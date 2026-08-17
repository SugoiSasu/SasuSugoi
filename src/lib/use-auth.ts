import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { user, loading };
}

export type AppRole = "user" | "admin" | "super_admin";

export function useMyRoles() {
  const { user } = useUser();
  return useQuery({
    queryKey: ["my-roles", user?.id ?? null],
    enabled: !!user,
    queryFn: async (): Promise<AppRole[]> => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []).map((r) => r.role as AppRole);
    },
  });
}

export function useIsAdmin() {
  const { data: roles, isLoading } = useMyRoles();
  const qc = useQueryClient();
  return {
    data: roles?.includes("admin") || roles?.includes("super_admin"),
    isLoading,
    refetch: () => qc.invalidateQueries({ queryKey: ["my-roles"] }),
  };
}

export function useIsSuperAdmin() {
  const { data: roles } = useMyRoles();
  return roles?.includes("super_admin") ?? false;
}
