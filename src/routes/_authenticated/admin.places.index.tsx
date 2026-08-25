import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { usePlaces, usePlaceRatingsMap, useDeletePlace, type Place } from "@/lib/places-api";
import {
  useCuisines,
  useSaveCuisine,
  useDeleteCuisine,
  type Cuisine,
  type CuisineInput,
} from "@/lib/cuisines-api";
import {
  useAllPlacePosts,
  useUpsertPlacePost,
  useDeletePlacePost,
  type PlacePost,
} from "@/lib/place-posts-api";
import { useIsSuperAdmin } from "@/lib/use-auth";
import { cuisineMeta } from "@/data/places";
import { toast } from "sonner";
import { ConfirmDeleteModal } from "@/components/admin/ConfirmDeleteModal";
import {
  Plus,
  Pencil,
  Trash2,
  MapPin,
  Loader2,
  X,
  Save,
  Search,
  Megaphone,
  UtensilsCrossed,
  Newspaper,
  MapIcon,
} from "lucide-react";
import { Map as MapPinIcon } from "lucide-react";
import { initialsFromName, colorFromKey } from "@/lib/avatar-utils";
import { MigrateAllPlacesButton } from "@/components/PlaceImageMigration";
import {
  AdminPageHeader,
  AdminStatBar,
  adminCtaClass,
  countThisMonth,
  type AdminStat,
} from "@/components/admin/AdminPageShell";
import { AdminSearchInput, AdminEmptyState } from "@/components/admin/AdminControls";

export const Route = createFileRoute("/_authenticated/admin/places/")({
  component: AdminPlaces,
});

function CoverThumb({
  url,
  name,
  size = 80,
}: {
  url?: string | null;
  name: string;
  size?: number;
}) {
  if (url) {
    return (
      <img
        src={url}
        alt=""
        style={{ width: size, height: size }}
        className="rounded-xl object-cover border border-border bg-muted flex-shrink-0"
        onError={(e) => (e.currentTarget.style.display = "none")}
      />
    );
  }
  const bg = colorFromKey(name);
  return (
    <div
      style={{ width: size, height: size, backgroundColor: bg, fontSize: size * 0.32 }}
      className="rounded-xl grid place-items-center text-white font-black tracking-tight flex-shrink-0"
    >
      {initialsFromName(name)}
    </div>
  );
}

const TABS = [
  { key: "lokale", label: "Lokale", icon: <MapIcon size={13} /> },
  { key: "kuchnie", label: "Kuchnie", icon: <UtensilsCrossed size={13} /> },
  { key: "wpisy", label: "Wpisy lokali", icon: <Newspaper size={13} /> },
] as const;

function AdminPlaces() {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("lokale");

  return (
    <div>
      <AdminPageHeader
        title="Lokale"
        icon={<MapPinIcon size={26} />}
        subtitle="Miejscówki na mapie, kuchnie i wpisy widoczne na Wallu."
        action={
          tab === "lokale" ? (
            <Link to="/admin/places/$id" params={{ id: "new" }} className={adminCtaClass}>
              <Plus size={16} /> Dodaj lokal
            </Link>
          ) : undefined
        }
      />
      <PlacesStatBar />
      <div className="flex gap-2 mb-6 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`chip ${tab === t.key ? "bg-tomato text-cream" : "bg-card border border-border"}`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>
      {tab === "lokale" ? <PlacesTab /> : tab === "kuchnie" ? <CuisinesTab /> : <PlacePostsTab />}
    </div>
  );
}

/**
 * Every number here is derived from the same queries the tabs already run
 * (react-query dedupes them), so nothing extra hits the network. "Bez
 * zdjęcia" and "Bez ocen" are the two actionable ones - they're the reason
 * this bar exists rather than just showing a total.
 */
