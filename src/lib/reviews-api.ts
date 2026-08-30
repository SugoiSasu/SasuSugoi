import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { trackEvent } from "@/lib/analytics";
import { useUser } from "@/lib/use-auth";

/** A friend's review counts as a recommendation from this rating up. */
const RECOMMEND_THRESHOLD = 4;

export interface Review {
  id: string;
  place_id: string;
  user_id: string;
  rating: number;
  body: string | null;
  photo_url: string | null;
  created_at: string;
  updated_at: string;
  author?: {
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
    avatar_source: "google" | "upload" | "initials";
    is_vip: boolean;
    vip_until: string | null;
    vip_nick_color: string | null;
  } | null;
}

export interface ReviewInput {
  place_id: string;
  rating: number;
  body?: string | null;
  photo_url?: string | null;
}

export function usePlaceReviews(placeId: string | undefined) {
  return useQuery({
    queryKey: ["place-reviews", placeId ?? null],
    enabled: !!placeId,
    queryFn: async (): Promise<Review[]> => {
      const { data: rows, error } = await supabase
        .from("reviews")
        .select("id, place_id, user_id, rating, body, photo_url, created_at, updated_at")
        .eq("place_id", placeId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const reviews = (rows ?? []) as Review[];
      const userIds = Array.from(new Set(reviews.map((r) => r.user_id)));
      if (userIds.length === 0) return reviews;
      const { data: authors } = await supabase
        .from("profiles")
        .select(
          "id, username, display_name, avatar_url, avatar_source, is_vip, vip_until, vip_nick_color",
        )
        .in("id", userIds);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const byId = new Map<string, any>((authors ?? []).map((a) => [a.id, a]));
      return reviews.map((r) => ({ ...r, author: byId.get(r.user_id) ?? null }));
    },
  });
}

export function useMyReviewForPlace(
  placeId: string | undefined,
  userId: string | undefined | null,
) {
  return useQuery({
    queryKey: ["my-review", placeId ?? null, userId ?? null],
    enabled: !!placeId && !!userId,
    queryFn: async (): Promise<Review | null> => {
      const { data, error } = await supabase
        .from("reviews")
        .select("*")
        .eq("place_id", placeId!)
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return (data as Review) ?? null;
    },
  });
}

export function useUserReviews(userId: string | undefined | null) {
  return useQuery({
    queryKey: ["user-reviews", userId ?? null],
    enabled: !!userId,
    queryFn: async (): Promise<
      (Review & { place: { id: string; slug: string; name: string; cuisine: string } | null })[]
    > => {
      const { data, error } = await supabase
        .from("reviews")
        .select("*, place:places(id, slug, name, cuisine)")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data ?? []) as any;
    },
  });
}

export function useSaveReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: ReviewInput }) => {
      const { data: me } = await supabase.auth.getUser();
      if (!me.user) throw new Error("Nie zalogowano");
      if (id) {
        const { error } = await supabase.from("reviews").update(values).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("reviews").insert({ ...values, user_id: me.user.id });
        if (error) throw error;
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["place-reviews", vars.values.place_id] });
      qc.invalidateQueries({ queryKey: ["my-review", vars.values.place_id] });
      qc.invalidateQueries({ queryKey: ["user-reviews"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
      // A new review is its own wall-feed item - without this, writing a
      // review and immediately checking /wall could miss it for up to the
      // feed's staleTime (own-activity should always feel instant).
      qc.invalidateQueries({ queryKey: ["wall-feed"] });
      if (!vars.id) {
        trackEvent("write_review", { item_id: vars.values.place_id, rating: vars.values.rating });
      }
    },
  });
}

export function useDeleteReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("reviews").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["place-reviews"] });
      qc.invalidateQueries({ queryKey: ["my-review"] });
      qc.invalidateQueries({ queryKey: ["user-reviews"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}

/** Upload review photo to private bucket; returns storage path. */
export async function uploadReviewPhoto(userId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage
    .from("review-photos")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return path;
}

export function useReviewPhotoUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: ["review-photo-url", path ?? null],
    enabled: !!path,
    staleTime: 1000 * 60 * 30,
    queryFn: async () => {
      if (!path) return null;
      if (path.startsWith("http")) return path;
      const { data, error } = await supabase.storage
        .from("review-photos")
        .createSignedUrl(path, 60 * 60 * 24 * 7);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}

/** Map of placeId -> how many of my friends left a >=4-star review. Same
 *  batched-pair-of-queries shape as useFriendFavoriteCounts (favorites-api.ts)
 *  and useFriendVisitedCounts (visits-api.ts) - one round trip for the whole
 *  deck/map instead of one per place. */
export function useFriendRecommendCounts() {
  const { user } = useUser();
  return useQuery({
    queryKey: ["friend-recommend-counts", user?.id ?? null],
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
      const { data: reviews, error } = await supabase
        .from("reviews")
        .select("place_id")
        .gte("rating", RECOMMEND_THRESHOLD)
        .in("user_id", friendIds);
      if (error) throw error;
      const counts = new Map<string, number>();
      (reviews ?? []).forEach((r) => {
        counts.set(r.place_id, (counts.get(r.place_id) ?? 0) + 1);
      });
      return counts;
    },
  });
}

/** Aggregated stats for a place. */
export function usePlaceReviewStats(placeId: string | undefined) {
  const { data: reviews } = usePlaceReviews(placeId);
  const list = reviews ?? [];
  const count = list.length;
  const avg =
    count === 0 ? null : Math.round((list.reduce((s, r) => s + r.rating, 0) / count) * 10) / 10;
  return { count, avg };
}

/** Stats for a user profile. */
export function useUserReviewStats(userId: string | undefined | null) {
  return useQuery({
    queryKey: ["user-review-stats", userId ?? null],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select("place_id")
        .eq("user_id", userId!);
      if (error) throw error;
      const rows = data ?? [];
      const uniquePlaces = new Set(rows.map((r) => r.place_id)).size;
      return { reviewsCount: rows.length, uniquePlaces };
    },
  });
}
