import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* Zgłoszenie właściciela - zalogowany użytkownik. */
export const submitOwnerRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        placeId: z.string().uuid(),
        name: z.string().trim().min(2).max(120),
        email: z.string().trim().email().max(255),
        instagram_url: z.string().trim().url().max(300).optional().or(z.literal("")),
        website_url: z.string().trim().url().max(300).optional().or(z.literal("")),
        message: z.string().trim().max(2000).optional().or(z.literal("")),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("owner_requests").insert({
      place_id: data.placeId,
      user_id: userId,
      name: data.name,
      email: data.email,
      instagram_url: data.instagram_url || null,
      website_url: data.website_url || null,
      message: data.message || null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* Zatwierdzenie zgłoszenia - tylko admin/super_admin. */
export const approveOwnerRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ requestId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: adminRoles, error: rErr } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (rErr) throw new Error(rErr.message);
    const isSuperAdmin = (adminRoles ?? []).some((r) => r.role === "super_admin");
    if (!isSuperAdmin) throw new Error("Forbidden");

    const { data: req, error: qErr } = await supabase
      .from("owner_requests")
      .select("id, place_id, user_id, status")
      .eq("id", data.requestId)
      .maybeSingle();
    if (qErr) throw new Error(qErr.message);
    if (!req) throw new Error("Zgłoszenie nie istnieje");
    if (req.status !== "pending") throw new Error("Zgłoszenie już rozpatrzone");
    if (!req.user_id) throw new Error("Zgłoszenie bez konta użytkownika - poproś o rejestrację");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error: insErr } = await supabaseAdmin
      .from("place_owners")
      .upsert(
        {
          user_id: req.user_id,
          place_id: req.place_id,
          verified: true,
        },
        { onConflict: "place_id" },
      );
    if (insErr) throw new Error(insErr.message);

    const { error: updErr } = await supabaseAdmin
      .from("owner_requests")
      .update({
        status: "approved",
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.requestId);
    if (updErr) throw new Error(updErr.message);

    // Powiadom właściciela
    await supabaseAdmin.from("notifications").insert({
      user_id: req.user_id,
      type: "owner_approved",
      title: "Twoje zgłoszenie zostało zatwierdzone",
      body: "Możesz teraz zarządzać profilem swojej knajpy.",
      link: "/",
      ref_type: "place",
      ref_id: req.place_id,
    });

    return { ok: true };
  });

export const rejectOwnerRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ requestId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: adminRoles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const isSuperAdmin = (adminRoles ?? []).some((r) => r.role === "super_admin");
    if (!isSuperAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("owner_requests")
      .update({
        status: "rejected",
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.requestId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
