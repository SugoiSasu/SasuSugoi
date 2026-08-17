import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Save, Loader2, X } from "lucide-react";
import { useIsAdmin } from "@/lib/use-auth";
import {
  useAchievements, useSaveAchievement, useDeleteAchievement, type Achievement,
} from "@/lib/achievements-api";

export const Route = createFileRoute("/_authenticated/admin/achievements")({
  head: () => ({ meta: [{ title: "Achievementy — Panel admina" }] }),
  component: AdminAchievements,
});

const CRITERIA_TYPES = [
  { value: "reviews_count", label: "Liczba recenzji" },
  { value: "unique_places", label: "Liczba unikalnych lokali" },
  { value: "points_total", label: "Suma punktów" },
  { value: "friends_count", label: "Liczba znajomych" },
] as const;

function emptyAchievement(): Omit<Achievement, "id"> {
  return {
    slug: "", name: "", description: "", icon_url: "🏅",
    criteria: { type: "reviews_count", threshold: 1 },
    sort_order: 100, enabled: true,
  };
}

function AdminAchievements() {
  const { data: isAdmin } = useIsAdmin();
  const { data: achievements, isLoading } = useAchievements();
  const save = useSaveAchievement();
  const del = useDeleteAchievement();
  const [editing, setEditing] = useState<Achievement | "new" | null>(null);

  if (!isAdmin) return <div className="text-center py-20 text-muted-foreground">Tylko admin.</div>;

  async function handleDelete(a: Achievement) {
    if (!confirm(`Usunąć achievement "${a.name}"?`)) return;
    try { await del.mutateAsync(a.id); toast.success("Usunięto"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Błąd"); }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl">Achievementy</h1>
          <p className="text-sm text-muted-foreground">Osiągnięcia przyznawane automatycznie po spełnieniu progu.</p>
        </div>
        <button onClick={() => setEditing("new")} className="inline-flex items-center gap-2 rounded-full bg-tomato text-cream px-5 py-2.5 font-semibold hover:bg-tomato/90">
          <Plus size={16} /> Dodaj
        </button>
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-20"><Loader2 className="animate-spin" /></div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(achievements ?? []).map((a) => (
            <div key={a.id} className="bg-card border border-border rounded-2xl p-4 space-y-2">
              <div className="flex items-start gap-3">
                <div className="text-3xl">{renderIcon(a.icon_url)}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-display text-lg leading-tight">{a.name}</div>
                  <div className="text-xs text-muted-foreground font-mono">{a.slug}</div>
                </div>
                {!a.enabled && <span className="text-[10px] uppercase tracking-wider text-muted-foreground">off</span>}
              </div>
              {a.description && <p className="text-sm text-muted-foreground line-clamp-2">{a.description}</p>}
              <div className="text-xs text-muted-foreground">
                Próg: <span className="font-mono">{a.criteria?.type} ≥ {a.criteria?.threshold}</span>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setEditing(a)} className="flex-1 rounded-lg border border-border py-1.5 text-sm hover:border-tomato hover:text-tomato">Edytuj</button>
                <button onClick={() => handleDelete(a)} className="rounded-lg border border-border px-3 hover:border-destructive hover:text-destructive">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <AchievementModal
          achievement={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSave={async (values) => {
            try { await save.mutateAsync({ id: editing === "new" ? undefined : editing.id, values }); toast.success("Zapisano"); setEditing(null); }
            catch (e) { toast.error(e instanceof Error ? e.message : "Błąd"); }
          }}
          saving={save.isPending}
        />
      )}
    </div>
  );
}

function renderIcon(icon: string | null) {
  if (!icon) return "🏅";
  if (icon.startsWith("http")) return <img src={icon} alt="" className="w-8 h-8 rounded" />;
  return icon;
}

function AchievementModal({
  achievement, onClose, onSave, saving,
}: {
  achievement: Achievement | null;
  onClose: () => void;
  onSave: (v: Omit<Achievement, "id">) => void;
  saving: boolean;
}) {
  const [f, setF] = useState<Omit<Achievement, "id">>(
    achievement
      ? { slug: achievement.slug, name: achievement.name, description: achievement.description, icon_url: achievement.icon_url, criteria: achievement.criteria, sort_order: achievement.sort_order, enabled: achievement.enabled }
      : emptyAchievement(),
  );

  return (
    <div className="fixed inset-0 z-50 bg-navy/70 backdrop-blur-sm grid place-items-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-card text-foreground rounded-3xl max-w-md w-full p-6 shadow-2xl my-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-2xl">{achievement ? "Edytuj" : "Nowy achievement"}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted grid place-items-center"><X size={16} /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onSave(f); }} className="space-y-3">
          <Field label="Slug">
            <input required disabled={!!achievement} value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value.toLowerCase() })} className="input" placeholder="np. food_critic" />
          </Field>
          <Field label="Nazwa">
            <input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className="input" />
          </Field>
          <Field label="Ikona (emoji lub URL)">
            <input value={f.icon_url ?? ""} onChange={(e) => setF({ ...f, icon_url: e.target.value })} className="input" placeholder="🏅 lub https://..." />
          </Field>
          <Field label="Opis">
            <textarea rows={2} value={f.description ?? ""} onChange={(e) => setF({ ...f, description: e.target.value })} className="input" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Typ progu">
              <select
                value={f.criteria?.type ?? "reviews_count"}
                onChange={(e) => setF({ ...f, criteria: { ...(f.criteria ?? {}), type: e.target.value } })}
                className="input"
              >
                {CRITERIA_TYPES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </Field>
            <Field label="Wartość progu">
              <input
                type="number" min={1}
                value={f.criteria?.threshold ?? 1}
                onChange={(e) => setF({ ...f, criteria: { ...(f.criteria ?? {}), threshold: parseInt(e.target.value) || 1 } })}
                className="input"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Sort">
              <input type="number" value={f.sort_order} onChange={(e) => setF({ ...f, sort_order: parseInt(e.target.value) || 0 })} className="input" />
            </Field>
            <label className="block">
              <span className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-1 block">Aktywny</span>
              <input type="checkbox" checked={f.enabled} onChange={(e) => setF({ ...f, enabled: e.target.checked })} className="w-5 h-5 mt-2" />
            </label>
          </div>
          <button type="submit" disabled={saving} className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-tomato text-cream py-3 font-semibold hover:bg-tomato/90 disabled:opacity-50">
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Zapisz
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-1 block">{label}</span>
      {children}
    </label>
  );
}
