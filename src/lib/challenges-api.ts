import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ChallengeCriteriaType =
  "cuisine_reviews" | "new_places_reviewed" | "unique_cuisines_reviewed";

export interface ChallengeCriteria {
  type: ChallengeCriteriaType;
  cuisine?: string;
  threshold: number;
  window_days: number;
}

export interface Challenge {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  icon: string | null;
  criteria: ChallengeCriteria;
  starts_at: string | null;
  ends_at: string | null;
  enabled: boolean;
  sort_order: number;
}

export interface UserChallengeCompletion {
  id: string;
  user_id: string;
  challenge_id: string;
  completed_at: string;
}

const CHALLENGE_COLUMNS =
  "id, slug, title, description, icon, criteria, starts_at, ends_at, enabled, sort_order";

export function useChallenges() {
  return useQuery({
    queryKey: ["challenges"],
    queryFn: async (): Promise<Challenge[]> => {
      const { data, error } = await supabase
        .from("challenges")
        .select(CHALLENGE_COLUMNS)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Challenge[];
    },
  });
}

export function useMyChallengeCompletions(userId: string | null | undefined) {
  return useQuery({
    queryKey: ["user-challenge-completions", userId ?? null],
    enabled: !!userId,
    queryFn: async (): Promise<UserChallengeCompletion[]> => {
      const { data, error } = await supabase
        .from("user_challenge_completions")
        .select("id, user_id, challenge_id, completed_at")
        .eq("user_id", userId!);
      if (error) throw error;
      return (data ?? []) as UserChallengeCompletion[];
    },
  });
}

export function useSaveChallenge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: Omit<Challenge, "id"> }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payload = values as any;
      if (id) {
        const { error } = await supabase.from("challenges").update(payload).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("challenges").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["challenges"] }),
  });
}

export function useDeleteChallenge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("challenges").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["challenges"] }),
  });
}
