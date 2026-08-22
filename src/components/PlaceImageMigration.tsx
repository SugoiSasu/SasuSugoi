import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CloudUpload, Loader2 } from "lucide-react";
import { migratePlaceImage } from "@/lib/place-image-migration.functions";
import { isHotlinkedUrl } from "@/lib/place-image-migration";
import type { Place } from "@/lib/places-api";

const FIELDS = ["cover_image_url", "avatar_url", "menu_image_url"] as const;
type Field = (typeof FIELDS)[number];

const FIELD_LABEL: Record<Field, string> = {
  cover_image_url: "okładka",
  avatar_url: "avatar",
  menu_image_url: "zdjęcie menu",
};

type Summary = { migrated: number; skipped: number; failed: { place: string; field: Field; message: string }[] };

/** Migracja 3 pól obrazków jednego lokalu (przy edycji). */
export function MigratePlaceImagesButton({
  place,
  onMigrated,
}: {
  place: Place;
  onMigrated?: (field: Field, url: string) => void;
}) {
  const run = useServerFn(migratePlaceImage);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const hotlinked = FIELDS.filter((f) => isHotlinkedUrl((place[f] ?? "") as string));

  async function handleClick() {
    setBusy(true);
    let migrated = 0;
    const errors: string[] = [];
    for (const field of FIELDS) {
      try {
        const res = await run({ data: { placeId: place.id, field } });
        if (res.status === "migrated") {
          migrated += 1;
          onMigrated?.(field, res.url);
        }
      } catch (e) {
        errors.push(`${FIELD_LABEL[field]}: ${e instanceof Error ? e.message : "błąd"}`);
      }
    }
    setBusy(false);
    await qc.invalidateQueries({ queryKey: ["places"] });
    if (errors.length) toast.error(`Migracja z błędami - ${errors.join(" · ")}`);
    else if (migrated === 0) toast.info("Wszystkie zdjęcia są już w Storage");
    else toast.success(`Zmigrowano ${migrated} ${migrated === 1 ? "zdjęcie" : "zdjęcia"} ✓`);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className="w-full inline-flex items-center justify-center gap-2 rounded-full border border-border py-2.5 text-sm font-semibold hover:border-tomato hover:text-tomato transition disabled:opacity-50"
      title="Pobiera zdjęcia z zewnętrznych CDN-ów i zapisuje we własnym Storage"
    >
      {busy ? <Loader2 className="animate-spin" size={14} /> : <CloudUpload size={14} />}
      {busy ? "Migruję…" : `Migruj zdjęcia do Storage${hotlinked.length ? ` (${hotlinked.length})` : ""}`}
    </button>
  );
}

/** Zbiorcza migracja wszystkich lokali z progresem i podsumowaniem. */
export function MigrateAllPlacesButton({ places }: { places: Place[] }) {
  const run = useServerFn(migratePlaceImage);
  const qc = useQueryClient();
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);

  async function handleClick() {
    if (!places.length) return;
    if (!confirm(`Zmigrować zdjęcia dla ${places.length} lokali? Operacja może potrwać kilka minut.`)) return;
    const total = places.length;
    const acc: Summary = { migrated: 0, skipped: 0, failed: [] };
    setSummary(null);
    setProgress({ done: 0, total });
    for (let i = 0; i < places.length; i++) {
      const p = places[i];
      for (const field of FIELDS) {
        try {
          const res = await run({ data: { placeId: p.id, field } });
          if (res.status === "migrated") acc.migrated += 1;
          else acc.skipped += 1;
        } catch (e) {
          acc.failed.push({ place: p.name, field, message: e instanceof Error ? e.message : "błąd" });
        }
      }
      setProgress({ done: i + 1, total });
    }
    setProgress(null);
    setSummary(acc);
    await qc.invalidateQueries({ queryKey: ["places"] });
    toast.success(`Migracja zakończona: ${acc.migrated} zmigrowanych, ${acc.skipped} bez zmian, ${acc.failed.length} błędów`);
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={handleClick}
        disabled={!!progress || !places.length}
        className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm font-semibold hover:border-tomato hover:text-tomato transition disabled:opacity-50"
      >
        {progress ? <Loader2 className="animate-spin" size={14} /> : <CloudUpload size={14} />}
        {progress ? `Migruję… ${progress.done}/${progress.total}` : "Migruj wszystkie lokale"}
      </button>

      {summary && (
        <div className="rounded-2xl border border-border bg-card p-4 text-sm space-y-2">
          <div className="font-semibold">Podsumowanie migracji</div>
          <ul className="text-muted-foreground space-y-0.5">
            <li>Zmigrowano zdjęć: <strong className="text-foreground">{summary.migrated}</strong></li>
            <li>Już OK / brak URL-a: <strong className="text-foreground">{summary.skipped}</strong></li>
            <li>Błędy: <strong className="text-foreground">{summary.failed.length}</strong></li>
          </ul>
          {summary.failed.length > 0 && (
            <div className="pt-2 border-t border-border">
              <div className="text-xs font-semibold text-destructive mb-1">Wymaga ręcznej uwagi:</div>
              <ul className="text-xs text-muted-foreground space-y-0.5 max-h-40 overflow-y-auto">
                {summary.failed.map((f, i) => (
                  <li key={i}>
                    <strong className="text-foreground">{f.place}</strong> - {FIELD_LABEL[f.field]}: {f.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
