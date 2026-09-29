import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/lib/use-auth";

export type TargetKind = "post" | "review" | "wall_comment" | "review_comment" | "place_post_comment";

export const REPORT_REASONS = [
  { id: "wulgaryzmy", label: "Wulgaryzmy" },
  { id: "nienawisc", label: "Mowa nienawiści" },
  { id: "przemoc", label: "Przemoc lub groźby" },
  { id: "erotyka", label: "Treści erotyczne" },
  { id: "spam", label: "Spam lub reklama" },
  { id: "inne", label: "Inne" },
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number]["id"];

export const KIND_LABEL: Record<TargetKind, string> = {
  post: "Wpis na Pożeralni",
  review: "Recenzja",
  wall_comment: "Komentarz (Pożeralnia)",
  review_comment: "Komentarz pod recenzją",
  place_post_comment: "Komentarz pod wpisem lokalu",
};

import { asError, dataBlokady, moderationMessage } from "@/lib/moderation-messages";
export { asError, moderationMessage };

/** Zglasza serwerowi zablokowana probe (log dla adminow). Best-effort, bez czekania. */
export function zglosZablokowanaProbe(text: string, gdzie: string) {
  void supabase.rpc("moderation_log_blocked", { _text: text, _where: gdzie }).then(
    () => {},
    () => {},
  );
}

const KOMUNIKATY_AKCJI: Record<string, string> = {
  forbidden: "Brak uprawnień do moderacji.",
  protected: "Nie można ukarać administratora.",
  self: "Nie możesz ukarać samego siebie.",
  super_only: "Blokadę stałą może nadać tylko super admin.",
  not_found: "Tej treści już nie ma.",
  own_content: "Nie możesz zgłosić własnej treści.",
  rate_limited: "Wysłałeś dziś już dużo zgłoszeń. Spróbuj jutro.",
  reason_required: "Podaj powód (min. 3 znaki).",
};
function bladAkcji(err: { message?: string } | null): Error {
  const m = err?.message ?? "";
  return new Error(KOMUNIKATY_AKCJI[m] ?? m ?? "Nie udało się");
}

/* ------------------------------------------------ status blokady */

export interface StatusBlokady {
  banned: boolean;
  permanent: boolean;
  expires_at: string | null;
  reason: string | null;
}

export function useMyBan() {
  const { user } = useUser();
  return useQuery({
    queryKey: ["my-ban", user?.id ?? null],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async (): Promise<StatusBlokady | null> => {
      const { data, error } = await supabase.rpc("my_ban_status");
      if (error) throw error;
      return ((data ?? [])[0] as StatusBlokady | undefined) ?? null;
    },
  });
}

export function opisBlokady(b: StatusBlokady): string {
  return b.permanent ? "Twoje konto ma stałą blokadę pisania." : dataBlokady(b.expires_at);
}

/* ------------------------------------------------ zgloszenia (uzytkownik) */

export function useReportContent() {
  return useMutation({
    mutationFn: async (v: { kind: TargetKind; id: string; reason: ReportReason; details?: string }) => {
      const { error } = await supabase.rpc("report_content", {
        _kind: v.kind,
        _id: v.id,
        _reason: v.reason,
        _details: v.details ?? undefined,
      });
      if (error) throw bladAkcji(error);
    },
  });
}

/* ------------------------------------------------ akcje moderatora */

export type AkcjaModeracji = "remove" | "warn" | "ban";

function odswiez(qc: ReturnType<typeof useQueryClient>) {
  for (const k of [
    "wall-feed",
    "wall-comments",
    "review-comments",
    "post-comments",
    "place-reviews",
    "admin",
    "user-reviews",
  ]) {
    qc.invalidateQueries({ queryKey: [k] });
  }
}

export function useModerationAct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: {
      kind: TargetKind;
      id: string;
      action: AkcjaModeracji;
      reason: string;
      days?: number | null;
    }) => {
      const { error } = await supabase.rpc("moderation_act", {
        _kind: v.kind,
        _id: v.id,
        _action: v.action,
        _reason: v.reason,
        _days: v.days ?? undefined,
      });
      if (error) throw bladAkcji(error);
    },
    onSuccess: () => odswiez(qc),
  });
}

/* ------------------------------------------------ panel: zgloszenia */

export interface Zgloszenie {
  id: string;
  reporter_id: string;
  target_kind: TargetKind;
  target_id: string;
  target_user_id: string | null;
  target_excerpt: string | null;
  target_image: string | null;
  reason: ReportReason;
  details: string | null;
  status: "open" | "actioned" | "dismissed";
  resolution: string | null;
  resolved_at: string | null;
  created_at: string;
}

export interface OsobaSkrot {
  id: string;
  username: string | null;
  display_name: string | null;
}

async function osoby(ids: string[]): Promise<Map<string, OsobaSkrot>> {
  const unikalne = [...new Set(ids.filter(Boolean))];
  if (!unikalne.length) return new Map();
  const { data } = await supabase.from("profiles").select("id, username, display_name").in("id", unikalne);
  return new Map(((data ?? []) as OsobaSkrot[]).map((p) => [p.id, p]));
}

