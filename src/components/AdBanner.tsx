import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { X, Megaphone } from "lucide-react";
import { useActiveAds, trackAdImpression, trackAdClick, DEFAULT_AD_CTA, type Ad } from "@/lib/ads-api";
import { useUser } from "@/lib/use-auth";
import { pickSeeded } from "@/lib/seeded-pick";

const STORAGE_KEY = "pozeramy:ad-dismissed";

function getDismissed(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function setDismissed(set: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(set)));
  } catch {
    /* noop */
  }
}

export function AdBanner() {
  const { data: ads } = useActiveAds();
  const { user } = useUser();
  const [dismissed, setDismissedState] = useState<Set<string>>(() => new Set());
  const [mounted, setMounted] = useState(false);
  const trackedRef = useRef<string | null>(null);

  useEffect(() => {
    setMounted(true);
    setDismissedState(getDismissed());
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const eligible = (ads ?? []).filter((a) => !dismissed.has(a.id));
  const ad = mounted ? pickSeeded(eligible, `banner-${user?.id ?? "anon"}-${today}`) ?? undefined : undefined;

  useEffect(() => {
    if (!ad) return;
    if (trackedRef.current === ad.id) return;
    trackedRef.current = ad.id;
    trackAdImpression(ad.id, user?.id);
  }, [ad?.id, user?.id]);

  if (!mounted || !ad) return null;

  const dismiss = () => {
    const next = new Set(dismissed);
    next.add(ad.id);
    setDismissed(next);
    setDismissedState(next);
  };

  return (
    <div className="relative w-full overflow-hidden border-b border-tomato/30 bg-gradient-to-r from-tomato/15 via-card to-tomato/15 animate-[adb-slide_420ms_ease-out]">
      {/* Shimmer sweep */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/15 to-transparent animate-[adb-shimmer_3.6s_linear_infinite]"
      />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 py-1.5 flex items-center gap-3">
        <span className="hidden sm:inline-flex items-center gap-1 chip bg-tomato text-cream text-[10px] uppercase tracking-wider animate-[adb-pulse_2.4s_ease-in-out_infinite]">
          <Megaphone size={10} /> Reklama
        </span>
        {ad.image_url && (
          <img
            src={ad.image_url}
            alt=""
            className="h-8 w-24 sm:w-36 object-cover rounded-md shrink-0 ring-1 ring-tomato/30"
            loading="lazy"
          />
        )}
        <div className="flex-1 min-w-0 text-sm">
          <AdContent ad={ad} userId={user?.id} />
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Zamknij reklamę"
          className="pz-hit grid place-items-center w-7 h-7 rounded-full hover:bg-tomato/10 text-muted-foreground hover:text-tomato transition-colors"
        >
          <X size={14} />
        </button>
      </div>
      <style>{`
        @keyframes adb-slide {
          0% { transform: translateY(-100%); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes adb-shimmer {
          0% { transform: translateX(0); }
          100% { transform: translateX(500%); }
        }
        @keyframes adb-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
      `}</style>
    </div>
  );
}

function AdContent({ ad, userId }: { ad: Ad; userId: string | undefined }) {
  const inner = (
    <span className="flex items-center gap-2 min-w-0">
      <span className="font-medium truncate">{ad.message}</span>
      <span className="hidden sm:inline shrink-0 chip bg-tomato text-cream text-[10px]">
        {ad.cta_label || DEFAULT_AD_CTA}
      </span>
    </span>
  );
  const onClick = () => trackAdClick(ad.id, userId);
  if (ad.place_id) {
    return (
      <Link to="/k/$id" params={{ id: ad.place_id }} onClick={onClick} className="hover:text-tomato transition-colors block">
        {inner}
      </Link>
    );
  }
  if (ad.link_url) {
    return (
      <a href={ad.link_url} target="_blank" rel="noreferrer" onClick={onClick} className="hover:text-tomato transition-colors block">
        {inner}
      </a>
    );
  }
  return inner;
}
