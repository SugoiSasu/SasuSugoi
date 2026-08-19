const STORAGE_PREFIX = "pz_onboarding_seen_v1:";

export function hasSeenOnboarding(userId: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(STORAGE_PREFIX + userId) === "1";
  } catch {
    return true;
  }
}

export function markOnboardingSeen(userId: string) {
  try {
    localStorage.setItem(STORAGE_PREFIX + userId, "1");
  } catch {
    /* ignore */
  }
}

type Listener = () => void;
const listeners = new Set<Listener>();

/** Lets any component (e.g. a "Jak korzystać z appki?" menu item) re-open the tour on demand. */
export function openOnboarding() {
  listeners.forEach((fn) => fn());
}

export function onOnboardingOpenRequest(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
