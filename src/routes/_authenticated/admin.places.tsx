import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  usePlaces,
  useSavePlace,
  useDeletePlace,
  type Place,
  type PlaceInput,
  type PlaceLocationInput,
  type MenuCategory,
  type OpeningHours,
} from "@/lib/places-api";
import { useCuisines } from "@/lib/cuisines-api";
import { cuisineMeta } from "@/data/places";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  MapPin,
  Loader2,
  X,
  Save,
  Search,
  Image as ImageIcon,
  AlertCircle,
  Upload,
  Sparkles,
} from "lucide-react";
import { initialsFromName, colorFromKey } from "@/lib/avatar-utils";
import { supabase } from "@/integrations/supabase/client";
import { MigratePlaceImagesButton, MigrateAllPlacesButton } from "@/components/PlaceImageMigration";
import { useDebounced } from "@/lib/use-debounced";
import {
  searchGooglePlaces,
  getGooglePlaceDetails,
  type PlaceSearchResult,
} from "@/lib/google-places.functions";

export const Route = createFileRoute("/_authenticated/admin/places")({
  component: AdminPlaces,
});

function emptyPlace(defaultCuisine: string): PlaceInput {
  return {
    name: "",
    cuisine: defaultCuisine,
    description: "",
    rating: 4.5,
    address: "",
    lat: 52.4082,
    lng: 16.9335,
    reel_url: "",
    cover_image_url: "",
    avatar_url: "",
    menu_url: "",
    menu_image_url: "",
    promo_label: "",
    promo_active: false,
    phone: "",
    website: "",
    price_range: "",
    has_takeaway: false,
    wheelchair_accessible: false,
    is_published: false,
    district: "",
    opening_hours: null,
    menu_items: null,
    extra_locations: [],
  };
}

