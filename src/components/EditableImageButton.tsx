import { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useUploadPlaceImage, type PlaceImageKind } from "@/lib/place-image-upload";

const ACCEPT = "image/jpeg,image/png,image/webp";

/**
 * Small camera-icon button overlaid on a place's cover or avatar image.
 * Only rendered by the caller when the viewer is the verified owner or an
 * admin — this component itself does no permission checking.
 */
export function EditableImageButton({
  placeId,
  kind,
  className = "",
  label,
}: {
  placeId: string;
  kind: PlaceImageKind;
  className?: string;
  label: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadPlaceImage(placeId);
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File) {
    setBusy(true);
    try {
      await upload.mutateAsync({ file, kind });
      toast.success(kind === "cover" ? "Okładka zaktualizowana ✓" : "Logo zaktualizowane ✓");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Nie udało się wgrać obrazu");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        aria-label={label}
        title={label}
        className={`pz-hit inline-flex items-center justify-center rounded-full bg-navy/70 text-cream backdrop-blur-sm transition hover:bg-navy disabled:opacity-70 ${className}`}
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
        }}
      />
    </>
  );
}