export function useZgloszenia(status: "open" | "closed") {
  return useQuery({
    queryKey: ["admin", "content-reports", status],
    refetchInterval: 30_000,
    queryFn: async () => {
      let q = supabase.from("content_reports").select("*").order("created_at", { ascending: status === "open" });
      q = status === "open" ? q.eq("status", "open") : q.neq("status", "open").limit(100);
      const { data, error } = await q;
      if (error) throw error;
      const lista = (data ?? []) as Zgloszenie[];
      const ludzie = await osoby(lista.flatMap((z) => [z.reporter_id, z.target_user_id ?? ""]));
      // Ten sam wpis zgloszony przez kilka osob = jedna karta z licznikiem.
      const grupy = new Map<string, { glowne: Zgloszenie; wszystkie: Zgloszenie[] }>();
      for (const z of lista) {
        const k = `${z.target_kind}:${z.target_id}`;
        const g = grupy.get(k);
        if (g) g.wszystkie.push(z);
        else grupy.set(k, { glowne: z, wszystkie: [z] });
      }
      return [...grupy.values()].map((g) => ({
        ...g,
        zglaszajacy: g.wszystkie.map((z) => ludzie.get(z.reporter_id)),
        autor: g.glowne.target_user_id ? ludzie.get(g.glowne.target_user_id) : undefined,
      }));
    },
  });
}
export type GrupaZgloszen = NonNullable<ReturnType<typeof useZgloszenia>["data"]>[number];

export function useResolveReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: {
      reportId: string;
      action: "dismiss" | AkcjaModeracji;
      reason?: string;
      days?: number | null;
    }) => {
      const { error } = await supabase.rpc("moderation_resolve_report", {
        _report: v.reportId,
        _action: v.action,
        _reason: v.reason ?? undefined,
        _days: v.days ?? undefined,
      });
      if (error) throw bladAkcji(error);
    },
    onSuccess: () => odswiez(qc),
  });
}

/* ------------------------------------------------ panel: kary */

export interface Kara {
  id: string;
  user_id: string;
  kind: "warning" | "ban";
  reason: string;
  expires_at: string | null;
  created_at: string;
  revoked_at: string | null;
  source_kind: string | null;
  source_excerpt: string | null;
  osoba?: OsobaSkrot;
}

export function czyAktywna(k: Kara): boolean {
  if (k.revoked_at) return false;
  if (k.kind === "warning") return true;
  return !k.expires_at || new Date(k.expires_at) > new Date();
}

export function useKary() {
  return useQuery({
    queryKey: ["admin", "sanctions"],
    queryFn: async (): Promise<Kara[]> => {
      const { data, error } = await supabase
        .from("user_sanctions")
        .select("id, user_id, kind, reason, expires_at, created_at, revoked_at, source_kind, source_excerpt")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      const lista = (data ?? []) as Kara[];
      const ludzie = await osoby(lista.map((k) => k.user_id));
      return lista.map((k) => ({ ...k, osoba: ludzie.get(k.user_id) }));
    },
  });
}

export function useRevokeSanction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("moderation_revoke", { _sanction: id });
      if (error) throw bladAkcji(error);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin"] }),
  });
}

/* ------------------------------------------------ panel: slowa i log */

export interface Slowo {
  id: number;
  pattern: string;
  kind: "block" | "allow";
  note: string | null;
  enabled: boolean;
}

export function useSlowa() {
  return useQuery({
    queryKey: ["admin", "moderation-terms"],
    queryFn: async (): Promise<Slowo[]> => {
      const { data, error } = await supabase
        .from("moderation_terms")
        .select("id, pattern, kind, note, enabled")
        .order("kind")
        .order("id");
      if (error) throw error;
      return (data ?? []) as Slowo[];
    },
  });
}

export function useZapiszSlowo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { id?: number; pattern?: string; kind?: "block" | "allow"; note?: string; enabled?: boolean }) => {
      const { id, ...reszta } = v;
      const { error } = id
        ? await supabase.from("moderation_terms").update(reszta).eq("id", id)
        : await supabase.from("moderation_terms").insert({
            pattern: reszta.pattern!,
            kind: reszta.kind ?? "block",
            note: reszta.note ?? null,
          });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "moderation-terms"] }),
  });
}

export function useUsunSlowo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("moderation_terms").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "moderation-terms"] }),
  });
}

export interface WpisLogu {
  id: number;
  user_id: string | null;
  kind: string;
  excerpt: string | null;
  note: string | null;
  created_at: string;
  osoba?: OsobaSkrot;
}

export function useLogModeracji() {
  return useQuery({
    queryKey: ["admin", "moderation-log"],
    queryFn: async (): Promise<WpisLogu[]> => {
      const { data, error } = await supabase
        .from("moderation_log")
        .select("id, user_id, kind, excerpt, note, created_at")
        .neq("kind", "image_check")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      const lista = (data ?? []) as WpisLogu[];
      const ludzie = await osoby(lista.map((l) => l.user_id ?? ""));
      return lista.map((l) => ({ ...l, osoba: l.user_id ? ludzie.get(l.user_id) : undefined }));
    },
  });
}
