import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { COLLAB_CONSENT_VERSION } from "./consent";

const schema = z.object({
  brand: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(200),
  message: z.string().trim().min(10).max(2000),
  consent: z.literal(true, { message: "Zgoda RODO jest wymagana." }),
  contact_consent: z.boolean().optional().default(false),
  consent_version: z.string().min(1).max(20),
  honeypot: z.string().max(0).optional().or(z.literal("")),
  elapsed_ms: z.number().int().nonnegative(),
  user_agent: z.string().max(500).optional(),
});


export const submitCollab = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data }) => {
    // Server-side anti-spam
    if (data.honeypot && data.honeypot.length > 0) {
      throw new Error("Wykryto bota.");
    }
    if (data.elapsed_ms < 3000) {
      throw new Error("Zwolnij na chwilę — wyślij formularz po krótkim odczekaniu.");
    }
    if (data.consent_version !== COLLAB_CONSENT_VERSION) {
      throw new Error(
        "Klauzula zgody została zaktualizowana. Odśwież stronę i zaakceptuj nową wersję.",
      );
    }
    // Block obvious link-spam
    const linkCount = (data.message.match(/https?:\/\//gi) ?? []).length;
    if (linkCount > 4) {
      throw new Error("Za dużo linków w wiadomości.");
    }

    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );

    const { error } = await supabase.from("collab_submissions").insert({
      brand: data.brand,
      email: data.email,
      message: data.message,
      consent_version: data.consent_version,
      consent_accepted_at: new Date().toISOString(),
      user_agent: data.user_agent ?? null,
    });

    if (error) {
      // RLS / CHECK constraint będzie ostatnią linią obrony
      throw new Error("Nie udało się zapisać zgłoszenia. Spróbuj ponownie.");
    }

    // Wyślij potwierdzenie tylko przy jawnej zgodzie na kontakt e-mailowy.
    if (data.contact_consent) {
      // Fire-and-forget confirmation email — never block or fail the submission.
      try {
        const { enqueueTransactionalEmailInternal } = await import(
          "./email/enqueue-internal.server"
        );
        const result = await enqueueTransactionalEmailInternal({
          templateName: "collab-confirmation",
          recipientEmail: data.email,
          idempotencyKey: `collab-confirmation-${data.email}-${Date.now()}`,
          templateData: { brandName: data.brand, message: data.message },
        });
        if (!result.ok) {
          console.warn("collab confirmation email not sent", result.reason);
        }
      } catch (mailErr) {
        console.error("collab confirmation email crashed", mailErr);
      }
    }


    return { ok: true as const };
  });
