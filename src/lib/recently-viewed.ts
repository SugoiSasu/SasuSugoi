import { useEffect, useState } from "react";

/**
 * Recently viewed places, kept only in this browser.
 *
 * Deliberately not a server table: the value here is "take me back to the
 * one I was looking at ten minutes ago", which is per-device and worthless
 * to anyone else. Storing it locally means it works logged out, costs no
 * round trip, and carries nothing worth syncing.
 */
const KEY = "pz:recently-viewed";
const MAX = 8;

/** Every access is guarded: Safari private mode throws on localStorage. */
function read(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string").slice(0, MAX);
  } catch {
    return [];
  }
}

function write(ids: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids.slice(0, MAX)));
  } catch {
    /* storage unavailable or full - the feature is a convenience, not data */
  }
}

/** Move a place to the front of the list (or add it), keeping it unique. */
export function recordPlaceView(placeId: string) {
  if (!placeId) return;
  const next = [placeId, ...read().filter((id) => id !== placeId)];
  write(next);
  // Same-tab listeners: the native `storage` event only fires in *other*
  // tabs, so the homepage would never notice a visit made in this one.
  window.dispatchEvent(new CustomEvent("pz:recently-viewed"));
}

export function clearRecentlyViewed() {
  write([]);
  window.dispatchEvent(new CustomEvent("pz:recently-viewed"));
}

/**
 * Reads on mount, not during render: localStorage does not exist on the
 * server, and returning [] there while the client returns 8 ids is exactly
 * the hydration mismatch the rest of this page has been avoiding.
 */
export function useRecentlyViewed(): string[] {
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    const sync = () => setIds(read());
    sync();
    window.addEventListener("pz:recently-viewed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("pz:recently-viewed", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return ids;
}
