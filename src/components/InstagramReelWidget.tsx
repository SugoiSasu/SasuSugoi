import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Instagram, X, ChevronLeft } from "lucide-react";

const HIDDEN_KEY = "pz_reel_widget_hidden";
const REFRESH_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

interface ReelInfo {
  url: string | null;
  syncedAt: string | null;
}

function useLatestReel() {
  return useQuery({
    queryKey: ["latest-reel"],
    staleTime: REFRESH_MS,
    queryFn: async (): Promise<ReelInfo> => {
      const { data } = await supabase
        .from("social_accounts")
        .select("extra, last_synced_at")
        .eq("platform", "instagram")
        .maybeSingle();
      const extra = (data?.extra ?? {}) as { latest_reel_url?: string | null };
      const url = extra.latest_reel_url ?? null;
      const syncedAt = data?.last_synced_at ?? null;

      const stale =
        !syncedAt || Date.now() - new Date(syncedAt).getTime() > REFRESH_MS;
      if (stale) {
        try {
          await fetch("/api/public/hooks/social-sync", { method: "POST" });
          const { data: fresh } = await supabase
            .from("social_accounts")
            .select("extra, last_synced_at")
            .eq("platform", "instagram")
            .maybeSingle();
          const freshExtra = (fresh?.extra ?? {}) as { latest_reel_url?: string | null };
          return { url: freshExtra.latest_reel_url ?? url, syncedAt: fresh?.last_synced_at ?? syncedAt };
        } catch {
          /* ignore */
        }
      }
      return { url, syncedAt };
    },
  });
}

export function InstagramReelWidget() {
  const [hidden, setHidden] = useState(true);
  const { data } = useLatestReel();

  useEffect(() => {
    try {
      setHidden(localStorage.getItem(HIDDEN_KEY) === "1");
    } catch { /* ignore */ }
  }, []);

  const reelUrl = data?.url ?? null;
  const embedUrl = reelUrl ? toEmbed(reelUrl) : null;

  if (!reelUrl) return null;

  if (hidden) {
    return (
      <button
        type="button"
        aria-label="Pokaż ostatnią rolkę"
        onClick={() => {
          setHidden(false);
          try { localStorage.removeItem(HIDDEN_KEY); } catch { /* ignore */ }
        }}
        className="fixed right-0 top-1/2 -translate-y-1/2 z-40 bg-tomato text-cream rounded-l-xl px-2 py-3 shadow-lg hover:bg-navy transition flex flex-col items-center gap-1"
      >
        <ChevronLeft size={16} />
        <Instagram size={16} />
      </button>
    );
  }

  return (
    <aside className="fixed right-3 bottom-20 sm:bottom-5 z-40 w-[220px] sm:w-[260px] rounded-2xl overflow-hidden border-2 border-navy bg-cream shadow-2xl animate-in fade-in slide-in-from-right-2">
      <div className="flex items-center justify-between bg-navy text-cream px-3 py-2 text-xs font-semibold">
        <span className="inline-flex items-center gap-1.5">
          <Instagram size={14} /> Ostatnia rolka
        </span>
        <button
          aria-label="Schowaj"
          onClick={() => {
            setHidden(true);
            try { localStorage.setItem(HIDDEN_KEY, "1"); } catch { /* ignore */ }
          }}
          className="hover:text-tomato transition"
        >
          <X size={14} />
        </button>
      </div>
      {embedUrl ? (
        <iframe
          src={embedUrl}
          title="Ostatnia rolka @po_zeramy"
          className="w-full"
          style={{ aspectRatio: "9/16", border: 0 }}
          loading="lazy"
          allow="encrypted-media"
        />
      ) : (
        <a
          href={reelUrl}
          target="_blank"
          rel="noreferrer"
          className="block aspect-[9/16] grid place-items-center bg-navy text-cream text-sm font-semibold"
        >
          Zobacz rolkę →
        </a>
      )}
      <a
        href={reelUrl}
        target="_blank"
        rel="noreferrer"
        className="block text-center bg-tomato text-cream py-2 text-xs font-semibold hover:bg-navy transition"
      >
        Otwórz na Instagramie
      </a>
    </aside>
  );
}

function toEmbed(url: string): string | null {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("instagram.com")) return null;
    const path = u.pathname.endsWith("/") ? u.pathname : u.pathname + "/";
    return `https://www.instagram.com${path}embed/`;
  } catch {
    return null;
  }
}
