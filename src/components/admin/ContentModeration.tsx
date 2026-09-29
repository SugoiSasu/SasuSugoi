import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { pl } from "date-fns/locale";
import { Ban, Check, Loader2, Plus, ShieldAlert, Trash2, Undo2 } from "lucide-react";
import {
  KIND_LABEL,
  REPORT_REASONS,
  czyAktywna,
  useKary,
  useLogModeracji,
  useResolveReport,
  useRevokeSanction,
  useSlowa,
  useUsunSlowo,
  useZapiszSlowo,
  useZgloszenia,
  type AkcjaModeracji,
  type GrupaZgloszen,
  type Kara,
  type OsobaSkrot,
} from "@/lib/moderation-api";
import { DecyzjaDialog } from "@/components/ContentMenu";
import { AdminEmptyState } from "@/components/admin/AdminControls";

const ETYKIETA_POWODU = Object.fromEntries(REPORT_REASONS.map((r) => [r.id, r.label])) as Record<string, string>;

function ile(iso: string) {
  return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: pl });
}

function Osoba({ o, fallback }: { o?: OsobaSkrot; fallback?: string }) {
  const nazwa = o?.display_name || (o?.username ? `@${o.username}` : fallback ?? "nieznany");
  return o?.username ? (
    <Link to="/u/$username" params={{ username: o.username }} className="font-semibold hover:text-tomato">
      {nazwa}
    </Link>
  ) : (
    <span className="font-semibold">{nazwa}</span>
  );
}

function Ladowanie() {
  return (
    <div className="grid place-items-center py-16">
      <Loader2 className="animate-spin text-tomato" size={26} />
    </div>
  );
}

/* ============================================================ zgloszenia */

