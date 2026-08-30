import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { deleteAdAdmin, duplicateAdAdmin, upsertAdAdmin } from "@/lib/ads-admin.functions";

export interface Ad {
  id: string;
  image_url: string;
  message: string;
  cta_label: string | null;
  link_url: string | null;
  place_id: string | null;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
}

export const DEFAULT_AD_CTA = "Zobacz więcej";

export interface AdInput {
  image_url: string;
  message: string;
  cta_label?: string | null;
  link_url?: string | null;
  place_id?: string | null;
  active?: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
}

function isLive(ad: Ad, now = Date.now()): boolean {
  if (!ad.active) return false;
  if (ad.starts_at && new Date(ad.starts_at).getTime() > now) return false;
  if (ad.ends_at && new Date(ad.ends_at).getTime() < now) return false;
  return true;
}

export function useActiveAds() {
  return useQuery({
    queryKey: ["ads-active"],
    staleTime: 60_000,
    queryFn: async (): Promise<Ad[]> => {
      const { data, error } = await supabase
        .from("ads")
        .select("id, image_url, message, cta_label, link_url, place_id, active, starts_at, ends_at, created_at, updated_at")
        .eq("active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as Ad[]).filter((a) => isLive(a));
    },
  });
}

export function useAllAds() {
  return useQuery({
    queryKey: ["ads-all"],
    queryFn: async (): Promise<Ad[]> => {
      const { data, error } = await supabase
        .from("ads")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Ad[];
    },
  });
}

export function useUpsertAd() {
  const qc = useQueryClient();
  const upsertAd = useServerFn(upsertAdAdmin);
  return useMutation({
    mutationFn: async (input: AdInput & { id?: string }) => {
      await upsertAd({ data: {
        id: input.id,
        image_url: input.image_url,
        message: input.message,
        cta_label: input.cta_label ?? null,
        link_url: input.link_url ?? null,
        place_id: input.place_id ?? null,
        active: input.active ?? true,
        starts_at: input.starts_at ?? null,
        ends_at: input.ends_at ?? null,
      } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ads-all"] });
      qc.invalidateQueries({ queryKey: ["ads-active"] });
    },
  });
}

export function useDeleteAd() {
  const qc = useQueryClient();
  const deleteAd = useServerFn(deleteAdAdmin);
  return useMutation({
    mutationFn: async (id: string) => {
      await deleteAd({ data: { id } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ads-all"] });
      qc.invalidateQueries({ queryKey: ["ads-active"] });
    },
  });
}

export interface AdStats {
  ad_id: string;
  impressions: number;
  clicks: number;
  impressions_7d: number;
  clicks_7d: number;
  unique_users: number;
  sessions: number;
}

export function useAdStats() {
  return useQuery({
    queryKey: ["ads-stats"],
    staleTime: 30_000,
    queryFn: async (): Promise<Record<string, AdStats>> => {
      const { data, error } = await supabase.rpc("ad_stats");
      if (error) throw error;
      const map: Record<string, AdStats> = {};
      ((data ?? []) as AdStats[]).forEach((r) => { map[r.ad_id] = r; });
      return map;
    },
  });
}

export function useDuplicateAd() {
  const qc = useQueryClient();
  const duplicateAd = useServerFn(duplicateAdAdmin);
  return useMutation({
    mutationFn: async (ad: Ad) => {
      await duplicateAd({ data: { id: ad.id } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ads-all"] });
      qc.invalidateQueries({ queryKey: ["ads-active"] });
    },
  });
}

/** Best-effort fire-and-forget tracking, logged-in users only - anonymous
 * visitors are never recorded (no user to attribute the event to, and RLS
 * would reject the insert anyway since `ad_events` now requires
 * user_id = auth.uid()). session_key is intentionally omitted so repeat
 * visits from the same user each get their own row; ad_stats() buckets them
 * into 30-minute sessions at query time instead of write-time dedup. */
export function trackAdImpression(adId: string, userId: string | null | undefined) {
  if (!userId) return;
  void supabase.from("ad_events").insert({ ad_id: adId, kind: "impression", user_id: userId });
}

export function trackAdClick(adId: string, userId: string | null | undefined) {
  if (!userId) return;
  void supabase.from("ad_events").insert({ ad_id: adId, kind: "click", user_id: userId });
}

export type LiveAdStatus = "active" | "scheduled" | "expired" | "disabled";

export function getAdLiveStatus(ad: Ad, now = Date.now()): LiveAdStatus {
  if (!ad.active) return "disabled";
  if (ad.starts_at && new Date(ad.starts_at).getTime() > now) return "scheduled";
  if (ad.ends_at && new Date(ad.ends_at).getTime() < now) return "expired";
  return "active";
}
