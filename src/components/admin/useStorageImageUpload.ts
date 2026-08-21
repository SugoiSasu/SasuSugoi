import { useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export interface StorageImageUploadOptions {
  bucket: string;
  /** Builds the storage path for a file — callers differ here because each
   * bucket's RLS INSERT policy expects a different folder convention (e.g.
   * ad-images requires a leading user-id folder, place-photos doesn't). */
  buildPath: (file: File) => string;
  maxMb?: number;
  /** How long the signed URL should stay valid. Defaults to 10 years —
   * matches what every admin uploader in this codebase already used. */
  signedUrlSeconds?: number;
  /** Optional extra check (e.g. min dimensions/aspect ratio) run after the
   * file is confirmed to be a readable image, before upload starts. Return
   * an error string to reject, or a warning string to allow-but-warn. */
  validate?: (file: File) => Promise<{ error?: string; warning?: string } | void>;
}

/** Shared "pick a file → validate → upload to Supabase Storage → sign the
 * URL" flow — was hand-rolled separately in admin.ads.tsx and
 * admin.places.tsx with near-identical bodies. */
export function useStorageImageUpload({
  bucket,
  buildPath,
  maxMb = 1,
  signedUrlSeconds = 60 * 60 * 24 * 365 * 10,
  validate,
}: StorageImageUploadOptions) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(file: File): Promise<string | null> {
    if (!file.type.startsWith("image/")) {
      toast.error("Wybierz plik graficzny (JPG, PNG, WebP).");
      return null;
    }
    if (file.size > maxMb * 1024 * 1024) {
      toast.error(`Plik za duży (max ${maxMb} MB).`);
      return null;
    }
    if (validate) {
      const result = await validate(file);
      if (result?.error) {
        toast.error(result.error);
        return null;
      }
      if (result?.warning) toast.warning(result.warning);
    }
    setUploading(true);
    try {
      const path = buildPath(file);
      const { error: upErr } = await supabase.storage
        .from(bucket)
        .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
      if (upErr) throw upErr;
      const { data: signed, error: signErr } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, signedUrlSeconds);
      if (signErr || !signed?.signedUrl)
        throw signErr ?? new Error("Nie udało się wygenerować URL");
      return signed.signedUrl;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Nie udało się wgrać pliku");
      return null;
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return { uploading, upload, inputRef };
}
