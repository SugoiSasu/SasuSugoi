import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { POZNAN_DISTRICTS } from "@/lib/profile-api";
import {
  bezpiecznyUrl,
  znajdzDaneLokalu,
  TYPY_OBRAZOW,
  MODEL_DOKLADNY,
  type PoleAI,
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

const pusty = (v: unknown) =>
  v == null || (typeof v === "string" && !v.trim()) || (Array.isArray(v) && !v.length) ||
  (typeof v === "object" && !Array.isArray(v) && !Object.keys(v as object).length);

/**
 * Tylko to, czego lokal nie ma - AI nie placi za czytanie stron po dane, ktore
 * juz stoja w bazie. Kuchnia jest zawsze ustawiona recznie, wiec jej nie
 * szukamy. Wynos i dostepnosc (domyslnie false = "nie wiadomo") dopinamy
 * tylko wtedy, gdy i tak cos szukamy - nie sa warte osobnego wywolania.
 */
function brakujacePola(p: Record<string, unknown>): PoleAI[] {
  const b: PoleAI[] = [];
  if (pusty(p.address)) b.push("adres");
  if (pusty(p.district)) b.push("dzielnica");
  if (pusty(p.phone)) b.push("telefon");
  if (pusty(p.website)) b.push("strona_www");
  if (pusty(p.description)) b.push("opis");
  if (!/^\${1,5}$/.test(String(p.price_range ?? ""))) b.push("poziom_cen");
  if (pusty(p.opening_hours)) b.push("godziny");
  if (pusty(p.menu_items)) b.push("menu", ...(pusty(p.menu_url) ? (["menu_url"] as PoleAI[]) : []));
  if (b.length) {
    if (!p.has_takeaway) b.push("na_wynos");
    if (!p.wheelchair_accessible) b.push("bez_barier");
  }
  return b;
}

/**
 * Szuka danych lokalu w internecie i zapisuje PROPOZYCJE w place_enrichment.
 * Lokalu nie rusza - admin przyjmuje pola w edytorze. Trwa ok. minuty.
 */
export const szukajDanychLokalu = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ placeId: z.string().uuid(), dokladnie: z.boolean().optional() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<PropozycjaLokalu> => {
    await tylkoAdmin(context);
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("Wyszukiwanie nie jest skonfigurowane (brak klucza API).");

    // Sesja admina, nie klucz serwisowy - na produkcji go nie ma, a RLS
    // i tak wpuszcza admina do szkicow, propozycji i storage.
    const db = context.supabase;
    const { data: place, error } = await db
      .from("places")
      .select(
        "id, name, address, website, district, phone, description, price_range, opening_hours, menu_url, menu_items, has_takeaway, wheelchair_accessible",
      )
      .eq("id", data.placeId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!place) throw new Error("Lokal nie istnieje");
    const { data: kuchnie } = await db.from("cuisines").select("name").eq("enabled", true);
    // Dzielnice: lista z profilu + te, ktore juz stoja w lokalach (zeby nie
    // mnozyc pisowni tej samej dzielnicy).
    const { data: wLokalach } = await db.from("places").select("district");
    const dzielnice = [
      ...new Set([
        ...POZNAN_DISTRICTS.filter((d) => d !== "Inna"),
        ...(wLokalach ?? []).map((p) => p.district?.trim()).filter((d): d is string => !!d),
      ]),
    ];

    const zapisz = async (wiersz: { status: "szukam" | "gotowe" | "blad"; blad: string | null; propozycja?: PropozycjaLokalu }) => {
      const { error: zErr } = await db.from("place_enrichment").upsert({
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
          szukaj: brakujacePola(place),
          model: data.dokladnie ? MODEL_DOKLADNY : undefined,
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

    const db = context.supabase;
    const BUCKET = "place-photos";
    const path = `${data.placeId}/${data.rodzaj === "logo" ? "avatar_url" : "cover_image_url"}-web-${Date.now()}.${ext}`;
    const { error: upErr } = await db.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: typ, upsert: false });
    if (upErr) throw new Error(`Upload do Storage: ${upErr.message}`);
    // Tak samo jak migracja zdjec lokali: podpisany URL na 10 lat.
    const { data: signed, error: sErr } = await db.storage
      .from(BUCKET)
      .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
    if (sErr || !signed) throw new Error(`Nie udało się utworzyć URL-a: ${sErr?.message ?? "brak"}`);
    return { url: signed.signedUrl };
  });
