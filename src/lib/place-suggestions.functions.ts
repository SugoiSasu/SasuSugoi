import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  name: z.string().trim().min(2).max(150),
  address: z.string().trim().max(200).optional().default(""),
  cuisine: z.string().trim().max(50).optional().default(""),
  website: z.string().trim().max(300).optional().default(""),
  instagram: z.string().trim().max(100).optional().default(""),
  notes: z.string().trim().max(1000).optional().default(""),
  submitter_name: z.string().trim().max(100).optional().default(""),
  submitter_email: z.string().trim().max(200).optional().default(""),
  honeypot: z.string().max(0).optional().or(z.literal("")),
  elapsed_ms: z.number().int().nonnegative(),
});

/** Public — anyone (incl. anonymous visitors) can submit a place suggestion,
 * same server-side anti-spam pattern as submitCollab (honeypot + timing). */
export const submitPlaceSuggestion = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data }) => {
    if (data.honeypot && data.honeypot.length > 0) {
      throw new Error("Wykryto bota.");
    }
    if (data.elapsed_ms < 2000) {
      throw new Error("Zwolnij na chwilę — wyślij formularz po krótkim odczekaniu.");
    }
    const linkCount = (data.notes.match(/https?:\/\//gi) ?? []).length;
    if (linkCount > 3) {
      throw new Error("Za dużo linków w uwagach.");
    }

    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );

    const { error } = await supabase.from("place_suggestions").insert({
      name: data.name,
      address: data.address || null,
      cuisine: data.cuisine || null,
      website: data.website || null,
      instagram: data.instagram || null,
      notes: data.notes || null,
      submitter_name: data.submitter_name || null,
      submitter_email: data.submitter_email || null,
    });

    if (error) {
      throw new Error("Nie udało się zapisać zgłoszenia. Spróbuj ponownie.");
    }

    return { ok: true as const };
  });
