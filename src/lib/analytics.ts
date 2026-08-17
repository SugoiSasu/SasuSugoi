/**
 * GA4 analytics helper — Google Consent Mode v2 aware.
 *
 * - Nie ładujemy skryptu gtag.js dopóki użytkownik nie udzieli zgody na
 *   `analytics_storage`. Po zgodzie ładujemy raz i cache'ujemy Promise.
 * - `trackEvent` sprawdza aktualną zgodę przed wysłaniem eventu.
 * - `disableGA()` ustawia oficjalną flagę `window['ga-disable-<ID>']=true`
 *   po cofnięciu zgody, więc dalsze wywołania gtag nie wysyłają hitów.
 */

export const GA_MEASUREMENT_ID = "G-KY41GY5F0P";

const STORAGE_KEY = "pz_cookie_consent_v1";
const DISABLE_FLAG = `ga-disable-${GA_MEASUREMENT_ID}`;

type Gtag = (...args: unknown[]) => void;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: Gtag;
    __pz_ga_loaded?: boolean;
    __pz_ga_last_event?: { name: string; params: Record<string, unknown>; ts: number; sent: boolean };
  }
}

export function hasAnalyticsConsent(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { analytics_storage?: string };
    return parsed?.analytics_storage === "granted";
  } catch {
    return false;
  }
}

export function isGALoaded(): boolean {
  return typeof window !== "undefined" && Boolean(window.__pz_ga_loaded);
}

let loadPromise: Promise<void> | null = null;

export function loadGA(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.__pz_ga_loaded) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<void>((resolve, reject) => {
    (window as unknown as Record<string, unknown>)[DISABLE_FLAG] = false;
    window.dataLayer = window.dataLayer || [];
    if (!window.gtag) {
      window.gtag = function gtag(...args: unknown[]) {
        window.dataLayer!.push(args);
      };
    }
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
    script.onload = () => {
      window.gtag!("js", new Date());
      window.gtag!("config", GA_MEASUREMENT_ID, { anonymize_ip: true, debug_mode: false });
      window.__pz_ga_loaded = true;
      resolve();
    };
    script.onerror = () => {
      loadPromise = null;
      reject(new Error("Failed to load gtag.js"));
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}

/** Cofnięcie zgody — blokuje kolejne hity gtag i próbuje wyczyścić ciasteczka _ga*. */
export function disableGA() {
  if (typeof window === "undefined") return;
  (window as unknown as Record<string, unknown>)[DISABLE_FLAG] = true;
  try {
    const host = window.location.hostname;
    const domains = [host, `.${host}`, `.${host.split(".").slice(-2).join(".")}`];
    document.cookie.split(";").forEach((c) => {
      const name = c.split("=")[0]?.trim();
      if (!name || !/^_ga/.test(name)) return;
      domains.forEach((d) => {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${d}`;
      });
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    });
  } catch {
    /* ignore */
  }
}

/**
 * Wysyła event do GA4 — tylko jeśli user zgodził się na `analytics_storage`.
 * Nigdy nie przekazujemy PII (email, IP itd.).
 */
export function trackEvent(name: string, params: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  const consented = hasAnalyticsConsent();
  const record = { name, params, ts: Date.now(), sent: false };
  if (!consented) {
    window.__pz_ga_last_event = record;
    return;
  }
  const send = () => {
    try {
      window.gtag?.("event", name, params);
      record.sent = true;
    } catch {
      /* ignore */
    } finally {
      window.__pz_ga_last_event = record;
    }
  };
  if (window.__pz_ga_loaded) {
    send();
  } else {
    loadGA().then(send).catch(() => {
      window.__pz_ga_last_event = record;
    });
  }
}
