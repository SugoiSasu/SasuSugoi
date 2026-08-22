import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bell, UserPlus, UserCheck, Newspaper, Trophy, CheckCheck, ArrowRight, WifiOff, AtSign, Heart, MessageCircle } from "lucide-react";
import { useUser } from "@/lib/use-auth";
import {
  useNotifications,
  useMarkRead,
  useRealtimeStatus,
  type Notification,
} from "@/lib/notifications-api";

const PREVIEW_STEP = 5;

function iconFor(type: string) {
  switch (type) {
    case "friend_request": return <UserPlus size={14} className="text-tomato" />;
    case "friend_accepted": return <UserCheck size={14} className="text-tomato" />;
    case "place_post": return <Newspaper size={14} className="text-tomato" />;
    case "achievement": return <Trophy size={14} className="text-tomato" />;
    case "review_tag": return <AtSign size={14} className="text-tomato" />;
    case "review_reaction": return <Heart size={14} className="text-tomato" />;
    case "review_comment": return <MessageCircle size={14} className="text-tomato" />;
    default: return <Bell size={14} className="text-tomato" />;
  }
}

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "teraz";
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h`;
  return `${Math.floor(diff / 86400)} d`;
}

export function NotificationBell() {
  const { user } = useUser();
  const { data } = useNotifications();
  const rtStatus = useRealtimeStatus();
  const offline = rtStatus === "error";
  const markRead = useMarkRead();
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(PREVIEW_STEP);
  const ref = useRef<HTMLDivElement>(null);
  const items = (data ?? []) as Notification[];
  const unread = items.filter((n) => !n.read_at).length;

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Auto mark-read shortly after opening (gives user a moment to see the dot)
  useEffect(() => {
    if (!open) return;
    setVisible(PREVIEW_STEP);
    const unreadIds = items.filter((n) => !n.read_at).map((n) => n.id);
    if (unreadIds.length === 0) return;
    const t = setTimeout(() => {
      markRead.mutate(unreadIds);
    }, 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!user) return null;
  const shown = items.slice(0, visible);
  const hasMore = visible < items.length;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={offline ? "Powiadomienia (offline)" : "Powiadomienia"}
        className="relative inline-flex items-center justify-center w-11 h-11 sm:w-9 sm:h-9 rounded-full hover:bg-card active:scale-95 transition"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-tomato text-cream text-[10px] font-bold grid place-items-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
        {offline && (
          <span
            title="Realtime offline - odpytujemy co 15 s"
            className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-background"
            aria-hidden
          />
        )}
      </button>

      {open && (
        <div className="fixed left-2 right-2 top-16 sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[360px] bg-card border border-border rounded-2xl shadow-xl overflow-hidden z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="font-semibold text-sm flex items-center gap-2">
              Powiadomienia
              {offline && (
                <span
                  title="Realtime niedostępne - używamy odpytywania co 15 s"
                  className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-600 bg-amber-500/10 border border-amber-500/30 rounded-full px-2 py-0.5"
                >
                  <WifiOff size={10} /> offline
                </span>
              )}
            </div>
            {unread > 0 && (
              <button
                onClick={() => markRead.mutate("all")}
                className="pz-hit inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-tomato"
              >
                <CheckCheck size={12} /> Oznacz wszystkie
              </button>
            )}
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                <Bell size={24} className="mx-auto mb-2 opacity-50" />
                Brak powiadomień
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {shown.map((n) => (
                  <li key={n.id}>
                    <NotificationRow
                      n={n}
                      onClick={() => {
                        setOpen(false);
                        if (!n.read_at) markRead.mutate([n.id]);
                      }}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="border-t border-border bg-background/40 px-3 py-2 flex items-center justify-between gap-2">
            {hasMore ? (
              <button
                type="button"
                onClick={() => setVisible((v) => v + PREVIEW_STEP)}
                className="text-xs text-muted-foreground hover:text-tomato"
              >
                Wczytaj więcej
              </button>
            ) : (
              <span className="text-[11px] text-muted-foreground">
                {items.length > 0 ? "To wszystko na razie" : ""}
              </span>
            )}
            <Link
              to="/notifications"
              onClick={() => setOpen(false)}
              className="inline-flex items-center gap-1 text-xs font-medium text-tomato hover:underline"
            >
              Zobacz wszystkie <ArrowRight size={12} />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function NotificationRow({ n, onClick }: { n: Notification; onClick: () => void }) {
  const className = `flex items-start gap-3 px-4 py-3 hover:bg-background/60 transition ${!n.read_at ? "bg-tomato/5" : ""}`;
  const content = (
    <>
      <span className="mt-0.5 shrink-0 w-7 h-7 rounded-full bg-tomato/10 grid place-items-center">
        {iconFor(n.type)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold truncate">{n.title}</div>
        {n.body && <div className="text-xs text-muted-foreground line-clamp-2">{n.body}</div>}
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">{timeAgo(n.created_at)}</div>
      </div>
      {!n.read_at && <span className="mt-1 w-2 h-2 rounded-full bg-tomato shrink-0" />}
    </>
  );
  if (n.link) {
    return (
      <Link to={n.link} onClick={onClick} className={className}>
        {content}
      </Link>
    );
  }
  return <button type="button" onClick={onClick} className={`${className} w-full text-left`}>{content}</button>;
}
