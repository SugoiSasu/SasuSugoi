import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Check, X, ExternalLink, Loader2, Trash2, MapPin } from "lucide-react";
import {
  usePlaceSuggestions,
  useApproveSuggestion,
  useRejectSuggestion,
  useDeleteSuggestion,
  type PlaceSuggestion,
} from "@/lib/place-suggestions-api";
import { useIsSuperAdmin } from "@/lib/use-auth";
import { formatDistanceToNow } from "date-fns";
import { pl } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/admin/suggestions")({
  component: AdminSuggestions,
});

function AdminSuggestions() {
  const isSuper = useIsSuperAdmin();
  const { data, isLoading } = usePlaceSuggestions();
  const approve = useApproveSuggestion();
  const reject = useRejectSuggestion();
  const del = useDeleteSuggestion();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);

  if (!isSuper) {
    return <div className="text-center py-20 text-muted-foreground">Tylko head admin może zarządzać zgłoszeniami.</div>;
  }

  const pending = (data ?? []).filter((s) => s.status === "pending");
  const done = (data ?? []).filter((s) => s.status !== "pending");

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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
    const targets = pending.filter((s) => selected.has(s.id));
    if (targets.length === 0) return;
    setBulkProgress({ done: 0, total: targets.length });
    let okCount = 0;
    let failCount = 0;
    for (const s of targets) {
      try {
        if (action === "approve") await approve.mutateAsync(s);
        else await reject.mutateAsync(s.id);
        okCount++;
      } catch {
        failCount++;
      }
      setBulkProgress((p) => (p ? { done: p.done + 1, total: p.total } : p));
    }
    setBulkProgress(null);
    setSelected(new Set());
    if (failCount === 0) {
      toast.success(
        action === "approve" ? `Zatwierdzono ${okCount} zgłoszeń ✓` : `Odrzucono ${okCount} zgłoszeń`,
      );
    } else {
      toast.warning(`Gotowe: ${okCount} udanych, ${failCount} nieudanych`);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-3xl">Zgłoszone lokale</h1>
        <p className="text-sm text-muted-foreground">
          {pending.length} do rozpatrzenia · {done.length} zarchiwizowanych
        </p>
      </div>

      {isLoading ? <div className="grid place-items-center py-20"><Loader2 className="animate-spin" /></div> :
       pending.length === 0 && done.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">Brak zgłoszeń jeszcze — czekamy na propozycje 🍽️</div>
      ) : (
        <div className="space-y-6">
          {pending.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <h2 className="font-display text-xl">Do rozpatrzenia</h2>
                {selected.size > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-muted-foreground">Zaznaczono {selected.size}</span>
                    <button
                      onClick={() => handleBulk("approve")}
                      disabled={!!bulkProgress}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-tomato text-cream px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                    >
                      <Check size={13} /> Zatwierdź zaznaczone
                    </button>
                    <button
                      onClick={() => handleBulk("reject")}
                      disabled={!!bulkProgress}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:border-destructive hover:text-destructive disabled:opacity-50"
                    >
                      <X size={13} /> Odrzuć zaznaczone
                    </button>
                    <button
                      onClick={() => setSelected(new Set())}
                      disabled={!!bulkProgress}
                      className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
                    >
                      Anuluj zaznaczenie
                    </button>
                  </div>
                )}
              </div>

              {bulkProgress && (
                <div className="mb-3 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
                  <Loader2 size={13} className="animate-spin" />
                  Przetwarzanie {bulkProgress.done} z {bulkProgress.total}…
                </div>
              )}

              <div className="grid gap-3">
                {pending.map((s) => (
                  <div key={s.id} className="bg-card border-2 border-tomato/40 rounded-2xl p-4 space-y-2">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0 flex items-start gap-2.5">
                        <input
                          type="checkbox"
                          checked={selected.has(s.id)}
                          onChange={() => toggleSelected(s.id)}
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
                      <button onClick={() => handleApprove(s)} disabled={approve.isPending || !!bulkProgress}
                              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-tomato text-cream py-2 text-sm font-semibold disabled:opacity-50">
                        <Check size={14} /> Zatwierdź (dodaj do panelu Lokale)
                      </button>
                      <button onClick={() => handleReject(s.id)} disabled={reject.isPending || !!bulkProgress}
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
                    <span className={`chip text-xs ${s.status === "approved" ? "bg-emerald-100 text-emerald-800" : "bg-muted text-muted-foreground"}`}>
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
      )}
    </div>
  );
}
