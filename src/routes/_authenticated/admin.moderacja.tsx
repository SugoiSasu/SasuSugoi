import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Check,
  X,
  ExternalLink,
  Loader2,
  Trash2,
  MapPin,
  CheckCircle2,
  XCircle,
  Mail,
  Instagram,
  Globe,
  MessageSquare,
  Lightbulb,
  Store,
  ShieldCheck,
} from "lucide-react";
import {
  AdminPageHeader,
  AdminStatBar,
  type AdminStat,
} from "@/components/admin/AdminPageShell";
import {
  usePlaceSuggestions,
  useApproveSuggestion,
  useRejectSuggestion,
  useDeleteSuggestion,
  type PlaceSuggestion,
} from "@/lib/place-suggestions-api";
import { useAdminOwnerRequests, useApproveOwnerRequest, useRejectOwnerRequest } from "@/lib/owners-api";
import { useIsSuperAdmin } from "@/lib/use-auth";
import { useBulkAction } from "@/components/admin/useBulkAction";
import { formatDistanceToNow } from "date-fns";
import { pl } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/admin/moderacja")({
  head: () => ({ meta: [{ title: "Moderacja - Panel admina" }] }),
  component: AdminModeracja,
});

const TABS = [
  { key: "suggestions", label: "Zgłoszenia lokali", icon: <Lightbulb size={13} /> },
  { key: "owners", label: "Właściciele", icon: <Store size={13} /> },
] as const;

function AdminModeracja() {
  const isSuper = useIsSuperAdmin();
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("suggestions");

  if (!isSuper) {
    return <div className="text-center py-20 text-muted-foreground">Tylko head admin może zarządzać moderacją.</div>;
  }

  return (
    <div>
      <AdminPageHeader
        title="Moderacja"
        icon={<ShieldCheck size={26} />}
        subtitle="Zgłoszenia nowych lokali i wnioski o przejęcie profilu."
      />
      <ModerationStatBar />
      <div className="flex gap-2 mb-6 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`chip ${tab === t.key ? "bg-tomato text-cream" : "bg-card border border-border"}`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>
      {tab === "suggestions" ? <SuggestionsTab /> : <OwnerRequestsTab />}
    </div>
  );
}

/**
 * Moderation is a decision queue, not a list - so the bar leads with "how
 * much is waiting" rather than a grand total. Both queues are counted
 * together in "W kolejce" because that is the number that decides whether
 * you need to open this page at all today.
 */
function ModerationStatBar() {
  const { data: suggestions, isLoading } = usePlaceSuggestions();
  const { data: owners } = useAdminOwnerRequests("all");

  const stats = useMemo<AdminStat[]>(() => {
    const sug = suggestions ?? [];
    const own = owners ?? [];
    const sugPending = sug.filter((s) => s.status === "pending").length;
    const ownPending = own.filter((o) => o.status === "pending").length;
    const queue = sugPending + ownPending;
    const decided = [...sug, ...own].filter((r) => r.status !== "pending");
    const approved = decided.filter((r) => r.status === "approved").length;
    const oldest = sug
      .concat(own as unknown as PlaceSuggestion[])
      .filter((r) => r.status === "pending")
      .map((r) => r.created_at)
      .sort()[0];
    return [
      {
        label: "W kolejce",
        value: queue,
        delta: queue ? "czeka na decyzję" : "kolejka pusta",
        tone: queue ? "attention" : "ok",
      },
      {
        label: "Zgłoszenia lokali",
        value: sugPending,
        delta: `${sug.length} łącznie`,
        tone: sugPending ? "attention" : "ok",
      },
      {
        label: "Wnioski właścicieli",
        value: ownPending,
        delta: `${own.length} łącznie`,
        tone: ownPending ? "attention" : "ok",
      },
      {
        label: "Najstarsze czeka",
        value: oldest
          ? formatDistanceToNow(new Date(oldest), { locale: pl })
          : decided.length
            ? "—"
            : "—",
        delta: decided.length ? `${approved} zatwierdzonych` : "brak decyzji",
        tone: "neutral",
      },
    ];
  }, [suggestions, owners]);

  return <AdminStatBar stats={stats} loading={isLoading} />;
}

