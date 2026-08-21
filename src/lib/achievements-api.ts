import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Achievement {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon_url: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  criteria: any;
  sort_order: number;
  enabled: boolean;
}

export interface UserAchievement {
  id: string;
  user_id: string;
  achievement_id: string;
  unlocked_at: string;
}

export type CriteriaType = "reviews_count" | "unique_places" | "points_total" | "friends_count" | "referrals_count";

export const CRITERIA_LABELS: Record<CriteriaType, { unit: string; verb: string }> = {
  reviews_count: { unit: "recenzji", verb: "Dodaj" },
  unique_places: { unit: "unikalnych lokali", verb: "Odwiedź" },
  points_total: { unit: "punktów PoŻarcia", verb: "Zdobądź" },
  friends_count: { unit: "znajomych", verb: "Dodaj" },
  referrals_count: { unit: "zaproszonych znajomych", verb: "Zaproś" },
};

/** Shared achievement-progress formula - keep this the single source of truth
 * so /osiagniecia and /u/$username never drift apart. */
export function computeProgress(
  a: Achievement,
  stats: Record<CriteriaType, number>,
): {
  current: number;
  threshold: number;
  type: CriteriaType | null;
  pct: number;
  remaining: number;
} {
  const type = (a.criteria?.type ?? null) as CriteriaType | null;
  const threshold = Number(a.criteria?.threshold ?? 0) || 0;
  const current = type && type in stats ? stats[type] : 0;
  const pct = threshold > 0 ? Math.min(100, Math.round((current / threshold) * 100)) : 0;
  const remaining = Math.max(0, threshold - current);
  return { current, threshold, type, pct, remaining };
}

export function useAchievements() {
  return useQuery({
    queryKey: ["achievements"],
    queryFn: async (): Promise<Achievement[]> => {
      const { data, error } = await supabase
        .from("achievements")
        .select("id, slug, name, description, icon_url, criteria, sort_order, enabled")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Achievement[];
    },
  });
}

export function useUserAchievements(userId: string | null | undefined) {
  return useQuery({
    queryKey: ["user-achievements", userId ?? null],
    enabled: !!userId,
    queryFn: async (): Promise<UserAchievement[]> => {
      const { data, error } = await supabase
        .from("user_achievements")
        .select("id, user_id, achievement_id, unlocked_at")
        .eq("user_id", userId!);
      if (error) throw error;
      return (data ?? []) as UserAchievement[];
    },
  });
}

export function useSaveAchievement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: Omit<Achievement, "id"> }) => {
      if (id) {
        const { error } = await supabase.from("achievements").update(values).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("achievements").insert(values);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["achievements"] }),
  });
}

export function useDeleteAchievement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("achievements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["achievements"] }),
  });
}
