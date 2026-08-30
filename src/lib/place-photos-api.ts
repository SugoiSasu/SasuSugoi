import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PlacePhoto {
  id: string;
  place_id: string;
  url: string;
  storage_path: string | null;
  caption: string | null;
  sort_order: number;
  uploaded_by: string | null;
  created_at: string;
}

const BUCKET = "place-photos";
const SIGNED_TTL = 60 * 60 * 24 * 7; // 7 days

export function usePlacePhotos(placeId: string) {
  return useQuery({
    queryKey: ["place-photos", placeId],
    enabled: !!placeId,
    // Signed URLs are valid 7 days - no need to re-sign every mount/focus.
    staleTime: 1000 * 60 * 60,
    queryFn: async (): Promise<PlacePhoto[]> => {
      const { data, error } = await supabase
        .from("place_photos")
        .select("id, place_id, url, storage_path, caption, sort_order, uploaded_by, created_at")
        .eq("place_id", placeId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      const rows = (data ?? []) as PlacePhoto[];
      const paths = rows.map((r) => r.storage_path).filter((p): p is string => !!p);
      // One batched storage call instead of one createSignedUrl per photo -
      // a place with 20 photos used to mean 20 sequential storage round trips.
      if (!paths.length) return rows;
      const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrls(paths, SIGNED_TTL);
      const urlByPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
      return rows.map((r) =>
        r.storage_path && urlByPath.get(r.storage_path)
          ? { ...r, url: urlByPath.get(r.storage_path)! }
          : r,
      );
    },
  });
}

export function useUploadPlacePhoto(placeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, caption }: { file: File; caption?: string }) => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Musisz być zalogowany.");
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${placeId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || undefined,
      });
      if (upErr) throw upErr;

      // Insert row; url stored is a public path (signed URL is regenerated on read).
      const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
      const { data: existing } = await supabase
        .from("place_photos").select("sort_order").eq("place_id", placeId)
        .order("sort_order", { ascending: false }).limit(1).maybeSingle();
      const nextOrder = ((existing?.sort_order as number | undefined) ?? -1) + 1;

      const { error: insErr } = await supabase.from("place_photos").insert({
        place_id: placeId,
        url: publicUrl,
        storage_path: path,
        caption: caption ?? null,
        sort_order: nextOrder,
        uploaded_by: uid,
      });
      if (insErr) {
        await supabase.storage.from(BUCKET).remove([path]);
        throw insErr;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["place-photos", placeId] }),
  });
}

export function useDeletePlacePhoto(placeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (photo: PlacePhoto) => {
      if (photo.storage_path) {
        await supabase.storage.from(BUCKET).remove([photo.storage_path]);
      }
      const { error } = await supabase.from("place_photos").delete().eq("id", photo.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["place-photos", placeId] }),
  });
}

export function useUpdatePlacePhoto(placeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, caption }: { id: string; caption: string | null }) => {
      const { error } = await supabase.from("place_photos").update({ caption }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["place-photos", placeId] }),
  });
}
