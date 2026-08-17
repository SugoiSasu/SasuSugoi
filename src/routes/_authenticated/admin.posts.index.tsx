import { createFileRoute, Link } from "@tanstack/react-router";
import { useAllPostsAdmin, useDeletePost } from "@/lib/posts-api";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/posts/")({
  component: AdminPosts,
});

function AdminPosts() {
  const { data: posts, isLoading } = useAllPostsAdmin();
  const del = useDeletePost();

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Usunąć wpis "${title}"?`)) return;
    try {
      await del.mutateAsync(id);
      toast.success("Usunięto");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Błąd");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl">Wpisy blogowe</h1>
          <p className="text-sm text-muted-foreground">{posts?.length ?? 0} wpisów</p>
        </div>
        <Link
          to="/admin/posts/$id"
          params={{ id: "new" }}
          className="inline-flex items-center gap-2 rounded-full bg-tomato text-cream px-5 py-2.5 font-semibold hover:bg-tomato/90 transition"
        >
          <Plus size={16} /> Nowy wpis
        </Link>
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-20"><Loader2 className="animate-spin" size={28} /></div>
      ) : posts && posts.length > 0 ? (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Tytuł</th>
                <th className="text-left px-4 py-3 hidden sm:table-cell">Status</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">Tagi</th>
                <th className="text-left px-4 py-3 hidden lg:table-cell">Zaktualizowano</th>
                <th className="px-4 py-3 w-px"></th>
              </tr>
            </thead>
            <tbody>
              {posts.map((p) => (
                <tr key={p.id} className="border-t border-border hover:bg-muted/30 transition">
                  <td className="px-4 py-3">
                    <div className="font-semibold">{p.title}</div>
                    <div className="text-xs text-muted-foreground">{p.slug}</div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className={`chip ${p.status === "published" ? "bg-tomato text-cream" : "bg-muted text-foreground"}`}>
                      {p.status === "published" ? "Opublikowany" : "Szkic"}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-xs text-muted-foreground">
                    {p.tags.join(", ") || "—"}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-xs text-muted-foreground">
                    {new Date(p.updated_at).toLocaleDateString("pl-PL")}
                  </td>
                  <td className="px-4 py-3 flex gap-1.5 justify-end">
                    {p.status === "published" && (
                      <Link to="/blog/$slug" params={{ slug: p.slug }} target="_blank" className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground" title="Podgląd">
                        <ExternalLink size={14} />
                      </Link>
                    )}
                    <Link to="/admin/posts/$id" params={{ id: p.id }} className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground" title="Edytuj">
                      <Pencil size={14} />
                    </Link>
                    <button onClick={() => handleDelete(p.id, p.title)} className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive" title="Usuń">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-20 bg-card border border-border rounded-2xl">
          <p className="text-muted-foreground mb-4">Brak wpisów. Stwórz pierwszy!</p>
          <Link to="/admin/posts/$id" params={{ id: "new" }} className="inline-flex items-center gap-2 rounded-full bg-tomato text-cream px-5 py-2.5 font-semibold">
            <Plus size={16} /> Nowy wpis
          </Link>
        </div>
      )}
    </div>
  );
}
