import { useState } from "react";
import { toast } from "sonner";
import { Ban, Flag, Loader2, MoreHorizontal, ShieldAlert, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin, useIsSuperAdmin, useUser } from "@/lib/use-auth";
import {
  REPORT_REASONS,
  useModerationAct,
  useReportContent,
  useResolveReport,
  type AkcjaModeracji,
  type ReportReason,
  type TargetKind,
} from "@/lib/moderation-api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const TABELA: Record<TargetKind, string> = {
  post: "wall_posts",
  review: "reviews",
  wall_comment: "wall_comments",
  review_comment: "review_comments",
  place_post_comment: "place_post_comments",
};

const SZYBKIE_POWODY = ["Wulgaryzmy", "Mowa nienawiści", "Spam lub reklama", "Treści nieodpowiednie", "Groźby"];

/**
 * Menu "⋯" przy wpisie, recenzji albo komentarzu (Mateusz 2026-09-29):
 *  - autor: Usun,
 *  - inny uzytkownik: Zglos,
 *  - admin: dodatkowo Usun / Usun i ostrzez / Usun i zbanuj - od razu, bez
 *    przechodzenia do panelu.
 * Uprawnienia egzekwuje baza (RPC moderation_act) - ukrycie pozycji w menu to
 * tylko wygoda.
 */