function PlacesStatBar() {
  const { data: places, isLoading } = usePlaces();
  const { data: ratings } = usePlaceRatingsMap();
  const { data: cuisines } = useCuisines();

  const stats = useMemo<AdminStat[]>(() => {
    const list = places ?? [];
    const noPhoto = list.filter((p) => !p.avatar_url && !p.cover_image_url).length;
    const rated = list.filter((p) => ratings?.get(p.id));
    const noRating = list.length - rated.length;
    const avg = rated.length
      ? rated.reduce((sum, p) => sum + (ratings!.get(p.id)!.avg ?? 0), 0) / rated.length
      : 0;
    const added = countThisMonth(list);
    return [
      {
        label: "Wszystkie lokale",
        value: list.length,
        delta: added ? `+${added} w tym mies.` : "bez nowych",
        tone: added ? "ok" : "neutral",
      },
      {
        label: "Bez zdjęcia",
        value: noPhoto,
        delta: noPhoto ? "do uzupełnienia" : "komplet",
        tone: noPhoto ? "attention" : "ok",
      },
      {
        label: "Bez ocen",
        value: noRating,
        delta: `${rated.length} ocenionych`,
        tone: noRating ? "attention" : "ok",
      },
      {
        label: "Śr. ocena",
        value: rated.length ? avg.toFixed(1).replace(".", ",") : "—",
        delta: `${(cuisines ?? []).filter((c) => c.enabled).length} kuchni`,
        tone: "neutral",
      },
    ];
  }, [places, ratings, cuisines]);

  return <AdminStatBar stats={stats} loading={isLoading} />;
}

