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
import {
  useAdminOwnerRequests,
  useApproveOwnerRequest,
  useRejectOwnerRequest,
  type OwnerRequest,
} from "@/lib/owners-api";
import { AdminFilterChips, AdminStatusTag } from "@/components/admin/AdminControls";
import { useIsSuperAdmin } from "@/lib/use-auth";
import { useBulkAction } from "@/components/admin/useBulkAction";
import { formatDistanceToNow } from "date-fns";
import { pl } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/admin/moderacja")({
  head: () => ({ meta: [{ title: "Moderacja - Panel admina" }] }),
  component: AdminModeracja,
});

/**
 * Moderation is a work queue, not two lists.
 *
 * It used to be two tabs - place suggestions and owner requests - each with
 * its own newest-first list. That meant you had to check two places to know
 * whether anything was waiting, and the newest-first order is backwards for
 * a queue: the item that has been waiting longest is the one that should be
 * dealt with first. Both feeds are now one oldest-first stream with a
 * sidebar that says how much is left and what was last decided.
 */
type QueueFilter = "all" | "suggestions" | "owners" | "archive";

const QUEUE_FILTERS: { key: QueueFilter; label: string }[] = [
  { key: "all", label: "Wszystko" },
  { key: "suggestions", label: "Zgłoszenia lokali" },
  { key: "owners", label: "Właściciele" },
  { key: "archive", label: "Archiwum" },
];

