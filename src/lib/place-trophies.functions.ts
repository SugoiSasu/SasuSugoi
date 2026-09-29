import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizujPropozycje } from "@/lib/trophies";

const MODEL = "claude-haiku-4-5-20251001";
// Haiku: ok. 1$/1M tokenow wejscia, 5$ wyjscia + 0,01$ za wyszukiwanie.
const CENA: [number, number] = [1, 5];

const NARZEDZIE = {
  name: "zapisz_trofea",
  description: "Zapisz trofea i wyroznienia tego lokalu, ktore POTWIERDZILES w zrodle. Wywolaj dokladnie raz, na koncu.",
  input_schema: {
    type: "object" as const,
    properties: {
      znaleziono_lokal: { type: "boolean", description: "Czy znalazles TEN lokal (ta nazwa, Poznan)." },
      uwagi: { type: "string", description: "Max 20 slow: sprzecznosci albo watpliwosci. Pusty, jesli brak." },
      trofea: {
        type: "array",
        description: "Tylko potwierdzone. Pusta lista, jesli lokal nie ma zadnego z tych wyroznien.",
        items: {
          type: "object",
          properties: {
            rodzaj: {
              type: "string",
              enum: ["michelin_star", "michelin_bib", "michelin_recommended"],
              description:
                "michelin_star = gwiazdka Michelin; michelin_bib = Bib Gourmand; michelin_recommended = wyrozniony/polecany w Przewodniku Michelin (Michelin Guide Recommended).",
            },
            poziom: { type: "integer", minimum: 1, maximum: 3, description: "Liczba gwiazdek - tylko dla michelin_star." },
            rok: { type: "integer", description: "Rok edycji przewodnika, w ktorej lokal dostal wyroznienie." },
            opis: { type: "string", description: "Opcjonalny dopisek, max 60 znakow (np. 'White Star', 'Sommelier Award'). Zwykle pusty." },
            zrodlo: { type: "string", description: "Dokladny URL strony, na ktorej to przeczytales (najlepiej guide.michelin.com)." },
          },
          required: ["rodzaj", "rok", "zrodlo"],
        },
      },
    },
    required: ["znaleziono_lokal", "uwagi", "trofea"],
  },
};

type Blok = { type: string; name?: string; input?: Record<string, unknown> };

async function wywolaj(apiKey: string, body: Record<string, unknown>) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "web-fetch-2025-09-10",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) throw new Error(`Anthropic API (${res.status}): ${(await res.text().catch(() => "")).slice(0, 300)}`);
  return (await res.json()) as {
    content: Blok[];
    stop_reason: string;
    usage?: { input_tokens?: number; output_tokens?: number; server_tool_use?: { web_search_requests?: number } };
  };
}

/**
 * Szuka trofeow lokalu w internecie (Michelin: gwiazdki, Bib Gourmand,
 * Wyroznienie) i zapisuje je jako PROPOZYCJE (status 'propozycja'). Na profilu
 * pokazuja sie dopiero po zatwierdzeniu przez admina. "Warte poZarcia" jest
 * nasze i przychodzi z glosowania, wiec tu go nie szukamy.
 */
