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
  category?: string | null;
  title?: string | null;
}

export interface TitledAchievement {
  achievement_id: string;
  slug: string;
  name: string;
  title: string;
  category: string | null;
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
    staleTime: 5 * 60_000,
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

/** One-time client-triggered unlocks for achievements that aren't a
 * countable stat (criteria.type === "manual") - e.g. finding your own
 * location dot on the map. Returns true only the first time it's called
 * for a given slug+user; safe to call again, the RPC no-ops if already
 * unlocked or the slug doesn't exist/isn't "manual". */
export function useUnlockManualAchievement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (slug: string): Promise<boolean> => {
      const { data, error } = await supabase.rpc("unlock_manual_achievement", { _slug: slug });
      if (error) throw error;
      return Boolean(data);
    },
    onSuccess: (unlocked) => {
      if (unlocked) qc.invalidateQueries({ queryKey: ["user-achievements"] });
    },
  });
}

/** LoL-style selectable titles: only unlocked achievements that carry a
 * `title` are wearable. Used by the picker in Ustawienia. */
export function useMyTitledAchievements(userId: string | null | undefined) {
  return useQuery({
    queryKey: ["my-titled-achievements", userId ?? null],
    enabled: !!userId,
    queryFn: async (): Promise<TitledAchievement[]> => {
      const { data, error } = await supabase
        .from("user_achievements")
        .select("achievement_id, achievements!inner(slug, name, title, category)")
        .eq("user_id", userId!)
        .not("achievements.title", "is", null);
      if (error) throw error;
      return (data ?? []).map((row) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const a = row.achievements as any;
        return {
          achievement_id: row.achievement_id,
          slug: a.slug,
          name: a.name,
          title: a.title,
          category: a.category ?? null,
        };
      });
    },
  });
}

export function useSetActiveTitle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (achievementId: string | null) => {
      const { error } = await supabase.rpc("set_active_title", {
        _achievement_id: achievementId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["profile-by-username"] });
      qc.invalidateQueries({ queryKey: ["users-ranking"] });
      qc.invalidateQueries({ queryKey: ["friend-leaderboard"] });
    },
  });
}

/**
 * Flip a single achievement on/off without opening the editor. Writes just
 * the one column rather than reusing useSaveAchievement's full-row update -
 * useAchievements() does not select `category`/`title`, so a full-row write
 * from this list would be sending a payload that never had them.
 */
export function useToggleAchievement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase.from("achievements").update({ enabled }).eq("id", id);
      if (error) throw error;
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
