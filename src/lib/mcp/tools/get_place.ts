import { defineTool } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export default defineTool({
  name: "get_place",
  title: "Get restaurant details",
  description:
    "Fetch full details for a single restaurant by its slug (e.g. 'gem-se-spot'). Returns name, cuisine, address, rating, description, phone, website, opening hours, menu, and cover image.",
  inputSchema: {
    slug: z.string().trim().min(1).describe("Restaurant slug from the profile URL, e.g. 'gem-se-spot'."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ slug }) => {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) {
      return { content: [{ type: "text", text: "Server misconfigured: missing Supabase env." }], isError: true };
    }
    const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await supabase
      .from("places")
      .select("*, locations:place_locations(*)")
      .eq("slug", slug)
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data) return { content: [{ type: "text", text: `No restaurant with slug '${slug}'.` }], isError: true };
    const enriched = { ...data, url: `https://pozeramy.live/k/${slug}` };
    return {
      content: [{ type: "text", text: JSON.stringify(enriched, null, 2) }],
      structuredContent: { place: enriched },
    };
  },
});
