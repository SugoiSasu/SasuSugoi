import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Crown,
  Plus,
  Trash2,
  Loader2,
  Save,
  ExternalLink,
  X,
  Upload,
  Image as ImageIcon,
  Copy,
  Search,
  Eye,
  MousePointerClick,
  Users,
  Layers,
} from "lucide-react";
import { useIsSuperAdmin, useUser } from "@/lib/use-auth";
import {
  useAllAds,
  useUpsertAd,
  useDeleteAd,
  useDuplicateAd,
  useAdStats,
  getAdLiveStatus,
  DEFAULT_AD_CTA,
  type Ad,
  type LiveAdStatus,
} from "@/lib/ads-api";
import { usePlaces } from "@/lib/places-api";
import { ConfirmDeleteModal } from "@/components/admin/ConfirmDeleteModal";
import { Field } from "@/components/admin/Field";
import { useStorageImageUpload } from "@/components/admin/useStorageImageUpload";

export const Route = createFileRoute("/_authenticated/admin/ads")({
  head: () => ({ meta: [{ title: "Reklamy - Panel admina" }] }),
  component: AdminAds,
});

const CTA_PRESETS = [
  "Zamów teraz",
  "Zobacz menu",
  "Sprawdź ofertę",
  "Zarezerwuj stolik",
  "Zobacz lokal",
  "Sprawdź promocję",
];

const MESSAGE_PRESETS = [
  "Sprawdź naszą nowość!",
  "Wpadnij spróbować!",
  "Promocja czasowa!",
  "Czekamy na Ciebie!",
  "Zobacz co mamy!",
];

const EMPTY = {
  image_url: "",
  message: "",
  cta_label: "",
  link_url: "",
  place_id: "",
  active: true,
  starts_at: "",
  ends_at: "",
};

const RECOMMENDED_DIMENSIONS = "1200 × 200 px (proporcje 6:1, max 500 KB, JPG/PNG/WebP)";

