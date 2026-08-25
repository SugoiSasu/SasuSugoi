import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeIlikeTerm } from "@/lib/postgrest-filter";
import type { AppRole } from "./use-auth";

export interface UserWithRoles {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  is_beta_tester: boolean;
  roles: AppRole[];
}

/** super_admin only: real site-wide totals, independent of useAllUsersWithRoles'
 * 50-row cap and search filter - that list is for browsing/managing, this is
 * for "how many users do we actually have". */
export function useUserCounts() {
  return useQuery({
    queryKey: ["user-counts"],
    queryFn: async () => {
      const [total, admins, beta] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        // A user can hold both "admin" and "super_admin" rows at once (see
        // the panel itself - Super Admins get both badges) - a plain row
        // count would double-count them, so fetch ids and dedupe instead of
        // using a head-only count here.
        supabase.from("user_roles").select("user_id").in("role", ["admin", "super_admin"]),
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("is_beta_tester", true),
      ]);
      if (total.error) throw total.error;
      if (admins.error) throw admins.error;
      if (beta.error) throw beta.error;
      const staffCount = new Set((admins.data ?? []).map((r) => r.user_id)).size;
      return { all: total.count ?? 0, staff: staffCount, beta: beta.count ?? 0 };
    },
  });
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
      const safeSearch = sanitizeIlikeTerm(search);
      if (safeSearch) {
        const s = `%${safeSearch}%`;
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


/** Goes through admin_grant_role (SECURITY DEFINER) instead of a direct table
 * insert so the grant and its audit_log entry happen atomically - see
 * 20260820110000_admin_audit_log.sql. */
export function useGrantRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase.rpc("admin_grant_role", { _user_id: userId, _role: role });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users-with-roles"] }),
  });
}

export function useRevokeRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase.rpc("admin_revoke_role", { _user_id: userId, _role: role });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users-with-roles"] }),
  });
}
