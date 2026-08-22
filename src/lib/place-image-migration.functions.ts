import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  PLACE_IMAGE_FIELDS,
  EXT_BY_TYPE,
  isHotlinkedUrl,
  type MigratableField,
  type MigrationResult,
} from "./place-image-migration";

/**
 * Przenosi jedno zdjęcie lokalu z hotlinkowanego CDN-a do Supabase Storage.
 * Serwerowo - fetch z CDN-ów Instagrama/Facebooka jest blokowany przez CORS w przeglądarce.
 */
export const migratePlaceImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        placeId: z.string().uuid(),
        field: z.enum(PLACE_IMAGE_FIELDS),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<MigrationResult> => {
    const BUCKET = "place-photos";
    const SIGNED_TTL = 60 * 60 * 24 * 365 * 10; // 10 lat
    const { supabase, userId } = context;

    const { data: roles, error: rErr } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (rErr) throw new Error(rErr.message);
    if (!(roles ?? []).some((r) => r.role === "admin" || r.role === "super_admin")) {
      throw new Error("Forbidden");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: place, error: pErr } = await supabaseAdmin
      .from("places")
      .select("id, name, cover_image_url, avatar_url, menu_image_url")
      .eq("id", data.placeId)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!place) throw new Error("Lokal nie istnieje");

    const current = (place as Record<string, string | null>)[data.field];
    if (!current) return { status: "skipped", reason: "Brak URL-a" };
    if (!isHotlinkedUrl(current)) return { status: "skipped", reason: "Już zmigrowane" };

    let res: Response;
    try {
      res = await fetch(current, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; pozeramy-migrator)" },
      });
    } catch {
      throw new Error("Nie udało się pobrać obrazu (martwy link lub blokada CDN)");
    }
    if (!res.ok) throw new Error(`Pobieranie obrazu nie udało się (HTTP ${res.status})`);

    const contentType = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (!contentType.startsWith("image/")) {
      throw new Error(`Odpowiedź nie jest obrazem (${contentType || "brak content-type"})`);
    }
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength === 0) throw new Error("Pobrany plik jest pusty");

    const ext = EXT_BY_TYPE[contentType] ?? "jpg";
    const path = `${data.placeId}/${data.field}-${Date.now()}.${ext}`;

    const { error: upErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType, upsert: false });
    if (upErr) throw new Error(`Upload do Storage: ${upErr.message}`);

    const { data: signed, error: sErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(path, SIGNED_TTL);
    if (sErr || !signed) throw new Error(`Nie udało się utworzyć URL-a: ${sErr?.message ?? "brak"}`);

    const patch = { [data.field]: signed.signedUrl } as Record<MigratableField, string>;
    const { error: updErr } = await supabaseAdmin.from("places").update(patch).eq("id", data.placeId);
    if (updErr) throw new Error(`Zapis URL-a w bazie: ${updErr.message}`);

    return { status: "migrated", url: signed.signedUrl };
  });
