import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { deleteAdAdmin, duplicateAdAdmin, upsertAdAdmin } from "@/lib/ads-admin.functions";

export interface Ad {
  id: string;
  image_url: string;
  message: string;
  link_url: string | null;
  place_id: string | null;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdInput {
  image_url: string;
  message: string;
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
    queryFn: async (): Promise<Ad[]> => {
      const { data, error } = await supabase
        .from("ads")
        .select("*")
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

/** Best-effort fire-and-forget tracking. Failures are silent. */
function getSessionKey(): string {
  if (typeof window === "undefined") return "";
  try {
    let k = localStorage.getItem("ad_session_key");
    if (!k) {
      k = Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem("ad_session_key", k);
    }
    return k;
  } catch {
    return "";
  }
}

export function trackAdImpression(adId: string) {
  void supabase.from("ad_events").insert({ ad_id: adId, kind: "impression", session_key: getSessionKey() });
}

export function trackAdClick(adId: string) {
  void supabase.from("ad_events").insert({ ad_id: adId, kind: "click", session_key: getSessionKey() });
}

export type LiveAdStatus = "active" | "scheduled" | "expired" | "disabled";

export function getAdLiveStatus(ad: Ad, now = Date.now()): LiveAdStatus {
  if (!ad.active) return "disabled";
  if (ad.starts_at && new Date(ad.starts_at).getTime() > now) return "scheduled";
  if (ad.ends_at && new Date(ad.ends_at).getTime() < now) return "expired";
  return "active";
}
