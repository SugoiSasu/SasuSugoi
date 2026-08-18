import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "./use-auth";

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
      const q = supabase.from("profiles").select("*");
      const { data, error } = UUID_RE.test(usernameOrId)
        ? await q.eq("id", usernameOrId).maybeSingle()
        : await q.ilike("username", usernameOrId).maybeSingle();
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
}

/**
 * Upsert by id — guarantees the row exists even if the auth trigger missed it
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
