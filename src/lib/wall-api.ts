import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/lib/use-auth";

export type WallItemKind = "review" | "favorite" | "achievement" | "place_post";

export interface WallAuthor {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  avatar_source: "google" | "upload" | "initials";
  is_vip: boolean;
  vip_until: string | null;
  vip_nick_color: string | null;
}

export interface WallPlace {
  id: string;
  slug: string | null;
  name: string;
  cuisine: string | null;
}

export interface WallItem {
  id: string;
  kind: WallItemKind;
  created_at: string;
  author?: WallAuthor | null;
  place?: WallPlace | null;
  /** Review body, post body, achievement name, etc. */
  text?: string | null;
  /** Review rating or similar. */
  rating?: number | null;
  /** Optional image for the item. */
  image_url?: string | null;
  /** Achievement name when kind === 'achievement'. */
  meta?: string | null;
}

/** Wall feed: activity from accepted friends + posts from places I favorited. */
export function useWallFeed() {
  const { user } = useUser();
  return useQuery({
    queryKey: ["wall-feed", user?.id ?? null],
    enabled: !!user,
    queryFn: async (): Promise<WallItem[]> => {
      const me = user!.id;

      // 1) friend ids
      const { data: fs } = await supabase
        .from("friendships")
        .select("requester_id, addressee_id")
        .eq("status", "accepted");
      const friendIds = (fs ?? [])
        .map((f) => (f.requester_id === me ? f.addressee_id : f.requester_id))
        .filter((id): id is string => !!id);

      // 2) followed + favorited + owned place ids (obserwowane knajpy pokazują wpisy na wallu, właściciele widzą swoje posty)
      const [{ data: favs }, { data: follows }, { data: owned }] = await Promise.all([
        supabase.from("place_favorites").select("place_id").eq("user_id", me),
        supabase.from("place_follows").select("place_id").eq("user_id", me),
        supabase.from("place_owners").select("place_id").eq("user_id", me).eq("verified", true),
      ]);
      const myPlaceIds = Array.from(
        new Set([
          ...(favs ?? []).map((r) => r.place_id),
          ...(follows ?? []).map((r) => r.place_id),
          ...(owned ?? []).map((r) => r.place_id),
        ]),
      );

      // Wall zawiera własną aktywność użytkownika (żeby autor widział swoje recenzje/posty na feedzie).
      const feedUserIds = Array.from(new Set([...friendIds, me]));

      const sinceIso = new Date(Date.now() - 1000 * 60 * 60 * 24 * 45).toISOString();
      const items: WallItem[] = [];

      // Helpers
      const profileIdsToFetch = new Set<string>(feedUserIds);
      const placeIdsToFetch = new Set<string>(myPlaceIds);

      // 3) friend reviews
      if (feedUserIds.length) {
        const { data: rvs } = await supabase
          .from("reviews")
          .select("id, user_id, place_id, body, rating, photo_url, created_at")
          .in("user_id", feedUserIds)
          .gte("created_at", sinceIso)
          .order("created_at", { ascending: false })
          .limit(50);
        (rvs ?? []).forEach((r) => {
          placeIdsToFetch.add(r.place_id);
          items.push({
            id: `review-${r.id}`,
            kind: "review",
            created_at: r.created_at,
            author: { id: r.user_id } as WallAuthor,
            place: { id: r.place_id } as WallPlace,
            text: r.body,
            rating: r.rating,
            image_url: r.photo_url,
          });
        });
      }

      // 4) friend favorites
      if (feedUserIds.length) {
        const { data: ffs } = await supabase
          .from("place_favorites")
          .select("id, user_id, place_id, created_at")
          .in("user_id", feedUserIds)
          .gte("created_at", sinceIso)
          .order("created_at", { ascending: false })
          .limit(50);
        (ffs ?? []).forEach((f) => {
          placeIdsToFetch.add(f.place_id);
          items.push({
            id: `fav-${f.id}`,
            kind: "favorite",
            created_at: f.created_at,
            author: { id: f.user_id } as WallAuthor,
            place: { id: f.place_id } as WallPlace,
          });
        });
      }

      // 5) friend achievements
      if (feedUserIds.length) {
        const { data: uas } = await supabase
          .from("user_achievements")
          .select("id, user_id, achievement_id, unlocked_at")
          .in("user_id", feedUserIds)
          .gte("unlocked_at", sinceIso)
          .order("unlocked_at", { ascending: false })
          .limit(50);
        const achIds = Array.from(new Set((uas ?? []).map((u) => u.achievement_id)));
        const achMap = new Map<string, string>();
        if (achIds.length) {
          const { data: achs } = await supabase
            .from("achievements")
            .select("id, name")
            .in("id", achIds);
          (achs ?? []).forEach((a) => achMap.set(a.id, a.name));
        }
        (uas ?? []).forEach((u) => {
          items.push({
            id: `ach-${u.id}`,
            kind: "achievement",
            created_at: u.unlocked_at,
            author: { id: u.user_id } as WallAuthor,
            meta: achMap.get(u.achievement_id) ?? "Nowe osiągnięcie",
          });
        });
      }

      // 6) posts only from places the user follows (owners also see their own)
      const postsPlaceIds = Array.from(
        new Set([
          ...(follows ?? []).map((r) => r.place_id),
          ...(owned ?? []).map((r) => r.place_id),
        ]),
      );
      if (postsPlaceIds.length) {
        const { data: pps } = await supabase
          .from("place_posts")
          .select("id, place_id, title, body, image_url, created_at")
          .in("place_id", postsPlaceIds)
          .order("created_at", { ascending: false })
          .limit(50);
        (pps ?? []).forEach((p) => {
          placeIdsToFetch.add(p.place_id);
          items.push({
            id: `pp-${p.id}`,
            kind: "place_post",
            created_at: p.created_at,
            place: { id: p.place_id } as WallPlace,
            text: p.body,
            image_url: p.image_url,
            meta: p.title,
          });
        });
      }

      // 7) hydrate profiles and places
      if (profileIdsToFetch.size) {
        const { data: profs } = await supabase
          .from("profiles")
          .select(
            "id, username, display_name, avatar_url, avatar_source, is_vip, vip_until, vip_nick_color",
          )
          .in("id", Array.from(profileIdsToFetch));
        const map = new Map((profs ?? []).map((p) => [p.id, p as WallAuthor]));
        items.forEach((it) => {
          if (it.author?.id) it.author = map.get(it.author.id) ?? it.author;
        });
      }
      if (placeIdsToFetch.size) {
        const { data: pls } = await supabase
          .from("places")
          .select("id, slug, name, cuisine")
          .in("id", Array.from(placeIdsToFetch));
        const map = new Map(
          (pls ?? []).map((p) => [
            p.id,
            {
              id: p.id,
              slug: p.slug ?? null,
              name: p.name,
              cuisine: p.cuisine ?? null,
            } as WallPlace,
          ]),
        );
        items.forEach((it) => {
          if (it.place?.id) it.place = map.get(it.place.id) ?? it.place;
        });
      }

      items.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
      return items.slice(0, 80);
    },
  });
}

export interface SearchedUser {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  avatar_source: string | null;
}

export function useUserSearch(query: string) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: ["user-search", trimmed],
    enabled: trimmed.length >= 2,
    queryFn: async (): Promise<SearchedUser[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("search_users", { _query: trimmed });
      if (error) throw error;
      return (data ?? []) as SearchedUser[];
    },
  });
}
