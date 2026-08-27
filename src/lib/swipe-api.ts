import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/lib/use-auth";
import { usePlaces } from "@/lib/places-api";
import { useMyVisitStatuses } from "@/lib/visits-api";
import { useMyFavoritePlaceIds } from "@/lib/favorites-api";

const SKIP_COOLDOWN_DAYS = 5;

/** Place ids this user skipped in the last SKIP_COOLDOWN_DAYS - excluded from the deck. */
export function useSkippedPlaceIds() {
  const { user } = useUser();
  return useQuery({
    queryKey: ["swipe-skips", user?.id ?? null],
    enabled: !!user,
    queryFn: async (): Promise<Set<string>> => {
      const sinceIso = new Date(Date.now() - SKIP_COOLDOWN_DAYS * 86400000).toISOString();
      const { data, error } = await supabase
        .from("place_swipe_skips")
        .select("place_id")
        .eq("user_id", user!.id)
        .gte("skipped_at", sinceIso);
      if (error) throw error;
      return new Set((data ?? []).map((r) => r.place_id as string));
    },
  });
}

export function useSkipPlace() {
  const qc = useQueryClient();
  const { user } = useUser();
  return useMutation({
    mutationFn: async (placeId: string) => {
      if (!user) throw new Error("Musisz być zalogowany");
      const { error } = await supabase
        .from("place_swipe_skips")
        .upsert({ user_id: user.id, place_id: placeId, skipped_at: new Date().toISOString() });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["swipe-skips"] });
    },
  });
}

/** Reverses a skip. A mis-swipe used to exile a place for the full cooldown with
 *  no way back, so undo has to delete the row rather than shorten it. */
export function useUnskipPlace() {
  const qc = useQueryClient();
  const { user } = useUser();
  return useMutation({
    mutationFn: async (placeId: string) => {
      if (!user) throw new Error("Musisz być zalogowany");
      const { error } = await supabase
        .from("place_swipe_skips")
        .delete()
        .eq("user_id", user.id)
        .eq("place_id", placeId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["swipe-skips"] });
    },
  });
}

/** Small deterministic PRNG-based shuffle - stable per seed, no Math.random(). */
function seededShuffle<T>(items: T[], seed: string): T[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const rand = () => {
    h = (h * 1103515245 + 12345) & 0x7fffffff;
    return h / 0x7fffffff;
  };
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Places the user hasn't reacted to yet - no "chcę odwiedzić"/odwiedzone/ulubione,
 * and not skipped in the last 5 days. Shuffled once per day so the order is stable
 * across re-renders/refetches but varies day to day. */
export function useSwipeDeck() {
  const { user } = useUser();
  const placesQ = usePlaces();
  const statusesQ = useMyVisitStatuses();
  const favIdsQ = useMyFavoritePlaceIds();
  const skippedQ = useSkippedPlaceIds();

  const isLoading =
    placesQ.isLoading || statusesQ.isLoading || favIdsQ.isLoading || skippedQ.isLoading;

  const deck = useMemo(() => {
    const places = (placesQ.data ?? []).filter((p) => p.is_published !== false);
    const statuses = statusesQ.data ?? {};
    const favIds = new Set(favIdsQ.data ?? []);
    const skipped = skippedQ.data ?? new Set<string>();
    const undecided = places.filter((p) => {
      if (skipped.has(p.id) || favIds.has(p.id)) return false;
      const s = statuses[p.id];
      if (s?.has("want") || s?.has("visited")) return false;
      return true;
    });
    const today = new Date().toISOString().slice(0, 10);
    return seededShuffle(undecided, `${user?.id ?? "anon"}-${today}`);
  }, [placesQ.data, statusesQ.data, favIdsQ.data, skippedQ.data, user?.id]);

  return { deck, isLoading };
}
