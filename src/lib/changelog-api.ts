import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ChangelogEntry {
  id: string;
  summary: string;
  created_at: string;
}

export function useAdminChangelog() {
  return useQuery({
    queryKey: ["admin-changelog"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_changelog")
        .select("id, summary, created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as ChangelogEntry[];
    },
  });
}
