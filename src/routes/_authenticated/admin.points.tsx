import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { usePointsRules, useUpdatePointsRule } from "@/lib/points-rules-api";

export const Route = createFileRoute("/_authenticated/admin/points")({
  head: () => ({ meta: [{ title: "Punkty PoŻarcia — Panel admina" }] }),
  component: AdminPoints,
});

const LABELS: Record<string, string> = {
  review_created: "Za dodanie recenzji",
  review_with_photo: "Bonus za zdjęcie w recenzji",
  first_visit_new_place: "Bonus za pierwszą wizytę w nowym lokalu",
};

function AdminPoints() {
  const { data: rules, isLoading } = usePointsRules();
  const update = useUpdatePointsRule();
  const [drafts, setDrafts] = useState<Record<string, { points: number; enabled: boolean }>>({});

  if (isLoading) return <div className="grid place-items-center py-20"><Loader2 className="animate-spin" /></div>;

  async function handleSave(event_key: string, points: number, enabled: boolean) {
    try {
      await update.mutateAsync({ event_key, points, enabled });
      toast.success("Zaktualizowano");
      setDrafts((d) => { const next = { ...d }; delete next[event_key]; return next; });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Błąd"); }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-3xl">Punkty PoŻarcia</h1>
        <p className="text-sm text-muted-foreground">Ile pkt dostaje użytkownik za każdą akcję. Możesz wyłączyć regułę bez kasowania jej z historii.</p>
      </div>

      <div className="space-y-3 max-w-2xl">
        {(rules ?? []).map((r) => {
          const draft = drafts[r.event_key];
          const points = draft?.points ?? r.points;
          const enabled = draft?.enabled ?? r.enabled;
          const dirty = draft !== undefined && (draft.points !== r.points || draft.enabled !== r.enabled);
          return (
            <div key={r.event_key} className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div>
                  <div className="font-semibold">{LABELS[r.event_key] ?? r.event_key}</div>
                  <div className="text-xs text-muted-foreground font-mono">{r.event_key}</div>
                  {r.description && <p className="text-xs text-muted-foreground mt-1">{r.description}</p>}
                </div>
                <label className="inline-flex items-center gap-2 text-xs font-semibold">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => setDrafts((d) => ({ ...d, [r.event_key]: { points, enabled: e.target.checked } }))}
                  />
                  Aktywna
                </label>
              </div>
              <div className="flex items-center gap-3 pt-1">
                <input
                  type="number"
                  value={points}
                  onChange={(e) => setDrafts((d) => ({ ...d, [r.event_key]: { points: parseInt(e.target.value) || 0, enabled } }))}
                  className="w-28 rounded-lg border-2 border-border px-3 py-2 outline-none focus:border-tomato"
                />
                <span className="text-sm text-muted-foreground">pkt</span>
                <button
                  disabled={!dirty || update.isPending}
                  onClick={() => handleSave(r.event_key, points, enabled)}
                  className="ml-auto inline-flex items-center gap-2 rounded-full bg-tomato text-cream px-4 py-2 text-sm font-semibold hover:bg-tomato/90 disabled:opacity-40"
                >
                  <Save size={14} /> Zapisz
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