export const szukajTrofeow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ placeId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: roles, error: rErr } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    if (rErr) throw new Error(rErr.message);
    if (!(roles ?? []).some((r) => r.role === "admin" || r.role === "super_admin")) throw new Error("Tylko dla adminów");
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("Wyszukiwanie nie jest skonfigurowane (brak klucza API).");

    const { data: place, error } = await supabase
      .from("places")
      .select("id, name, address, website")
      .eq("id", data.placeId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!place) throw new Error("Lokal nie istnieje");

    const polecenie = [
      `Lokal: "${place.name}", Poznan.`,
      place.address ? `Adres: ${place.address}.` : "",
      place.website ? `Strona: ${place.website}.` : "",
      "Sprawdz, czy ten lokal ma w Przewodniku Michelin: gwiazdke (1-3), Bib Gourmand albo wyroznienie (Michelin Guide Recommended).",
      "Zacznij od guide.michelin.com (wyszukaj nazwe lokalu i Poznan), potem ewentualnie oficjalna strona lokalu i wiarygodne media.",
      "Tylko to, co przeczytales w zrodle, z rokiem edycji. Lokal o tej samej nazwie w innym miescie to NIE ten lokal.",
      "Brak trofeum jest poprawnym wynikiem - zwroc pusta liste. Nie zgaduj i nie wpisuj nagrod innych niz wymienione.",
      "Nie pisz tekstu miedzy narzedziami. Konczysz jednym wywolaniem zapisz_trofea.",
    ]
      .filter(Boolean)
      .join("\n");

    const tools = [
      {
        type: "web_search_20250305",
        name: "web_search",
        max_uses: 3,
        user_location: { type: "approximate", city: "Poznań", country: "PL", timezone: "Europe/Warsaw" },
      },
      { type: "web_fetch_20250910", name: "web_fetch", max_uses: 2, max_content_tokens: 5000 },
      NARZEDZIE,
    ];
    const messages: { role: string; content: unknown }[] = [{ role: "user", content: polecenie }];
    const koszt = { tokeny_we: 0, tokeny_wy: 0, wyszukiwania: 0 };
    let wynik: Record<string, unknown> | null = null;

    for (let tura = 0; tura < 4 && !wynik; tura++) {
      const wymus = tura === 3;
      const odp = await wywolaj(apiKey, {
        model: MODEL,
        max_tokens: 2000,
        tools,
        tool_choice: wymus ? { type: "tool", name: NARZEDZIE.name } : { type: "auto" },
        messages,
      });
      koszt.tokeny_we += odp.usage?.input_tokens ?? 0;
      koszt.tokeny_wy += odp.usage?.output_tokens ?? 0;
      koszt.wyszukiwania += odp.usage?.server_tool_use?.web_search_requests ?? 0;
      const trafienie = odp.content.find((b) => b.type === "tool_use" && b.name === NARZEDZIE.name);
      if (trafienie?.input) {
        wynik = trafienie.input;
        break;
      }
      messages.push({ role: "assistant", content: odp.content });
      if (odp.stop_reason !== "pause_turn") {
        messages.push({ role: "user", content: "Zapisz teraz wynik narzedziem zapisz_trofea." });
      }
    }
    if (!wynik) throw new Error("AI nie zwróciło wyniku.");

    const usd = (koszt.tokeny_we * CENA[0] + koszt.tokeny_wy * CENA[1]) / 1e6 + koszt.wyszukiwania * 0.01;
    const znaleziono = wynik.znaleziono_lokal === true;
    const uwagi = typeof wynik.uwagi === "string" ? wynik.uwagi : "";
    const surowe = Array.isArray(wynik.trofea) ? (wynik.trofea as Record<string, unknown>[]) : [];

    // Walidacja po naszej stronie: model moze zwrocic rok z przyszlosci albo
    // link nie-http - takie wpisy odpadaja, zanim trafia do bazy.
    const rok = new Date().getFullYear();
    const poprawne = znaleziono
      ? surowe.map((p) => normalizujPropozycje(p, rok)).filter((p): p is NonNullable<typeof p> => !!p)
      : [];

    // Bez duplikatow wzgledem tego, co juz jest (zatwierdzone i propozycje).
    const { data: istniejace } = await supabase
      .from("place_trophies" as never)
      .select("kind, year, label")
      .eq("place_id", place.id);
    const klucz = (k: string, r: number, l: string | null) => `${k}|${r}|${l ?? ""}`;
    const juz = new Set(
      ((istniejace ?? []) as unknown as { kind: string; year: number; label: string | null }[]).map((t) =>
        klucz(t.kind, t.year, t.label),
      ),
    );
    const nowe = poprawne.filter((p) => !juz.has(klucz(p.kind, p.year, p.label)));

    if (nowe.length) {
      const { error: iErr } = await supabase.from("place_trophies" as never).insert(
        nowe.map((p) => ({
          place_id: place.id,
          kind: p.kind,
          tier: p.tier,
          year: p.year,
          label: p.label,
          source_url: p.source_url,
          status: "propozycja",
          proposed_by_ai: true,
          created_by: userId,
        })) as never,
      );
      if (iErr) throw new Error(`Zapis propozycji: ${iErr.message}`);
    }

    return {
      znaleziono,
      uwagi,
      dodane: nowe.length,
      pominiete: surowe.length - nowe.length,
      usd: Math.round(usd * 1000) / 1000,
    };
  });