function PlacesTab() {
  const { data: places, isLoading } = usePlaces();
  const { data: ratings } = usePlaceRatingsMap();
  const del = useDeletePlace();
  const [confirmDelete, setConfirmDelete] = useState<Place | null>(null);
  const [query, setQuery] = useState("");
  const [cuisineFilter, setCuisineFilter] = useState<string>("Wszystko");
  const [sort, setSort] = useState<"default" | "name" | "rating" | "newest">("default");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const { data: cuisines } = useCuisines();
  const cuisineNames = useMemo(
    () => (cuisines ?? []).filter((c) => c.enabled).map((c) => c.name),
    [cuisines],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (places ?? []).filter((p) => {
      if (cuisineFilter !== "Wszystko" && p.cuisine !== cuisineFilter) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.address.toLowerCase().includes(q) ||
        p.cuisine.toLowerCase().includes(q) ||
        (p.description ?? "").toLowerCase().includes(q)
      );
    });
    if (sort === "default") return list;
    return list.slice().sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name, "pl");
      if (sort === "rating") return (ratings?.get(b.id)?.avg ?? 0) - (ratings?.get(a.id)?.avg ?? 0);
      return (b.created_at ?? "").localeCompare(a.created_at ?? "");
    });
  }, [places, query, cuisineFilter, sort, ratings]);

  const allVisibleSelected = filtered.length > 0 && filtered.every((p) => selected.has(p.id));

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

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleBulkDeleteConfirmed() {
    setBulkDeleting(true);
    const ids = [...selected];
    const results = await Promise.allSettled(ids.map((id) => del.mutateAsync(id)));
    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed === 0) {
      toast.success(`Usunięto ${ids.length} lokali`);
    } else {
      toast.error(`Usunięto ${ids.length - failed} z ${ids.length} - ${failed} nie udało się`);
    }
    setSelected(new Set());
    setBulkDeleting(false);
    setBulkDeleteOpen(false);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <p className="text-sm text-muted-foreground">
            {filtered.length}
            {places && filtered.length !== places.length ? ` z ${places.length}` : ""} miejscówek ·
            widoczne publicznie
          </p>
          {filtered.length > 0 && (
            <button
              type="button"
              onClick={() =>
                setSelected(allVisibleSelected ? new Set() : new Set(filtered.map((p) => p.id)))
              }
              className="text-xs font-semibold text-tomato hover:underline"
            >
              {allVisibleSelected ? "Wyczyść zaznaczenie" : "Zaznacz widoczne"}
            </button>
          )}
        </div>
      </div>

      <div className="mb-5">
        <MigrateAllPlacesButton places={places ?? []} />
      </div>

      {/* Search + filter */}
      <div className="mb-5 flex flex-col sm:flex-row gap-3">
        <AdminSearchInput
          value={query}
          onChange={setQuery}
          placeholder="Szukaj po nazwie, adresie, opisie…"
          className="flex-1"
        />
        <div className="w-full sm:w-52">
          <select
            value={cuisineFilter}
            onChange={(e) => setCuisineFilter(e.target.value)}
            className="input"
          >
            <option value="Wszystko">Wszystkie kuchnie</option>
            {cuisineNames.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="w-full sm:w-52">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            className="input"
          >
            <option value="default">Domyślna kolejność</option>
            <option value="name">Nazwa A-Z</option>
            <option value="rating">Najwyżej oceniane</option>
            <option value="newest">Najnowsze</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-20">
          <Loader2 className="animate-spin" size={28} />
        </div>
      ) : filtered.length === 0 ? (
        <AdminEmptyState
          title="Brak wyników dla tych filtrów."
          hint="Spróbuj innego zapytania lub wyczyść filtr kuchni."
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p) => {
            const color = cuisineMeta(p.cuisine).color;
            const rating = ratings?.get(p.id);
            const isSelected = selected.has(p.id);
            return (
              <div
                key={p.id}
                className={`bg-card border rounded-2xl p-4 flex flex-col gap-3 transition-colors ${
                  isSelected ? "border-tomato ring-1 ring-tomato" : "border-border"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="relative flex-shrink-0">
                    <CoverThumb url={p.avatar_url ?? p.cover_image_url} name={p.name} size={80} />
                    <button
                      type="button"
                      onClick={() => toggleSelected(p.id)}
                      aria-label={isSelected ? "Odznacz" : "Zaznacz"}
                      aria-pressed={isSelected}
                      className={`absolute -top-1.5 -left-1.5 w-6 h-6 rounded-full border-2 grid place-items-center transition-colors ${
                        isSelected
                          ? "bg-tomato border-tomato text-cream"
                          : "bg-card border-border text-transparent hover:border-tomato"
                      }`}
                    >
                      ✓
                    </button>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div
                          className="text-xs uppercase tracking-wider font-bold truncate"
                          style={{ color }}
                        >
                          {p.cuisine}
                        </div>
                        <Link
                          to="/k/$id"
                          params={{ id: p.slug || p.id }}
                          className="font-display text-lg leading-tight truncate hover:text-tomato transition block"
                          title="Zobacz profil lokalu"
                        >
                          {p.name}
                        </Link>
                      </div>
                      <span className="text-sm font-bold whitespace-nowrap">
                        {rating ? `⭐ ${rating.avg.toFixed(1)} (${rating.count})` : "Brak ocen"}
                      </span>
                    </div>
                    {/* `flex`, not `inline-flex`: an inline-flex sizes to its
                        content, so the inner truncate had no width to clip
                        against and long addresses pushed the card (and the
                        page) past the viewport by ~34px at 1280. */}
                    <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1 min-w-0">
                      <MapPin size={12} className="flex-shrink-0" />
                      <span className="truncate">{p.address}</span>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">{p.description}</p>
                <div className="flex gap-2 mt-auto">
                  <Link
                    to="/admin/places/$id"
                    params={{ id: p.id }}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-sm hover:border-tomato hover:text-tomato transition"
                  >
                    <Pencil size={13} /> Edytuj
                  </Link>
                  <button
                    onClick={() => setConfirmDelete(p)}
                    className="rounded-lg border border-border px-3 hover:border-destructive hover:text-destructive transition"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <div className="flex items-center gap-3 rounded-full bg-navy text-cream shadow-2xl px-4 py-2.5">
            <span className="text-sm font-semibold whitespace-nowrap">
              Zaznaczono {selected.size}
            </span>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="text-sm text-cream/70 hover:text-cream"
            >
              Anuluj
            </button>
            <button
              type="button"
              onClick={() => setBulkDeleteOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-destructive text-destructive-foreground px-3 py-1.5 text-sm font-semibold hover:bg-destructive/90"
            >
              <Trash2 size={13} /> Usuń zaznaczone
            </button>
          </div>
        </div>
      )}

      <ConfirmDeleteModal
        open={!!confirmDelete}
        title={`Usunąć "${confirmDelete?.name}"?`}
        description="Lokal zniknie z mapy i wyszukiwania. Recenzje i historia wizyt użytkowników pozostaną osierocone."
        pending={del.isPending}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={handleDeleteConfirmed}
      />

      <ConfirmDeleteModal
        open={bulkDeleteOpen}
        title={`Usunąć ${selected.size} ${selected.size === 1 ? "lokal" : "lokali"}?`}
        description="Zniknie z mapy i wyszukiwania. Recenzje i historia wizyt użytkowników pozostaną osierocone."
        confirmLabel={`Usuń ${selected.size}`}
        pending={bulkDeleting}
        onCancel={() => setBulkDeleteOpen(false)}
        onConfirm={handleBulkDeleteConfirmed}
      />
    </div>
  );
}

function emptyCuisine(): CuisineInput {
  return { name: "", emoji: "🍽️", color: "#3b4cc7", sort_order: 100, enabled: true };
}

function CuisinesTab() {
  const isSuper = useIsSuperAdmin();
  const { data, isLoading } = useCuisines();
  const save = useSaveCuisine();
  const del = useDeleteCuisine();
  const [editing, setEditing] = useState<Cuisine | "new" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Cuisine | null>(null);

  if (!isSuper) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        Tylko head admin może edytować kuchnie.
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
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <p className="text-sm text-muted-foreground">
          {data?.length ?? 0} kategorii · używane w filtrach i formularzu lokalu
        </p>
        <button
          onClick={() => setEditing("new")}
          className="inline-flex items-center gap-2 rounded-full bg-tomato text-cream px-5 py-2.5 font-semibold hover:bg-tomato/90 transition"
        >
          <Plus size={16} /> Dodaj kuchnię
        </button>
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-20">
          <Loader2 className="animate-spin" />
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {(data ?? []).map((c) => (
            <div
              key={c.id}
              className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3"
            >
              <div
                className="w-12 h-12 rounded-xl grid place-items-center text-2xl flex-shrink-0"
                style={{ backgroundColor: c.color ?? "#3b4cc7" }}
              >
                {c.emoji ?? "🍽️"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-display text-lg leading-tight truncate">{c.name}</div>
                <div className="text-xs text-muted-foreground">
                  Sort: {c.sort_order} · {c.enabled ? "✓ aktywna" : "⏸ ukryta"}
                </div>
              </div>
              <button
                onClick={() => setEditing(c)}
                className="p-2 rounded-lg border border-border hover:border-tomato hover:text-tomato"
              >
                <Pencil size={13} />
              </button>
              <button
                onClick={() => setConfirmDelete(c)}
                className="p-2 rounded-lg border border-border hover:border-destructive hover:text-destructive"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <CuisineModal
          key={editing === "new" ? "new" : editing.id}
          cuisine={editing === "new" ? null : editing}
          saving={save.isPending}
          onClose={() => !save.isPending && setEditing(null)}
          onSave={async (values) => {
            try {
              await save.mutateAsync({ id: editing === "new" ? undefined : editing.id, values });
              toast.success(editing === "new" ? "Dodano ✓" : "Zapisano ✓");
              setEditing(null);
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Błąd");
            }
          }}
        />
      )}

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

function CuisineModal({
  cuisine,
  onClose,
  onSave,
  saving,
}: {
  cuisine: Cuisine | null;
  onClose: () => void;
  onSave: (v: CuisineInput) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<CuisineInput>(
    cuisine
      ? {
          name: cuisine.name,
          emoji: cuisine.emoji,
          color: cuisine.color,
          sort_order: cuisine.sort_order,
          enabled: cuisine.enabled,
        }
      : emptyCuisine(),
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-navy/70 backdrop-blur-sm grid place-items-center p-4"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          onSave(form);
        }}
        className="bg-card rounded-3xl max-w-md w-full shadow-2xl p-6 space-y-3"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl">{cuisine ? "Edytuj kuchnię" : "Nowa kuchnia"}</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-muted grid place-items-center"
          >
            <X size={16} />
          </button>
        </div>
        <label className="block">
          <span className="text-xs uppercase font-semibold text-muted-foreground">Nazwa</span>
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="input"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs uppercase font-semibold text-muted-foreground">Emoji</span>
            <input
              value={form.emoji ?? ""}
              onChange={(e) => setForm({ ...form, emoji: e.target.value })}
              className="input"
            />
          </label>
          <label className="block">
            <span className="text-xs uppercase font-semibold text-muted-foreground">Kolor</span>
            <input
              type="color"
              value={form.color ?? "#3b4cc7"}
              onChange={(e) => setForm({ ...form, color: e.target.value })}
              className="input h-10"
            />
          </label>
        </div>
        <label className="block">
          <span className="text-xs uppercase font-semibold text-muted-foreground">Sortowanie</span>
          <input
            type="number"
            value={form.sort_order}
            onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })}
            className="input"
          />
        </label>
        <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
          />
          Aktywna (widoczna w filtrach)
        </label>
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-full border border-border py-3 font-semibold hover:bg-muted"
          >
            Anuluj
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-[2] inline-flex items-center justify-center gap-2 rounded-full bg-tomato text-cream py-3 font-semibold disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="animate-spin" size={16} /> Zapisywanie…
              </>
            ) : (
              <>
                <Save size={16} /> Zapisz
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

const EMPTY_POST = { place_id: "", title: "", body: "", image_url: "" };

function PlacePostsTab() {
  const { data: posts, isLoading } = useAllPlacePosts();
  const { data: places } = usePlaces();
  const upsert = useUpsertPlacePost();
  const del = useDeletePlacePost();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PlacePost | null>(null);
  const [form, setForm] = useState<typeof EMPTY_POST>(EMPTY_POST);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  function startEdit(p: PlacePost | null) {
    setEditing(p);
    setForm(
      p
        ? {
            place_id: p.place_id,
            title: p.title,
            body: p.body ?? "",
            image_url: p.image_url ?? "",
          }
        : EMPTY_POST,
    );
    setOpen(true);
  }

  async function handleSave() {
    if (!form.place_id || !form.title.trim()) {
      toast.error("Lokal i tytuł są wymagane");
      return;
    }
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
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Błąd");
    }
  }

  async function handleDeleteConfirmed() {
    if (!confirmDeleteId) return;
    try {
      await del.mutateAsync(confirmDeleteId);
      toast.success("Usunięto");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Błąd");
    } finally {
      setConfirmDeleteId(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <p className="text-sm text-muted-foreground">
          Pojawiają się na Wallu u użytkowników, którzy mają lokal w ulubionych.
        </p>
        <button
          onClick={() => startEdit(null)}
          className="inline-flex items-center gap-2 rounded-full bg-tomato text-cream px-4 py-2 text-sm font-semibold hover:bg-tomato/90"
        >
          <Plus size={14} /> Nowy wpis
        </button>
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-10">
          <Loader2 className="animate-spin" />
        </div>
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
              <li
                key={p.id}
                className="bg-card border border-border rounded-2xl p-3 flex items-center gap-3"
              >
                {p.image_url && (
                  <img
                    src={p.image_url}
                    alt=""
                    className="w-20 h-16 object-cover rounded-md shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-muted-foreground">{place?.name ?? " - "}</div>
                  <div className="font-semibold truncate">{p.title}</div>
                  {p.body && <div className="text-xs text-muted-foreground truncate">{p.body}</div>}
                </div>
                <button
                  onClick={() => startEdit(p)}
                  className="chip bg-card border border-border hover:border-tomato"
                >
                  Edytuj
                </button>
                <button
                  onClick={() => setConfirmDeleteId(p.id)}
                  className="grid place-items-center w-8 h-8 rounded-full text-destructive hover:bg-destructive/10"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-card border border-border rounded-2xl w-full max-w-lg p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-xl">{editing ? "Edytuj wpis" : "Nowy wpis"}</h2>
              <button
                onClick={() => setOpen(false)}
                className="grid place-items-center w-8 h-8 rounded-full hover:bg-muted"
              >
                <X size={14} />
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <label className="block">
                <div className="text-xs font-semibold text-muted-foreground mb-1">Lokal *</div>
                <select
                  value={form.place_id}
                  onChange={(e) => setForm({ ...form, place_id: e.target.value })}
                  className="input"
                >
                  <option value=""> - wybierz - </option>
                  {(places ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <div className="text-xs font-semibold text-muted-foreground mb-1">Tytuł *</div>
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="input"
                  maxLength={140}
                />
              </label>
              <label className="block">
                <div className="text-xs font-semibold text-muted-foreground mb-1">Treść</div>
                <textarea
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                  rows={4}
                  className="input"
                />
              </label>
              <label className="block">
                <div className="text-xs font-semibold text-muted-foreground mb-1">
                  Grafika (URL)
                </div>
                <input
                  value={form.image_url}
                  onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                  className="input"
                  placeholder="https://..."
                />
                {form.image_url && (
                  <img
                    src={form.image_url}
                    alt=""
                    className="mt-2 w-full max-h-40 object-cover rounded-md"
                  />
                )}
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setOpen(false)} className="chip bg-card border border-border">
                Anuluj
              </button>
              <button
                onClick={handleSave}
                disabled={upsert.isPending}
                className="inline-flex items-center gap-2 rounded-full bg-tomato text-cream px-4 py-2 text-sm font-semibold hover:bg-tomato/90 disabled:opacity-50"
              >
                <Save size={14} /> Zapisz
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDeleteModal
        open={!!confirmDeleteId}
        title="Usunąć wpis?"
        description="Zniknie z Walla u wszystkich, którzy mają ten lokal w ulubionych."
        pending={del.isPending}
        onCancel={() => setConfirmDeleteId(null)}
        onConfirm={handleDeleteConfirmed}
      />
    </div>
  );
}