function BulkBar({
  count,
  busy,
  progress,
  onApprove,
  onReject,
  onClear,
}: {
  count: number;
  busy: boolean;
  progress: { done: number; total: number } | null;
  onApprove: () => void;
  onReject: () => void;
  onClear: () => void;
}) {
  if (count === 0) return null;
  return (
    <div className="mb-3 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold text-muted-foreground">Zaznaczono {count}</span>
        <button
          onClick={onApprove}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg bg-tomato text-cream px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
        >
          <Check size={13} /> Zatwierdź zaznaczone
        </button>
        <button
          onClick={onReject}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:border-destructive hover:text-destructive disabled:opacity-50"
        >
          <X size={13} /> Odrzuć zaznaczone
        </button>
        <button onClick={onClear} disabled={busy} className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50">
          Anuluj zaznaczenie
        </button>
      </div>
      {progress && (
        <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
          <Loader2 size={13} className="animate-spin" />
          Przetwarzanie {progress.done} z {progress.total}…
        </div>
      )}
    </div>
  );
}

function SuggestionsTab() {
  const { data, isLoading } = usePlaceSuggestions();
  const approve = useApproveSuggestion();
  const reject = useRejectSuggestion();
  const del = useDeleteSuggestion();

  const pending = (data ?? []).filter((s) => s.status === "pending");
  const done = (data ?? []).filter((s) => s.status !== "pending");
  const bulk = useBulkAction(pending, (s) => s.id);

  async function handleApprove(s: PlaceSuggestion) {
    try {
      const placeId = await approve.mutateAsync(s);
      toast.success("Utworzono szkic knajpy ✓", {
        action: placeId
          ? { label: "Edytuj", onClick: () => { window.location.href = `/admin/places?edit=${placeId}`; } }
          : undefined,
        duration: 8000,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Błąd");
    }
  }

  async function handleReject(id: string) {
    try {
      await reject.mutateAsync(id);
      toast.success("Odrzucone");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Błąd");
    }
  }

  async function handleBulk(action: "approve" | "reject") {
    const { ok, fail } = await bulk.run(async (s) => {
      if (action === "approve") await approve.mutateAsync(s);
      else await reject.mutateAsync(s.id);
    });
    if (ok === 0 && fail === 0) return;
    if (fail === 0) toast.success(action === "approve" ? `Zatwierdzono ${ok} zgłoszeń ✓` : `Odrzucono ${ok} zgłoszeń`);
    else toast.warning(`Gotowe: ${ok} udanych, ${fail} nieudanych`);
  }

  if (isLoading) return <div className="grid place-items-center py-20"><Loader2 className="animate-spin" /></div>;
  if (pending.length === 0 && done.length === 0) {
    return <div className="text-center py-20 text-muted-foreground">Brak zgłoszeń jeszcze - czekamy na propozycje 🍽️</div>;
  }

  return (
    <div className="space-y-6">
      {pending.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h2 className="font-display text-xl">Do rozpatrzenia</h2>
          </div>
          <BulkBar
            count={bulk.selectedCount}
            busy={bulk.busy}
            progress={bulk.progress}
            onApprove={() => handleBulk("approve")}
            onReject={() => handleBulk("reject")}
            onClear={bulk.clear}
          />
          <div className="grid gap-3">
            {pending.map((s) => (
              <div key={s.id} className="bg-card border-2 border-tomato/40 rounded-2xl p-4 space-y-2">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex items-start gap-2.5">
                    <input
                      type="checkbox"
                      checked={bulk.selected.has(s.id)}
                      onChange={() => bulk.toggle(s.id)}
                      className="mt-1.5 w-4 h-4 accent-tomato shrink-0"
                      aria-label={`Zaznacz zgłoszenie „${s.name}"`}
                    />
                    <div className="min-w-0">
                      <h3 className="font-display text-lg leading-tight">{s.name}</h3>
                      {s.cuisine && <div className="text-xs uppercase font-bold text-tomato">{s.cuisine}</div>}
                      {s.address && (
                        <div className="text-xs text-muted-foreground inline-flex items-center gap-1 mt-1">
                          <MapPin size={12} /> {s.address}
                        </div>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(s.created_at), { addSuffix: true, locale: pl })}
                  </span>
                </div>
                {s.notes && <p className="text-sm text-foreground/80">{s.notes}</p>}
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {s.website && <a href={s.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-tomato">🌐 {s.website} <ExternalLink size={10} /></a>}
                  {s.instagram && <a href={s.instagram} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-tomato">📷 IG <ExternalLink size={10} /></a>}
                  {(s.submitter_name || s.submitter_email) && (
                    <span>Od: {s.submitter_name ?? ""} {s.submitter_email ?? ""}</span>
                  )}
                </div>
                <div className="flex gap-2 pt-2">
                  <button onClick={() => handleApprove(s)} disabled={approve.isPending || bulk.busy}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-tomato text-cream py-2 text-sm font-semibold disabled:opacity-50">
                    <Check size={14} /> Zatwierdź (dodaj do panelu Lokale)
                  </button>
                  <button onClick={() => handleReject(s.id)} disabled={reject.isPending || bulk.busy}
                          className="rounded-lg border border-border px-3 hover:border-destructive hover:text-destructive text-sm inline-flex items-center gap-1">
                    <X size={14} /> Odrzuć
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Po zatwierdzeniu przejdź do zakładki <strong>Lokale</strong> i uzupełnij pełne dane (współrzędne, opis, cover).
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {done.length > 0 && (
        <section>
          <h2 className="font-display text-xl mb-3">Archiwum</h2>
          <div className="grid gap-2">
            {done.map((s) => (
              <div key={s.id} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3 text-sm">
                <span className={`chip text-xs ${s.status === "approved" ? "bg-ok/12 text-ok" : "bg-muted text-muted-foreground"}`}>
                  {s.status === "approved" ? "✓ zatwierdzone" : "✕ odrzucone"}
                </span>
                <div className="flex-1 min-w-0 truncate">
                  <strong>{s.name}</strong> {s.address ? `· ${s.address}` : ""}
                </div>
                <button onClick={() => del.mutateAsync(s.id).then(() => toast.success("Usunięto"))} className="text-muted-foreground hover:text-destructive"><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function OwnerRequestsTab() {
  const [statusTab, setStatusTab] = useState<"pending" | "approved" | "rejected">("pending");
  const { data, isLoading } = useAdminOwnerRequests(statusTab);
  const approve = useApproveOwnerRequest();
  const reject = useRejectOwnerRequest();
  const bulk = useBulkAction(data ?? [], (r) => r.id);

  async function handleBulk(action: "approve" | "reject") {
    const skipped = action === "approve" ? bulk.selectedItems.filter((r) => !r.user_id).length : 0;
    const { ok, fail } = await bulk.run(async (r) => {
      if (action === "approve") {
        if (!r.user_id) throw new Error("brak konta");
        await approve.mutateAsync(r.id);
      } else {
        await reject.mutateAsync(r.id);
      }
    });
    if (ok === 0 && fail === 0) return;
    const verb = action === "approve" ? "Zatwierdzono" : "Odrzucono";
    if (fail === 0 && skipped === 0) toast.success(`${verb} ${ok} zgłoszeń`);
    else toast.warning(`${verb} ${ok}${fail ? `, ${fail} nieudanych` : ""}${skipped ? `, ${skipped} pominiętych (brak konta)` : ""}`);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
        <div className="flex gap-2">
          {(["pending", "approved", "rejected"] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setStatusTab(t); bulk.clear(); }}
              className={`chip ${statusTab === t ? "bg-tomato text-cream" : "bg-card border border-border"}`}
            >
              {t === "pending" ? "Oczekujące" : t === "approved" ? "Zatwierdzone" : "Odrzucone"}
            </button>
          ))}
        </div>
      </div>

      {statusTab === "pending" && (
        <BulkBar
          count={bulk.selectedCount}
          busy={bulk.busy}
          progress={bulk.progress}
          onApprove={() => handleBulk("approve")}
          onReject={() => handleBulk("reject")}
          onClear={bulk.clear}
        />
      )}

      {isLoading ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="animate-spin text-tomato" size={28} />
        </div>
      ) : !data || data.length === 0 ? (
        <p className="text-sm text-muted-foreground">Brak zgłoszeń w tej kategorii.</p>
      ) : (
        <ul className="space-y-3">
          {data.map((r) => (
            <li
              key={r.id}
              className="rounded-2xl border border-border bg-card p-4 flex flex-col sm:flex-row gap-4 sm:items-start"
            >
              {statusTab === "pending" && (
                <input
                  type="checkbox"
                  checked={bulk.selected.has(r.id)}
                  onChange={() => bulk.toggle(r.id)}
                  className="mt-1.5 w-4 h-4 accent-tomato shrink-0"
                  aria-label={`Zaznacz zgłoszenie „${r.name}"`}
                />
              )}
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-lg">{r.name}</span>
                  {r.place ? (
                    <Link
                      to="/k/$id"
                      params={{ id: r.place.slug || r.place.id }}
                      className="chip bg-navy text-cream text-xs"
                    >
                      {r.place.name}
                    </Link>
                  ) : (
                    <span className="chip bg-muted text-xs">Knajpa usunięta</span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleString("pl-PL")}
                  {!r.user_id && " · zgłoszenie bez konta użytkownika"}
                </div>
                <a href={`mailto:${r.email}`} className="inline-flex items-center gap-1.5 text-sm text-tomato hover:underline">
                  <Mail size={13} /> {r.email}
                </a>
                {r.instagram_url && (
                  <a href={r.instagram_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm text-navy/70 hover:text-tomato ml-3">
                    <Instagram size={13} /> Instagram
                  </a>
                )}
                {r.website_url && (
                  <a href={r.website_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm text-navy/70 hover:text-tomato ml-3">
                    <Globe size={13} /> www
                  </a>
                )}
                {r.message && (
                  <div className="mt-2 flex gap-2 text-sm text-navy/80">
                    <MessageSquare size={14} className="flex-shrink-0 mt-0.5 text-navy/50" />
                    <p className="whitespace-pre-wrap">{r.message}</p>
                  </div>
                )}
              </div>
              {r.status === "pending" && (
                <div className="flex sm:flex-col gap-2 sm:w-40">
                  <button
                    disabled={!r.user_id || approve.isPending}
                    onClick={async () => {
                      try {
                        await approve.mutateAsync(r.id);
                        toast.success("Zatwierdzono");
                      } catch (e) {
                        toast.error((e as Error).message);
                      }
                    }}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-ok text-cream px-4 py-2 font-semibold hover:bg-ok/90 disabled:opacity-50"
                  >
                    <CheckCircle2 size={16} /> Zatwierdź
                  </button>
                  <button
                    disabled={reject.isPending}
                    onClick={async () => {
                      try {
                        await reject.mutateAsync(r.id);
                        toast.success("Odrzucono");
                      } catch (e) {
                        toast.error((e as Error).message);
                      }
                    }}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-full border-2 border-border px-4 py-2 font-semibold hover:border-tomato hover:text-tomato disabled:opacity-50"
                  >
                    <XCircle size={16} /> Odrzuć
                  </button>
                </div>
              )}
              {r.status !== "pending" && (
                <span
                  className={`chip ${r.status === "approved" ? "bg-ok text-cream" : "bg-muted"}`}
                >
                  {r.status === "approved" ? "Zatwierdzone" : "Odrzucone"}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
