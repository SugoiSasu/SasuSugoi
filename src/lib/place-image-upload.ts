import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { resizeImageCover } from "@/lib/image-resize";

const BUCKET = "place-photos";
const TEN_YEARS = 60 * 60 * 24 * 365 * 10;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SOURCE_MB = 10;

export type PlaceImageKind = "cover" | "avatar";

const TARGETS: Record<PlaceImageKind, { w: number; h: number }> = {
  cover: { w: 1200, h: 400 },
  avatar: { w: 400, h: 400 },
};

export function useUploadPlaceImage(placeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, kind }: { file: File; kind: PlaceImageKind }) => {
      if (!ALLOWED_TYPES.includes(file.type)) {
        throw new Error("Dozwolone formaty: JPG, PNG, WEBP");
      }
      if (file.size > MAX_SOURCE_MB * 1024 * 1024) {
        throw new Error(`Plik za duży (max ${MAX_SOURCE_MB} MB)`);
      }
      const target = TARGETS[kind];
      const { blob, ext } = await resizeImageCover(file, target.w, target.h);

      const path = `${placeId}/${kind}.${ext}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, blob, {
        cacheControl: "3600",
        upsert: true,
        contentType: blob.type,
      });
      if (upErr) throw upErr;

      const { data: signed, error: signErr } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(path, TEN_YEARS);
      if (signErr || !signed?.signedUrl) throw signErr ?? new Error("Nie udało się wygenerować URL");

      const update = kind === "cover" ? { cover_image_url: signed.signedUrl } : { avatar_url: signed.signedUrl };
      const { error: dbErr } = await supabase.from("places").update(update).eq("id", placeId);
      if (dbErr) throw dbErr;

      return signed.signedUrl;
    },
    onSuccess: () => {
      // Partial match invalidates ["place", slugOrId] regardless of which
      // param the current route used, plus the map/discover list query.
      qc.invalidateQueries({ queryKey: ["place"] });
      qc.invalidateQueries({ queryKey: ["places"] });
    },
  });
}
