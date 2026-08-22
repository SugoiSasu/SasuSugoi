import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

const nullableText = z.preprocess((value) => (value === "" ? null : value), z.string().max(500).nullable().optional());
const nullableUuid = z.preprocess((value) => (value === "" ? null : value), z.string().uuid().nullable().optional());
const nullableDate = z.preprocess((value) => (value === "" ? null : value), z.string().nullable().optional());

const nullableCta = z.preprocess((value) => (value === "" ? null : value), z.string().max(40).nullable().optional());

const adPayloadSchema = z.object({
  id: z.string().uuid().optional(),
  image_url: z.string().min(1).max(500),
  message: z.string().min(1).max(140),
  cta_label: nullableCta,
  link_url: nullableText,
  place_id: nullableUuid,
  active: z.boolean().optional(),
  starts_at: nullableDate,
  ends_at: nullableDate,
});

const adIdSchema = z.object({ id: z.string().uuid() });

async function assertSuperAdmin(supabase: SupabaseClient<Database>, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
  const isSuper = (data ?? []).some((row) => row.role === "super_admin");
  if (!isSuper) throw new Error("Forbidden: super_admin only");
}

export const upsertAdAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => adPayloadSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);

    const payload = {
      image_url: data.image_url,
      message: data.message,
      cta_label: data.cta_label ?? null,
      link_url: data.link_url ?? null,
      place_id: data.place_id ?? null,
      active: data.active ?? true,
      starts_at: data.starts_at ?? null,
      ends_at: data.ends_at ?? null,
    };

    if (data.id) {
      const { error } = await context.supabase.from("ads").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true };
    }

    const { error } = await context.supabase.from("ads").insert(payload);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteAdAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => adIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);

    const { error } = await context.supabase.from("ads").delete().eq("id", data.id);
    if (error) throw new Error(error.message);

    return { ok: true };
  });

export const duplicateAdAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => adIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);

    const { data: ad, error: readError } = await context.supabase
      .from("ads")
      .select("image_url,message,cta_label,link_url,place_id,starts_at,ends_at")
      .eq("id", data.id)
      .single();

    if (readError) throw new Error(readError.message);

    const { error } = await context.supabase.from("ads").insert({
      image_url: ad.image_url,
      message: `${ad.message} (kopia)`,
      cta_label: ad.cta_label,
      link_url: ad.link_url,
      place_id: ad.place_id,
      active: false,
      starts_at: ad.starts_at,
      ends_at: ad.ends_at,
    });

    if (error) throw new Error(error.message);
    return { ok: true };
  });
