import { useEffect, useState } from "react";
import { ExternalLink, X } from "lucide-react";

const STORAGE_KEY = "pozeramy:in-app-browser-banner-dismissed";

/** Instagram/Facebook/TikTok/X's built-in in-app WebViews are well known for
 * fighting the page's own viewport scaling and zoom behavior in ways a site
 * can't fix from the outside - this can't detect or work around the WebView
 * itself, only point the visitor at their real browser instead. */
function isKnownInAppBrowser(ua: string): boolean {
  return /Instagram|FBAN|FBAV|FB_IAB|TikTok|BytedanceWebview|Twitter/i.test(ua);
}

export function InAppBrowserBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (window.localStorage.getItem(STORAGE_KEY) === "1") return;
    if (isKnownInAppBrowser(navigator.userAgent)) setShow(true);
  }, []);

  function dismiss() {
    window.localStorage.setItem(STORAGE_KEY, "1");
    setShow(false);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch {
      // Clipboard API can be blocked inside some in-app browsers - the
      // banner's own text already tells the visitor the URL to retype.
    }
  }

  if (!show) return null;

  return (
    // Static, not fixed - the app's header/sidebar are separate fixed-position
    // elements of their own, so a fixed banner here would overlay them instead
    // of pushing them down. Sitting first in normal flow (mounted before
    // AlphaGate's content in __root.tsx) shifts everything below it instead.
    <div className="relative z-[200] bg-navy px-4 py-2.5 text-cream shadow-md">
      <div className="mx-auto flex max-w-2xl items-center gap-3">
        <ExternalLink size={16} className="shrink-0 text-tomato" />
        <p className="flex-1 text-xs leading-snug sm:text-sm">
          Strona może wyglądać lepiej w normalnej przeglądarce. Skopiuj link i otwórz w Chrome/Safari.
        </p>
        <button
          type="button"
          onClick={copyLink}
          className="shrink-0 rounded-full bg-tomato px-3 py-1.5 text-xs font-semibold text-cream hover:bg-tomato/90"
        >
          Kopiuj link
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Zamknij"
          className="shrink-0 text-cream/70 hover:text-cream"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
