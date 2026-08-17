import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/lib/use-auth";

export interface ReviewReply {
  id: string;
  review_id: string;
  place_id: string;
  owner_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

/** Wszystkie odpowiedzi wlasciciela dla knajpy (map po review_id). */
export function usePlaceReviewReplies(placeId: string | undefined) {
  return useQuery({
    queryKey: ["review-replies", placeId ?? null],
    enabled: !!placeId,
    queryFn: async (): Promise<Record<string, ReviewReply>> => {
      const { data, error } = await supabase
        .from("review_replies")
        .select("*")
        .eq("place_id", placeId!);
      if (error) throw error;
      const map: Record<string, ReviewReply> = {};
      for (const r of (data ?? []) as ReviewReply[]) map[r.review_id] = r;
      return map;
    },
  });
}

export function useUpsertReviewReply(placeId: string) {
  const qc = useQueryClient();
  const { user } = useUser();
  return useMutation({
    mutationFn: async ({
      reviewId,
      content,
      existingId,
    }: {
      reviewId: string;
      content: string;
      existingId?: string;
    }) => {
      if (!user) throw new Error("Nie zalogowano");
      if (existingId) {
        const { error } = await supabase
          .from("review_replies")
          .update({ content })
          .eq("id", existingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("review_replies").insert({
          review_id: reviewId,
          place_id: placeId,
          owner_id: user.id,
          content,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["review-replies", placeId] }),
  });
}

export function useDeleteReviewReply(placeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("review_replies").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["review-replies", placeId] }),
  });
}
