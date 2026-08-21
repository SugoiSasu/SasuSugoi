import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Play, X, Instagram, Loader2 } from "lucide-react";
import { getInstagramEmbed } from "@/lib/instagram-embed.functions";
import { cuisineMeta } from "@/data/places";

declare global {
  interface Window {
    instgrm?: { Embeds: { process: () => void } };
  }
}

function loadInstagramScript(): Promise<void> {
  return new Promise((resolve) => {
    if (window.instgrm) {
      resolve();
      return;
    }
    const existing = document.getElementById("ig-embed-script");
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.id = "ig-embed-script";
    script.src = "https://www.instagram.com/embed.js";
    script.async = true;
    script.onload = () => resolve();
    document.body.appendChild(script);
  });
}

/** Branded "poster" button - real Instagram embed only loads once clicked. */
export function InstagramReelPoster({
  reelUrl,
  cuisine,
  placeName,
}: {
  reelUrl: string;
  cuisine: string;
  placeName: string;
}) {
  const [open, setOpen] = useState(false);
  const meta = cuisineMeta(cuisine);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group relative mx-auto flex aspect-[9/16] w-full max-w-[220px] flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border border-border text-cream shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
        style={{ background: `linear-gradient(160deg, ${meta.color}, ${meta.color}bb)` }}
      >
        <span
          aria-hidden="true"
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 15%, rgba(255,255,255,.25), transparent 55%)",
          }}
        />
        <span className="relative grid h-14 w-14 place-items-center rounded-full bg-cream/20 backdrop-blur-sm transition duration-300 group-hover:scale-110 group-hover:bg-cream/30">
          <Play size={24} className="translate-x-0.5 fill-cream text-cream" />
        </span>
        <span className="relative px-5 text-center text-sm font-semibold leading-snug">
          Zobacz rolkę {placeName}
        </span>
        <span className="relative inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-cream/80">
          <Instagram size={12} /> Instagram
        </span>
      </button>

      {open && (
        <InstagramReelModal reelUrl={reelUrl} placeName={placeName} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

function InstagramReelModal({
  reelUrl,
  placeName,
  onClose,
}: {
  reelUrl: string;
  placeName: string;
  onClose: () => void;
}) {
  const fetchEmbed = useServerFn(getInstagramEmbed);
  const containerRef = useRef<HTMLDivElement>(null);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["ig-embed", reelUrl],
    queryFn: () => fetchEmbed({ data: { url: reelUrl } }),
    staleTime: 1000 * 60 * 60,
    retry: 1,
  });

  useEffect(() => {
    if (!data?.html) return;
    let cancelled = false;
    loadInstagramScript().then(() => {
      if (!cancelled) window.instgrm?.Embeds.process();
    });
    return () => {
      cancelled = true;
    };
  }, [data?.html]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Rolka ${placeName} na Instagramie`}
      className="fixed inset-0 z-[100] grid place-items-center bg-navy/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-3xl bg-card shadow-2xl animate-in fade-in zoom-in-95 duration-300"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Zamknij"
          className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-navy/80 text-cream hover:bg-tomato transition"
        >
          <X size={16} />
        </button>
        <div className="p-4">
          {isLoading && (
            <div className="grid aspect-[9/16] place-items-center">
              <Loader2 className="animate-spin text-tomato" size={28} />
            </div>
          )}
          {isError && (
            <div className="grid aspect-[9/16] place-items-center gap-3 px-6 text-center text-sm text-muted-foreground">
              <p>Nie udało się załadować rolki.</p>
              <a
                href={reelUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full bg-navy text-cream px-4 py-2 text-xs font-semibold hover:bg-tomato transition"
              >
                <Instagram size={13} /> Otwórz na Instagramie
              </a>
            </div>
          )}
          {data?.html && (
            <div ref={containerRef} dangerouslySetInnerHTML={{ __html: data.html }} />
          )}
        </div>
      </div>
    </div>
  );
}
