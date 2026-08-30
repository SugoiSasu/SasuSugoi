import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "./use-auth";
import { sanitizeIlikeTerm } from "./postgrest-filter";

export type AvatarSource = "google" | "upload" | "initials";

export interface Profile {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  avatar_source: AvatarSource;
  bio: string | null;
  district: string | null;
  favorite_cuisines: string[];
  is_public: boolean;
  points_total: number;
  created_at: string;
  instagram_url: string | null;
  tiktok_url: string | null;
  youtube_url: string | null;
  facebook_url: string | null;
  x_url: string | null;
  is_vip: boolean;
  vip_until: string | null;
  vip_nick_color: string | null;
  gender: "M" | "K" | null;
  onboarding_seen_at: string | null;
  ig_popup_dismissed_at: string | null;
  notification_prefs: Record<string, boolean> | null;
  active_title: string | null;
  active_title_achievement_id: string | null;
}

export const POZNAN_DISTRICTS = [
  "Stare Miasto",
  "Jeżyce",
  "Wilda",
  "Grunwald",
  "Łazarz",
  "Sołacz",
  "Winogrady",
  "Rataje",
  "Piątkowo",
  "Naramowice",
  "Górczyn",
  "Dębiec",
  "Malta",
  "Junikowo",
  "Inna",
] as const;

export function useMyProfile() {
  const { user } = useUser();
  return useQuery({
    queryKey: ["profile", user?.id ?? null],
    enabled: !!user,
    queryFn: async (): Promise<Profile | null> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as Profile | null;
    },
  });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function useProfileByUsername(usernameOrId: string) {
  return useQuery({
    queryKey: ["profile-by-username", usernameOrId.toLowerCase()],
    queryFn: async (): Promise<Profile | null> => {
      // Explicit columns (not "*") — this is the public-profile lookup, reachable
      // by anon visitors; keeps internal-only columns like is_beta_tester and
      // returned_after_break_at from ever leaking into the response payload.
      const q = supabase.from("profiles").select(
        "id, username, display_name, avatar_url, avatar_source, bio, district, favorite_cuisines, is_public, points_total, created_at, instagram_url, tiktok_url, youtube_url, facebook_url, x_url, is_vip, vip_until, vip_nick_color, gender, active_title, active_title_achievement_id",
      );
      // ilike's own wildcards (%, _) must be stripped from a raw route param
      // before use, same as the ranking search does - otherwise "/u/%25"
      // (-> "%") matches every username and .maybeSingle() throws on the
      // resulting multi-row result instead of behaving like a clean 404.
      const { data, error } = UUID_RE.test(usernameOrId)
        ? await q.eq("id", usernameOrId).maybeSingle()
        : await q.ilike("username", sanitizeIlikeTerm(usernameOrId)).maybeSingle();
      if (error) throw error;
      return data as Profile | null;
    },
  });
}

export interface ProfileUpdate {
  username?: string;
  display_name?: string | null;
  bio?: string | null;
  district?: string | null;
  favorite_cuisines?: string[];
  is_public?: boolean;
  avatar_url?: string | null;
  avatar_source?: AvatarSource;
  instagram_url?: string | null;
  tiktok_url?: string | null;
  youtube_url?: string | null;
  facebook_url?: string | null;
  x_url?: string | null;
  vip_nick_color?: string | null;
  gender?: "M" | "K" | null;
  onboarding_seen_at?: string;
  ig_popup_dismissed_at?: string;
  notification_prefs?: Record<string, boolean>;
}

/**
 * Upsert by id - guarantees the row exists even if the auth trigger missed it
 * (e.g. preview accounts created before the trigger was installed).
 */
export function useUpdateProfile() {
  const { user } = useUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: ProfileUpdate) => {
      if (!user) throw new Error("Nie zalogowano");
      const { data, error } = await supabase
        .from("profiles")
        .upsert({ id: user.id, ...patch }, { onConflict: "id" })
        .select()
        .single();
      if (error) throw error;
      return data as Profile;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["profile-by-username"] });
    },
  });
}

export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${userId}/avatar-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  return path;
}

/** Bundles everything RLS already scopes to the current user into one JSON
 * object - no server function needed, every table here already restricts
 * reads to auth.uid() at the database level. */
export async function exportMyData(userId: string) {
  const [profile, reviews, favorites, visits, friendships] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("reviews").select("*").eq("user_id", userId),
    supabase.from("place_favorites").select("*").eq("user_id", userId),
    supabase.from("place_visits").select("*").eq("user_id", userId),
    supabase
      .from("friendships")
      .select("*")
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`),
  ]);
  for (const r of [profile, reviews, favorites, visits, friendships]) {
    if (r.error) throw r.error;
  }
  return {
    exported_at: new Date().toISOString(),
    profile: profile.data,
    reviews: reviews.data,
    favorites: favorites.data,
    visits: visits.data,
    friendships: friendships.data,
  };
}

/** Sign a private-bucket path. Cached for 30 min. */
export function useAvatarUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: ["avatar-url", path ?? null],
    enabled: !!path,
    staleTime: 1000 * 60 * 30,
    queryFn: async () => {
      if (!path) return null;
      if (path.startsWith("http")) return path;
      const { data, error } = await supabase.storage
        .from("avatars")
        .createSignedUrl(path, 60 * 60 * 24 * 7);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}
