import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * Logowanie Google/Apple w aplikacji natywnej (powloka Capacitor ladujaca te strone).
 *
 * Google odrzuca logowanie w osadzonym oknie aplikacji, wiec calosc idzie przez systemowa
 * przegladarke (Custom Tab / Safari), a powrot do aplikacji robi link pl.pozeramy.app://auth.
 * Uzywamy PKCE: w linku wraca tylko jednorazowy kod, a klucz do jego wymiany (code verifier)
 * zostaje w aplikacji - inna aplikacja, ktora przechwyci link, nic z nim nie zrobi.
 * Wtyczki Capacitora bierzemy z window.Capacitor (wstrzykiwane przez powloke), wiec strona
 * nie dostaje zadnych dodatkowych zaleznosci.
 */

export const NATIVE_SCHEME = "pl.pozeramy.app";

type ListenerHandle = { remove?: () => void };
type CapacitorPlugins = {
  Browser?: { open(o: { url: string }): unknown; close(): unknown };
  // Na stronie zdalnej most natywny zwraca sam uchwyt, a pakiet @capacitor/core - obietnice. Obslugujemy oba.
  App?: { addListener(ev: string, cb: (e: never) => void): unknown };
};
type CapacitorGlobal = { isNativePlatform?: () => boolean; Plugins?: CapacitorPlugins };

function cap(): CapacitorGlobal | undefined {
  return typeof window === "undefined" ? undefined : (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
}

/** Zamyka przegladarke systemowa; nigdy nie rzuca (wynik moze nie byc obietnica). */
function closeBrowser(): void {
  try {
    void Promise.resolve(cap()?.Plugins?.Browser?.close()).catch(() => {});
  } catch {
    // brak wtyczki - nic do zamkniecia
  }
}

/** Rejestruje nasluch zdarzenia aplikacji (appUrlOpen, appStateChange) niezaleznie od ksztaltu wyniku mostu; zwraca funkcje odlaczajaca. Nigdy nie rzuca. */
export function onAppEvent<E>(event: string, cb: (e: E) => void): () => void {
  const app = cap()?.Plugins?.App;
  if (!app) return () => {};
  let handle: ListenerHandle | undefined;
  let removed = false;
  try {
    const r = app.addListener(event, cb as (e: never) => void);
    void Promise.resolve(r)
      .then((h) => {
        if (removed) (h as ListenerHandle | undefined)?.remove?.();
        else handle = h as ListenerHandle | undefined;
      })
      .catch(() => {});
  } catch {
    return () => {};
  }
  return () => {
    removed = true;
    try {
      handle?.remove?.();
    } catch {
      // juz odlaczony
    }
  };
}

export function isNativeApp(): boolean {
  return !!cap()?.isNativePlatform?.();
}

let _client: ReturnType<typeof createClient> | undefined;
/** Osobny klient tylko do tej wymiany: PKCE i wlasny klucz w storage, zeby nie ruszac glownej sesji. */
function nativeClient() {
  if (!_client) {
    _client = createClient(
      import.meta.env.VITE_SUPABASE_URL as string,
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
      {
        auth: {
          flowType: "pkce",
          storage: localStorage,
          storageKey: "pz-native-oauth",
          persistSession: true,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      },
    );
  }
  return _client;
}

export async function startNativeOAuth(provider: "google" | "apple"): Promise<void> {
  const browser = cap()?.Plugins?.Browser;
  if (!browser) throw new Error("Przeglądarka systemowa jest niedostępna w tej aplikacji.");
  const { data, error } = await nativeClient().auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${window.location.origin}/auth/app-callback`, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data.url) throw new Error("Nie udało się rozpocząć logowania.");
  await browser.open({ url: data.url });
}

/**
 * Nasluchuje powrotu z przegladarki. Zwraca funkcje odlaczajaca nasluch.
 * `onDone` dostaje blad (albo null, gdy sesja ustawiona).
 */
export function listenForNativeAuth(onDone: (error: Error | null) => void): () => void {
  return onAppEvent<{ url: string }>("appUrlOpen", async ({ url }) => {
    if (!url.startsWith(`${NATIVE_SCHEME}://auth`)) return;
    try {
      const params = new URL(url).searchParams;
      const err = params.get("error_description") || params.get("error");
      if (err) throw new Error(err);
      const code = params.get("code");
      if (!code) throw new Error("Brak kodu logowania.");
      const { data, error } = await nativeClient().auth.exchangeCodeForSession(code);
      if (error || !data.session) throw error ?? new Error("Nie udało się zalogować.");
      const { error: setErr } = await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });
      if (setErr) throw setErr;
      // Sesja zyje juz w glownym kliencie; ta kopia z pomocniczego jest zbedna.
      await nativeClient().auth.signOut({ scope: "local" });
      closeBrowser();
      onDone(null);
    } catch (e) {
      closeBrowser();
      onDone(e instanceof Error ? e : new Error("Nie udało się zalogować."));
    }
  });
}

/** Linki https z maili i udostępnień, które otwierają aplikację zamiast przeglądarki (Android App Links). */
const APP_LINK_PATHS = ["/auth/confirm", "/k/"];

/**
 * Otwarcie aplikacji linkiem https nie przenosi widoku na jego adres (WebView zostaje tam, gdzie był),
 * więc nawigujemy sami - tylko w obrębie własnej domeny i tylko na dozwolone ścieżki.
 */
export function installAppLinkNavigation(): () => void {
  return onAppEvent<{ url: string }>("appUrlOpen", ({ url }) => {
    try {
      const u = new URL(url);
      if (u.origin !== window.location.origin) return;
      if (!APP_LINK_PATHS.some((p) => u.pathname.startsWith(p))) return;
      window.location.assign(u.pathname + u.search + u.hash);
    } catch {
      // nieczytelny adres - ignorujemy
    }
  });
}
