import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export const searchPlacesTool = {
  name: "search_places",
  config: {
    title: "Search restaurants",
    description:
      "Search restaurants (knajpy) in the poŻeramy directory by free-text query. Matches on name, cuisine, district, and address. Returns up to 20 results with slug, name, cuisine, address, rating, and profile URL.",
    inputSchema: {
      query: z
        .string()
        .trim()
        .min(1)
        .describe(
          "Free-text query — restaurant name, cuisine (e.g. 'ramen', 'włoska'), district, or address.",
        ),
      limit: z
        .number()
        .int()
        .min(1)
        .max(20)
        .optional()
        .describe("Max results (default 10, max 20)."),
    },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  },
  handler: async ({ query, limit }: { query: string; limit?: number }) => {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) {
      return {
        content: [{ type: "text" as const, text: "Server misconfigured: missing Supabase env." }],
        isError: true,
      };
    }
    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const max = limit ?? 10;
    const like = `%${query}%`;
    const { data, error } = await supabase
      .from("places")
      .select("slug, name, cuisine, address, district, rating, cover_image_url")
      .or(`name.ilike.${like},cuisine.ilike.${like},district.ilike.${like},address.ilike.${like}`)
      .order("rating", { ascending: false })
      .limit(max);
    if (error) return { content: [{ type: "text" as const, text: error.message }], isError: true };
    const rows = (data ?? []).map((r) => ({
      ...r,
      url: `https://pozeramy.live/k/${r.slug}`,
    }));
    return {
      content: [{ type: "text" as const, text: JSON.stringify(rows, null, 2) }],
      structuredContent: { results: rows, count: rows.length },
    };
  },
};