function isValidHttpUrl(s: string): boolean {
  if (!s) return true;
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

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

function AdminPlaces() {
  const { data: places, isLoading } = usePlaces();
  const { data: cuisines } = useCuisines();
  const cuisineNames = useMemo(
    () => (cuisines ?? []).filter((c) => c.enabled).map((c) => c.name),
    [cuisines],
  );
  const defaultCuisine = cuisineNames[0] ?? "Mix";
  const save = useSavePlace();
  const del = useDeletePlace();
  const [editing, setEditing] = useState<Place | "new" | null>(null);
  const [query, setQuery] = useState("");
  const [cuisineFilter, setCuisineFilter] = useState<string>("Wszystko");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (places ?? []).filter((p) => {
      if (cuisineFilter !== "Wszystko" && p.cuisine !== cuisineFilter) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.address.toLowerCase().includes(q) ||
        p.cuisine.toLowerCase().includes(q) ||
        (p.description ?? "").toLowerCase().includes(q)
      );
    });
  }, [places, query, cuisineFilter]);

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Usunąć "${name}"?`)) return;
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
          <h1 className="font-display text-3xl">Lokale na mapie</h1>
          <p className="text-sm text-muted-foreground">
            {filtered.length}
            {places && filtered.length !== places.length ? ` z ${places.length}` : ""} miejscówek ·
            widoczne publicznie
          </p>
        </div>
        <button
          onClick={() => setEditing("new")}
          className="inline-flex items-center gap-2 rounded-full bg-tomato text-cream px-5 py-2.5 font-semibold hover:bg-tomato/90 transition"
        >
          <Plus size={16} /> Dodaj lokal
        </button>
      </div>

      <div className="mb-5">
        <MigrateAllPlacesButton places={places ?? []} />
      </div>

      {/* Search + filter */}
      <div className="mb-5 flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Szukaj po nazwie, adresie, opisie..."
            className="input pl-9 w-full"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 grid place-items-center rounded-full hover:bg-muted"
              aria-label="Wyczyść"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <select
          value={cuisineFilter}
          onChange={(e) => setCuisineFilter(e.target.value)}
          className="input sm:w-52"
        >
          <option value="Wszystko">Wszystkie kuchnie</option>
          {cuisineNames.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-20">
          <Loader2 className="animate-spin" size={28} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          Brak wyników. Spróbuj innego zapytania 🔍
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p) => {
            const color = cuisineMeta(p.cuisine).color;
            return (
              <div
                key={p.id}
                className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-3"
              >
                <div className="flex items-start gap-3">
                  <CoverThumb url={p.avatar_url ?? p.cover_image_url} name={p.name} size={80} />
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
                      <span className="text-sm font-bold whitespace-nowrap">⭐ {p.rating}</span>
                    </div>
                    <div className="text-xs text-muted-foreground inline-flex items-center gap-1 mt-1 truncate">
                      <MapPin size={12} className="flex-shrink-0" />
                      <span className="truncate">{p.address}</span>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">{p.description}</p>
                <div className="flex gap-2 mt-auto">
                  <button
                    onClick={() => setEditing(p)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-sm hover:border-tomato hover:text-tomato transition"
                  >
                    <Pencil size={13} /> Edytuj
                  </button>
                  <button
                    onClick={() => handleDelete(p.id, p.name)}
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

      {editing && (
        <PlaceModal
          key={editing === "new" ? "new" : editing.id}
          place={editing === "new" ? null : editing}
          cuisineNames={cuisineNames}
          defaultCuisine={defaultCuisine}
          onClose={() => !save.isPending && setEditing(null)}
          onSave={async (values) => {
            try {
              await save.mutateAsync({ id: editing === "new" ? undefined : editing.id, values });
              toast.success(editing === "new" ? "Dodano lokal ✓" : "Zapisano zmiany ✓");
              setEditing(null);
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Błąd zapisu");
            }
          }}
          saving={save.isPending}
          error={save.error instanceof Error ? save.error.message : null}
        />
      )}
    </div>
  );
}

function PlaceModal({
  place,
  cuisineNames,
  defaultCuisine,
  onClose,
  onSave,
  saving,
  error,
}: {
  place: Place | null;
  cuisineNames: string[];
  defaultCuisine: string;
  onClose: () => void;
  onSave: (v: PlaceInput) => void;
  saving: boolean;
  error: string | null;
}) {
  const [form, setForm] = useState<PlaceInput>(
    place
      ? {
          name: place.name,
          cuisine: place.cuisine,
          description: place.description,
          rating: place.rating,
          address: place.address,
          lat: place.lat,
          lng: place.lng,
          reel_url: place.reel_url ?? "",
          cover_image_url: place.cover_image_url ?? "",
          avatar_url: place.avatar_url ?? "",
          menu_url: place.menu_url ?? "",
          menu_image_url: place.menu_image_url ?? "",
          promo_label: place.promo_label ?? "",
          promo_active: place.promo_active ?? false,
          phone: place.phone ?? "",
          website: place.website ?? "",
          price_range: place.price_range ?? "",
          has_takeaway: place.has_takeaway ?? false,
          wheelchair_accessible: place.wheelchair_accessible ?? false,
          is_published: (place as unknown as { is_published?: boolean }).is_published ?? true,
          district: place.district ?? "",
          opening_hours: place.opening_hours ?? null,
          menu_items: place.menu_items ?? null,
          extra_locations: (place.locations ?? []).map((l) => ({
            id: l.id,
            label: l.label,
            address: l.address,
            lat: l.lat,
            lng: l.lng,
          })),
        }
      : emptyPlace(defaultCuisine),
  );

  const extras: PlaceLocationInput[] = form.extra_locations ?? [];
  const setExtras = (next: PlaceLocationInput[]) => setForm({ ...form, extra_locations: next });
  const updateExtra = (i: number, patch: Partial<PlaceLocationInput>) => {
    setExtras(extras.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  };

  const coverUrl = form.cover_image_url ?? "";
  const coverValid = isValidHttpUrl(coverUrl);
  const reelValid = isValidHttpUrl(form.reel_url ?? "");
  const menuUrlValid = isValidHttpUrl(form.menu_url ?? "");
  const menuImgValid = isValidHttpUrl(form.menu_image_url ?? "");
  const websiteValid = isValidHttpUrl(form.website ?? "");
  const canSubmit =
    !saving && coverValid && reelValid && menuUrlValid && menuImgValid && websiteValid;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    onSave(form);
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-navy/70 backdrop-blur-sm flex items-start sm:items-center justify-center p-2 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-card text-foreground rounded-3xl max-w-lg w-full shadow-2xl my-4 sm:my-8 max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-card border-b border-border">
          <h2 className="font-display text-2xl">{place ? "Edytuj lokal" : "Nowy lokal"}</h2>
          <button
            onClick={onClose}
            disabled={saving}
            className="w-8 h-8 rounded-full bg-muted grid place-items-center hover:bg-muted/70 disabled:opacity-50"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={submit} className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-4 space-y-3">
            <GooglePlacesAutofill
              onFill={(details) =>
                setForm((f) => ({
                  ...f,
                  name: f.name || details.name,
                  address: details.address,
                  lat: details.lat,
                  lng: details.lng,
                  phone: details.phone ?? f.phone,
                  website: details.website ?? f.website,
                  price_range: details.priceRange ?? f.price_range,
                  opening_hours: details.openingHours ?? f.opening_hours,
                }))
              }
            />
            <FormField label="Nazwa">
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="input"
              />
            </FormField>
            <FormField label="Kuchnia">
              <select
                value={form.cuisine}
                onChange={(e) => setForm({ ...form, cuisine: e.target.value })}
                className="input"
              >
                {cuisineNames.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Dzielnica">
                <input
                  value={form.district ?? ""}
                  onChange={(e) => setForm({ ...form, district: e.target.value })}
                  placeholder="np. Jeżyce"
                  className="input"
                />
              </FormField>
              <FormField label="Poziom cenowy">
                <PriceLevelPicker
                  value={form.price_range ?? ""}
                  onChange={(v) => setForm({ ...form, price_range: v })}
                />
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Telefon">
                <input
                  type="tel"
                  value={form.phone ?? ""}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+48 ..."
                  className="input"
                />
              </FormField>
              <FormField label="Strona www">
                <input
                  type="url"
                  value={form.website ?? ""}
                  onChange={(e) => setForm({ ...form, website: e.target.value })}
                  placeholder="https://..."
                  className={`input ${!websiteValid ? "border-destructive" : ""}`}
                />
              </FormField>
            </div>
            <div className="flex gap-4 flex-wrap text-sm">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.has_takeaway}
                  onChange={(e) => setForm({ ...form, has_takeaway: e.target.checked })}
                />
                🥡 Na wynos
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.wheelchair_accessible}
                  onChange={(e) => setForm({ ...form, wheelchair_accessible: e.target.checked })}
                />
                ♿ Bez schodów
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer font-semibold">
                <input
                  type="checkbox"
                  checked={form.is_published ?? false}
                  onChange={(e) => setForm({ ...form, is_published: e.target.checked })}
                />
                {form.is_published ? "✅ Opublikowane" : "📝 Szkic (niewidoczne publicznie)"}
              </label>
            </div>

            <OpeningHoursEditor
              value={form.opening_hours}
              onChange={(v) => setForm({ ...form, opening_hours: v })}
            />
            <MenuItemsEditor
              value={form.menu_items}
              onChange={(v) => setForm({ ...form, menu_items: v })}
            />

            <FormField label="Opis">
              <textarea
                required
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="input"
              />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Ocena (1–5)">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="5"
                  value={form.rating}
                  onChange={(e) => setForm({ ...form, rating: parseFloat(e.target.value) })}
                  className="input"
                />
              </FormField>
              <FormField label="Adres">
                <input
                  required
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="input"
                />
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Szerokość (lat)">
                <input
                  type="number"
                  step="0.0001"
                  required
                  value={form.lat}
                  onChange={(e) => setForm({ ...form, lat: parseFloat(e.target.value) })}
                  className="input"
                />
              </FormField>
              <FormField label="Długość (lng)">
                <input
                  type="number"
                  step="0.0001"
                  required
                  value={form.lng}
                  onChange={(e) => setForm({ ...form, lng: parseFloat(e.target.value) })}
                  className="input"
                />
              </FormField>
            </div>
            <p className="text-xs text-muted-foreground -mt-1">
              Tip: znajdź miejsce na{" "}
              <a
                className="underline"
                target="_blank"
                rel="noreferrer"
                href="https://www.google.com/maps"
              >
                Google Maps
              </a>
              , kliknij prawym i skopiuj współrzędne.
            </p>
            <FormField label="Link do rolki IG">
              <input
                type="url"
                value={form.reel_url ?? ""}
                onChange={(e) => setForm({ ...form, reel_url: e.target.value })}
                placeholder="https://instagram.com/reel/..."
                className={`input ${!reelValid ? "border-destructive" : ""}`}
              />
              {!reelValid && (
                <span className="text-xs text-destructive mt-1 block">
                  Podaj poprawny adres http(s)://
                </span>
              )}
            </FormField>

            {/* Avatar / miniaturka lokalu (file upload) */}
            <AvatarUploader
              value={form.avatar_url ?? ""}
              fallbackName={form.name}
              onChange={(url) => setForm({ ...form, avatar_url: url })}
            />

            {/* Cover (file upload) */}
            <ImageUploader
              title="Okładka lokalu (banner 3:1)"
              hint="Min 900×300 px, JPG/PNG/WEBP, do 5 MB. Wyświetlana jako baner i miniaturka."
              recommendedLabel="Zalecane 1200×400 px (3:1)"
              subfolder="covers"
              maxMb={5}
              minW={900}
              minH={300}
              targetAspect={3}
              aspectTolerance={0.25}
              previewClass="w-32 h-20 rounded-xl"
              value={form.cover_image_url ?? ""}
              onChange={(url) => setForm({ ...form, cover_image_url: url })}
            />

            <FormField label="Link do menu (PDF lub strona)">
              <input
                type="url"
                value={form.menu_url ?? ""}
                onChange={(e) => setForm({ ...form, menu_url: e.target.value })}
                placeholder="https://..."
                className={`input ${!menuUrlValid ? "border-destructive" : ""}`}
              />
            </FormField>
            <FormField label="URL zdjęcia menu (opcjonalnie)">
              <input
                type="url"
                value={form.menu_image_url ?? ""}
                onChange={(e) => setForm({ ...form, menu_image_url: e.target.value })}
                placeholder="https://..."
                className={`input ${!menuImgValid ? "border-destructive" : ""}`}
              />
            </FormField>
            <div className="rounded-xl border border-border p-3 space-y-2 bg-muted/30">
              <FormField label="Pasek nowości / promocji (max 100 znaków)">
                <input
                  type="text"
                  maxLength={100}
                  value={form.promo_label ?? ""}
                  onChange={(e) => setForm({ ...form, promo_label: e.target.value })}
                  placeholder="🆕 Nowe menu od maja — sprawdź co się zmieniło"
                  className="input"
                />
              </FormField>
              <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!form.promo_active}
                  onChange={(e) => setForm({ ...form, promo_active: e.target.checked })}
                />
                Pokaż pasek na profilu lokalu
              </label>
            </div>
            <div className="border-t border-border pt-3 mt-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                  Dodatkowe oddziały ({extras.length})
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setExtras([...extras, { address: "", lat: form.lat, lng: form.lng, label: "" }])
                  }
                  className="inline-flex items-center gap-1 text-xs font-semibold text-tomato hover:underline"
                >
                  <Plus size={12} /> Dodaj oddział
                </button>
              </div>
              {extras.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Lokal ma jedną pinezkę. Dodaj oddziały jeśli to sieć z wieloma adresami.
                </p>
              )}
              <div className="space-y-3">
                {extras.map((loc, i) => (
                  <div
                    key={loc.id ?? `new-${i}`}
                    className="rounded-xl border border-border p-3 space-y-2 bg-muted/30"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground">
                        Oddział #{i + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => setExtras(extras.filter((_, idx) => idx !== i))}
                        className="text-destructive hover:opacity-80"
                        aria-label="Usuń oddział"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                    <input
                      value={loc.label ?? ""}
                      onChange={(e) => updateExtra(i, { label: e.target.value })}
                      placeholder="Etykieta (np. Stary Browar) — opcjonalna"
                      className="input"
                    />
                    <input
                      required
                      value={loc.address}
                      onChange={(e) => updateExtra(i, { address: e.target.value })}
                      placeholder="Adres oddziału"
                      className="input"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        step="0.0001"
                        required
                        value={loc.lat}
                        onChange={(e) => updateExtra(i, { lat: parseFloat(e.target.value) })}
                        placeholder="lat"
                        className="input"
                      />
                      <input
                        type="number"
                        step="0.0001"
                        required
                        value={loc.lng}
                        onChange={(e) => updateExtra(i, { lng: parseFloat(e.target.value) })}
                        placeholder="lng"
                        className="input"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sticky footer */}
          <div className="sticky bottom-0 z-10 border-t border-border bg-card px-6 py-4 space-y-3">
            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-destructive/10 text-destructive border border-destructive/30 px-3 py-2 text-sm">
                <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
            {!coverValid || !reelValid || !menuUrlValid || !menuImgValid ? (
              <div className="text-xs text-destructive">
                Popraw nieprawidłowe adresy URL, żeby zapisać.
              </div>
            ) : null}
            {place && (
              <MigratePlaceImagesButton
                place={place}
                onMigrated={(field, url) => setForm((f) => ({ ...f, [field]: url }))}
              />
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="flex-1 rounded-full border border-border py-3 font-semibold hover:bg-muted transition disabled:opacity-50"
              >
                Anuluj
              </button>
              <button
                type="submit"
                disabled={!canSubmit}
                className="flex-[2] inline-flex items-center justify-center gap-2 rounded-full bg-tomato text-cream py-3 font-semibold hover:bg-tomato/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
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
          </div>
        </form>
      </div>
    </div>
  );
}

function GooglePlacesAutofill({
  onFill,
}: {
  onFill: (details: Awaited<ReturnType<typeof getGooglePlaceDetails>>) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<PlaceSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [filling, setFilling] = useState<string | null>(null);
  const debouncedQuery = useDebounced(query, 350);
  const requestId = useRef(0);
  const search = useServerFn(searchGooglePlaces);
  const getDetails = useServerFn(getGooglePlaceDetails);

  useEffect(() => {
    const q = debouncedQuery.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    const id = ++requestId.current;
    setSearching(true);
    search({ data: { query: q } })
      .then((res) => {
        if (requestId.current === id) setResults(res);
      })
      .catch((e) => {
        if (requestId.current === id)
          toast.error(e instanceof Error ? e.message : "Błąd wyszukiwania Google Places");
      })
      .finally(() => {
        if (requestId.current === id) setSearching(false);
      });
  }, [debouncedQuery]);

  async function pick(result: PlaceSearchResult) {
    setFilling(result.placeId);
    try {
      const details = await getDetails({ data: { placeId: result.placeId } });
      onFill(details);
      toast.success("Uzupełniono danymi z Google");
      setOpen(false);
      setQuery("");
      setResults([]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Nie udało się pobrać szczegółów");
    } finally {
      setFilling(null);
    }
  }

  return (
    <div className="relative rounded-2xl border border-dashed border-tomato/40 bg-tomato/5 p-3">
      <label className="flex items-center gap-1.5 text-xs uppercase tracking-wider font-semibold text-tomato mb-1.5">
        <Sparkles size={13} /> Uzupełnij z Google Places
      </label>
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Szukaj lokalu po nazwie…"
        className="input"
      />
      {open && (searching || results.length > 0) && (
        <div className="absolute left-3 right-3 top-full mt-1 z-20 rounded-xl border border-border bg-card shadow-lg overflow-hidden">
          {searching && (
            <div className="px-3 py-2.5 text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" /> Szukam…
            </div>
          )}
          {!searching &&
            results.map((r) => (
              <button
                key={r.placeId}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(r)}
                disabled={filling !== null}
                className="w-full text-left px-3 py-2.5 hover:bg-muted/60 disabled:opacity-50 border-b border-border last:border-0 flex items-center gap-2"
              >
                {filling === r.placeId ? (
                  <Loader2 size={14} className="animate-spin shrink-0" />
                ) : (
                  <MapPin size={14} className="shrink-0 text-tomato" />
                )}
                <span className="min-w-0">
                  <span className="block text-sm font-semibold truncate">{r.name}</span>
                  <span className="block text-xs text-muted-foreground truncate">{r.address}</span>
                </span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-1 block">
        {label}
      </span>
      {children}
    </label>
  );
}

const DAYS: { key: keyof OpeningHours; label: string }[] = [
  { key: "mon", label: "Pon" },
  { key: "tue", label: "Wt" },
  { key: "wed", label: "Śr" },
  { key: "thu", label: "Czw" },
  { key: "fri", label: "Pt" },
  { key: "sat", label: "Sob" },
  { key: "sun", label: "Nd" },
];

function OpeningHoursEditor({
  value,
  onChange,
}: {
  value: OpeningHours | null;
  onChange: (v: OpeningHours | null) => void;
}) {
  const hours = value ?? {};
  const update = (day: keyof OpeningHours, patch: { open?: string; close?: string } | null) => {
    const next = { ...hours };
    if (patch === null) delete next[day];
    else
      next[day] = {
        open: patch.open ?? hours[day]?.open ?? "",
        close: patch.close ?? hours[day]?.close ?? "",
      };
    onChange(Object.keys(next).length ? next : null);
  };
  const [bulkOpen, setBulkOpen] = useState("");
  const [bulkClose, setBulkClose] = useState("");
  const applyBulk = (keys: (keyof OpeningHours)[]) => {
    if (!bulkOpen || !bulkClose) return;
    const next = { ...hours };
    keys.forEach((k) => {
      next[k] = { open: bulkOpen, close: bulkClose };
    });
    onChange(next);
  };
  const clearAll = () => onChange(null);
  return (
    <div className="rounded-xl border border-border p-3 space-y-3 bg-muted/30">
      <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
        Godziny otwarcia
      </div>

      {/* Bulk shortcuts */}
      <div className="rounded-lg border border-border bg-card p-2.5 space-y-2">
        <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          Zbiorczo
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="time"
            value={bulkOpen}
            onChange={(e) => setBulkOpen(e.target.value)}
            className="input py-1 text-xs"
            aria-label="Od"
          />
          <input
            type="time"
            value={bulkClose}
            onChange={(e) => setBulkClose(e.target.value)}
            className="input py-1 text-xs"
            aria-label="Do"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => applyBulk(["mon", "tue", "wed", "thu", "fri"])}
            disabled={!bulkOpen || !bulkClose}
            className="chip bg-navy text-cream text-xs disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Pon–Pt
          </button>
          <button
            type="button"
            onClick={() => applyBulk(["sat", "sun"])}
            disabled={!bulkOpen || !bulkClose}
            className="chip bg-tomato text-cream text-xs disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Sob–Nd
          </button>
          <button
            type="button"
            onClick={() => applyBulk(["mon", "tue", "wed", "thu", "fri", "sat", "sun"])}
            disabled={!bulkOpen || !bulkClose}
            className="chip bg-card border border-border text-xs disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Cały tydzień
          </button>
          <button
            type="button"
            onClick={clearAll}
            className="chip bg-card border border-border text-xs ml-auto"
          >
            Wyczyść
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        {DAYS.map(({ key, label }) => {
          const h = hours[key];
          return (
            <div
              key={key}
              className="grid grid-cols-[3rem_1fr_1fr_auto] items-center gap-2 text-sm"
            >
              <span className="font-semibold">{label}</span>
              <input
                type="time"
                value={h?.open ?? ""}
                onChange={(e) => update(key, { open: e.target.value })}
                className="input py-1 text-xs"
              />
              <input
                type="time"
                value={h?.close ?? ""}
                onChange={(e) => update(key, { close: e.target.value })}
                className="input py-1 text-xs"
              />
              {h ? (
                <button
                  type="button"
                  onClick={() => update(key, null)}
                  className="text-xs text-destructive hover:underline"
                >
                  Zamknięte
                </button>
              ) : (
                <span className="text-xs text-muted-foreground">—</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PriceLevelPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  // Store as "$", "$$", ..., "$$$$$". Legacy free-text values are shown read-only with an option to convert.
  const isDollar = /^\${1,5}$/.test(value);
  const level = isDollar ? value.length : 0;
  const isLegacy = !isDollar && value.trim() !== "";
  const LABELS = ["Bez oceny", "Bardzo tanio", "Tanio", "Średnio", "Drogo", "Bardzo drogo"];
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        {[0, 1, 2, 3, 4, 5].map((n) => {
          const active = level === n;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n === 0 ? "" : "$".repeat(n))}
              className={`min-w-[3rem] rounded-full px-3 py-1.5 text-sm font-bold border transition ${active ? "bg-tomato text-cream border-tomato shadow" : "bg-background text-foreground border-border hover:border-tomato"}`}
              aria-pressed={active}
              aria-label={LABELS[n]}
              title={LABELS[n]}
            >
              {n === 0 ? "—" : "$".repeat(n)}
            </button>
          );
        })}
      </div>
      {isLegacy && (
        <div className="text-[11px] text-muted-foreground flex items-center gap-2">
          <span>Stara wartość: „{value}"</span>
          <button
            type="button"
            onClick={() => onChange("")}
            className="text-tomato font-semibold hover:underline"
          >
            Wyczyść
          </button>
        </div>
      )}
    </div>
  );
}

function MenuItemsEditor({
  value,
  onChange,
}: {
  value: MenuCategory[] | null;
  onChange: (v: MenuCategory[] | null) => void;
}) {
  const cats = value ?? [];
  const setCats = (next: MenuCategory[]) => onChange(next.length ? next : null);
  return (
    <div className="rounded-xl border border-border p-3 space-y-3 bg-muted/30">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
          Menu (kategorie + pozycje)
        </div>
        <button
          type="button"
          onClick={() => setCats([...cats, { category: "", items: [] }])}
          className="text-xs font-semibold text-tomato hover:underline inline-flex items-center gap-1"
        >
          <Plus size={12} /> Kategoria
        </button>
      </div>
      {cats.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Brak menu — użytkownicy zobaczą przycisk „Zaproponuj menu".
        </p>
      )}
      {cats.map((cat, ci) => (
        <div key={ci} className="rounded-lg border border-border p-2 space-y-2 bg-card">
          <div className="flex gap-2">
            <input
              value={cat.category}
              onChange={(e) =>
                setCats(cats.map((c, i) => (i === ci ? { ...c, category: e.target.value } : c)))
              }
              placeholder="Nazwa kategorii (np. Kebab)"
              className="input flex-1"
            />
            <button
              type="button"
              onClick={() => setCats(cats.filter((_, i) => i !== ci))}
              className="text-destructive hover:opacity-70"
              aria-label="Usuń kategorię"
            >
              <Trash2 size={14} />
            </button>
          </div>
          <div className="space-y-1.5">
            {cat.items.map((item, ii) => (
              <div key={ii} className="grid grid-cols-[1fr_5rem_auto] gap-1.5">
                <input
                  value={item.name}
                  onChange={(e) =>
                    setCats(
                      cats.map((c, i) =>
                        i === ci
                          ? {
                              ...c,
                              items: c.items.map((x, j) =>
                                j === ii ? { ...x, name: e.target.value } : x,
                              ),
                            }
                          : c,
                      ),
                    )
                  }
                  placeholder="Nazwa dania"
                  className="input py-1 text-sm"
                />
                <input
                  value={item.price ?? ""}
                  onChange={(e) =>
                    setCats(
                      cats.map((c, i) =>
                        i === ci
                          ? {
                              ...c,
                              items: c.items.map((x, j) =>
                                j === ii ? { ...x, price: e.target.value } : x,
                              ),
                            }
                          : c,
                      ),
                    )
                  }
                  placeholder="28 zł"
                  className="input py-1 text-sm"
                />
                <button
                  type="button"
                  onClick={() =>
                    setCats(
                      cats.map((c, i) =>
                        i === ci ? { ...c, items: c.items.filter((_, j) => j !== ii) } : c,
                      ),
                    )
                  }
                  className="text-destructive hover:opacity-70 px-1"
                  aria-label="Usuń pozycję"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setCats(
                  cats.map((c, i) =>
                    i === ci ? { ...c, items: [...c.items, { name: "", price: "" }] } : c,
                  ),
                )
              }
              className="text-xs font-semibold text-tomato hover:underline inline-flex items-center gap-1"
            >
              <Plus size={11} /> Pozycja
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

const AVATAR_BUCKET = "place-photos";
const AVATAR_MAX_MB = 3;
const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];

type UrlStatus = "idle" | "checking" | "ok" | "broken";

function useUrlHealth(url: string): UrlStatus {
  const [status, setStatus] = useState<UrlStatus>("idle");
  useEffect(() => {
    if (!url) {
      setStatus("idle");
      return;
    }
    setStatus("checking");
    let cancelled = false;
    const img = new Image();
    img.onload = () => !cancelled && setStatus("ok");
    img.onerror = () => !cancelled && setStatus("broken");
    img.src = url;
    return () => {
      cancelled = true;
      img.onload = null;
      img.onerror = null;
    };
  }, [url]);
  return status;
}

function UrlStatusBadge({ status }: { status: UrlStatus }) {
  if (status === "idle") return null;
  const map = {
    checking: { text: "Sprawdzam adres…", cls: "bg-muted text-muted-foreground border-border" },
    ok: {
      text: "✓ URL działa w przeglądarce",
      cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
    },
    broken: {
      text: "✗ URL nie ładuje się w przeglądarce",
      cls: "bg-destructive/10 text-destructive border-destructive/30",
    },
  } as const;
  const { text, cls } = map[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${cls}`}
    >
      {text}
    </span>
  );
}

