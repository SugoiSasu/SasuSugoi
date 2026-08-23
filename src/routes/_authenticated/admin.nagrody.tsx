import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Trophy, Plus, Play, Lock, Loader2 } from "lucide-react";
import { useIsSuperAdmin } from "@/lib/use-auth";
import { useCuisines } from "@/lib/cuisines-api";
import { usePlaces } from "@/lib/places-api";
import {
  useAdminAwardsEvents,
  useCreateAwardsEvent,
  useActivateAwardsEvent,
  useCloseAwardsEvent,
  useAwardsEventTally,
  useAwardWinners,
  type AwardsEvent,
} from "@/lib/awards-api";

export const Route = createFileRoute("/_authenticated/admin/nagrody")({
  head: () => ({ meta: [{ title: "Nagrody - Panel admina" }] }),
  component: AdminNagrody,
});

function AdminNagrody() {
  const isSuper = useIsSuperAdmin();
  const { data: events, isLoading } = useAdminAwardsEvents();
  const [creating, setCreating] = useState(false);

  if (!isSuper) {
    return <div className="text-center py-20 text-muted-foreground">Tylko head admin.</div>;
  }

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-3xl mb-1">Warte poŻarcia</h1>
          <p className="text-sm text-muted-foreground">
            Doroczne głosowanie na najlepszy lokal w każdej kategorii kuchni. Niewidoczne dla
            użytkowników, dopóki nie odpalisz wydarzenia.
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-2 rounded-full bg-tomato text-cream px-4 py-2 text-sm font-semibold hover:bg-tomato/90"
        >
          <Plus size={15} /> Nowe wydarzenie
        </button>
      </div>

      {creating && <NewEventForm onDone={() => setCreating(false)} />}

      {isLoading ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="animate-spin text-tomato" size={28} />
        </div>
      ) : !events || events.length === 0 ? (
        <p className="text-sm text-muted-foreground">Brak wydarzeń jeszcze.</p>
      ) : (
        <div className="space-y-4">
          {events.map((e) => (
            <EventCard key={e.id} event={e} />
          ))}
        </div>
      )}
    </div>
  );
}

function NewEventForm({ onDone }: { onDone: () => void }) {
  const { data: cuisines } = useCuisines();
  const create = useCreateAwardsEvent();
  const [name, setName] = useState(`Warte poŻarcia ${new Date().getFullYear()}`);
  const [selected, setSelected] = useState<Set<string>>(new Set((cuisines ?? []).map((c) => c.id)));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit() {
    if (!name.trim() || selected.size === 0) {
      toast.error("Podaj nazwę i wybierz co najmniej jedną kategorię");
      return;
    }
    try {
      await create.mutateAsync({ name: name.trim(), cuisineIds: Array.from(selected) });
      toast.success("Wydarzenie utworzone jako szkic");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Błąd");
    }
  }

  return (
    <div className="mb-6 rounded-2xl border border-tomato/40 bg-card p-4 space-y-4">
      <label className="block">
        <span className="text-xs font-bold uppercase tracking-wider text-navy/70">Nazwa</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
        />
      </label>
      <div>
        <span className="text-xs font-bold uppercase tracking-wider text-navy/70">Kategorie</span>
        <div className="mt-2 flex flex-wrap gap-2">
          {(cuisines ?? []).map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => toggle(c.id)}
              className={`chip text-xs ${selected.has(c.id) ? "bg-tomato text-cream" : "bg-card border border-border"}`}
            >
              {c.emoji} {c.name}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={create.isPending}
          className="rounded-full bg-tomato text-cream px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          Utwórz jako szkic
        </button>
        <button onClick={onDone} className="rounded-full border border-border px-4 py-2 text-sm">
          Anuluj
        </button>
      </div>
    </div>
  );
}

function EventCard({ event }: { event: AwardsEvent }) {
  const { data: cuisines } = useCuisines();
  const { data: places } = usePlaces();
  const activate = useActivateAwardsEvent();
  const close = useCloseAwardsEvent();
  const { data: tally } = useAwardsEventTally(event.status === "active" ? event.id : null);
  const { data: winners } = useAwardWinners(event.status === "closed" ? event.id : null);
  const [confirmClose, setConfirmClose] = useState(false);

  const cuisineById = new Map((cuisines ?? []).map((c) => [c.id, c]));
  const placeById = new Map((places ?? []).map((p) => [p.id, p]));

  const statusChip =
    event.status === "draft"
      ? "bg-muted text-muted-foreground"
      : event.status === "active"
        ? "bg-emerald-600 text-white"
        : "bg-navy text-cream";
  const statusLabel = event.status === "draft" ? "Szkic" : event.status === "active" ? "Aktywne" : "Zamknięte";

  async function handleActivate() {
    try {
      await activate.mutateAsync(event.id);
      toast.success("Wydarzenie odpalone - widoczne publicznie");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Błąd");
    }
  }

  async function handleClose() {
    try {
      await close.mutateAsync(event.id);
      toast.success("Zamknięte - zwycięzcy zamrożeni");
      setConfirmClose(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Błąd");
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Trophy size={16} className="text-tomato" />
          <span className="font-bold">{event.name}</span>
          <span className={`chip text-xs ${statusChip}`}>{statusLabel}</span>
        </div>
        {event.status === "draft" && (
          <button
            onClick={handleActivate}
            disabled={activate.isPending}
            className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 text-white px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
          >
            <Play size={13} /> Odpal
          </button>
        )}
        {event.status === "active" &&
          (confirmClose ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Zamknąć i zamrozić wyniki?</span>
              <button
                onClick={handleClose}
                disabled={close.isPending}
                className="rounded-full bg-navy text-cream px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
              >
                Tak, zamknij
              </button>
              <button onClick={() => setConfirmClose(false)} className="text-xs text-muted-foreground">
                Anuluj
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmClose(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:border-navy"
            >
              <Lock size={13} /> Zamknij
            </button>
          ))}
      </div>

      {event.status === "active" && (
        <div className="grid gap-2 sm:grid-cols-2">
          {event.cuisine_ids.map((cid) => {
            const cuisine = cuisineById.get(cid);
            const rows = Array.from(tally ?? [])
              .filter(([key]) => key.startsWith(`${cid}:`))
              .map(([key, count]) => ({ placeId: key.split(":")[1], count }))
              .sort((a, b) => b.count - a.count);
            return (
              <div key={cid} className="rounded-xl border border-border p-2.5">
                <p className="text-xs font-bold uppercase tracking-wider text-navy/70 mb-1.5">
                  {cuisine?.emoji} {cuisine?.name ?? cid}
                </p>
                {rows.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Jeszcze bez głosów.</p>
                ) : (
                  <ul className="space-y-0.5">
                    {rows.slice(0, 5).map((r) => (
                      <li key={r.placeId} className="flex justify-between text-xs">
                        <span className="truncate">{placeById.get(r.placeId)?.name ?? r.placeId}</span>
                        <span className="font-bold shrink-0 ml-2">{r.count}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}

      {event.status === "closed" && (
        <div className="grid gap-2 sm:grid-cols-2">
          {(winners ?? []).map((w) => (
            <div key={w.id} className="rounded-xl border border-border p-2.5 flex items-center justify-between gap-2">
              <span className="text-sm">
                {w.cuisine?.emoji} {w.cuisine?.name}: <strong>{w.place?.name}</strong>
              </span>
              <span className="chip bg-mustard text-navy text-xs shrink-0">{w.vote_count} gł.</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
