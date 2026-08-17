import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/lib/use-auth";

export type PlacePostType = "announcement" | "menu" | "event" | "promo" | "news";

export interface PlacePost {
  id: string;
  place_id: string;
  title: string;
  body: string | null;
  image_url: string | null;
  post_type: PlacePostType | string;
  owner_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlacePostInput {
  place_id: string;
  title: string;
  body?: string | null;
  image_url?: string | null;
  post_type?: PlacePostType;
}

export function useAllPlacePosts() {
  return useQuery({
    queryKey: ["place-posts-all"],
    queryFn: async (): Promise<PlacePost[]> => {
      const { data, error } = await supabase
        .from("place_posts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PlacePost[];
    },
  });
}

/** Posty konkretnej knajpy (chronologicznie, od najnowszych). */
export function usePlacePosts(placeId: string | undefined) {
  return useQuery({
    queryKey: ["place-posts", placeId ?? null],
    enabled: !!placeId,
    queryFn: async (): Promise<PlacePost[]> => {
      const { data, error } = await supabase
        .from("place_posts")
        .select("*")
        .eq("place_id", placeId!)
        .order("created_at", { ascending: false })
        .limit(40);
      if (error) throw error;
      return (data ?? []) as PlacePost[];
    },
  });
}

export function useUpsertPlacePost() {
  const qc = useQueryClient();
  const { user } = useUser();
  return useMutation({
    mutationFn: async (input: PlacePostInput & { id?: string }) => {
      const payload = {
        place_id: input.place_id,
        title: input.title,
        body: input.body ?? null,
        image_url: input.image_url ?? null,
        post_type: input.post_type ?? "announcement",
        owner_id: user?.id ?? null,
      };
      if (input.id) {
        const { error } = await supabase.from("place_posts").update(payload).eq("id", input.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("place_posts").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["place-posts-all"] });
      qc.invalidateQueries({ queryKey: ["place-posts", v.place_id] });
      qc.invalidateQueries({ queryKey: ["wall-feed"] });
    },
  });
}

export function useDeletePlacePost(placeId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("place_posts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["place-posts-all"] });
      if (placeId) qc.invalidateQueries({ queryKey: ["place-posts", placeId] });
      qc.invalidateQueries({ queryKey: ["wall-feed"] });
    },
  });
}
