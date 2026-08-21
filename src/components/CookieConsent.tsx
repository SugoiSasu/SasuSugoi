import { useEffect, useState } from "react";
import { GA_MEASUREMENT_ID, disableGA, hasAnalyticsConsent, isGALoaded, loadGA, trackEvent } from "@/lib/analytics";
import { supabase } from "@/integrations/supabase/client";


/**
 * Google Consent Mode v2 – zgodny baner cookies.
 *
 * Kategorie (mapowane 1:1 na sygnały Consent Mode):
 *  - analytics_storage
 *  - ad_storage
 *  - ad_user_data
 *  - ad_personalization
 *
 * functionality_storage / security_storage pozostają "granted" (niezbędne).
 * Domyślny stan ("denied" dla wszystkich reklamowo-analitycznych sygnałów)
 * ustawiany jest w <head> jeszcze przed hydratacją - patrz __root.tsx.
 */

const STORAGE_KEY = "pz_cookie_consent_v1";
const ANON_ID_KEY = "pz_cookie_consent_anon_id";
const CONSENT_LOG_VERSION = "1";

// Random per-browser id, unrelated to any account - lets us prove what a
// given (anonymous) session consented to and when, without identifying
// anyone. Never sent anywhere except our own consent log.
function getOrCreateAnonId(): string {
  try {
    let id = localStorage.getItem(ANON_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(ANON_ID_KEY, id);
    }
    return id;
  } catch {
    return "unknown";
  }
}

function logConsentServerSide(state: Omit<ConsentState, "ts" | "version">) {
  supabase
    .from("cookie_consent_log")
    .insert({
      anon_id: getOrCreateAnonId(),
      analytics_storage: state.analytics_storage === "granted",
      ad_storage: state.ad_storage === "granted",
      ad_user_data: state.ad_user_data === "granted",
      ad_personalization: state.ad_personalization === "granted",
      consent_version: CONSENT_LOG_VERSION,
    })
    .then(({ error }) => {
      if (error) console.warn("cookie consent log failed", error.message);
    });
}

type ConsentValue = "granted" | "denied";

interface ConsentState {
  analytics_storage: ConsentValue;
  ad_storage: ConsentValue;
  ad_user_data: ConsentValue;
  ad_personalization: ConsentValue;
  ts: number;
  version: 1;
}

const DENY_ALL: Omit<ConsentState, "ts" | "version"> = {
  analytics_storage: "denied",
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
};

const ACCEPT_ALL: Omit<ConsentState, "ts" | "version"> = {
  analytics_storage: "granted",
  ad_storage: "granted",
  ad_user_data: "granted",
  ad_personalization: "granted",
};

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    pozeramyOpenCookieSettings?: () => void;
  }
}

function pushConsentUpdate(state: Omit<ConsentState, "ts" | "version">) {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  // gtag helper – zdefiniowany w inline-script w <head>
  const gtag = window.gtag || function (...args: unknown[]) { window.dataLayer!.push(args); };
  gtag("consent", "update", state);

  // Załaduj lub wyłącz gtag.js zależnie od zgody na analitykę.
  if (state.analytics_storage === "granted") {
    loadGA().catch(() => { /* ignore load errors */ });
  } else {
    disableGA();
  }
}


