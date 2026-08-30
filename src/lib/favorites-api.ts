import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/lib/use-auth";
import { trackEvent } from "@/lib/analytics";

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
  is_vip: boolean;
  vip_until: string | null;
  vip_nick_color: string | null;
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
  const { user } = useUser();
  // Reads the same cache entry useMyFavoritePlaceIds() populates (identical
  // queryKey/queryFn/enabled), but `select` means this only re-renders when
  // its own derived boolean actually flips - not on every toggle anywhere in
  // the list, which is what happened when every caller subscribed to the raw
  // array and React Query re-renders on any reference change to it.
  const { data: isFav } = useQuery({
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
    select: (ids) => ids.includes(placeId),
  });
  return isFav ?? false;
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
      // "user-favorite-places" (visits-api.ts's useUserFavoritePlaces) is a
      // separate query key for the same place_favorites table - used by
      // moje-miejsca's "Ulubione" tab and the sidebar/nav stat chips. Without
      // this, favoriting/unfavoriting anywhere else left those stale until an
      // unrelated refetch or full reload happened to touch them.
      qc.invalidateQueries({ queryKey: ["user-favorite-places"] });
      qc.invalidateQueries({ queryKey: ["friends-favorited"] });
      qc.invalidateQueries({ queryKey: ["place-favorite-counts"] });
      // A new favorite is its own wall-feed item (and unfavoriting removes
      // it) - without this it could miss the feed for up to its staleTime.
      qc.invalidateQueries({ queryKey: ["wall-feed"] });
    },
    onSuccess: (_d, { placeId, on }) => {
      if (on) trackEvent("favorite_place", { item_id: placeId });
    },
  });
}

/** Map of placeId -> number of users who favorited it. */
export function useFavoriteCounts() {
  return useQuery({
    queryKey: ["place-favorite-counts"],
    queryFn: async (): Promise<Record<string, number>> => {
      const { data, error } = await supabase.from("place_favorites").select("place_id");
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
/**
 * How many of my friends favourited each place, for every place at once.
 *
 * useFriendsWhoFavorited answers the same question for a single place, which
 * is right on a place profile and wrong on a map: one query per pin would be
 * dozens of round trips. This is two queries total, and feeds both the
 * "U znajomych" map layer and the count badge on the pins.
 */
export function useFriendFavoriteCounts() {
  const { user } = useUser();
  return useQuery({
    queryKey: ["friend-favorite-counts", user?.id ?? null],
    enabled: !!user,
    queryFn: async (): Promise<Map<string, number>> => {
      const { data: fs, error: fErr } = await supabase
        .from("friendships")
        .select("requester_id, addressee_id")
        .eq("status", "accepted");
      if (fErr) throw fErr;
      const friendIds = (fs ?? [])
        .map((f) => (f.requester_id === user!.id ? f.addressee_id : f.requester_id))
        .filter((id): id is string => !!id);
      if (friendIds.length === 0) return new Map();
      const { data: favs, error } = await supabase
        .from("place_favorites")
        .select("place_id")
        .in("user_id", friendIds);
      if (error) throw error;
      const counts = new Map<string, number>();
      (favs ?? []).forEach((f) => {
        counts.set(f.place_id, (counts.get(f.place_id) ?? 0) + 1);
      });
      return counts;
    },
  });
}

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
        .select(
          "id, username, display_name, avatar_url, avatar_source, is_vip, vip_until, vip_nick_color",
        )
        .in("id", userIds);
      if (pErr) throw pErr;
      return (profiles ?? []).map((p) => ({
        user_id: p.id,
        username: p.username,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
        avatar_source: p.avatar_source as "google" | "upload" | "initials",
        is_vip: p.is_vip,
        vip_until: p.vip_until,
        vip_nick_color: p.vip_nick_color,
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
        .select("created_at, place:places(id, slug, name, cuisine, address, avatar_url, cover_image_url)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? [])
        .map(
          (row) =>
            (
              row as unknown as {
                place: {
                  id: string;
                  slug: string;
                  name: string;
                  cuisine: string;
                  address: string;
                  avatar_url: string | null;
                  cover_image_url: string | null;
                } | null;
              }
            ).place,
        )
        .filter((p): p is NonNullable<typeof p> => !!p);
    },
  });
}
