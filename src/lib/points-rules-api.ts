import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PointsRule {
  event_key: string;
  points: number;
  enabled: boolean;
  description: string | null;
  updated_at: string;
}

export function usePointsRules() {
  return useQuery({
    queryKey: ["points-rules"],
    queryFn: async (): Promise<PointsRule[]> => {
      const { data, error } = await supabase
        .from("points_rules")
        .select("*")
        .order("event_key", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PointsRule[];
    },
  });
}

export function useUpdatePointsRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      event_key,
      points,
      enabled,
    }: {
      event_key: string;
      points: number;
      enabled: boolean;
    }) => {
      const { error } = await supabase
        .from("points_rules")
        .update({ points, enabled })
        .eq("event_key", event_key);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["points-rules"] }),
  });
}
