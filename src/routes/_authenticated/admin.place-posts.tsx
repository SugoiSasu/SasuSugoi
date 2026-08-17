import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, Save, X, Megaphone } from "lucide-react";
import { useAllPlacePosts, useUpsertPlacePost, useDeletePlacePost, type PlacePost } from "@/lib/place-posts-api";
import { usePlaces } from "@/lib/places-api";

export const Route = createFileRoute("/_authenticated/admin/place-posts")({
  head: () => ({ meta: [{ title: "Wpisy lokali — Panel admina" }] }),
  component: AdminPlacePosts,
});

const EMPTY = { place_id: "", title: "", body: "", image_url: "" };

function AdminPlacePosts() {
  const { data: posts, isLoading } = useAllPlacePosts();
  const { data: places } = usePlaces();
  const upsert = useUpsertPlacePost();
  const del = useDeletePlacePost();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PlacePost | null>(null);
  const [form, setForm] = useState<typeof EMPTY>(EMPTY);

  function startEdit(p: PlacePost | null) {
    setEditing(p);
    setForm(p ? {
      place_id: p.place_id, title: p.title, body: p.body ?? "", image_url: p.image_url ?? "",
    } : EMPTY);
    setOpen(true);
  }

  async function handleSave() {
    if (!form.place_id || !form.title.trim()) { toast.error("Lokal i tytuł są wymagane"); return; }
    try {
      await upsert.mutateAsync({
        id: editing?.id,
        place_id: form.place_id,
        title: form.title.trim(),
        body: form.body.trim() || null,
        image_url: form.image_url.trim() || null,
      });
      toast.success(editing ? "Zaktualizowano" : "Dodano wpis");
      setOpen(false);
      setEditing(null);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Błąd"); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Usunąć wpis?")) return;
    try { await del.mutateAsync(id); toast.success("Usunięto"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Błąd"); }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl mb-1">Wpisy lokali</h1>
          <p className="text-sm text-muted-foreground">Pojawiają się na Wallu u użytkowników, którzy mają lokal w ulubionych.</p>
        </div>
        <button onClick={() => startEdit(null)} className="inline-flex items-center gap-2 rounded-full bg-tomato text-cream px-4 py-2 text-sm font-semibold hover:bg-tomato/90">
          <Plus size={14} /> Nowy wpis
        </button>
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-10"><Loader2 className="animate-spin" /></div>
      ) : !posts || posts.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-2xl p-8 text-center text-sm text-muted-foreground">
          <Megaphone className="mx-auto text-muted-foreground mb-2" size={28} />
          Brak wpisów.
        </div>
      ) : (
        <ul className="space-y-3">
          {posts.map((p) => {
            const place = (places ?? []).find((pl) => pl.id === p.place_id);
            return (
              <li key={p.id} className="bg-card border border-border rounded-2xl p-3 flex items-center gap-3">
                {p.image_url && <img src={p.image_url} alt="" className="w-20 h-16 object-cover rounded-md shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-muted-foreground">{place?.name ?? "—"}</div>
                  <div className="font-semibold truncate">{p.title}</div>
                  {p.body && <div className="text-xs text-muted-foreground truncate">{p.body}</div>}
                </div>
                <button onClick={() => startEdit(p)} className="chip bg-card border border-border hover:border-tomato">Edytuj</button>
                <button onClick={() => handleDelete(p.id)} className="grid place-items-center w-8 h-8 rounded-full text-destructive hover:bg-destructive/10">
                  <Trash2 size={14} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={() => setOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-card border border-border rounded-2xl w-full max-w-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-xl">{editing ? "Edytuj wpis" : "Nowy wpis"}</h2>
              <button onClick={() => setOpen(false)} className="grid place-items-center w-8 h-8 rounded-full hover:bg-muted"><X size={14} /></button>
            </div>
            <div className="space-y-3 text-sm">
              <label className="block">
                <div className="text-xs font-semibold text-muted-foreground mb-1">Lokal *</div>
                <select value={form.place_id} onChange={(e) => setForm({ ...form, place_id: e.target.value })} className="pp-input">
                  <option value="">— wybierz —</option>
                  {(places ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
              <label className="block">
                <div className="text-xs font-semibold text-muted-foreground mb-1">Tytuł *</div>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="pp-input" maxLength={140} />
              </label>
              <label className="block">
                <div className="text-xs font-semibold text-muted-foreground mb-1">Treść</div>
                <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={4} className="pp-input" />
              </label>
              <label className="block">
                <div className="text-xs font-semibold text-muted-foreground mb-1">Grafika (URL)</div>
                <input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} className="pp-input" placeholder="https://..." />
                {form.image_url && <img src={form.image_url} alt="" className="mt-2 w-full max-h-40 object-cover rounded-md" />}
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setOpen(false)} className="chip bg-card border border-border">Anuluj</button>
              <button onClick={handleSave} disabled={upsert.isPending} className="inline-flex items-center gap-2 rounded-full bg-tomato text-cream px-4 py-2 text-sm font-semibold hover:bg-tomato/90 disabled:opacity-50">
                <Save size={14} /> Zapisz
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .pp-input { width: 100%; background: hsl(var(--background)); border: 1px solid hsl(var(--border)); border-radius: 0.5rem; padding: 0.5rem 0.75rem; font-size: 0.875rem; }
        .pp-input:focus { outline: none; border-color: hsl(var(--ring)); }
      `}</style>
    </div>
  );
}
