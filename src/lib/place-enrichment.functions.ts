import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { POZNAN_DISTRICTS } from "@/lib/profile-api";
import {
  bezpiecznyUrl,
  znajdzDaneLokalu,
  TYPY_OBRAZOW,
  type PropozycjaLokalu,
} from "@/lib/place-enrichment.core";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";

type Kontekst = { supabase: SupabaseClient<Database>; userId: string };

async function tylkoAdmin({ supabase, userId }: Kontekst) {
  const { data: roles, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw new Error(error.message);
  if (!(roles ?? []).some((r) => r.role === "admin" || r.role === "super_admin")) {
    throw new Error("Tylko dla adminów");
  }
}

/**
 * Szuka danych lokalu w internecie i zapisuje PROPOZYCJE w place_enrichment.
 * Lokalu nie rusza - admin przyjmuje pola w edytorze. Trwa ok. minuty.
 */
export const szukajDanychLokalu = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ placeId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<PropozycjaLokalu> => {
    await tylkoAdmin(context);
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("Wyszukiwanie nie jest skonfigurowane (brak klucza API).");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: place, error } = await supabaseAdmin
      .from("places")
      .select("id, name, address, website")
      .eq("id", data.placeId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!place) throw new Error("Lokal nie istnieje");
    const { data: kuchnie } = await supabaseAdmin.from("cuisines").select("name").eq("enabled", true);
    // Dzielnice: lista z profilu + te, ktore juz stoja w lokalach (zeby nie
    // mnozyc pisowni tej samej dzielnicy).
    const { data: wLokalach } = await supabaseAdmin.from("places").select("district");
    const dzielnice = [
      ...new Set([
        ...POZNAN_DISTRICTS.filter((d) => d !== "Inna"),
        ...(wLokalach ?? []).map((p) => p.district?.trim()).filter((d): d is string => !!d),
      ]),
    ];

    const zapisz = async (wiersz: { status: "szukam" | "gotowe" | "blad"; blad: string | null; propozycja?: PropozycjaLokalu }) => {
      const { error: zErr } = await supabaseAdmin.from("place_enrichment").upsert({
        place_id: place.id,
        created_by: context.userId,
        updated_at: new Date().toISOString(),
        status: wiersz.status,
        blad: wiersz.blad,
        ...(wiersz.propozycja ? { propozycja: wiersz.propozycja as unknown as Json } : {}),
      });
      if (zErr) throw new Error(`Zapis propozycji: ${zErr.message}`);
    };

    await zapisz({ status: "szukam", blad: null });
    try {
      const propozycja = await znajdzDaneLokalu(
        {
          nazwa: place.name,
          adres: place.address,
          strona: place.website,
          kuchnie: (kuchnie ?? []).map((k) => k.name),
          dzielnice,
        },
        apiKey,
      );
      await zapisz({ status: "gotowe", propozycja, blad: null });
      return propozycja;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await zapisz({ status: "blad", blad: msg.slice(0, 500) });
      throw new Error(`Wyszukiwanie nie powiodło się: ${msg}`);
    }
  });

/**
 * Kopiuje wybrany obraz (logo / okladke) z cudzej strony do naszego storage.
 * Zwraca URL - do formularza; zapis lokalu robi admin przyciskiem Zapisz.
 */
export const pobierzObrazLokalu = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        placeId: z.string().uuid(),
        url: z.string().url(),
        rodzaj: z.enum(["logo", "okladka"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ url: string }> => {
    await tylkoAdmin(context);
    const zrodlo = bezpiecznyUrl(data.url);
    if (!zrodlo) throw new Error("Niedozwolony adres obrazu");

    let res: Response;
    try {
      res = await fetch(zrodlo, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; pozeramy-bot/1.0)" },
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      throw new Error("Nie udało się pobrać obrazu (martwy link lub blokada)");
    }
    if (!res.ok) throw new Error(`Pobieranie obrazu nie udało się (HTTP ${res.status})`);
    const typ = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    const ext = TYPY_OBRAZOW[typ];
    if (!ext) throw new Error(`To nie jest obsługiwany obraz (${typ || "brak typu"})`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength === 0) throw new Error("Pobrany plik jest pusty");
    if (bytes.byteLength > 5 * 1024 * 1024) throw new Error("Obraz większy niż 5 MB");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const BUCKET = "place-photos";
    const path = `${data.placeId}/${data.rodzaj === "logo" ? "avatar_url" : "cover_image_url"}-web-${Date.now()}.${ext}`;
    const { error: upErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: typ, upsert: false });
    if (upErr) throw new Error(`Upload do Storage: ${upErr.message}`);
    // Tak samo jak migracja zdjec lokali: podpisany URL na 10 lat.
    const { data: signed, error: sErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
    if (sErr || !signed) throw new Error(`Nie udało się utworzyć URL-a: ${sErr?.message ?? "brak"}`);
    return { url: signed.signedUrl };
  });