export function ContentMenu({
  kind,
  id,
  authorId,
  ownDelete = true,
  onDeleted,
  className = "",
}: {
  kind: TargetKind;
  id: string;
  authorId: string | null | undefined;
  /** false, gdy komponent sam ma juz przycisk usuwania (komentarze). */
  ownDelete?: boolean;
  onDeleted?: () => void;
  className?: string;
}) {
  const { user } = useUser();
  const { data: isAdmin } = useIsAdmin();
  const qc = useQueryClient();
  const [raport, setRaport] = useState(false);
  const [decyzja, setDecyzja] = useState<AkcjaModeracji | null>(null);
  const [potwierdzUsun, setPotwierdzUsun] = useState(false);
  const [usuwam, setUsuwam] = useState(false);

  if (!user || !id) return null;
  const mojaTresc = authorId === user.id;
  const mozeUsunac = mojaTresc && ownDelete;
  if (!mojaTresc && !authorId) return null;
  if (mojaTresc && !ownDelete) return null;

  async function usunWlasna() {
    setUsuwam(true);
    const { error } = await supabase
      .from(TABELA[kind] as "wall_posts")
      .delete()
      .eq("id", id);
    setUsuwam(false);
    if (error) {
      toast.error("Nie udało się usunąć.");
      return;
    }
    setPotwierdzUsun(false);
    toast.success("Usunięto.");
    for (const k of ["wall-feed", "place-reviews", "user-reviews", "my-review", "wall-comments", "review-comments"]) {
      qc.invalidateQueries({ queryKey: [k] });
    }
    onDeleted?.();
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Więcej opcji"
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tomato ${className}`}
        >
          <MoreHorizontal size={16} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {mozeUsunac && (
            <DropdownMenuItem onSelect={() => setPotwierdzUsun(true)} className="gap-2 text-destructive focus:text-destructive">
              <Trash2 size={15} /> Usuń
            </DropdownMenuItem>
          )}
          {!mojaTresc && (
            <DropdownMenuItem onSelect={() => setRaport(true)} className="gap-2">
              <Flag size={15} /> Zgłoś
            </DropdownMenuItem>
          )}
          {isAdmin && !mojaTresc && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
                <ShieldAlert size={12} /> Moderator
              </DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => setDecyzja("remove")} className="gap-2">
                <Trash2 size={15} /> Usuń treść
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setDecyzja("warn")} className="gap-2">
                <ShieldAlert size={15} /> Usuń i ostrzeż
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setDecyzja("ban")} className="gap-2 text-destructive focus:text-destructive">
                <Ban size={15} /> Usuń i zbanuj
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Potwierdzenie usuniecia wlasnej tresci */}
      <Dialog open={potwierdzUsun} onOpenChange={(o) => !usuwam && setPotwierdzUsun(o)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Usunąć?</DialogTitle>
            <DialogDescription>
              {kind === "review"
                ? "Recenzja zniknie, a punkty za nią zostaną cofnięte."
                : kind === "post"
                  ? "Wpis zniknie razem z reakcjami i komentarzami."
                  : "Tej operacji nie da się cofnąć."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <button type="button" onClick={() => setPotwierdzUsun(false)} className="chip border border-border bg-card">
              Anuluj
            </button>
            <button
              type="button"
              onClick={usunWlasna}
              disabled={usuwam}
              className="inline-flex items-center gap-2 rounded-full bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground disabled:opacity-60"
            >
              {usuwam && <Loader2 size={14} className="animate-spin" />} Usuń
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ZglosDialog open={raport} onClose={() => setRaport(false)} kind={kind} id={id} />
      {decyzja && (
        <DecyzjaDialog akcja={decyzja} kind={kind} id={id} onClose={() => setDecyzja(null)} onDone={onDeleted} />
      )}
    </>
  );
}

/* ----------------------------------------------------------- zgloszenie */

function ZglosDialog({ open, onClose, kind, id }: { open: boolean; onClose: () => void; kind: TargetKind; id: string }) {
  const [powod, setPowod] = useState<ReportReason | null>(null);
  const [opis, setOpis] = useState("");
  const zglos = useReportContent();

  async function wyslij() {
    if (!powod) return;
    try {
      await zglos.mutateAsync({ kind, id, reason: powod, details: opis.trim() || undefined });
      toast.success("Dziękujemy! Zgłoszenie trafiło do moderatorów.");
      setPowod(null);
      setOpis("");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Nie udało się wysłać zgłoszenia");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !zglos.isPending && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Zgłoś treść</DialogTitle>
          <DialogDescription>Co jest nie tak? Moderator sprawdzi to jak najszybciej.</DialogDescription>
        </DialogHeader>
        <div role="radiogroup" aria-label="Powód zgłoszenia" className="flex flex-col gap-1.5">
          {REPORT_REASONS.map((r) => (
            <button
              key={r.id}
              type="button"
              role="radio"
              aria-checked={powod === r.id}
              onClick={() => setPowod(r.id)}
              className={`flex min-h-11 items-center gap-3 rounded-xl border px-3 py-2 text-left text-sm transition ${
                powod === r.id ? "border-tomato bg-tomato/10 font-semibold" : "border-border hover:border-tomato/60"
              }`}
            >
              <span
                className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border-2 ${powod === r.id ? "border-tomato" : "border-muted-foreground/40"}`}
              >
                {powod === r.id && <span className="h-2 w-2 rounded-full bg-tomato" />}
              </span>
              {r.label}
            </button>
          ))}
        </div>
        <textarea
          value={opis}
          onChange={(e) => setOpis(e.target.value)}
          maxLength={500}
          rows={3}
          placeholder="Dodatkowy opis (opcjonalnie)"
          aria-label="Dodatkowy opis"
          className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-tomato"
        />
        <DialogFooter className="gap-2 sm:gap-2">
          <button type="button" onClick={onClose} className="chip border border-border bg-card">
            Anuluj
          </button>
          <button
            type="button"
            onClick={wyslij}
            disabled={!powod || zglos.isPending}
            className="inline-flex items-center gap-2 rounded-full bg-tomato px-4 py-2 text-sm font-semibold text-cream disabled:opacity-50"
          >
            {zglos.isPending && <Loader2 size={14} className="animate-spin" />} Wyślij zgłoszenie
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ----------------------------------------------------------- decyzja moderatora */

