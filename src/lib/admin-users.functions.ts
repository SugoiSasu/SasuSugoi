import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const deleteUserAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId: callerId } = context;

    // Verify caller is super_admin
    const { data: roles, error: rErr } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId);
    if (rErr) throw new Error(rErr.message);
    const isSuper = (roles ?? []).some((r) => r.role === "super_admin");
    if (!isSuper) throw new Error("Forbidden: super_admin only");

    if (data.userId === callerId) {
      throw new Error("Nie możesz usunąć własnego konta z panelu admina");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (delErr) throw new Error(delErr.message);

    // Log before the row can vanish under an FK cascade from some future
    // schema change - target_user_id is ON DELETE SET NULL, but the details
    // blob keeps the id regardless.
    await supabaseAdmin.from("admin_audit_log").insert({
      actor_id: callerId,
      action: "delete_user_account",
      target_user_id: data.userId,
      details: { userId: data.userId },
    });

    return { ok: true };
  });

/** Self-service account deletion (GDPR Art. 17) - any authenticated user may
 * delete their own account. Deleting the auth.users row cascades through
 * every table with an ON DELETE CASCADE user_id FK (reviews, friendships,
 * favorites, notifications, etc.). */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
