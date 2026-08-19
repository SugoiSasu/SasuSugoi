import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Save, Trash2, Loader2, X, Lock } from "lucide-react";
import { useIsSuperAdmin } from "@/lib/use-auth";
import { useRanks, useSaveRank, useDeleteRank, type Rank } from "@/lib/ranks-api";
import { RankBadge } from "@/components/RankBadge";
import { ConfirmDeleteModal } from "@/components/admin/ConfirmDeleteModal";

export const Route = createFileRoute("/_authenticated/admin/ranks")({
  head: () => ({ meta: [{ title: "Rangi — Panel admina" }] }),
  component: AdminRanks,
});

function emptyRank(): Omit<Rank, "id" | "is_system"> {
  return { slug: "", name: "", color: "#e35d2e", icon: "🏆", description: "", sort_order: 100 };
}

function AdminRanks() {
  const isSuper = useIsSuperAdmin();
  const { data: ranks, isLoading } = useRanks();
  const save = useSaveRank();
  const del = useDeleteRank();
  const [editing, setEditing] = useState<Rank | "new" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Rank | null>(null);

  if (!isSuper) {
    return (
      <div className="bg-card border border-border rounded-2xl p-8 text-center">
        <Lock className="mx-auto text-muted-foreground mb-3" size={32} />
        <h2 className="font-display text-2xl mb-2">Tylko Head Admin</h2>
        <p className="text-sm text-muted-foreground">Edycja rang dostępna jest tylko dla pożeramy (super_admin).</p>
      </div>
    );
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
          <h1 className="font-display text-3xl">Rangi</h1>
          <p className="text-sm text-muted-foreground">Kosmetyczne odznaki widoczne na profilu użytkownika.</p>
        </div>
        <button
          onClick={() => setEditing("new")}
          className="inline-flex items-center gap-2 rounded-full bg-tomato text-cream px-5 py-2.5 font-semibold hover:bg-tomato/90 transition"
        >
          <Plus size={16} /> Dodaj rangę
        </button>
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-20"><Loader2 className="animate-spin" size={28} /></div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(ranks ?? []).map((r) => (
            <div key={r.id} className="bg-card border border-border rounded-2xl p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <RankBadge rank={r} />
                {r.is_system && <span className="text-[10px] uppercase tracking-wider font-bold text-amber-600">systemowa</span>}
              </div>
              <div>
                <div className="font-display text-lg">{r.name}</div>
                <div className="text-xs text-muted-foreground font-mono">{r.slug}</div>
              </div>
              {r.description && <p className="text-sm text-muted-foreground line-clamp-2">{r.description}</p>}
              <div className="flex gap-2 pt-1">
                <button onClick={() => setEditing(r)} className="flex-1 rounded-lg border border-border py-1.5 text-sm hover:border-tomato hover:text-tomato">Edytuj</button>
                {!r.is_system && (
                  <button onClick={() => setConfirmDelete(r)} className="rounded-lg border border-border px-3 hover:border-destructive hover:text-destructive">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <RankModal
          rank={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSave={async (values) => {
            try {
              await save.mutateAsync({ id: editing === "new" ? undefined : editing.id, values });
              toast.success("Zapisano");
              setEditing(null);
            } catch (e) { toast.error(e instanceof Error ? e.message : "Błąd"); }
          }}
          saving={save.isPending}
        />
      )}

      <ConfirmDeleteModal
        open={!!confirmDelete}
        title={`Usunąć rangę "${confirmDelete?.name}"?`}
        description="Odznaka zniknie z profili wszystkich użytkowników, którzy ją mają."
        pending={del.isPending}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={handleDeleteConfirmed}
      />
    </div>
  );
}

function RankModal({
  rank, onClose, onSave, saving,
}: { rank: Rank | null; onClose: () => void; onSave: (v: Omit<Rank, "id" | "is_system">) => void; saving: boolean }) {
  const [f, setF] = useState<Omit<Rank, "id" | "is_system">>(
    rank
      ? { slug: rank.slug, name: rank.name, color: rank.color, icon: rank.icon, description: rank.description, sort_order: rank.sort_order }
      : emptyRank(),
  );

  return (
    <div className="fixed inset-0 z-50 bg-navy/70 backdrop-blur-sm grid place-items-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-card text-foreground rounded-3xl max-w-md w-full p-6 shadow-2xl my-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-2xl">{rank ? "Edytuj rangę" : "Nowa ranga"}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted grid place-items-center"><X size={16} /></button>
        </div>
        {rank && (
          <div className="mb-4">
            <RankBadge rank={{ ...rank, ...f, is_system: rank.is_system }} />
          </div>
        )}
        <form
          onSubmit={(e) => { e.preventDefault(); onSave(f); }}
          className="space-y-3"
        >
          <Field label="Slug (a-z, 0-9, _-)">
            <input
              required value={f.slug} disabled={!!rank}
              onChange={(e) => setF({ ...f, slug: e.target.value.toLowerCase() })}
              className="input"
              placeholder="np. smakosz"
            />
          </Field>
          <Field label="Nazwa">
            <input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className="input" />
          </Field>
          <Field label="Ikona (emoji lub puste)">
            <input value={f.icon ?? ""} onChange={(e) => setF({ ...f, icon: e.target.value })} className="input" placeholder="🍕" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Kolor (hex)">
              <div className="flex gap-2 items-center">
                <input type="color" value={f.color} onChange={(e) => setF({ ...f, color: e.target.value })} className="w-12 h-10 rounded-lg border border-border" />
                <input value={f.color} onChange={(e) => setF({ ...f, color: e.target.value })} className="input flex-1 font-mono text-sm" />
              </div>
            </Field>
            <Field label="Sort (mniej = wcześniej)">
              <input type="number" value={f.sort_order} onChange={(e) => setF({ ...f, sort_order: parseInt(e.target.value) || 0 })} className="input" />
            </Field>
          </div>
          <Field label="Opis (opcjonalnie)">
            <textarea rows={2} value={f.description ?? ""} onChange={(e) => setF({ ...f, description: e.target.value })} className="input" />
          </Field>
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