function AdminAds() {
  const isSuper = useIsSuperAdmin();
  const { user } = useUser();
  const { data: ads, isLoading } = useAllAds();
  const { data: places } = usePlaces();
  const { data: stats } = useAdStats();
  const upsert = useUpsertAd();
  const del = useDeleteAd();
  const duplicate = useDuplicateAd();
  const [editing, setEditing] = useState<Ad | null>(null);
  const [form, setForm] = useState<typeof EMPTY>(EMPTY);
  const [open, setOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [manualImage, setManualImage] = useState(false);
  const {
    uploading,
    upload,
    inputRef: fileInputRef,
  } = useStorageImageUpload({
    bucket: "ad-images",
    buildPath: (file) => {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      return `${user!.id}/${Date.now()}.${ext}`;
    },
    maxMb: 1,
  });

  const filtered = useMemo(() => {
    const list = ads ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((a) => a.message.toLowerCase().includes(q));
  }, [ads, search]);

  if (!isSuper) {
    return (
      <div className="bg-card border border-border rounded-2xl p-8 text-center">
        <Crown className="mx-auto text-muted-foreground mb-3" size={32} />
        <h2 className="font-display text-2xl mb-2">Tylko Head Admin</h2>
        <p className="text-sm text-muted-foreground">Reklamy może dodawać wyłącznie Head Admin.</p>
      </div>
    );
  }

  function startEdit(ad: Ad | null) {
    setEditing(ad);
    setManualImage(false);
    setForm(
      ad
        ? {
            image_url: ad.image_url,
            message: ad.message,
            cta_label: ad.cta_label ?? "",
            link_url: ad.link_url ?? "",
            place_id: ad.place_id ?? "",
            active: ad.active,
            starts_at: ad.starts_at ? ad.starts_at.slice(0, 16) : "",
            ends_at: ad.ends_at ? ad.ends_at.slice(0, 16) : "",
          }
        : EMPTY,
    );
    setOpen(true);
  }

  async function handleUpload(file: File) {
    if (!user) return;
    const url = await upload(file);
    if (url) {
      setForm((f) => ({ ...f, image_url: url }));
      toast.success("Wgrano grafikę");
    }
  }

  async function handleSave() {
    if (!form.image_url.trim() || !form.message.trim()) {
      toast.error("Grafika i komunikat są wymagane");
      return;
    }
    try {
      await upsert.mutateAsync({
        id: editing?.id,
        image_url: form.image_url.trim(),
        message: form.message.trim(),
        cta_label: form.cta_label.trim() || null,
        link_url: form.link_url.trim() || null,
        place_id: form.place_id || null,
        active: form.active,
        starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
        ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
      });
      toast.success(editing ? "Zaktualizowano reklamę" : "Dodano reklamę");
      setOpen(false);
      setEditing(null);
    } catch (e) {
      console.error("[ads] save failed", e);
      toast.error(e instanceof Error ? e.message : "Błąd zapisu");
    }
  }

  async function handleDeleteConfirmed(id: string) {
    try {
      await del.mutateAsync(id);
      toast.success("Usunięto reklamę");
    } catch (e) {
      console.error("[ads] delete failed", e);
      toast.error(e instanceof Error ? e.message : "Błąd usuwania");
    } finally {
      setConfirmDeleteId(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-3xl mb-1">Reklamy (Head Admin)</h1>
          <p className="text-sm text-muted-foreground">
            Ta sama reklama pokazuje się w pasku u góry, w sidebarze desktopowym i jako karta w
            feedzie „Nowo otwarte". Grafika pełni rolę logo w kompaktowych miejscach - może linkować
            do lokalu lub URL.
            <br />
            <span className="text-xs">
              Zalecane wymiary (pasek u góry):{" "}
              <strong className="text-foreground">{RECOMMENDED_DIMENSIONS}</strong>. W
              sidebarze/feedzie grafika jest kadrowana do kwadratu/5:4.
            </span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => startEdit(null)}
          className="inline-flex items-center gap-2 rounded-full bg-tomato text-cream px-4 py-2 text-sm font-semibold hover:bg-tomato/90"
        >
          <Plus size={14} /> Nowa reklama
        </button>
      </div>

      {(ads?.length ?? 0) > 0 && (
        <div className="relative mb-4">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Szukaj po treści reklamy…"
            className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-card border border-border outline-none focus:border-tomato text-sm"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Wyczyść"
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="grid place-items-center py-10">
          <Loader2 className="animate-spin" />
        </div>
      ) : !ads || ads.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-2xl p-8 text-center text-sm text-muted-foreground">
          Brak reklam. Kliknij „Nowa reklama".
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-2xl p-8 text-center text-sm text-muted-foreground">
          Brak reklam pasujących do „{search}".
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((ad) => {
            const place = (places ?? []).find((p) => p.id === ad.place_id);
            const status = getAdLiveStatus(ad);
            const s = stats?.[ad.id];
            const ctr =
              s && s.impressions > 0 ? ((s.clicks / s.impressions) * 100).toFixed(1) : null;
            return (
              <li
                key={ad.id}
                className="bg-card border border-border rounded-2xl p-3 flex items-center gap-3"
              >
                <img
                  src={ad.image_url}
                  alt=""
                  className="w-32 h-12 object-cover rounded-md shrink-0 bg-muted"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <StatusChip status={status} />
                    {place && <span className="text-xs text-muted-foreground">→ {place.name}</span>}
                    {ad.link_url && <ExternalLink size={11} className="text-muted-foreground" />}
                  </div>
                  <div className="text-sm font-medium truncate">{ad.message}</div>
                  <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span
                      className="inline-flex items-center gap-1"
                      title="Wyświetlenia (łącznie / 7 dni)"
                    >
                      <Eye size={11} /> {s?.impressions ?? 0}
                      {s && s.impressions_7d > 0 && (
                        <span className="text-emerald-500">+{s.impressions_7d}/7d</span>
                      )}
                    </span>
                    <span
                      className="inline-flex items-center gap-1"
                      title="Kliknięcia (łącznie / 7 dni)"
                    >
                      <MousePointerClick size={11} /> {s?.clicks ?? 0}
                      {s && s.clicks_7d > 0 && (
                        <span className="text-emerald-500">+{s.clicks_7d}/7d</span>
                      )}
                    </span>
                    {ctr && <span title="Click-through rate">CTR {ctr}%</span>}
                    <span
                      className="inline-flex items-center gap-1"
                      title="Unikalni zalogowani użytkownicy"
                    >
                      <Users size={11} /> {s?.unique_users ?? 0}
                    </span>
                    <span
                      className="inline-flex items-center gap-1"
                      title="Sesje (1 wejście + 30 min od jednego użytkownika, tylko zalogowani)"
                    >
                      <Layers size={11} /> {s?.sessions ?? 0} sesji
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => startEdit(ad)}
                  className="chip bg-card border border-border hover:border-tomato"
                >
                  Edytuj
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await duplicate.mutateAsync(ad);
                      toast.success("Zduplikowano (jako wyłączoną)");
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Błąd duplikowania");
                    }
                  }}
                  disabled={duplicate.isPending}
                  className="grid place-items-center w-8 h-8 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                  aria-label="Duplikuj reklamę"
                  title="Duplikuj"
                >
                  {duplicate.isPending ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Copy size={14} />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDeleteId(ad.id)}
                  disabled={del.isPending && confirmDeleteId === ad.id}
                  className="grid place-items-center w-8 h-8 rounded-full text-destructive hover:bg-destructive/10 disabled:opacity-50"
                  aria-label="Usuń reklamę"
                >
                  {del.isPending && confirmDeleteId === ad.id ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Trash2 size={14} />
                  )}
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
            className="bg-card border border-border rounded-2xl w-full max-w-lg p-5 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-xl">
                {editing ? "Edytuj reklamę" : "Nowa reklama"}
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid place-items-center w-8 h-8 rounded-full hover:bg-muted"
              >
                <X size={14} />
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <Field label="Lokal (opcjonalnie - logo lokalu pobiera się stąd automatycznie)">
                <select
                  value={form.place_id}
                  onChange={(e) => {
                    const placeId = e.target.value;
                    const place = (places ?? []).find((p) => p.id === placeId);
                    setForm((f) => ({
                      ...f,
                      place_id: placeId,
                      image_url: place?.cover_image_url || f.image_url,
                    }));
                  }}
                  className="input"
                >
                  <option value=""> - brak - </option>
                  {(places ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Grafika" required>
                <div className="space-y-2">
                  {form.place_id ? (
                    <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                      <ImageIcon size={11} className="shrink-0 mt-0.5" />
                      Logo pobrane automatycznie z profilu lokalu - nic nie trzeba wgrywać.{" "}
                      <button
                        type="button"
                        onClick={() => setManualImage(true)}
                        className="underline hover:text-tomato"
                      >
                        Podmień ręcznie
                      </button>
                    </p>
                  ) : null}
                  {(!form.place_id || manualImage) && (
                    <>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploading}
                          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:border-tomato disabled:opacity-50"
                        >
                          {uploading ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Upload size={12} />
                          )}
                          {uploading ? "Wgrywam…" : "Wgraj plik"}
                        </button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleUpload(f);
                          }}
                        />
                        {form.image_url && (
                          <button
                            type="button"
                            onClick={() => setForm({ ...form, image_url: "" })}
                            className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground hover:text-destructive hover:border-destructive"
                          >
                            <X size={12} /> Usuń grafikę
                          </button>
                        )}
                      </div>
                      <input
                        value={form.image_url}
                        onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                        className="input"
                        placeholder="…lub wklej URL grafiki"
                      />
                      <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                        <ImageIcon size={11} className="shrink-0 mt-0.5" />
                        Zalecane:{" "}
                        <strong className="text-foreground">{RECOMMENDED_DIMENSIONS}</strong>
                      </p>
                    </>
                  )}
                  {form.image_url && (
                    <div className="mt-1 rounded-md border border-border overflow-hidden bg-muted">
                      <img src={form.image_url} alt="" className="w-full max-h-32 object-cover" />
                    </div>
                  )}
                </div>
              </Field>
              <Field label="Komunikat (hook)" required>
                <input
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  className="input"
                  placeholder="Krótki tekst reklamy"
                  maxLength={140}
                />
                <PresetChips
                  options={MESSAGE_PRESETS}
                  onPick={(v) => setForm((f) => ({ ...f, message: v }))}
                />
              </Field>
              <Field label={`Przycisk CTA (domyślnie „${DEFAULT_AD_CTA}")`}>
                <input
                  value={form.cta_label}
                  onChange={(e) => setForm({ ...form, cta_label: e.target.value })}
                  className="input"
                  placeholder={DEFAULT_AD_CTA}
                  maxLength={40}
                />
                <PresetChips
                  options={CTA_PRESETS}
                  onPick={(v) => setForm((f) => ({ ...f, cta_label: v }))}
                />
              </Field>
              <Field label="URL (opcjonalnie - gdy bez lokalu)">
                <input
                  value={form.link_url}
                  onChange={(e) => setForm({ ...form, link_url: e.target.value })}
                  className="input"
                  placeholder="https://..."
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Od (opcjonalnie)">
                  <input
                    type="datetime-local"
                    value={form.starts_at}
                    onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
                    className="input"
                  />
                </Field>
                <Field label="Do (opcjonalnie)">
                  <input
                    type="datetime-local"
                    value={form.ends_at}
                    onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
                    className="input"
                  />
                </Field>
              </div>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                />
                Aktywna
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="chip bg-card border border-border"
              >
                Anuluj
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={upsert.isPending || uploading}
                className="inline-flex items-center gap-2 rounded-full bg-tomato text-cream px-4 py-2 text-sm font-semibold hover:bg-tomato/90 disabled:opacity-50"
              >
                {upsert.isPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Save size={14} />
                )}
                {editing ? "Zapisz zmiany" : "Dodaj reklamę"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDeleteModal
        open={!!confirmDeleteId}
        title="Usunąć reklamę?"
        description="Tej operacji nie można cofnąć. Reklama zniknie z paska na górze strony."
        pending={del.isPending}
        onCancel={() => setConfirmDeleteId(null)}
        onConfirm={() => handleDeleteConfirmed(confirmDeleteId!)}
      />

      <style>{`
        .input { width: 100%; background: hsl(var(--background)); border: 1px solid hsl(var(--border)); border-radius: 0.5rem; padding: 0.5rem 0.75rem; font-size: 0.875rem; }
        .input:focus { outline: none; border-color: hsl(var(--ring)); }
      `}</style>
    </div>
  );
}

function PresetChips({ options, onPick }: { options: string[]; onPick: (value: string) => void }) {
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onPick(opt)}
          className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground hover:border-tomato hover:text-tomato transition-colors"
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

const STATUS_STYLE: Record<LiveAdStatus, { label: string; cls: string }> = {
  active: { label: "Aktywna", cls: "bg-emerald-500/10 text-emerald-500" },
  scheduled: { label: "Zaplanowana", cls: "bg-sky-500/10 text-sky-500" },
  expired: { label: "Wygasła", cls: "bg-amber-500/10 text-amber-500" },
  disabled: { label: "Wyłączona", cls: "bg-muted text-muted-foreground" },
};

function StatusChip({ status }: { status: LiveAdStatus }) {
  const s = STATUS_STYLE[status];
  return <span className={`chip text-[10px] uppercase ${s.cls}`}>{s.label}</span>;
}
