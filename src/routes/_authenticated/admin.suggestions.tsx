import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Check, X, ExternalLink, Loader2, Trash2, MapPin } from "lucide-react";
import { usePlaceSuggestions, useUpdateSuggestionStatus, useDeleteSuggestion } from "@/lib/place-suggestions-api";
import { useIsSuperAdmin } from "@/lib/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { pl } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/admin/suggestions")({
  component: AdminSuggestions,
});

function AdminSuggestions() {
  const isSuper = useIsSuperAdmin();
  const { data, isLoading } = usePlaceSuggestions();
  const updateStatus = useUpdateSuggestionStatus();
  const del = useDeleteSuggestion();

  if (!isSuper) {
    return <div className="text-center py-20 text-muted-foreground">Tylko head admin może zarządzać zgłoszeniami.</div>;
  }

  const pending = (data ?? []).filter((s) => s.status === "pending");
  const done = (data ?? []).filter((s) => s.status !== "pending");

  async function handle(id: string, status: "approved" | "rejected") {
    try {
      let approvedPlaceId: string | undefined;
      if (status === "approved") {
        const s = (data ?? []).find((x) => x.id === id);
        if (s) {
          // Tworzymy szkic knajpy (is_published=false) do dokończenia w panelu Lokale.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: created, error } = await (supabase as any)
            .from("places")
            .insert({
              name: s.name,
              cuisine: s.cuisine || "Inna",
              address: s.address || "",
              description: s.notes || "",
              website: s.website || null,
              instagram: s.instagram || null,
              lat: 52.4082,
              lng: 16.9335,
              is_published: false,
            })
            .select("id")
            .single();
          if (error) throw error;
          approvedPlaceId = created?.id;
        }
      }
      await updateStatus.mutateAsync({ id, status, approved_place_id: approvedPlaceId });
      if (status === "approved") {
        toast.success("Utworzono szkic knajpy ✓", {
          action: approvedPlaceId
            ? {
                label: "Edytuj",
                onClick: () => {
                  window.location.href = `/admin/places?edit=${approvedPlaceId}`;
                },
              }
            : undefined,
          duration: 8000,
        });
      } else {
        toast.success("Odrzucone");
      }
    } catch (e) { toast.error(e instanceof Error ? e.message : "Błąd"); }
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
              <h2 className="font-display text-xl mb-3">Do rozpatrzenia</h2>
              <div className="grid gap-3">
                {pending.map((s) => (
                  <div key={s.id} className="bg-card border-2 border-tomato/40 rounded-2xl p-4 space-y-2">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <h3 className="font-display text-lg leading-tight">{s.name}</h3>
                        {s.cuisine && <div className="text-xs uppercase font-bold text-tomato">{s.cuisine}</div>}
                        {s.address && (
                          <div className="text-xs text-muted-foreground inline-flex items-center gap-1 mt-1">
                            <MapPin size={12} /> {s.address}
                          </div>
                        )}
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
                      <button onClick={() => handle(s.id, "approved")} disabled={updateStatus.isPending}
                              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-tomato text-cream py-2 text-sm font-semibold disabled:opacity-50">
                        <Check size={14} /> Zatwierdź (dodaj do panelu Lokale)
                      </button>
                      <button onClick={() => handle(s.id, "rejected")} disabled={updateStatus.isPending}
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