function readStored(): ConsentState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConsentState;
    if (parsed?.version !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

function persist(next: Omit<ConsentState, "ts" | "version">) {
  const payload: ConsentState = { ...next, ts: Date.now(), version: 1 };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
  pushConsentUpdate(next);
  logConsentServerSide(next);
}

export function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [hasStored, setHasStored] = useState(false);
  const [prefs, setPrefs] = useState({
    analytics_storage: false,
    ad_storage: false,
    ad_user_data: false,
    ad_personalization: false,
  });

  useEffect(() => {
    const stored = readStored();
    if (!stored) {
      setVisible(true);
    } else {
      setHasStored(true);
      // Re-emit stored decision, tak żeby analytics załadowane po hydratacji też je dostał.
      pushConsentUpdate({
        analytics_storage: stored.analytics_storage,
        ad_storage: stored.ad_storage,
        ad_user_data: stored.ad_user_data,
        ad_personalization: stored.ad_personalization,
      });
    }
    window.pozeramyOpenCookieSettings = () => {
      const s = readStored();
      if (s) {
        setHasStored(true);
        setPrefs({
          analytics_storage: s.analytics_storage === "granted",
          ad_storage: s.ad_storage === "granted",
          ad_user_data: s.ad_user_data === "granted",
          ad_personalization: s.ad_personalization === "granted",
        });
      }
      setExpanded(true);
      setVisible(true);
    };
    return () => {
      delete window.pozeramyOpenCookieSettings;
    };
  }, []);

  if (!visible) return null;

  const acceptAll = () => {
    persist(ACCEPT_ALL);
    setHasStored(true);
    setVisible(false);
  };
  const rejectAll = () => {
    persist(DENY_ALL);
    setHasStored(true);
    setVisible(false);
  };
  const saveSelected = () => {
    persist({
      analytics_storage: prefs.analytics_storage ? "granted" : "denied",
      ad_storage: prefs.ad_storage ? "granted" : "denied",
      ad_user_data: prefs.ad_user_data ? "granted" : "denied",
      ad_personalization: prefs.ad_personalization ? "granted" : "denied",
    });
    setHasStored(true);
    setVisible(false);
  };
  const revokeConsent = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    // Powrót do stanu domyślnego – wszystko denied
    pushConsentUpdate(DENY_ALL);
    setHasStored(false);
    setExpanded(false);
    setPrefs({
      analytics_storage: false,
      ad_storage: false,
      ad_user_data: false,
      ad_personalization: false,
    });
    // Baner zostaje widoczny – użytkownik może podjąć nową decyzję.
    setVisible(true);
  };

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Zgoda na pliki cookies"
      className="fixed inset-x-0 bottom-0 z-[100] px-3 pb-3 sm:px-6 sm:pb-6"
    >
      <div className="mx-auto max-w-3xl rounded-2xl bg-navy/95 text-cream shadow-[0_24px_60px_-20px_rgba(0,0,0,0.6)] backdrop-blur border border-cream/10 p-4 sm:p-6">
        <div className="flex flex-col gap-3">
          <div>
            <h2 className="font-display text-lg sm:text-xl">Cookies i prywatność</h2>
            <p className="mt-1 text-sm text-cream/80 leading-relaxed">
              Używamy plików cookies, aby serwis działał i (za Twoją zgodą) mierzyć ruch oraz personalizować
              reklamy. Zgodnie z Google Consent Mode v2 domyślnie nic nieobowiązkowego nie jest włączone,
              dopóki nie klikniesz „Akceptuję". Więcej w{" "}
              <a href="/polityka-prywatnosci" className="underline font-semibold text-blush hover:text-tomato">
                polityce prywatności
              </a>.
            </p>
          </div>

          {expanded && (
            <div className="mt-1 grid gap-2 rounded-xl bg-cream/[0.04] p-3 border border-cream/10">
              <PrefRow label="Niezbędne" description="Zawsze aktywne – logowanie, bezpieczeństwo." disabled checked />
              <PrefRow
                label="Analityka"
                description="Anonimowe statystyki odwiedzin (analytics_storage)."
                checked={prefs.analytics_storage}
                onChange={(v) => setPrefs((p) => ({ ...p, analytics_storage: v }))}
              />
              <PrefRow
                label="Marketing"
                description="Pomiar i personalizacja reklam (ad_storage, ad_user_data, ad_personalization)."
                checked={prefs.ad_storage && prefs.ad_user_data && prefs.ad_personalization}
                onChange={(v) =>
                  setPrefs((p) => ({ ...p, ad_storage: v, ad_user_data: v, ad_personalization: v }))
                }
              />
            </div>
          )}

          {expanded && <GADebugPanel analyticsGranted={prefs.analytics_storage} />}


          <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-end">
            {!expanded && (
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className="pz-hit text-sm text-cream/80 hover:text-cream underline underline-offset-2 sm:mr-auto"
              >
                Ustawienia
              </button>
            )}
            {expanded && (
              <button
                type="button"
                onClick={saveSelected}
                className="min-h-11 text-sm px-4 py-2 rounded-full bg-cream/10 hover:bg-cream/20 border border-cream/20 sm:mr-auto"
              >
                Zapisz wybór
              </button>
            )}
            {expanded && hasStored && (
              <button
                type="button"
                onClick={revokeConsent}
                className="text-sm px-4 py-2 rounded-full bg-transparent hover:bg-cream/10 border border-cream/30 text-cream/90"
                aria-label="Cofnij zgodę i zresetuj zapisane preferencje cookies"
              >
                Cofnij zgodę
              </button>
            )}
            <button
              type="button"
              onClick={rejectAll}
              className="min-h-11 text-sm px-4 py-2 rounded-full bg-cream/10 hover:bg-cream/20 border border-cream/20"
            >
              Odrzuć wszystkie
            </button>
            <button
              type="button"
              onClick={acceptAll}
              className="min-h-11 text-sm px-4 py-2 rounded-full bg-tomato text-cream font-semibold hover:scale-[1.02] transition"
            >
              Akceptuję wszystkie
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PrefRow({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange?: (v: boolean) => void;
}) {
  const toggle = () => {
    if (disabled) return;
    onChange?.(!checked);
  };
  return (
    <div className={`flex items-start justify-between gap-3 text-sm ${disabled ? "opacity-70" : ""}`}>
      <div className="flex-1">
        <span className="font-semibold text-cream">{label}</span>
        <span className="block text-xs text-cream/70">{description}</span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={`Przełącznik zgody: ${label}`}
        aria-disabled={disabled}
        onClick={toggle}
        disabled={disabled}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-tomato/70 ${
          checked ? "bg-tomato" : "bg-cream/20"
        } ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-cream shadow transition-transform ${
            checked ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}

function GADebugPanel({ analyticsGranted }: { analyticsGranted: boolean }) {
  const [tick, setTick] = useState(0);
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const stored = readStored();
  const consented = hasAnalyticsConsent();
  const loaded = isGALoaded();
  const last = typeof window !== "undefined" ? window.__pz_ga_last_event : undefined;
  const dlSize = typeof window !== "undefined" ? window.dataLayer?.length ?? 0 : 0;

  const sendTest = () => {
    trackEvent("pz_debug_test", { source: "cookie_settings", ts: Date.now() });
    setTestStatus(consented ? "Wysłano zdarzenie testowe do GA4." : "Zgoda na analitykę wyłączona - zdarzenie zbuforowane, nic nie wysłano.");
    setTimeout(() => setTick((t) => t + 1), 50);
  };
  const refresh = () => setTick((t) => t + 1);

  return (
    <div className="mt-2 rounded-xl bg-cream/[0.04] p-3 border border-cream/10 text-xs text-cream/85 space-y-1.5" data-tick={tick}>
      <div className="font-semibold text-cream text-sm mb-1">Debug GA4</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
        <div>Measurement ID: <span className="font-mono text-cream">{GA_MEASUREMENT_ID}</span></div>
        <div>Zapisana zgoda: <StatusPill ok={stored != null} okLabel="tak" offLabel="brak" /></div>
        <div>analytics_storage: <StatusPill ok={consented} okLabel="granted" offLabel="denied" /></div>
        <div>Wybrana w panelu: <StatusPill ok={analyticsGranted} okLabel="on" offLabel="off" /></div>
        <div>gtag.js załadowany: <StatusPill ok={loaded} okLabel="tak" offLabel="nie" /></div>
        <div>dataLayer entries: <span className="font-mono">{dlSize}</span></div>
      </div>
      {last && (
        <div className="pt-1 border-t border-cream/10">
          <div>Ostatnie zdarzenie: <span className="font-mono">{last.name}</span> - {last.sent ? "wysłane" : "zbuforowane (brak zgody)"}</div>
        </div>
      )}
      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          onClick={sendTest}
          className="pz-hit rounded-full bg-tomato/90 hover:bg-tomato text-cream px-3 py-1 text-xs font-semibold"
        >
          Wyślij zdarzenie testowe
        </button>
        <button
          type="button"
          onClick={refresh}
          className="pz-hit rounded-full bg-cream/10 hover:bg-cream/20 border border-cream/20 text-cream/90 px-3 py-1 text-xs"
        >
          Odśwież stan
        </button>
      </div>
      {testStatus && <div className="text-cream/80">{testStatus}</div>}
      <p className="text-[11px] text-cream/60 pt-1">
        Nie przesyłamy w zdarzeniach żadnych wrażliwych danych (bez e-maili, bez IP, bez treści formularzy).
      </p>
    </div>
  );
}

function StatusPill({ ok, okLabel, offLabel }: { ok: boolean; okLabel: string; offLabel: string }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${ok ? "bg-emerald-500/20 text-emerald-200" : "bg-cream/10 text-cream/70"}`}>
      {ok ? okLabel : offLabel}
    </span>
  );
}
