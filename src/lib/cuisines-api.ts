import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Cuisine {
  id: string;
  name: string;
  emoji: string | null;
  color: string | null;
  sort_order: number;
  enabled: boolean;
}

export type CuisineInput = Omit<Cuisine, "id">;

export function useCuisines() {
  return useQuery({
    queryKey: ["cuisines"],
    queryFn: async (): Promise<Cuisine[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("cuisines")
        .select("id, name, emoji, color, sort_order, enabled")
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Cuisine[];
    },
  });
}

export function useEnabledCuisineNames() {
  const { data } = useCuisines();
  return (data ?? []).filter((c) => c.enabled).map((c) => c.name);
}

export function useSaveCuisine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: CuisineInput }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const table = (supabase as any).from("cuisines");
      if (id) {
        const { error } = await table.update(values).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await table.insert(values);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cuisines"] }),
  });
}

export function useDeleteCuisine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from("cuisines").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cuisines"] }),
  });
}
