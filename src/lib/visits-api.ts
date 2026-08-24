import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/lib/use-auth";

export type VisitStatus = "want" | "visited";

export interface VisitedPlace {
  id: string;
  slug: string | null;
  name: string;
  cuisine: string;
  address: string;
  avatar_url: string | null;
  cover_image_url: string | null;
  lat?: number | null;
  lng?: number | null;
  added_at?: string;
}

/** All my (placeId -> set of statuses). */
export function useMyVisitStatuses() {
  const { user } = useUser();
  return useQuery({
    queryKey: ["my-visit-statuses", user?.id ?? null],
    enabled: !!user,
    queryFn: async (): Promise<Record<string, Set<VisitStatus>>> => {
      const { data, error } = await supabase
        .from("place_visits")
        .select("place_id, status")
        .eq("user_id", user!.id);
      if (error) throw error;
      const map: Record<string, Set<VisitStatus>> = {};
      for (const row of data ?? []) {
        (map[row.place_id] ??= new Set()).add(row.status as VisitStatus);
      }
      return map;
    },
  });
}

export function useMyVisitStatus(placeId: string, status: VisitStatus) {
  const { data } = useMyVisitStatuses();
  return data?.[placeId]?.has(status) ?? false;
}

export function useToggleVisit() {
  const qc = useQueryClient();
  const { user } = useUser();
  return useMutation({
    mutationFn: async ({ placeId, status, on }: { placeId: string; status: VisitStatus; on: boolean }) => {
      if (!user) throw new Error("Musisz być zalogowany");
      if (on) {
        const { error } = await supabase
          .from("place_visits")
          .insert({ user_id: user.id, place_id: placeId, status });
        if (error && !String(error.message).includes("duplicate")) throw error;
      } else {
        const { error } = await supabase
          .from("place_visits")
          .delete()
          .eq("user_id", user.id)
          .eq("place_id", placeId)
          .eq("status", status);
        if (error) throw error;
      }
    },
    onMutate: async ({ placeId, status, on }) => {
      await qc.cancelQueries({ queryKey: ["my-visit-statuses"] });
      const key = ["my-visit-statuses", user?.id ?? null];
      const prev = qc.getQueryData<Record<string, Set<VisitStatus>>>(key);
      qc.setQueryData<Record<string, Set<VisitStatus>>>(key, (cur) => {
        const next: Record<string, Set<VisitStatus>> = {};
        for (const [k, v] of Object.entries(cur ?? {})) next[k] = new Set(v);
        const set = next[placeId] ?? new Set<VisitStatus>();
        if (on) set.add(status);
        else set.delete(status);
        if (set.size === 0) delete next[placeId];
        else next[placeId] = set;
        return next;
      });
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["my-visit-statuses", user?.id ?? null], ctx.prev);
    },
    onSettled: (_d, _e, vars) => {
      qc.invalidateQueries({ queryKey: ["my-visit-statuses"] });
      qc.invalidateQueries({ queryKey: ["user-visited-places"] });
      if (vars) qc.invalidateQueries({ queryKey: ["user-visited-places", vars.status] });
    },
  });
}

/** Full place objects for a given user + status (publicly readable). */
export function useUserVisitedPlaces(userId: string | undefined, status: VisitStatus) {
  return useQuery({
    queryKey: ["user-visited-places", status, userId ?? null],
    enabled: !!userId,
    queryFn: async (): Promise<VisitedPlace[]> => {
      const { data, error } = await supabase
        .from("place_visits")
        .select("created_at, place:places(id, slug, name, cuisine, address, avatar_url, cover_image_url, lat, lng)")
        .eq("user_id", userId!)
        .eq("status", status)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as unknown as Array<{ created_at: string; place: VisitedPlace | null }>;
      return rows
        .filter((r): r is { created_at: string; place: VisitedPlace } => !!r.place)
        .map((r) => ({ ...r.place, added_at: r.created_at }));
    },
  });
}

/** Public: place_favorites by any user id. */
export function useUserFavoritePlaces(userId: string | undefined) {
  return useQuery({
    queryKey: ["user-favorite-places", userId ?? null],
    enabled: !!userId,
    queryFn: async (): Promise<VisitedPlace[]> => {
      const { data, error } = await supabase
        .from("place_favorites")
        .select("created_at, place:places(id, slug, name, cuisine, address, avatar_url, cover_image_url, lat, lng)")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as unknown as Array<{ created_at: string; place: VisitedPlace | null }>;
      return rows
        .filter((r): r is { created_at: string; place: VisitedPlace } => !!r.place)
        .map((r) => ({ ...r.place, added_at: r.created_at }));
    },
  });
}
