import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "./use-auth";

export interface UserWithRoles {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  is_beta_tester: boolean;
  roles: AppRole[];
}

/** super_admin only: list all profiles + their roles. RLS enforces it. */
export function useAllUsersWithRoles(search: string) {
  return useQuery({
    queryKey: ["users-with-roles", search],
    queryFn: async (): Promise<UserWithRoles[]> => {
      let q = supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, is_beta_tester")
        .order("created_at", { ascending: false })
        .limit(50);
      if (search.trim()) {
        const s = `%${search.trim()}%`;
        q = q.or(`username.ilike.${s},display_name.ilike.${s}`);
      }
      const { data: profiles, error } = await q;
      if (error) throw error;
      const ids = (profiles ?? []).map((p) => p.id);
      if (ids.length === 0) return [];
      const { data: roles, error: rErr } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", ids);
      if (rErr) throw rErr;
      const byUser = new Map<string, AppRole[]>();
      (roles ?? []).forEach((r) => {
        const arr = byUser.get(r.user_id) ?? [];
        arr.push(r.role as AppRole);
        byUser.set(r.user_id, arr);
      });
      return (profiles ?? []).map((p) => ({
        ...p,
        is_beta_tester: Boolean(p.is_beta_tester),
        roles: byUser.get(p.id) ?? [],
      }));
    },
  });
}

export function useSetBetaTester() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, value }: { userId: string; value: boolean }) => {
      const { error } = await supabase.rpc("admin_set_beta_tester", {
        _user_id: userId,
        _value: value,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users-with-roles"] }),
  });
}


export function useGrantRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role });
      if (error && !error.message.includes("duplicate")) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users-with-roles"] }),
  });
}

export function useRevokeRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", role);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users-with-roles"] }),
  });
}