const OPISY: Record<AkcjaModeracji, { tytul: string; przycisk: string; opis: string }> = {
  remove: { tytul: "Usuń treść", przycisk: "Usuń", opis: "Treść zniknie, a autor dostanie powiadomienie z powodem." },
  warn: { tytul: "Usuń i ostrzeż", przycisk: "Usuń i ostrzeż", opis: "Treść zniknie, a autor dostanie ostrzeżenie zapisane w jego historii." },
  ban: { tytul: "Usuń i zbanuj", przycisk: "Usuń i zbanuj", opis: "Treść zniknie, a autor nie będzie mógł pisać (przeglądać nadal może)." },
};

export function DecyzjaDialog({
  akcja,
  kind,
  id,
  onClose,
  onDone,
  dla,
  reportId,
}: {
  akcja: AkcjaModeracji;
  kind: TargetKind;
  id: string;
  onClose: () => void;
  onDone?: () => void;
  /** Gdy decyzja dotyczy zgloszenia - dziala tez, gdy tresc zostala juz usunieta. */
  reportId?: string;
  /** Krotki opis tresci/autora nad formularzem. */
  dla?: string;
}) {
  const isSuper = useIsSuperAdmin();
  const [powod, setPowod] = useState("");
  const [dni, setDni] = useState<string>("7");
  const act = useModerationAct();
  const resolve = useResolveReport();
  const pending = act.isPending || resolve.isPending;
  const o = OPISY[akcja];

  async function zatwierdz() {
    const days = akcja === "ban" ? (dni === "stale" ? null : Number(dni)) : null;
    try {
      if (reportId) await resolve.mutateAsync({ reportId, action: akcja, reason: powod.trim(), days });
      else await act.mutateAsync({ kind, id, action: akcja, reason: powod.trim(), days });
      toast.success(akcja === "remove" ? "Treść usunięta." : akcja === "warn" ? "Usunięto i ostrzeżono autora." : "Usunięto i zbanowano autora.");
      onClose();
      onDone?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Nie udało się");
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{o.tytul}</DialogTitle>
          <DialogDescription>{dla ? `${dla} - ${o.opis}` : o.opis}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground" htmlFor="pz-powod">
              Powód (widzi go autor)
            </label>
            <input
              id="pz-powod"
              value={powod}
              onChange={(e) => setPowod(e.target.value)}
              maxLength={200}
              placeholder="np. Wulgaryzmy w komentarzu"
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-tomato"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {SZYBKIE_POWODY.map((p) => (
                <button key={p} type="button" onClick={() => setPowod(p)} className="rounded-full border border-border px-2.5 py-1 text-xs hover:border-tomato hover:text-tomato">
                  {p}
                </button>
              ))}
            </div>
          </div>
          {akcja === "ban" && (
            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Na jak długo</div>
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Czas bana">
                {[
                  ["1", "1 dzień"],
                  ["7", "7 dni"],
                  ["30", "30 dni"],
                  ...(isSuper ? ([["stale", "Na stałe"]] as [string, string][]) : []),
                ].map(([v, l]) => (
                  <button
                    key={v}
                    type="button"
                    role="radio"
                    aria-checked={dni === v}
                    onClick={() => setDni(v)}
                    className={`rounded-full border px-3.5 py-2 text-sm font-semibold transition ${
                      dni === v ? "border-destructive bg-destructive text-destructive-foreground" : "border-border hover:border-destructive"
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
              {!isSuper && <p className="mt-1.5 text-xs text-muted-foreground">Ban na stałe może nadać tylko super admin.</p>}
            </div>
          )}
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <button type="button" onClick={onClose} className="chip border border-border bg-card">
            Anuluj
          </button>
          <button
            type="button"
            onClick={zatwierdz}
            disabled={powod.trim().length < 3 || pending}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-50 ${
              akcja === "ban" ? "bg-destructive text-destructive-foreground" : "bg-tomato text-cream"
            }`}
          >
            {pending && <Loader2 size={14} className="animate-spin" />} {o.przycisk}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
