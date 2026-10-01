import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MODEL = "claude-haiku-4-5-20251001";

const wejscie = z.object({
  nazwa: z.string().trim().min(1).max(150),
  kuchnia: z.string().max(60).optional().default(""),
  dzielnica: z.string().max(80).optional().default(""),
  adres: z.string().max(200).optional().default(""),
  poziomCen: z.string().max(80).optional().default(""),
  naWynos: z.boolean().optional().default(false),
  bezBarier: z.boolean().optional().default(false),
  godziny: z.string().max(300).optional().default(""),
  menu: z.array(z.string().max(120)).max(40).optional().default([]),
  trofea: z.array(z.string().max(160)).max(10).optional().default([]),
  stary: z.string().max(1500).optional().default(""),
});

/**
 * Pisze opis lokalu na podstawie WSZYSTKIEGO, co o nim wiemy (kuchnia, dzielnica,
 * ceny, wynos, godziny, pozycje z menu, trofea). Bez wyszukiwania w sieci - tylko
 * fakty z formularza, wiec jest tanie (ok. 0,002 USD) i nie zmysla: model ma
 * zakaz dopisywania czegokolwiek spoza listy.
 */
export const napiszOpisLokalu = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => wejscie.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: roles, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    if (error) throw new Error(error.message);
    if (!(roles ?? []).some((r) => r.role === "admin" || r.role === "super_admin")) throw new Error("Tylko dla adminów");
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("Generowanie nie jest skonfigurowane (brak klucza API).");

    const fakty = [
      `Nazwa: ${data.nazwa}`,
      data.kuchnia && `Kuchnia: ${data.kuchnia}`,
      data.dzielnica && `Dzielnica Poznania: ${data.dzielnica}`,
      data.adres && `Adres: ${data.adres}`,
      data.poziomCen && `Poziom cen: ${data.poziomCen}`,
      data.naWynos && "Jedzenie na wynos: tak",
      data.bezBarier && "Dostępny dla wózków: tak",
      data.godziny && `Godziny: ${data.godziny}`,
      data.menu.length ? `Pozycje z menu: ${data.menu.join("; ")}` : "",
      data.trofea.length ? `Trofea i wyróżnienia: ${data.trofea.join("; ")}` : "",
      data.stary && `Dotychczasowy opis (źródło faktów i stylu, popraw go): ${data.stary}`,
    ]
      .filter(Boolean)
      .join("\n");

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      signal: AbortSignal.timeout(30_000),
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 500,
        system:
          "Piszesz opisy lokali gastronomicznych dla polskiej aplikacji o jedzeniu w Poznaniu. " +
          "Napisz 2-3 zdania (maks. 300 znaków), po polsku, naturalnie, własnymi słowami. " +
          "Użyj WYŁĄCZNIE faktów z listy poniżej: nie dopisuj niczego, czego tam nie ma (wystroju, atmosfery, historii, składników spoza menu). " +
          "Jeśli są trofea, wspomnij o nich rzeczowo i poprawnie: gwiazdka, Bib Gourmand i wyróżnienie to nagrody przewodnika Michelin; " +
          "'Warte poŻarcia' to nagroda w głosowaniu użytkowników naszej aplikacji (NIE przewodnik, NIE lista w przewodniku). " +
          "Dzielnicę odmieniaj poprawnie ('na Wildzie', 'na Jeżycach', 'na Łazarzu', w centrum). Zachowaj wszystkie polskie znaki diakrytyczne. " +
          "Wspomnij 2-4 charakterystyczne dania z menu, jeśli są. Bez superlatyw (najlepszy, wyjątkowy), bez emoji, bez cen w złotówkach. " +
          "Zwróć sam tekst opisu, bez cudzysłowów i wstępu.",
        messages: [{ role: "user", content: fakty }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic API (${res.status}): ${(await res.text().catch(() => "")).slice(0, 200)}`);
    const json = (await res.json()) as { content: { type: string; text?: string }[] };
    const tekst = json.content.find((b) => b.type === "text")?.text?.trim().replace(/^["„]|["”]$/g, "") ?? "";
    if (!tekst) throw new Error("AI nie zwróciło opisu.");
    return { opis: tekst.slice(0, 400) };
  });
