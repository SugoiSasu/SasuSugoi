import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export const getPlaceTool = {
  name: "get_place",
  config: {
    title: "Get restaurant details",
    description:
      "Fetch full details for a single restaurant by its slug (e.g. 'gem-se-spot'). Returns name, cuisine, address, rating, description, phone, website, opening hours, menu, and cover image.",
    inputSchema: {
      slug: z
        .string()
        .trim()
        .min(1)
        .describe("Restaurant slug from the profile URL, e.g. 'gem-se-spot'."),
    },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  },
  handler: async ({ slug }: { slug: string }) => {
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
    const { data, error } = await supabase
      .from("places")
      .select("*, locations:place_locations(*)")
      .eq("slug", slug)
      .maybeSingle();
    if (error) return { content: [{ type: "text" as const, text: error.message }], isError: true };
    if (!data)
      return {
        content: [{ type: "text" as const, text: `No restaurant with slug '${slug}'.` }],
        isError: true,
      };
    const enriched = { ...data, url: `https://pozeramy.live/k/${slug}` };
    return {
      content: [{ type: "text" as const, text: JSON.stringify(enriched, null, 2) }],
      structuredContent: { place: enriched },
    };
  },
};