export function ZgloszeniaPanel() {
  const [widok, setWidok] = useState<"open" | "closed">("open");
  const { data, isLoading } = useZgloszenia(widok);
  const { data: kary } = useKary();
  const resolve = useResolveReport();
  const [decyzja, setDecyzja] = useState<{ g: GrupaZgloszen; akcja: AkcjaModeracji } | null>(null);

  const ostrzezenia = useMemo(() => {
    const m = new Map<string, number>();
    for (const k of kary ?? []) if (k.kind === "warning" && !k.revoked_at) m.set(k.user_id, (m.get(k.user_id) ?? 0) + 1);
    return m;
  }, [kary]);

  async function odrzuc(g: GrupaZgloszen) {
    try {
      await resolve.mutateAsync({ reportId: g.glowne.id, action: "dismiss" });
      toast.success("Zgłoszenie odrzucone.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Nie udało się");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(
          [
            ["open", "Do sprawdzenia"],
            ["closed", "Rozpatrzone"],
          ] as const
        ).map(([k, l]) => (
          <button
            key={k}
            type="button"
            onClick={() => setWidok(k)}
            aria-pressed={widok === k}
            className={`chip text-xs ${widok === k ? "bg-navy text-cream" : "bg-card border border-border"}`}
          >
            {l}
          </button>
        ))}
      </div>

      {isLoading ? (
        <Ladowanie />
      ) : !data?.length ? (
        <AdminEmptyState
          title={widok === "open" ? "Brak zgłoszeń do sprawdzenia" : "Nic jeszcze nie rozpatrzono"}
          hint={widok === "open" ? "Gdy ktoś zgłosi wpis lub komentarz, pojawi się tutaj." : undefined}
        />
      ) : (
        <ul className="space-y-3">
          {data.map((g) => {
            const z = g.glowne;
            const powody = new Map<string, number>();
            g.wszystkie.forEach((x) => powody.set(x.reason, (powody.get(x.reason) ?? 0) + 1));
            const wUserze = z.target_user_id ? (ostrzezenia.get(z.target_user_id) ?? 0) : 0;
            return (
              <li key={`${z.target_kind}:${z.target_id}`} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-muted px-2.5 py-1 font-semibold">{KIND_LABEL[z.target_kind]}</span>
                  {[...powody].map(([r, n]) => (
                    <span key={r} className="rounded-full bg-tomato/12 px-2.5 py-1 font-bold text-tomato">
                      {ETYKIETA_POWODU[r] ?? r}
                      {n > 1 ? ` ×${n}` : ""}
                    </span>
                  ))}
                  <span className="text-muted-foreground">{ile(z.created_at)}</span>
                  {g.wszystkie.length > 1 && (
                    <span className="font-semibold text-tomato">{g.wszystkie.length} zgłaszających</span>
                  )}
                </div>

                <div className="mt-3 rounded-xl bg-background p-3 text-sm">
                  {z.target_excerpt ? (
                    <p className="whitespace-pre-wrap break-words">{z.target_excerpt}</p>
                  ) : (
                    <p className="text-muted-foreground">(bez tekstu)</p>
                  )}
                  {z.target_image && (
                    <img src={z.target_image} alt="" className="mt-2 max-h-40 rounded-lg object-cover" loading="lazy" />
                  )}
                </div>

                <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                  <div>
                    Autor: <Osoba o={g.autor} />
                    {wUserze > 0 && (
                      <span className="ml-2 rounded-full bg-destructive/10 px-2 py-0.5 font-bold text-destructive">
                        {wUserze} {wUserze === 1 ? "ostrzeżenie" : wUserze < 5 ? "ostrzeżenia" : "ostrzeżeń"}
                        {wUserze >= 2 ? " - rozważ ban" : ""}
                      </span>
                    )}
                  </div>
                  <div>
                    Zgłosił(a): {g.zglaszajacy.map((o, i) => (
                      <span key={i}>
                        {i > 0 && ", "}
                        <Osoba o={o} />
                      </span>
                    ))}
                    {z.details && <span className="ml-1 italic">- „{z.details}”</span>}
                  </div>
                </div>

                {widok === "open" ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => odrzuc(g)}
                      disabled={resolve.isPending}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-2 text-xs font-semibold hover:border-ok hover:text-ok disabled:opacity-50"
                    >
                      <Check size={13} /> Odrzuć zgłoszenie
                    </button>
                    <button
                      type="button"
                      onClick={() => setDecyzja({ g, akcja: "remove" })}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-2 text-xs font-semibold hover:border-tomato hover:text-tomato"
                    >
                      <Trash2 size={13} /> Usuń
                    </button>
                    <button
                      type="button"
                      onClick={() => setDecyzja({ g, akcja: "warn" })}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-2 text-xs font-semibold hover:border-tomato hover:text-tomato"
                    >
                      <ShieldAlert size={13} /> Usuń i ostrzeż
                    </button>
                    <button
                      type="button"
                      onClick={() => setDecyzja({ g, akcja: "ban" })}
                      className="inline-flex items-center gap-1.5 rounded-full bg-destructive px-3.5 py-2 text-xs font-semibold text-destructive-foreground hover:bg-destructive/90"
                    >
                      <Ban size={13} /> Usuń i zbanuj
                    </button>
                  </div>
                ) : (
                  <div className="mt-3 text-xs font-semibold text-muted-foreground">
                    Decyzja:{" "}
                    {{ dismissed: "odrzucone", remove: "usunięto", warn: "usunięto i ostrzeżono", ban: "usunięto i zbanowano" }[
                      z.resolution ?? "dismissed"
                    ] ?? z.resolution}
                    {z.resolved_at && ` · ${ile(z.resolved_at)}`}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {decyzja && (
        <DecyzjaDialog
          akcja={decyzja.akcja}
          kind={decyzja.g.glowne.target_kind}
          id={decyzja.g.glowne.target_id}
          reportId={decyzja.g.glowne.id}
          dla={decyzja.g.autor?.display_name || decyzja.g.autor?.username || undefined}
          onClose={() => setDecyzja(null)}
        />
      )}
    </div>
  );
}

/* ============================================================ kary */

function opisKary(k: Kara): { tekst: string; ton: string } {
  if (k.revoked_at) return { tekst: "Cofnięte", ton: "bg-muted text-muted-foreground" };
  if (k.kind === "warning") return { tekst: "Ostrzeżenie", ton: "bg-mustard/25 text-navy" };
  if (!k.expires_at) return { tekst: "Ban stały", ton: "bg-destructive text-destructive-foreground" };
  if (new Date(k.expires_at) <= new Date()) return { tekst: "Ban wygasł", ton: "bg-muted text-muted-foreground" };
  return {
    tekst: `Ban do ${new Date(k.expires_at).toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit" })}`,
    ton: "bg-destructive/15 text-destructive",
  };
}

export function KaryPanel() {
  const { data, isLoading } = useKary();
  const cofnij = useRevokeSanction();
  const [tylkoAktywne, setTylkoAktywne] = useState(true);
  const lista = (data ?? []).filter((k) => !tylkoAktywne || czyAktywna(k));

  const ostrzezenia = useMemo(() => {
    const m = new Map<string, number>();
    for (const k of data ?? []) if (k.kind === "warning" && !k.revoked_at) m.set(k.user_id, (m.get(k.user_id) ?? 0) + 1);
    return m;
  }, [data]);

  async function zdejmij(k: Kara) {
    if (!confirm(k.kind === "ban" ? "Zdjąć blokadę? Użytkownik znowu będzie mógł pisać." : "Cofnąć ostrzeżenie?")) return;
    try {
      await cofnij.mutateAsync(k.id);
      toast.success("Cofnięte.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Nie udało się");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(
          [
            [true, "Aktywne"],
            [false, "Wszystkie"],
          ] as const
        ).map(([v, l]) => (
          <button
            key={l}
            type="button"
            onClick={() => setTylkoAktywne(v)}
            aria-pressed={tylkoAktywne === v}
            className={`chip text-xs ${tylkoAktywne === v ? "bg-navy text-cream" : "bg-card border border-border"}`}
          >
            {l}
          </button>
        ))}
      </div>
      {isLoading ? (
        <Ladowanie />
      ) : !lista.length ? (
        <AdminEmptyState title="Brak kar" hint="Ostrzeżenia i bany pojawią się tu po pierwszej decyzji moderatora." />
      ) : (
        <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
          {lista.map((k) => {
            const o = opisKary(k);
            const n = ostrzezenia.get(k.user_id) ?? 0;
            return (
              <li key={k.id} className="flex flex-wrap items-start gap-x-4 gap-y-2 px-4 py-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Osoba o={k.osoba} />
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${o.ton}`}>{o.tekst}</span>
                    {k.kind === "warning" && n >= 3 && !k.revoked_at && (
                      <span className="text-[11px] font-bold text-destructive">{n} ostrzeżeń - czas na bana</span>
                    )}
                  </div>
                  <p className="text-sm">{k.reason}</p>
                  {k.source_excerpt && (
                    <p className="line-clamp-2 text-xs italic text-muted-foreground">„{k.source_excerpt}”</p>
                  )}
                  <p className="text-[11px] text-muted-foreground">{ile(k.created_at)}</p>
                </div>
                {czyAktywna(k) && (
                  <button
                    type="button"
                    onClick={() => zdejmij(k)}
                    disabled={cofnij.isPending}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-2 text-xs font-semibold hover:border-ok hover:text-ok disabled:opacity-50"
                  >
                    <Undo2 size={13} /> {k.kind === "ban" ? "Zdejmij blokadę" : "Cofnij"}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ============================================================ slowa i log */

export function SlowaPanel() {
  const { data: slowa, isLoading } = useSlowa();
  const { data: log } = useLogModeracji();
  const zapisz = useZapiszSlowo();
  const usun = useUsunSlowo();
  const [wzorzec, setWzorzec] = useState("");
  const [notatka, setNotatka] = useState("");
  const [rodzaj, setRodzaj] = useState<"block" | "allow">("block");

  async function dodaj() {
    if (!wzorzec.trim()) return;
    try {
      await zapisz.mutateAsync({ pattern: wzorzec.trim().toLowerCase(), kind: rodzaj, note: notatka.trim() || undefined });
      setWzorzec("");
      setNotatka("");
      toast.success("Dodano.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Nie udało się dodać");
    }
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div>
          <h2 className="font-display text-xl">Zabronione słowa</h2>
          <p className="max-w-prose text-xs text-muted-foreground">
            Wpis lub komentarz z takim słowem nie zostanie opublikowany. Dopasowanie działa po normalizacji, więc łapie
            też „k.u.r.w.a”, „k u r w a” i „kurw4”. Lista „wyjątków” oznacza słowa, które wyglądają jak przekleństwo, a
            nim nie są (np. „zajebisty” w recenzji). Wzorce to wyrażenia regularne; <code>\y</code> = granica słowa.
          </p>
        </div>
        <div className="grid gap-2 rounded-2xl border border-border bg-card p-3 sm:grid-cols-[1fr_1fr_auto_auto]">
          <input
            value={wzorzec}
            onChange={(e) => setWzorzec(e.target.value)}
            placeholder="wzorzec, np. \ydrugie\y"
            aria-label="Wzorzec"
            className="input"
          />
          <input value={notatka} onChange={(e) => setNotatka(e.target.value)} placeholder="notatka (opcjonalnie)" aria-label="Notatka" className="input" />
          <select value={rodzaj} onChange={(e) => setRodzaj(e.target.value as "block" | "allow")} aria-label="Rodzaj" className="input">
            <option value="block">Blokuj</option>
            <option value="allow">Wyjątek</option>
          </select>
          <button
            type="button"
            onClick={dodaj}
            disabled={zapisz.isPending || !wzorzec.trim()}
            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-tomato px-4 py-2 text-sm font-semibold text-cream disabled:opacity-50"
          >
            <Plus size={14} /> Dodaj
          </button>
        </div>
        {isLoading ? (
          <Ladowanie />
        ) : (
          <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
            {(slowa ?? []).map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
                <code className={`rounded bg-muted px-2 py-0.5 text-xs ${s.enabled ? "" : "line-through opacity-50"}`}>{s.pattern}</code>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${s.kind === "block" ? "bg-destructive/12 text-destructive" : "bg-ok/12 text-ok"}`}>
                  {s.kind === "block" ? "blokuj" : "wyjątek"}
                </span>
                <span className="flex-1 text-xs text-muted-foreground">{s.note}</span>
                <button
                  type="button"
                  onClick={() => zapisz.mutate({ id: s.id, enabled: !s.enabled })}
                  className="text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                  {s.enabled ? "Wyłącz" : "Włącz"}
                </button>
                <button
                  type="button"
                  onClick={() => confirm("Usunąć wzorzec?") && usun.mutate(s.id)}
                  aria-label="Usuń wzorzec"
                  className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 size={13} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="font-display text-xl">Zablokowane próby</h2>
          <p className="text-xs text-muted-foreground">Kto i co próbował opublikować mimo filtra (ostatnie 100). Kto się upiera, ten kandydat do ostrzeżenia.</p>
        </div>
        {!log?.length ? (
          <AdminEmptyState title="Brak zablokowanych prób" />
        ) : (
          <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
            {log.map((l) => (
              <li key={l.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
                <Osoba o={l.osoba} fallback="?" />
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold">
                  {l.kind === "text_blocked" ? "tekst" : l.kind === "image_blocked" ? "zdjęcie" : "błąd kontroli"}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs italic text-muted-foreground">{l.excerpt ?? l.note}</span>
                <span className="text-[11px] text-muted-foreground">{l.note && l.excerpt ? `${l.note} · ` : ""}{ile(l.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
