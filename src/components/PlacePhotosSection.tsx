import { useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, Loader2, Trash2, X, ChevronLeft, ChevronRight, Image as ImageIcon } from "lucide-react";
import {
  usePlacePhotos,
  useUploadPlacePhoto,
  useDeletePlacePhoto,
  type PlacePhoto,
} from "@/lib/place-photos-api";

const MAX_MB = 8;

export function PlacePhotosSection({ placeId, canManage }: { placeId: string; canManage: boolean }) {
  const { data: photos = [], isLoading } = usePlacePhotos(placeId);
  const upload = useUploadPlacePhoto(placeId);
  const del = useDeletePlacePhoto(placeId);
  const fileRef = useRef<HTMLInputElement>(null);
  const [lightbox, setLightbox] = useState<number | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_MB * 1024 * 1024) {
      toast.error(`Za duży plik (max ${MAX_MB} MB).`);
      e.target.value = "";
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("To nie jest obraz.");
      e.target.value = "";
      return;
    }
    try {
      await upload.mutateAsync({ file });
      toast.success("Zdjęcie dodane.");
    } catch (err) {
      toast.error((err as Error).message || "Nie udało się wgrać zdjęcia.");
    } finally {
      e.target.value = "";
    }
  }

  async function onDelete(photo: PlacePhoto) {
    if (!confirm("Usunąć zdjęcie?")) return;
    try {
      await del.mutateAsync(photo);
      toast.success("Usunięto.");
    } catch (err) {
      toast.error((err as Error).message || "Nie udało się usunąć.");
    }
  }

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="animate-spin" size={16} /> Wczytywanie zdjęć…
      </div>
    );
  }

  if (photos.length === 0 && !canManage) return null;

  return (
    <section className="surface rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-xl inline-flex items-center gap-2">
          <ImageIcon size={18} /> Zdjęcia
          {photos.length > 0 && (
            <span className="text-xs font-normal text-muted-foreground">({photos.length})</span>
          )}
        </h2>
        {canManage && (
          <>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={upload.isPending}
              className="inline-flex items-center gap-2 rounded-full bg-tomato text-cream px-3 py-1.5 text-xs font-semibold hover:bg-tomato/90 transition disabled:opacity-50"
            >
              {upload.isPending ? <Loader2 className="animate-spin" size={14} /> : <Camera size={14} />}
              Dodaj zdjęcie
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onFile}
            />
          </>
        )}
      </div>

      {photos.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Brak zdjęć. {canManage && "Dodaj pierwsze - pokażą się na profilu i karcie lokalu."}
        </p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
          {photos.map((p, i) => (
            <div key={p.id} className="relative group aspect-square rounded-xl overflow-hidden border border-border bg-muted">
              <button
                type="button"
                onClick={() => setLightbox(i)}
                className="block w-full h-full"
                aria-label="Powiększ zdjęcie"
              >
                <img src={p.url} alt={p.caption ?? ""} className="w-full h-full object-cover transition group-hover:scale-105" loading="lazy" />
              </button>
              {canManage && (
                <button
                  type="button"
                  onClick={() => onDelete(p)}
                  className="pz-hit absolute top-1 right-1 w-7 h-7 rounded-full bg-black/70 text-white grid place-items-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition"
                  aria-label="Usuń zdjęcie"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {lightbox !== null && photos[lightbox] && (
        <Lightbox
          photos={photos}
          index={lightbox}
          onClose={() => setLightbox(null)}
          onIndex={setLightbox}
        />
      )}
    </section>
  );
}

function Lightbox({
  photos,
  index,
  onClose,
  onIndex,
}: {
  photos: PlacePhoto[];
  index: number;
  onClose: () => void;
  onIndex: (i: number) => void;
}) {
  const p = photos[index];
  const prev = () => onIndex((index - 1 + photos.length) % photos.length);
  const next = () => onIndex((index + 1) % photos.length);
  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/90 grid place-items-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute top-3 right-3 w-11 h-11 rounded-full bg-white/10 text-white grid place-items-center hover:bg-white/20"
        aria-label="Zamknij"
      >
        <X size={18} />
      </button>
      {photos.length > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); prev(); }}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 text-white grid place-items-center hover:bg-white/20"
            aria-label="Poprzednie"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); next(); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 text-white grid place-items-center hover:bg-white/20"
            aria-label="Następne"
          >
            <ChevronRight size={20} />
          </button>
        </>
      )}
      <img
        src={p.url}
        alt={p.caption ?? ""}
        className="max-w-full max-h-[85dvh] object-contain rounded-xl"
        onClick={(e) => e.stopPropagation()}
      />
      {p.caption && (
        <div className="absolute bottom-4 left-0 right-0 text-center text-white/90 text-sm px-4">
          {p.caption}
        </div>
      )}
    </div>
  );
}
