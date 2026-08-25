import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useAllPostsAdmin, useDeletePost } from "@/lib/posts-api";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2, ExternalLink, FileText } from "lucide-react";
import {
  AdminSearchInput,
  AdminStatusTag,
  AdminEmptyState,
} from "@/components/admin/AdminControls";
import { ConfirmDeleteModal } from "@/components/admin/ConfirmDeleteModal";
import {
  AdminPageHeader,
  AdminStatBar,
  adminCtaClass,
  countThisMonth,
  type AdminStat,
} from "@/components/admin/AdminPageShell";

export const Route = createFileRoute("/_authenticated/admin/posts/")({
  component: AdminPosts,
});

function AdminPosts() {
  const { data: posts, isLoading } = useAllPostsAdmin();
  const del = useDeletePost();
  const [search, setSearch] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; title: string } | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return posts ?? [];
    return (posts ?? []).filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [posts, search]);

  const postStats = useMemo<AdminStat[]>(() => {
    const list = posts ?? [];
    const published = list.filter((p) => p.status === "published").length;
    const drafts = list.length - published;
    const noCover = list.filter((p) => !p.cover_image_url).length;
    const added = countThisMonth(list);
    return [
      {
        label: "Wszystkie wpisy",
        value: list.length,
        delta: added ? `+${added} w tym mies.` : "bez nowych",
        tone: added ? "ok" : "neutral",
      },
      { label: "Opublikowane", value: published, delta: "widoczne publicznie", tone: "ok" },
      {
        label: "Szkice",
        value: drafts,
        delta: drafts ? "do dokończenia" : "brak",
        tone: drafts ? "attention" : "ok",
      },
      {
        label: "Bez okładki",
        value: noCover,
        delta: noCover ? "do uzupełnienia" : "komplet",
        tone: noCover ? "attention" : "ok",
      },
    ];
  }, [posts]);

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
      <AdminPageHeader
        title="Wpisy blogowe"
        icon={<FileText size={26} />}
        subtitle="Treści redakcyjne widoczne w zakładce Odkrywaj."
        action={
          <Link to="/admin/posts/$id" params={{ id: "new" }} className={adminCtaClass}>
            <Plus size={16} /> Nowy wpis
          </Link>
        }
      />
      <AdminStatBar loading={isLoading} stats={postStats} />

      {(posts?.length ?? 0) > 0 && (
        <AdminSearchInput
          value={search}
          onChange={setSearch}
          placeholder="Szukaj po tytule, slugu, tagu…"
          className="mb-4 max-w-sm"
        />
      )}

      {isLoading ? (
        <div className="grid place-items-center py-20"><Loader2 className="animate-spin" size={28} /></div>
      ) : filtered.length > 0 ? (
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
              {filtered.map((p) => (
                <tr key={p.id} className="border-t border-border hover:bg-muted/30 transition">
                  <td className="px-4 py-3">
                    <div className="font-semibold">{p.title}</div>
                    <div className="text-xs text-muted-foreground">{p.slug}</div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <AdminStatusTag
                      tone={p.status === "published" ? "ok" : "neutral"}
                      label={p.status === "published" ? "Opublikowany" : "Szkic"}
                    />
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-xs text-muted-foreground">
                    {p.tags.join(", ") || " - "}
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
                    <button onClick={() => setConfirmDelete({ id: p.id, title: p.title })} className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive" title="Usuń">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : search ? (
        <AdminEmptyState title={`Nic nie pasuje do „${search}".`} hint="Spróbuj innego hasła." />
      ) : (
        <AdminEmptyState
          title="Brak wpisów. Stwórz pierwszy!"
          action={
            <Link to="/admin/posts/$id" params={{ id: "new" }} className={adminCtaClass}>
              <Plus size={16} /> Nowy wpis
            </Link>
          }
        />
      )}

      <ConfirmDeleteModal
        open={!!confirmDelete}
        title={`Usunąć wpis "${confirmDelete?.title}"?`}
        description="Tej operacji nie można cofnąć."
        pending={del.isPending}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={handleDeleteConfirmed}
      />
    </div>
  );
}
