import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Rank {
  id: string;
  slug: string;
  name: string;
  color: string;
  icon: string | null;
  description: string | null;
  sort_order: number;
  is_system: boolean;
}

export interface UserRank {
  id: string;
  user_id: string;
  rank_id: string;
  granted_at: string;
  rank: Rank;
}

export function useRanks() {
  return useQuery({
    queryKey: ["ranks"],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Rank[]> => {
      const { data, error } = await supabase
        .from("ranks")
        .select("id, slug, name, color, icon, description, sort_order, is_system")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Rank[];
    },
  });
}

export function useUserRanks(userId: string | undefined | null) {
  return useQuery({
    queryKey: ["user-ranks", userId ?? null],
    enabled: !!userId,
    queryFn: async (): Promise<Rank[]> => {
      const { data, error } = await supabase
        .from("user_ranks")
        .select("rank:ranks(*)")
        .eq("user_id", userId!);
      if (error) throw error;
      const rows = (data ?? []) as Array<{ rank: Rank }>;
      return rows
        .map((r) => r.rank)
        .filter(Boolean)
        .sort((a, b) => a.sort_order - b.sort_order);
    },
  });
}

export function useSaveRank() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: Omit<Rank, "id" | "is_system"> }) => {
      if (id) {
        const { error } = await supabase.from("ranks").update(values).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("ranks").insert(values);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ranks"] }),
  });
}

export function useDeleteRank() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ranks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ranks"] }),
  });
}

export function useGrantRankToUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, rankId }: { userId: string; rankId: string }) => {
      const { data: me } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("user_ranks")
        .insert({ user_id: userId, rank_id: rankId, granted_by: me.user?.id ?? null });
      if (error && !error.message.includes("duplicate")) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["user-ranks", vars.userId] });
      qc.invalidateQueries({ queryKey: ["users-with-roles"] });
    },
  });
}

export function useRevokeRankFromUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, rankId }: { userId: string; rankId: string }) => {
      const { error } = await supabase
        .from("user_ranks")
        .delete()
        .eq("user_id", userId)
        .eq("rank_id", rankId);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["user-ranks", vars.userId] });
      qc.invalidateQueries({ queryKey: ["users-with-roles"] });
    },
  });
}
