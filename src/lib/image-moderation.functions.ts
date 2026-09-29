import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const NARZEDZIE = {
  name: "ocena_zdjecia",
  description: "Wynik oceny, czy zdjęcie nadaje się do publicznej aplikacji o jedzeniu.",
  input_schema: {
    type: "object" as const,
    properties: {
      ok: { type: "boolean" as const, description: "false tylko gdy zdjęcie łamie zasady poniżej" },
      kategoria: {
        type: "string" as const,
        enum: ["ok", "erotyka", "przemoc", "nienawisc", "narkotyki", "inne"],
      },
    },
    required: ["ok", "kategoria"],
  },
};

const OPIS_KATEGORII: Record<string, string> = {
  erotyka: "treści erotycznych lub nagości",
  przemoc: "drastycznej przemocy lub krwi",
  nienawisc: "symboli nienawiści",
  narkotyki: "narkotyków",
  inne: "treści niedozwolonych",
};

export type WynikKontroliZdjecia = { ok: true } | { ok: false; powod: string };

/**
 * Kontrola zdjecia przed publikacja (wpis na Pozeralni, recenzja).
 * Claude Haiku (vision), ok. 0,003 USD za zdjecie.
 *
 * - Pliki tylko z naszego storage: funkcja nie moze sluzyc jako darmowy
 *   klasyfikator dowolnych obrazow ani jako proxy do cudzych adresow.
 * - Limit 40/godz. na osobe (RPC moderation_image_check_allowed, wpis w logu).
 * - AI niedostepne / blad -> zdjecie PRZECHODZI, a blad trafia do logu. Wolimy
 *   nie blokowac wszystkich zdjec przy awarii; backstopem sa zgloszenia.
 * - To kontrola po stronie klienta: kto ominie aplikacje i wgra plik prosto do
 *   API, nie zostanie sprawdzony - tym zajmuja sie zgloszenia i moderatorzy.
 */
export const sprawdzZdjecie = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        url: z.string().url().optional(),
        bucket: z.string().max(60).optional(),
        path: z.string().max(300).optional(),
      })
      .refine((v) => v.url || (v.bucket && v.path), "Podaj url albo bucket i path")
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<WynikKontroliZdjecia> => {
    const { supabase } = context;

    let url = data.url;
    if (!url) {
      const { data: signed, error } = await supabase.storage.from(data.bucket!).createSignedUrl(data.path!, 300);
      if (error || !signed) return { ok: true }; // nie umiemy pobrac - nie blokujemy
      url = signed.signedUrl;
    }
    const nasz = process.env.SUPABASE_URL ? new URL(process.env.SUPABASE_URL).host : null;
    if (!nasz || new URL(url).host !== nasz) throw new Error("Niedozwolone źródło zdjęcia");

    const { data: wolno } = await supabase.rpc("moderation_image_check_allowed");
    if (!wolno) {
      return { ok: false, powod: "Za dużo zdjęć w krótkim czasie. Spróbuj za chwilę." };
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      await supabase.rpc("moderation_log_image", { _kind: "image_check_failed", _note: "brak klucza API" });
      return { ok: true };
    }

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        signal: AbortSignal.timeout(20000),
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 200,
          tools: [NARZEDZIE],
          tool_choice: { type: "tool", name: NARZEDZIE.name },
          messages: [
            {
              role: "user",
              content: [
                { type: "image", source: { type: "url", url } },
                {
                  type: "text",
                  text:
                    "Zdjęcie ma trafić do publicznej aplikacji o jedzeniu i restauracjach w Polsce. " +
                    "Odrzuć (ok=false) TYLKO gdy widać: nagość lub treści seksualne, drastyczną przemoc / krew / okaleczenia, " +
                    "symbole nienawiści (np. swastyka), narkotyki. " +
                    "Wszystko inne jest OK: jedzenie, lokale, ludzie, selfie, memy, screenshoty, rozmazane lub słabe zdjęcia. " +
                    "Nie oceniaj jakości ani tematu. Odpowiedz narzędziem.",
                },
              ],
            },
          ],
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as {
        content: Array<{ type: string; input?: { ok?: boolean; kategoria?: string } }>;
      };
      const wynik = json.content.find((b) => b.type === "tool_use")?.input;
      if (wynik && wynik.ok === false) {
        const kat = wynik.kategoria ?? "inne";
        await supabase.rpc("moderation_log_image", { _kind: "image_blocked", _note: kat });
        return {
          ok: false,
          powod: `To zdjęcie nie może zostać opublikowane - wygląda na zawierające ${OPIS_KATEGORII[kat] ?? OPIS_KATEGORII.inne}.`,
        };
      }
      return { ok: true };
    } catch (e) {
      await supabase.rpc("moderation_log_image", {
        _kind: "image_check_failed",
        _note: e instanceof Error ? e.message : "blad",
      });
      return { ok: true };
    }
  });
