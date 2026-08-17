import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/lib/use-auth";

export interface PlaceFavorite {
  id: string;
  user_id: string;
  place_id: string;
  created_at: string;
}

export interface FavoritedByFriend {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  avatar_source: "google" | "upload" | "initials";
}

/** All of my favorite place ids. */
export function useMyFavoritePlaceIds() {
  const { user } = useUser();
  return useQuery({
    queryKey: ["my-favorite-place-ids", user?.id ?? null],
    enabled: !!user,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from("place_favorites")
        .select("place_id")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []).map((r) => r.place_id);
    },
  });
}

export function useIsFavorite(placeId: string) {
  const { data: ids } = useMyFavoritePlaceIds();
  return (ids ?? []).includes(placeId);
}

export function useToggleFavorite() {
  const qc = useQueryClient();
  const { user } = useUser();
  return useMutation({
    mutationFn: async ({ placeId, on }: { placeId: string; on: boolean }) => {
      if (!user) throw new Error("Musisz być zalogowany");
      if (on) {
        const { error } = await supabase
          .from("place_favorites")
          .insert({ user_id: user.id, place_id: placeId });
        if (error && !String(error.message).includes("duplicate")) throw error;
      } else {
        const { error } = await supabase
          .from("place_favorites")
          .delete()
          .eq("user_id", user.id)
          .eq("place_id", placeId);
        if (error) throw error;
      }
    },
    onMutate: async ({ placeId, on }) => {
      // Optimistically update id list + counts so UI flips instantly.
      await qc.cancelQueries({ queryKey: ["my-favorite-place-ids"] });
      await qc.cancelQueries({ queryKey: ["place-favorite-counts"] });

      const prevIds = qc.getQueryData<string[]>(["my-favorite-place-ids", user?.id ?? null]);
      qc.setQueryData<string[]>(["my-favorite-place-ids", user?.id ?? null], (cur) => {
        const list = cur ?? [];
        if (on) return list.includes(placeId) ? list : [...list, placeId];
        return list.filter((id) => id !== placeId);
      });

      const prevCounts = qc.getQueryData<Record<string, number>>(["place-favorite-counts"]);
      qc.setQueryData<Record<string, number>>(["place-favorite-counts"], (cur) => {
        const next = { ...(cur ?? {}) };
        const delta = on ? 1 : -1;
        next[placeId] = Math.max(0, (next[placeId] ?? 0) + delta);
        return next;
      });

      return { prevIds, prevCounts };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prevIds) qc.setQueryData(["my-favorite-place-ids", user?.id ?? null], ctx.prevIds);
      if (ctx?.prevCounts) qc.setQueryData(["place-favorite-counts"], ctx.prevCounts);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["my-favorite-place-ids"] });
      qc.invalidateQueries({ queryKey: ["my-favorite-places"] });
      qc.invalidateQueries({ queryKey: ["friends-favorited"] });
      qc.invalidateQueries({ queryKey: ["place-favorite-counts"] });
    },
  });
}

/** Map of placeId -> number of users who favorited it. */
export function useFavoriteCounts() {
  return useQuery({
    queryKey: ["place-favorite-counts"],
    queryFn: async (): Promise<Record<string, number>> => {
      const { data, error } = await supabase
        .from("place_favorites")
        .select("place_id");
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const row of data ?? []) {
        counts[row.place_id] = (counts[row.place_id] ?? 0) + 1;
      }
      return counts;
    },
    staleTime: 30_000,
  });
}

export function useFavoriteCount(placeId: string) {
  const { data } = useFavoriteCounts();
  return data?.[placeId] ?? 0;
}


/** Friends (accepted) who favorited a given place. */
export function useFriendsWhoFavorited(placeId: string) {
  const { user } = useUser();
  return useQuery({
    queryKey: ["friends-favorited", placeId, user?.id ?? null],
    enabled: !!user && !!placeId,
    queryFn: async (): Promise<FavoritedByFriend[]> => {
      const { data: fs, error: fErr } = await supabase
        .from("friendships")
        .select("requester_id, addressee_id")
        .eq("status", "accepted");
      if (fErr) throw fErr;
      const friendIds = (fs ?? [])
        .map((f) => (f.requester_id === user!.id ? f.addressee_id : f.requester_id))
        .filter((id): id is string => !!id);
      if (friendIds.length === 0) return [];
      const { data: favs, error: favErr } = await supabase
        .from("place_favorites")
        .select("user_id")
        .eq("place_id", placeId)
        .in("user_id", friendIds);
      if (favErr) throw favErr;
      const userIds = (favs ?? []).map((f) => f.user_id);
      if (userIds.length === 0) return [];
      const { data: profiles, error: pErr } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, avatar_source")
        .in("id", userIds);
      if (pErr) throw pErr;
      return (profiles ?? []).map((p) => ({
        user_id: p.id,
        username: p.username,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
        avatar_source: p.avatar_source as "google" | "upload" | "initials",
      }));
    },
  });
}

/** Full place objects favorited by current user. */
export function useMyFavoritePlaces() {
  const { user } = useUser();
  return useQuery({
    queryKey: ["my-favorite-places", user?.id ?? null],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("place_favorites")
        .select("created_at, place:places(id, slug, name, cuisine, address, cover_image_url)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? [])
        .map((row) => (row as unknown as { place: { id: string; slug: string; name: string; cuisine: string; address: string; cover_image_url: string | null } | null }).place)
        .filter((p): p is NonNullable<typeof p> => !!p);
    },
  });
}
