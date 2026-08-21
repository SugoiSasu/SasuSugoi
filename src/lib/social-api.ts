import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type SocialPlatform = Database["public"]["Enums"]["social_platform"];
export type SocialAccount = Database["public"]["Tables"]["social_accounts"]["Row"];

export const PLATFORM_LABEL: Record<SocialPlatform, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  facebook: "Facebook",
};

/** Public - anyone can read active social accounts (safe-column view). */
export function useActiveSocialAccounts() {
  return useQuery({
    queryKey: ["social-accounts", "active"],
    queryFn: async (): Promise<SocialAccount[]> => {
      const { data, error } = await supabase
        .from("social_accounts_public")
        .select("platform, handle, profile_url, followers_count, posts_count, is_active")
        .order("platform");
      if (error) throw error;
      return (data ?? []) as unknown as SocialAccount[];
    },
    staleTime: 5 * 60 * 1000,
  });
}


/** Admin - all accounts (incl. inactive) for management page. */
export function useAllSocialAccounts() {
  return useQuery({
    queryKey: ["social-accounts", "all"],
    queryFn: async (): Promise<SocialAccount[]> => {
      const { data, error } = await supabase
        .from("social_accounts")
        .select("*")
        .order("platform");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export interface SocialAccountInput {
  platform: SocialPlatform;
  handle: string;
  profile_url?: string | null;
  is_active?: boolean;
}

export function useUpsertSocialAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SocialAccountInput) => {
      const { error } = await supabase
        .from("social_accounts")
        .upsert(
          {
            platform: input.platform,
            handle: input.handle,
            profile_url: input.profile_url ?? null,
            is_active: input.is_active ?? true,
          },
          { onConflict: "platform" },
        );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["social-accounts"] }),
  });
}

export function useDeleteSocialAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (platform: SocialPlatform) => {
      const { error } = await supabase
        .from("social_accounts")
        .delete()
        .eq("platform", platform);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["social-accounts"] }),
  });
}

/** Manually override followers_count (and optionally posts_count) - useful when API token expired. */
export function useSetManualMetrics() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      platform: SocialPlatform;
      followers_count: number | null;
      posts_count?: number | null;
    }) => {
      const patch: Database["public"]["Tables"]["social_accounts"]["Update"] = {
        followers_count: input.followers_count,
        last_synced_at: new Date().toISOString(),
        last_sync_error: null,
      };
      if (input.posts_count !== undefined) patch.posts_count = input.posts_count;
      const { error } = await supabase
        .from("social_accounts")
        .update(patch)
        .eq("platform", input.platform);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["social-accounts"] }),
  });
}

/** Stale time = 48h. Returns true if metrics need refresh. */
export function isStale(account: SocialAccount): boolean {
  if (!account.last_synced_at) return true;
  const ageMs = Date.now() - new Date(account.last_synced_at).getTime();
  return ageMs > 48 * 60 * 60 * 1000;
}

export function formatCount(n: number | null | undefined): string {
  if (n == null) return " - ";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".0", "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(".0", "")}k`;
  return String(n);
}
