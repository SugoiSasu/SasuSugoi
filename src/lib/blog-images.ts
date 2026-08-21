import { supabase } from "@/integrations/supabase/client";

const BUCKET = "blog-images";
// 10 lat - wpisy blogowe mają być długoterminowo dostępne
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 365 * 10;

/**
 * Uploaduje plik do bucketu blog-images i zwraca podpisany URL z bardzo długim TTL.
 * Używamy podpisanego URL, bo bucket jest prywatny (workspace blokuje publiczne buckety).
 */
export async function uploadBlogImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("To nie jest plik graficzny.");
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("Maksymalny rozmiar zdjęcia to 10 MB.");
  }
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${new Date().getFullYear()}/${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: false, contentType: file.type });
  if (upErr) throw new Error(`Upload zdjęcia: ${upErr.message}`);
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data) throw new Error(`Nie udało się utworzyć URL: ${error?.message}`);
  return data.signedUrl;
}
