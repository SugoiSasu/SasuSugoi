import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { MenuCategory } from "@/lib/places-api";

const MENU_TOOL = {
  name: "menu_extracted",
  description: "Ustrukturyzowane menu odczytane ze zdjęcia.",
  input_schema: {
    type: "object" as const,
    properties: {
      categories: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            category: { type: "string" as const, description: "Nazwa kategorii, np. Przystawki" },
            items: {
              type: "array" as const,
              items: {
                type: "object" as const,
                properties: {
                  name: { type: "string" as const },
                  price: { type: "string" as const, description: "np. '28 zł' - pomiń jeśli nie widać ceny" },
                  description: { type: "string" as const, description: "krótki opis dania - pomiń jeśli go nie ma" },
                },
                required: ["name"],
              },
            },
          },
          required: ["category", "items"],
        },
      },
    },
    required: ["categories"],
  },
};

/** Admin/super_admin only - reads a menu photo via Claude's vision API and
 * returns structured MenuCategory[] to prefill MenuItemsEditor, so staff
 * don't have to retype every dish from a paper menu by hand. */
export const extractMenuFromImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ imageUrl: z.string().url() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: roles, error: rErr } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (rErr) throw new Error(rErr.message);
    const isAdmin = (roles ?? []).some((r) => r.role === "admin" || r.role === "super_admin");
    if (!isAdmin) throw new Error("Forbidden: admin only");

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("AI-ekstrakcja menu nie jest skonfigurowana (brak klucza API).");

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 4096,
        tools: [MENU_TOOL],
        tool_choice: { type: "tool", name: "menu_extracted" },
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "url", url: data.imageUrl } },
              {
                type: "text",
                text:
                  "Wyodrębnij pełne menu z tego zdjęcia. Pogrupuj pozycje w logiczne kategorie " +
                  "zgodnie z tym co widać na zdjęciu (np. Przystawki, Dania główne, Desery, Napoje - " +
                  "użyj nazw kategorii z samego zdjęcia, jeśli są). Dla każdej pozycji podaj nazwę i " +
                  "cenę jeśli jest widoczna (jako tekst, np. '28 zł'). Pole opisu (description) " +
                  "wypełniaj TYLKO jeśli na zdjęciu jest wyraźnie czytelny, kompletny tekst opisu tej " +
                  "pozycji, i wtedy przepisz go dokładnie tak jak jest napisany - nie parafrazuj, nie " +
                  "składaj opisu z pojedynczych, rozmytych słów ani nie łącz fragmentów z różnych " +
                  "dań. Jeśli tekst opisu jest niewyraźny, częściowo nieczytelny, albo go po prostu " +
                  "nie ma - pomiń pole description całkowicie. Puste pole jest zawsze lepsze niż " +
                  "przybliżony lub zmyślony opis. Zachowaj oryginalne polskie nazwy dań i pisownię ze " +
                  "zdjęcia.",
              },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Anthropic API error (${res.status}): ${body.slice(0, 300)}`);
    }

    const json = (await res.json()) as {
      content: Array<{ type: string; input?: { categories?: MenuCategory[] } }>;
    };
    const toolUse = json.content.find((b) => b.type === "tool_use");
    const categories = toolUse?.input?.categories ?? [];
    if (categories.length === 0) {
      throw new Error("Nie udało się odczytać menu ze zdjęcia - spróbuj wyraźniejsze zdjęcie.");
    }

    return { categories };
  });
