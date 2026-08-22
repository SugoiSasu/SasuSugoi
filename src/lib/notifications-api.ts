import { useEffect, useRef, useState } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "./use-auth";
import { reportLovableError } from "./lovable-error-reporting";

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  ref_type: string | null;
  ref_id: string | null;
  read_at: string | null;
  created_at: string;
}

export const NOTIFICATION_TYPES = [
  "friend_request",
  "friend_accepted",
  "place_post",
  "achievement",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

const PAGE_SIZE = 15;

// ---------------------------------------------------------------------------
// Lightweight monitoring: log + forward to Lovable error capture
// ---------------------------------------------------------------------------
export interface NotifLogEntry {
  level: "info" | "warn" | "error";
  message: string;
  at: string;
  ctx: Record<string, unknown>;
}

const LOG_BUFFER_MAX = 100;
const logBuffer: NotifLogEntry[] = [];
const logListeners = new Set<(entries: NotifLogEntry[]) => void>();

function pushLog(entry: NotifLogEntry) {
  logBuffer.unshift(entry);
  if (logBuffer.length > LOG_BUFFER_MAX) logBuffer.length = LOG_BUFFER_MAX;
  logListeners.forEach((fn) => { try { fn([...logBuffer]); } catch { /* noop */ } });
}

export function useNotificationsLog(): NotifLogEntry[] {
  const [entries, setEntries] = useState<NotifLogEntry[]>([...logBuffer]);
  useEffect(() => {
    logListeners.add(setEntries);
    return () => { logListeners.delete(setEntries); };
  }, []);
  return entries;
}

function logNotifEvent(
  level: "info" | "warn" | "error",
  message: string,
  ctx: Record<string, unknown> = {},
) {
  const entry: NotifLogEntry = { level, message, ctx, at: new Date().toISOString() };
  pushLog(entry);
  const payload = { module: "notifications", message, ...ctx, at: entry.at };
  if (level === "error") {
    // eslint-disable-next-line no-console
    console.error("[notifications]", payload);
    reportLovableError(new Error(`[notifications] ${message}`), payload);
  } else if (level === "warn") {
    // eslint-disable-next-line no-console
    console.warn("[notifications]", payload);
  } else {
    // eslint-disable-next-line no-console
    console.debug("[notifications]", payload);
  }
}

// ---------------------------------------------------------------------------
// Realtime status (shared so polling can speed up when realtime is down)
// ---------------------------------------------------------------------------
export type RealtimeStatus = "idle" | "connecting" | "connected" | "error";
let realtimeStatus: RealtimeStatus = "idle";
const statusListeners = new Set<(s: RealtimeStatus) => void>();
function setRealtimeStatus(s: RealtimeStatus) {
  if (realtimeStatus === s) return;
  realtimeStatus = s;
  statusListeners.forEach((fn) => {
    try { fn(s); } catch { /* noop */ }
  });
}
export function useRealtimeStatus(): RealtimeStatus {
  const [s, setS] = useState<RealtimeStatus>(realtimeStatus);
  useEffect(() => {
    statusListeners.add(setS);
    return () => { statusListeners.delete(setS); };
  }, []);
  return s;
}

// ---------------------------------------------------------------------------
// Bell dropdown query (top N, with realtime + adaptive polling fallback)
// ---------------------------------------------------------------------------
export function useNotifications(limit = 30) {
  const { user } = useUser();
  const qc = useQueryClient();
  const rtStatus = useRealtimeStatus();
  const subscribedAtRef = useRef<number>(0);

  useEffect(() => {
    if (!user) return;
    setRealtimeStatus("connecting");
    subscribedAtRef.current = Date.now();

    const channelId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const ch = supabase
      .channel(`notifications:${user.id}:${channelId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => {
          qc.invalidateQueries({ queryKey: ["notifications", user.id] });
          qc.invalidateQueries({ queryKey: ["notifications-page", user.id] });
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setRealtimeStatus("connected");
          logNotifEvent("info", "realtime subscribed", { userId: user.id });
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setRealtimeStatus("error");
          logNotifEvent("warn", "realtime status", { status, userId: user.id });
        }
      });

    // Safety: if we never reach SUBSCRIBED within 8s, treat as error so polling speeds up.
    const t = setTimeout(() => {
      if (realtimeStatus !== "connected") {
        setRealtimeStatus("error");
        logNotifEvent("warn", "realtime did not connect within 8s - using polling fallback", {
          userId: user.id,
        });
      }
    }, 8_000);

    return () => {
      clearTimeout(t);
      supabase.removeChannel(ch);
      setRealtimeStatus("idle");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- user.id (not the user object,
    // whose reference changes on every onAuthStateChange tick) is what should retrigger this.
  }, [user?.id, qc]);

  // Fallback polling: 15s when realtime not connected, 60s when healthy.
  const refetchInterval = rtStatus === "connected" ? 60_000 : 15_000;

  return useQuery({
    queryKey: ["notifications", user?.id ?? null],
    enabled: !!user,
    refetchInterval,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<Notification[]> => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
          .from("notifications")
          .select("*")
          .eq("user_id", user!.id)
          .order("created_at", { ascending: false })
          .limit(limit);
        if (error) throw error;
        return (data ?? []) as Notification[];
      } catch (err) {
        logNotifEvent("error", "fetch failed", { err: String(err), userId: user?.id });
        throw err;
      }
    },
  });
}

export function useUnreadCount() {
  const { data } = useNotifications();
  return (data ?? []).filter((n) => !n.read_at).length;
}

// ---------------------------------------------------------------------------
// Full notifications page: infinite query + type filter
// ---------------------------------------------------------------------------
export interface NotificationsPage {
  items: Notification[];
  nextCursor: string | null; // ISO created_at of the last item if more
}

export function useNotificationsInfinite(filter: NotificationType | "all" = "all") {
  const { user } = useUser();
  const rtStatus = useRealtimeStatus();

  return useInfiniteQuery<NotificationsPage, Error, InfiniteData<NotificationsPage>, readonly unknown[], string | null>({
    queryKey: ["notifications-page", user?.id ?? null, filter],
    enabled: !!user,
    initialPageParam: null,
    refetchInterval: rtStatus === "connected" ? 60_000 : 20_000,
    queryFn: async ({ pageParam }) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let q = (supabase as any)
          .from("notifications")
          .select("*")
          .eq("user_id", user!.id)
          .order("created_at", { ascending: false })
          .limit(PAGE_SIZE);
        if (filter !== "all") q = q.eq("type", filter);
        if (pageParam) q = q.lt("created_at", pageParam);
        const { data, error } = await q;
        if (error) throw error;
        const items = (data ?? []) as Notification[];
        const nextCursor =
          items.length === PAGE_SIZE ? items[items.length - 1].created_at : null;
        return { items, nextCursor };
      } catch (err) {
        logNotifEvent("error", "infinite fetch failed", {
          err: String(err),
          userId: user?.id,
          filter,
        });
        throw err;
      }
    },
    getNextPageParam: (last) => last.nextCursor,
  });
}

// ---------------------------------------------------------------------------
// Mark read
// ---------------------------------------------------------------------------
export function useMarkRead() {
  const { user } = useUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[] | "all") => {
      if (!user) return;
      if (Array.isArray(ids) && ids.length === 0) return;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const base = (supabase as any)
          .from("notifications")
          .update({ read_at: new Date().toISOString() })
          .eq("user_id", user.id)
          .is("read_at", null);
        const { error } = ids === "all" ? await base : await base.in("id", ids);
        if (error) throw error;
      } catch (err) {
        logNotifEvent("error", "mark read failed", { err: String(err), userId: user?.id });
        throw err;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications", user?.id ?? null] });
      qc.invalidateQueries({ queryKey: ["notifications-page", user?.id ?? null] });
    },
  });
}

export const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  friend_request: "Zaproszenia",
  friend_accepted: "Nowe znajomości",
  place_post: "Wpisy lokali",
  achievement: "Odznaki",
};
