import { createClient } from "@supabase/supabase-js";

export const listCuisinesTool = {
  name: "list_cuisines",
  config: {
    title: "List cuisines",
    description:
      "List all cuisine tags available in the poŻeramy directory (e.g. 'Polska', 'Włoska', 'Sushi'). Useful before calling search_places with a specific cuisine.",
    inputSchema: {},
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  },
  handler: async () => {
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
      .from("cuisines")
      .select("name, emoji")
      .eq("enabled", true)
      .order("sort_order");
    if (error) return { content: [{ type: "text" as const, text: error.message }], isError: true };
    return {
      content: [{ type: "text" as const, text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { cuisines: data ?? [] },
    };
  },
};
