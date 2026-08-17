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

export function useAchievements() {
  return useQuery({
    queryKey: ["achievements"],
    queryFn: async (): Promise<Achievement[]> => {
      const { data, error } = await supabase
        .from("achievements")
        .select("*")
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
        .select("*")
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