function AdminModeracja() {
  const isSuper = useIsSuperAdmin();
  const [filter, setFilter] = useState<QueueFilter>("all");

  if (!isSuper) {
    return <div className="text-center py-20 text-muted-foreground">Tylko head admin może zarządzać moderacją.</div>;
  }

  return (
    <div>
      <AdminPageHeader
        title="Moderacja"
        icon={<ShieldCheck size={26} />}
        subtitle="Zgłoszenia nowych lokali i wnioski o przejęcie profilu - najstarsze na górze."
      />
      <ModerationStatBar />
      <div className="grid gap-4 items-start lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <ModerationQueue filter={filter} onFilterChange={setFilter} />
        <QueueSidebar />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ the queue */

function ModerationQueue({
  filter,
  onFilterChange,
}: {
  filter: QueueFilter;
  onFilterChange: (f: QueueFilter) => void;
}) {
  const { data: suggestions, isLoading: loadingS } = usePlaceSuggestions();
  const { data: owners, isLoading: loadingO } = useAdminOwnerRequests("all");

  const counts = useMemo(() => {
    const s = (suggestions ?? []).filter((x) => x.status === "pending").length;
    const o = (owners ?? []).filter((x) => x.status === "pending").length;
    const archive =
      (suggestions ?? []).length - s + ((owners ?? []).length - o);
    return { all: s + o, suggestions: s, owners: o, archive };
  }, [suggestions, owners]);

  const isLoading = loadingS || loadingO;

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <AdminFilterChips
          value={filter}
          onChange={onFilterChange}
          options={QUEUE_FILTERS.map((f) => ({ ...f, count: counts[f.key] }))}
        />
      </div>
      {isLoading ? (
        <div className="grid place-items-center py-20">
          <Loader2 className="animate-spin text-tomato" size={28} />
        </div>
      ) : filter === "archive" ? (
        <ArchiveList suggestions={suggestions ?? []} owners={owners ?? []} />
      ) : (
        <PendingList filter={filter} />
      )}
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

/* --------------------------------------------------- merged pending list */

type PendingEntry =
  | { kind: "suggestion"; id: string; created_at: string; s: PlaceSuggestion }
  | { kind: "owner"; id: string; created_at: string; o: OwnerRequest };

function PendingList({ filter }: { filter: QueueFilter }) {
  const { data: suggestions } = usePlaceSuggestions();
  const { data: owners } = useAdminOwnerRequests("all");
  const approveS = useApproveSuggestion();
  const rejectS = useRejectSuggestion();
  const approveO = useApproveOwnerRequest();
  const rejectO = useRejectOwnerRequest();

  const entries = useMemo<PendingEntry[]>(() => {
    const list: PendingEntry[] = [];
    if (filter !== "owners") {
      for (const s of suggestions ?? []) {
        if (s.status === "pending")
          list.push({ kind: "suggestion", id: s.id, created_at: s.created_at, s });
      }
    }
    if (filter !== "suggestions") {
      for (const o of owners ?? []) {
        if (o.status === "pending")
          list.push({ kind: "owner", id: o.id, created_at: o.created_at, o });
      }
    }
    // Oldest first. A queue is FIFO - the item that has waited longest is
    // the one that should be dealt with next. Both source lists arrive
    // newest-first, which is the right default for browsing and the wrong
    // one for working through a backlog.
    return list.sort((a, b) => a.created_at.localeCompare(b.created_at));
  }, [suggestions, owners, filter]);

  const bulk = useBulkAction(entries, (e) => e.id);

  async function handleBulk(action: "approve" | "reject") {
    // Owner requests submitted without an account cannot be approved -
    // there is nobody to grant ownership to. Count them as skipped rather
    // than letting them fail.
    const skipped =
      action === "approve"
        ? bulk.selectedItems.filter((e) => e.kind === "owner" && !e.o.user_id).length
        : 0;
    const { ok, fail } = await bulk.run(async (e) => {
      if (action === "approve") {
        if (e.kind === "suggestion") await approveS.mutateAsync(e.s);
        else {
          if (!e.o.user_id) throw new Error("brak konta");
          await approveO.mutateAsync(e.o.id);
        }
      } else {
        if (e.kind === "suggestion") await rejectS.mutateAsync(e.s.id);
        else await rejectO.mutateAsync(e.o.id);
      }
    });
    if (ok === 0 && fail === 0) return;
    const verb = action === "approve" ? "Zatwierdzono" : "Odrzucono";
    if (fail === 0 && skipped === 0) toast.success(`${verb} ${ok} zgłoszeń`);
    else
      toast.warning(
        `${verb} ${ok}${fail ? `, ${fail} nieudanych` : ""}${
          skipped ? `, ${skipped} pominiętych (brak konta)` : ""
        }`,
      );
  }

  if (entries.length === 0) {
    return (
      <div className="px-6 py-20 text-center">
        <div className="text-3xl mb-2" aria-hidden="true">
          🍽️
        </div>
        <p className="text-sm font-semibold">Kolejka pusta. Dobra robota.</p>
        <p className="text-xs text-muted-foreground mt-1">
          Nowe zgłoszenia pojawią się tutaj automatycznie.
        </p>
      </div>
    );
  }

  return (
    <div>
      {bulk.selectedCount > 0 && (
        <div className="px-4 pt-4">
          <BulkBar
            count={bulk.selectedCount}
            busy={bulk.busy}
            progress={bulk.progress}
            onApprove={() => handleBulk("approve")}
            onReject={() => handleBulk("reject")}
            onClear={bulk.clear}
          />
        </div>
      )}
      <ul className="divide-y divide-border">
        {entries.map((e) => (
          <li key={`${e.kind}-${e.id}`} className="p-4 flex gap-3">
            <input
              type="checkbox"
              checked={bulk.selected.has(e.id)}
              onChange={() => bulk.toggle(e.id)}
              className="mt-1 w-4 h-4 accent-tomato shrink-0"
              aria-label={`Zaznacz: ${e.kind === "suggestion" ? e.s.name : e.o.name}`}
            />
            <div className="min-w-0 flex-1">
              {e.kind === "suggestion" ? (
                <SuggestionCard s={e.s} busy={bulk.busy} />
              ) : (
                <OwnerCard o={e.o} busy={bulk.busy} />
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Shared first line of every queue card: what kind it is, and how long it
 *  has been waiting - the two things you need before reading the details. */
function EntryMeta({ kind, createdAt }: { kind: "suggestion" | "owner"; createdAt: string }) {
  const waiting = formatDistanceToNow(new Date(createdAt), { locale: pl });
  return (
    <div className="flex items-center gap-2 flex-wrap mb-1.5">
      <AdminStatusTag
        tone={kind === "suggestion" ? "info" : "attention"}
        label={kind === "suggestion" ? "Nowy lokal" : "Właściciel"}
        icon={kind === "suggestion" ? <Lightbulb size={11} /> : <Store size={11} />}
      />
      <span className="text-[11px] text-muted-foreground">czeka {waiting}</span>
    </div>
  );
}

function SuggestionCard({ s, busy }: { s: PlaceSuggestion; busy: boolean }) {
  const approve = useApproveSuggestion();
  const reject = useRejectSuggestion();

  async function handleApprove() {
    try {
      const placeId = await approve.mutateAsync(s);
      toast.success("Utworzono szkic knajpy ✓", {
        action: placeId
          ? {
              label: "Edytuj",
              onClick: () => {
                window.location.href = `/admin/places?edit=${placeId}`;
              },
            }
          : undefined,
        duration: 8000,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Błąd");
    }
  }

  async function handleReject() {
    try {
      await reject.mutateAsync(s.id);
      toast.success("Odrzucone");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Błąd");
    }
  }

  return (
    <div>
      <EntryMeta kind="suggestion" createdAt={s.created_at} />
      <h3 className="font-display text-lg leading-tight">{s.name}</h3>
      {s.cuisine && <div className="text-xs uppercase font-bold text-tomato">{s.cuisine}</div>}
      {s.address && (
        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1 min-w-0">
          <MapPin size={12} className="shrink-0" />
          <span className="truncate">{s.address}</span>
        </div>
      )}
      {s.notes && (
        <p className="text-sm mt-2 rounded-xl bg-background px-3 py-2 text-foreground/80 whitespace-pre-wrap">
          {s.notes}
        </p>
      )}
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground mt-2">
        {s.website && (
          <a
            href={s.website}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 hover:text-tomato min-w-0"
          >
            <Globe size={11} className="shrink-0" />
            <span className="truncate max-w-56">{s.website}</span>
            <ExternalLink size={10} className="shrink-0" />
          </a>
        )}
        {s.instagram && (
          <a
            href={s.instagram}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 hover:text-tomato"
          >
            <Instagram size={11} /> IG <ExternalLink size={10} />
          </a>
        )}
        {(s.submitter_name || s.submitter_email) && (
          <span className="truncate">
            Od: {s.submitter_name ?? ""} {s.submitter_email ?? ""}
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-2 pt-3">
        <button
          onClick={handleApprove}
          disabled={approve.isPending || busy}
          className="inline-flex items-center justify-center gap-1.5 rounded-full bg-ok text-cream px-4 py-2 text-sm font-semibold hover:bg-ok/90 disabled:opacity-50"
        >
          <Check size={14} /> Zatwierdź
        </button>
        <button
          onClick={handleReject}
          disabled={reject.isPending || busy}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-semibold hover:border-destructive hover:text-destructive disabled:opacity-50"
        >
          <X size={14} /> Odrzuć
        </button>
        <span className="text-[11px] text-muted-foreground self-center">
          Zatwierdzenie tworzy szkic w <strong>Lokale</strong> do uzupełnienia.
        </span>
      </div>
    </div>
  );
}

function OwnerCard({ o, busy }: { o: OwnerRequest; busy: boolean }) {
  const approve = useApproveOwnerRequest();
  const reject = useRejectOwnerRequest();

  return (
    <div>
      <EntryMeta kind="owner" createdAt={o.created_at} />
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-display text-lg leading-tight">{o.name}</span>
        {o.place ? (
          <Link
            to="/k/$id"
            params={{ id: o.place.slug || o.place.id }}
            className="chip bg-navy text-cream text-xs"
          >
            {o.place.name}
          </Link>
        ) : (
          <AdminStatusTag tone="danger" label="Knajpa usunięta" />
        )}
      </div>
      {!o.user_id && (
        <p className="text-xs text-tomato font-semibold mt-1">
          Zgłoszenie bez konta - nie da się nadać własności, dopóki osoba się nie zarejestruje.
        </p>
      )}
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 text-sm">
        <a
          href={`mailto:${o.email}`}
          className="inline-flex items-center gap-1.5 text-tomato hover:underline min-w-0"
        >
          <Mail size={13} className="shrink-0" />
          <span className="truncate max-w-64">{o.email}</span>
        </a>
        {o.instagram_url && (
          <a
            href={o.instagram_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-tomato"
          >
            <Instagram size={13} /> Instagram
          </a>
        )}
        {o.website_url && (
          <a
            href={o.website_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-tomato"
          >
            <Globe size={13} /> www
          </a>
        )}
      </div>
      {o.message && (
        <div className="mt-2 flex gap-2 text-sm rounded-xl bg-background px-3 py-2">
          <MessageSquare size={14} className="shrink-0 mt-0.5 text-muted-foreground" />
          <p className="whitespace-pre-wrap min-w-0">{o.message}</p>
        </div>
      )}
      <div className="flex flex-wrap gap-2 pt-3">
        <button
          disabled={!o.user_id || approve.isPending || busy}
          onClick={async () => {
            try {
              await approve.mutateAsync(o.id);
              toast.success("Zatwierdzono");
            } catch (e) {
              toast.error((e as Error).message);
            }
          }}
          className="inline-flex items-center gap-2 rounded-full bg-ok text-cream px-4 py-2 text-sm font-semibold hover:bg-ok/90 disabled:opacity-50"
        >
          <CheckCircle2 size={15} /> Zatwierdź
        </button>
        <button
          disabled={reject.isPending || busy}
          onClick={async () => {
            try {
              await reject.mutateAsync(o.id);
              toast.success("Odrzucono");
            } catch (e) {
              toast.error((e as Error).message);
            }
          }}
          className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold hover:border-destructive hover:text-destructive disabled:opacity-50"
        >
          <XCircle size={15} /> Odrzuć
        </button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- archive */

function ArchiveList({
  suggestions,
  owners,
}: {
  suggestions: PlaceSuggestion[];
  owners: OwnerRequest[];
}) {
  const del = useDeleteSuggestion();
  const rows = useMemo(() => {
    const list: {
      id: string;
      kind: "suggestion" | "owner";
      name: string;
      sub: string;
      status: string;
      at: string;
    }[] = [];
    for (const s of suggestions) {
      if (s.status === "pending") continue;
      list.push({
        id: s.id,
        kind: "suggestion",
        name: s.name,
        sub: s.address ?? s.cuisine ?? "",
        status: s.status,
        at: s.reviewed_at ?? s.created_at,
      });
    }
    for (const o of owners) {
      if (o.status === "pending") continue;
      list.push({
        id: o.id,
        kind: "owner",
        name: o.name,
        sub: o.place?.name ?? o.email,
        status: o.status,
        at: o.reviewed_at ?? o.created_at,
      });
    }
    return list.sort((a, b) => b.at.localeCompare(a.at));
  }, [suggestions, owners]);

  if (rows.length === 0) {
    return (
      <p className="px-6 py-20 text-center text-sm text-muted-foreground">
        Archiwum jest puste - nic jeszcze nie zostało rozpatrzone.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {rows.map((r) => (
        <li key={`${r.kind}-${r.id}`} className="px-4 py-3 flex items-center gap-3 text-sm">
          <AdminStatusTag
            tone={r.status === "approved" ? "ok" : "neutral"}
            label={r.status === "approved" ? "Zatwierdzone" : "Odrzucone"}
          />
          <div className="flex-1 min-w-0">
            <div className="font-semibold truncate">{r.name}</div>
            {r.sub && <div className="text-xs text-muted-foreground truncate">{r.sub}</div>}
          </div>
          <span className="text-[11px] text-muted-foreground whitespace-nowrap">
            {formatDistanceToNow(new Date(r.at), { addSuffix: true, locale: pl })}
          </span>
          {r.kind === "suggestion" && (
            <button
              onClick={() => del.mutateAsync(r.id).then(() => toast.success("Usunięto"))}
              className="text-muted-foreground hover:text-destructive shrink-0"
              aria-label={`Usuń z archiwum: ${r.name}`}
            >
              <Trash2 size={13} />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

/* -------------------------------------------------------------- sidebar */

function QueueSidebar() {
  const { data: suggestions } = usePlaceSuggestions();
  const { data: owners } = useAdminOwnerRequests("all");

  const { pendingS, pendingO, log } = useMemo(() => {
    const s = (suggestions ?? []).filter((x) => x.status === "pending").length;
    const o = (owners ?? []).filter((x) => x.status === "pending").length;
    // Real audit trail: both tables carry reviewed_at, so this is what
    // actually happened, not a mock feed.
    const decided: { id: string; text: string; at: string; ok: boolean }[] = [];
    for (const x of suggestions ?? []) {
      if (x.status === "pending" || !x.reviewed_at) continue;
      decided.push({
        id: `s-${x.id}`,
        text: `${x.status === "approved" ? "Zatwierdzono zgłoszenie" : "Odrzucono zgłoszenie"} - ${x.name}`,
        at: x.reviewed_at,
        ok: x.status === "approved",
      });
    }
    for (const x of owners ?? []) {
      if (x.status === "pending" || !x.reviewed_at) continue;
      decided.push({
        id: `o-${x.id}`,
        text: `${x.status === "approved" ? "Nadano własność" : "Odrzucono wniosek"} - ${x.place?.name ?? x.name}`,
        at: x.reviewed_at,
        ok: x.status === "approved",
      });
    }
    decided.sort((a, b) => b.at.localeCompare(a.at));
    return { pendingS: s, pendingO: o, log: decided.slice(0, 6) };
  }, [suggestions, owners]);

  const total = pendingS + pendingO;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl bg-navy text-cream p-5">
        <div className="text-[11px] font-bold uppercase tracking-wider opacity-70 mb-2">
          Teraz w kolejce
        </div>
        <div className="font-display text-4xl leading-none mb-4 tabular-nums">{total}</div>
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="opacity-80">Zgłoszenia lokali</span>
            <span className="font-bold tabular-nums">{pendingS}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="opacity-80">Wnioski właścicieli</span>
            <span className="font-bold tabular-nums">{pendingO}</span>
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-card border border-border p-5">
        <h2 className="font-display text-base mb-3">Ostatnie decyzje</h2>
        {log.length === 0 ? (
          <p className="text-xs text-muted-foreground">Jeszcze nic nie rozpatrzono.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {log.map((l) => (
              <li key={l.id} className="flex items-start gap-2.5">
                <span
                  className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${l.ok ? "bg-ok" : "bg-destructive"}`}
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <div className="text-xs font-semibold leading-snug">{l.text}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {formatDistanceToNow(new Date(l.at), { addSuffix: true, locale: pl })}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
