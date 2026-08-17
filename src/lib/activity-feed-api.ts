import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ActivityEvent = {
  id: string;
  type: "visited" | "favorited" | "reviewed";
  placeName: string;
  placeSlug: string;
  createdAt: string;
};

type Row = {
  id?: string;
  created_at: string;
  place: { id: string; name: string; slug: string | null } | null;
};

function mapRows(rows: Row[] | null, type: ActivityEvent["type"]): ActivityEvent[] {
  return (rows ?? [])
    .filter((r) => !!r.place)
    .map((r, i) => ({
      id: `${type}-${r.id ?? `${r.place!.id}-${i}`}-${r.created_at}`,
      type,
      placeName: r.place!.name,
      placeSlug: r.place!.slug ?? r.place!.id,
      createdAt: r.created_at,
    }));
}

/** Computed activity feed (visits + favorites + reviews), no dedicated table. */
export function useUserActivityFeed(userId: string | undefined, limit = 8) {
  return useQuery({
    queryKey: ["activity-feed", userId, limit],
    enabled: !!userId,
    queryFn: async (): Promise<ActivityEvent[]> => {
      const select = "id, created_at, place:places(id, name, slug)";
      const [visits, favorites, reviews] = await Promise.all([
        supabase
          .from("place_visits")
          .select(select)
          .eq("user_id", userId!)
          .eq("status", "visited")
          .order("created_at", { ascending: false })
          .limit(limit),
        supabase
          .from("place_favorites")
          .select(select)
          .eq("user_id", userId!)
          .order("created_at", { ascending: false })
          .limit(limit),
        supabase
          .from("reviews")
          .select(select)
          .eq("user_id", userId!)
          .order("created_at", { ascending: false })
          .limit(limit),
      ]);

      const events = [
        ...mapRows(visits.data as unknown as Row[] | null, "visited"),
        ...mapRows(favorites.data as unknown as Row[] | null, "favorited"),
        ...mapRows(reviews.data as unknown as Row[] | null, "reviewed"),
      ];

      return events
        .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
        .slice(0, limit);
    },
    staleTime: 60_000,
  });
}
