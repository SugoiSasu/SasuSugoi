import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2, Save, X } from "lucide-react";
import { useCuisines, useSaveCuisine, useDeleteCuisine, type Cuisine, type CuisineInput } from "@/lib/cuisines-api";
import { useIsSuperAdmin } from "@/lib/use-auth";
import { ConfirmDeleteModal } from "@/components/admin/ConfirmDeleteModal";

export const Route = createFileRoute("/_authenticated/admin/cuisines")({
  component: AdminCuisines,
});

function empty(): CuisineInput {
  return { name: "", emoji: "🍽️", color: "#3b4cc7", sort_order: 100, enabled: true };
}

function AdminCuisines() {
  const isSuper = useIsSuperAdmin();
  const { data, isLoading } = useCuisines();
  const save = useSaveCuisine();
  const del = useDeleteCuisine();
  const [editing, setEditing] = useState<Cuisine | "new" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Cuisine | null>(null);

  if (!isSuper) {
    return <div className="text-center py-20 text-muted-foreground">Tylko head admin może edytować kuchnie.</div>;
  }

  async function handleDeleteConfirmed() {
    if (!confirmDelete) return;
    try {
      await del.mutateAsync(confirmDelete.id);
      toast.success("Usunięto");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Błąd");
    } finally {
      setConfirmDelete(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl">Rodzaje kuchni</h1>
          <p className="text-sm text-muted-foreground">{data?.length ?? 0} kategorii · używane w filtrach i formularzu lokalu</p>
        </div>
        <button onClick={() => setEditing("new")} className="inline-flex items-center gap-2 rounded-full bg-tomato text-cream px-5 py-2.5 font-semibold hover:bg-tomato/90 transition">
          <Plus size={16} /> Dodaj kuchnię
        </button>
      </div>

      {isLoading ? <div className="grid place-items-center py-20"><Loader2 className="animate-spin" /></div> : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {(data ?? []).map((c) => (
            <div key={c.id} className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl grid place-items-center text-2xl flex-shrink-0" style={{ backgroundColor: c.color ?? "#3b4cc7" }}>
                {c.emoji ?? "🍽️"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-display text-lg leading-tight truncate">{c.name}</div>
                <div className="text-xs text-muted-foreground">Sort: {c.sort_order} · {c.enabled ? "✓ aktywna" : "⏸ ukryta"}</div>
              </div>
              <button onClick={() => setEditing(c)} className="p-2 rounded-lg border border-border hover:border-tomato hover:text-tomato"><Pencil size={13} /></button>
              <button onClick={() => setConfirmDelete(c)} className="p-2 rounded-lg border border-border hover:border-destructive hover:text-destructive"><Trash2 size={13} /></button>
            </div>
          ))}
        </div>
      )}

      {editing && <CuisineModal
        key={editing === "new" ? "new" : editing.id}
        cuisine={editing === "new" ? null : editing}
        saving={save.isPending}
        onClose={() => !save.isPending && setEditing(null)}
        onSave={async (values) => {
          try {
            await save.mutateAsync({ id: editing === "new" ? undefined : editing.id, values });
            toast.success(editing === "new" ? "Dodano ✓" : "Zapisano ✓");
            setEditing(null);
          } catch (e) { toast.error(e instanceof Error ? e.message : "Błąd"); }
        }}
      />}

      <ConfirmDeleteModal
        open={!!confirmDelete}
        title={`Usunąć kuchnię "${confirmDelete?.name}"?`}
        description="Lokale z tą kuchnią pozostaną, ale będą miały wartość niepowiązaną z listą."
        pending={del.isPending}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={handleDeleteConfirmed}
      />
    </div>
  );
}

function CuisineModal({ cuisine, onClose, onSave, saving }: {
  cuisine: Cuisine | null;
  onClose: () => void;
  onSave: (v: CuisineInput) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<CuisineInput>(cuisine
    ? { name: cuisine.name, emoji: cuisine.emoji, color: cuisine.color, sort_order: cuisine.sort_order, enabled: cuisine.enabled }
    : empty()
  );

  return (
    <div className="fixed inset-0 z-50 bg-navy/70 backdrop-blur-sm grid place-items-center p-4" onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); onSave(form); }}
            className="bg-card rounded-3xl max-w-md w-full shadow-2xl p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl">{cuisine ? "Edytuj kuchnię" : "Nowa kuchnia"}</h2>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-full bg-muted grid place-items-center"><X size={16} /></button>
        </div>
        <label className="block">
          <span className="text-xs uppercase font-semibold text-muted-foreground">Nazwa</span>
          <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs uppercase font-semibold text-muted-foreground">Emoji</span>
            <input value={form.emoji ?? ""} onChange={(e) => setForm({ ...form, emoji: e.target.value })} className="input" />
          </label>
          <label className="block">
            <span className="text-xs uppercase font-semibold text-muted-foreground">Kolor</span>
            <input type="color" value={form.color ?? "#3b4cc7"} onChange={(e) => setForm({ ...form, color: e.target.value })} className="input h-10" />
          </label>
        </div>
        <label className="block">
          <span className="text-xs uppercase font-semibold text-muted-foreground">Sortowanie</span>
          <input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })} className="input" />
        </label>
        <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />
          Aktywna (widoczna w filtrach)
        </label>
        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-full border border-border py-3 font-semibold hover:bg-muted">Anuluj</button>
          <button type="submit" disabled={saving} className="flex-[2] inline-flex items-center justify-center gap-2 rounded-full bg-tomato text-cream py-3 font-semibold disabled:opacity-50">
            {saving ? <><Loader2 className="animate-spin" size={16} /> Zapisywanie…</> : <><Save size={16} /> Zapisz</>}
          </button>
        </div>
      </form>
    </div>
  );
}