function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Nie udało się odczytać wymiarów obrazu"));
    };
    img.src = url;
  });
}

function validateDims(
  dims: { width: number; height: number },
  opts: { minW: number; minH: number; targetAspect: number; aspectTolerance: number },
): { error?: string; warning?: string } {
  const { width, height } = dims;
  if (width < opts.minW || height < opts.minH) {
    return { error: `Obraz za mały (${width}×${height}). Minimum: ${opts.minW}×${opts.minH} px.` };
  }
  const aspect = width / height;
  const diff = Math.abs(aspect - opts.targetAspect) / opts.targetAspect;
  if (diff > opts.aspectTolerance) {
    return {
      warning: `Proporcje ${aspect.toFixed(2)}:1 różnią się od zalecanych ${opts.targetAspect}:1 — obraz może zostać przycięty.`,
    };
  }
  return {};
}

function AvatarUploader({
  value,
  onChange,
  fallbackName,
}: {
  value: string;
  onChange: (url: string) => void;
  fallbackName: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [lastDims, setLastDims] = useState<{ width: number; height: number } | null>(null);
  const initials = initialsFromName(fallbackName || "?");
  const bg = colorFromKey(fallbackName || "lokal");
  const urlStatus = useUrlHealth(value);

  async function handleFile(file: File) {
    if (!AVATAR_TYPES.includes(file.type)) {
      toast.error("Dozwolone: JPG, PNG, WEBP");
      return;
    }
    if (file.size > AVATAR_MAX_MB * 1024 * 1024) {
      toast.error(`Plik za duży (max ${AVATAR_MAX_MB} MB)`);
      return;
    }
    let dims: { width: number; height: number };
    try {
      dims = await readImageDimensions(file);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Nieprawidłowy obraz");
      return;
    }
    const { error, warning } = validateDims(dims, {
      minW: 200,
      minH: 200,
      targetAspect: 1,
      aspectTolerance: 0.15,
    });
    if (error) {
      toast.error(error);
      return;
    }
    if (warning) toast.warning(warning);
    setLastDims(dims);
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `avatars/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
      if (upErr) throw upErr;
      const { data: signed, error: signErr } = await supabase.storage
        .from(AVATAR_BUCKET)
        .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
      if (signErr || !signed?.signedUrl)
        throw signErr ?? new Error("Nie udało się wygenerować URL");
      onChange(signed.signedUrl);
      toast.success(`Avatar wgrany ✓ (${dims.width}×${dims.height})`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Nie udało się wgrać pliku");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="rounded-xl border border-border p-3 space-y-2 bg-muted/30">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-sm font-semibold">Avatar / logo lokalu</div>
        <span className="inline-flex items-center gap-1 rounded-full bg-navy/10 text-navy border border-navy/20 px-2 py-0.5 text-[11px] font-semibold">
          Zalecane 400×400 px (1:1)
        </span>
      </div>
      <div className="flex items-start gap-3">
        <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-navy bg-muted grid place-items-center flex-shrink-0 shadow-sm">
          {value ? (
            <img src={value} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            <div
              className="w-full h-full grid place-items-center text-cream font-black text-2xl"
              style={{ backgroundColor: bg }}
            >
              {initials}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-2 rounded-full bg-navy text-cream px-4 py-2 text-sm font-semibold hover:bg-navy/90 disabled:opacity-50"
            >
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {value ? "Zmień avatar" : "Wgraj avatar"}
            </button>
            {value && (
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setLastDims(null);
                }}
                disabled={uploading}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-2 text-sm hover:border-destructive hover:text-destructive"
              >
                <Trash2 size={13} /> Usuń
              </button>
            )}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            {value && <UrlStatusBadge status={urlStatus} />}
            {lastDims && (
              <span className="text-[11px] text-muted-foreground">
                Wgrany rozmiar: {lastDims.width}×{lastDims.height} px
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Min 200×200 px, JPG/PNG/WEBP, do {AVATAR_MAX_MB} MB.
          </p>
        </div>
      </div>
    </div>
  );
}

const IMAGE_BUCKET = "place-photos";
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

function ImageUploader({
  value,
  onChange,
  title,
  hint,
  subfolder,
  maxMb,
  previewClass,
  recommendedLabel,
  minW,
  minH,
  targetAspect,
  aspectTolerance = 0.2,
}: {
  value: string;
  onChange: (url: string) => void;
  title: string;
  hint: string;
  subfolder: string;
  maxMb: number;
  previewClass: string;
  recommendedLabel?: string;
  minW?: number;
  minH?: number;
  targetAspect?: number;
  aspectTolerance?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [lastDims, setLastDims] = useState<{ width: number; height: number } | null>(null);
  const urlStatus = useUrlHealth(value);

  async function handleFile(file: File) {
    if (!IMAGE_TYPES.includes(file.type)) {
      toast.error("Dozwolone: JPG, PNG, WEBP");
      return;
    }
    if (file.size > maxMb * 1024 * 1024) {
      toast.error(`Plik za duży (max ${maxMb} MB)`);
      return;
    }
    let dims: { width: number; height: number };
    try {
      dims = await readImageDimensions(file);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Nieprawidłowy obraz");
      return;
    }
    if (targetAspect && minW && minH) {
      const { error, warning } = validateDims(dims, { minW, minH, targetAspect, aspectTolerance });
      if (error) {
        toast.error(error);
        return;
      }
      if (warning) toast.warning(warning);
    }
    setLastDims(dims);
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${subfolder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(IMAGE_BUCKET)
        .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
      if (upErr) throw upErr;
      const { data: signed, error: signErr } = await supabase.storage
        .from(IMAGE_BUCKET)
        .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
      if (signErr || !signed?.signedUrl)
        throw signErr ?? new Error("Nie udało się wygenerować URL");
      onChange(signed.signedUrl);
      toast.success(`Wgrano ✓ (${dims.width}×${dims.height})`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Nie udało się wgrać pliku");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="rounded-xl border border-border p-3 space-y-2 bg-muted/30">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-sm font-semibold">{title}</div>
        {recommendedLabel && (
          <span className="inline-flex items-center gap-1 rounded-full bg-navy/10 text-navy border border-navy/20 px-2 py-0.5 text-[11px] font-semibold">
            {recommendedLabel}
          </span>
        )}
      </div>
      <div className="flex items-start gap-3">
        <div
          className={`${previewClass} overflow-hidden border border-border bg-muted grid place-items-center flex-shrink-0`}
        >
          {value ? (
            <img src={value} alt="Podgląd" className="w-full h-full object-cover" />
          ) : (
            <ImageIcon size={20} className="text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-2 rounded-full bg-navy text-cream px-4 py-2 text-sm font-semibold hover:bg-navy/90 disabled:opacity-50"
            >
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {value ? "Zmień plik" : "Wgraj plik"}
            </button>
            {value && (
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setLastDims(null);
                }}
                disabled={uploading}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-2 text-sm hover:border-destructive hover:text-destructive"
              >
                <Trash2 size={13} /> Usuń
              </button>
            )}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            {value && <UrlStatusBadge status={urlStatus} />}
            {lastDims && (
              <span className="text-[11px] text-muted-foreground">
                Wgrany rozmiar: {lastDims.width}×{lastDims.height} px
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{hint}</p>
        </div>
      </div>
    </div>
  );
}
