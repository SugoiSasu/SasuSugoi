// tanstackStart({ client: { entry: "./src/client.tsx" } }) is silently
// ignored by this framework version in both dev and prod builds (confirmed
// by bundling a unique marker string into the client-init file and finding
// it absent from the output either way) - initialize the client SDK here
// instead, guarded to browser-only so it never runs in the SSR bundle
// where server.ts already calls Sentry.init() itself.
//
// Filename deliberately does NOT match *.client.* (was instrument.client.ts)
// - TanStack Start's import-protection plugin denies importing any file
// matching that pattern from a module it considers part of the server
// bundle, and __root.tsx is compiled into both. This import existed
// unchanged for many prior successful builds, then started failing production
// builds 2026-08-25 (all builds after commit 2cd3871 - a change to this same
// file that never touched this line) - renaming sidesteps whatever bundler
// heuristic started flagging it rather than chasing why the flag flipped.
if (typeof document !== "undefined") {
  import("../sentry-client-init");

  // Every route nested under _authenticated (Karty, Notifications, Friends,
  // ...) throws an uncaught "InvalidStateError: Transition was aborted
  // because of invalid state" on load - TanStack Router's
  // defaultViewTransition wraps navigation in document.startViewTransition(),
  // and that layout route's own async auth check (beforeLoad) plus its
  // ssr:false mount path means the browser sometimes gets asked to start a
  // second transition before the first one settles, which the View
  // Transitions API rejects. Confirmed extensively this doesn't break
  // anything - Karty/Friends/Notifications all work correctly - it's just
  // Sentry/console noise from a benign, well-known API race.
  //
  // A sibling rejection - "AbortError: Transition was skipped" - fires from
  // the same document.startViewTransition() machinery whenever a navigation
  // supersedes a still-running transition (e.g. two nav clicks in quick
  // succession, anywhere in the app, not just _authenticated routes) - also
  // documented, benign browser behavior, not an app bug. Suppress only these
  // two known rejections so real errors still surface normally.
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    if (
      reason &&
      typeof reason === "object" &&
      typeof reason.message === "string" &&
      ((reason.name === "InvalidStateError" &&
        reason.message.includes("Transition was aborted")) ||
        (reason.name === "AbortError" && reason.message.includes("Transition was skipped")))
    ) {
      event.preventDefault();
    }
  });
}

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { readThemeCookies } from "@/lib/theme";
import { Home, MapPin } from "lucide-react";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import sadPizza404 from "@/assets/brand/sad-pizza-404.png";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { ScrollToTop } from "@/components/ScrollToTop";

import { installPolishStripper } from "@/lib/polish-stripper";
import { VisitEventListener } from "@/components/VisitStatus";
import { AuthAnalytics } from "@/components/AuthAnalytics";
import { AlphaGate } from "@/components/AlphaGate";
import { supabase } from "@/integrations/supabase/client";
import { SiteNav } from "@/components/SiteNav";
import { AppSidebar } from "@/components/AppSidebar";
import { BottomTabBar } from "@/components/BottomTabBar";

import { Toaster } from "@/components/ui/sonner";
import { CookieConsent } from "@/components/CookieConsent";
import { OnboardingTour } from "@/components/OnboardingTour";
import { PatchNotesModal } from "@/components/PatchNotesModal";
import { InAppBrowserBanner } from "@/components/InAppBrowserBanner";
import { BASE_URL } from "@/lib/site-config";

function NotFoundComponent() {
  return (
    <div className="relative flex min-h-dvh items-center overflow-hidden bg-navy px-5 py-16 text-cream sm:px-8 lg:py-24">
      <div className="bg-terrazzo-navy absolute inset-0 opacity-30" />

      <div className="relative z-10 mx-auto w-full max-w-6xl">
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.05fr]">
          <div className="order-2 text-center lg:order-1 lg:text-left">
            <span className="chip mb-6 inline-flex items-center gap-2 bg-cream/10 text-cream/80">
              <span className="h-2 w-2 rounded-full bg-tomato" />
              404
            </span>

            <h1 className="font-display text-[5.5rem] font-black leading-[0.9] tracking-tight text-cream sm:text-[7rem] lg:text-[8.5rem]">
              404
            </h1>

            <h2 className="font-display mt-4 text-3xl font-black uppercase leading-[0.95] text-cream sm:text-4xl lg:text-5xl">
              Tego lokalu <span className="text-tomato">nie poŻarliśmy.</span>
            </h2>

            <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-cream/80 sm:text-lg lg:mx-0">
              Wygląda na to, że ten lokal uciekł nam sprzed talerza albo jeszcze go nie odkryliśmy.
              Spróbuj sprawdzić adres lub wróć na główną i znajdź coś pysznego!
            </p>

            <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row lg:justify-start">
              <Link
                to="/"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-tomato px-6 py-3 text-sm font-semibold text-cream transition hover:scale-[1.02] hover:bg-tomato/90"
              >
                <Home size={18} />
                Wróć na stronę główną
              </Link>

              <Link
                to="/"
                hash="mapa"
                className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-cream/30 bg-transparent px-6 py-3 text-sm font-semibold text-cream transition hover:bg-cream/10"
              >
                <MapPin size={18} />
                Otwórz mapę
              </Link>
            </div>
          </div>

          <div className="order-1 mx-auto w-full max-w-xs sm:max-w-sm lg:order-2 lg:max-w-md">
            <div className="relative">
              <div className="blob absolute -left-6 top-1/4 h-24 w-24 bg-blush/25 blur-2xl" />
              <div className="blob absolute -right-4 bottom-1/4 h-28 w-28 bg-tomato/25 blur-2xl" />
              <img
                src={sadPizza404}
                alt="Smutna pizza - strona nie istnieje"
                className="relative z-10 w-full rounded-3xl drop-shadow-2xl"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

// Defined inline (not imported from AlphaGate.tsx) so the root loader's own
// chunk owns this call directly - a cross-file import here previously
// resolved to undefined at runtime (`fetchAlphaGateEnabled is not defined`),
// suspected to be a route-splitting interaction with this file's guarded
// dynamic `instrument.client` import above.
async function fetchAlphaGateEnabled(): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("alpha_gate_enabled");
    if (error) throw error;
    return Boolean(data);
  } catch {
    return false;
  }
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  // AlphaGate used to start every render in a client-only "loading" state -
  // fine for a logged-in browser, but it meant SSR shipped nothing but a
  // spinner to every crawler and link-preview bot, gate on or off. Routed
  // through TanStack Router's own loaderData (not react-query) so the value
  // is identical on the server's render and the client's first hydration
  // pass - going through queryClient.ensureQueryData looked equivalent but
  // wasn't: the client's fresh queryClient starts empty, so its first
  // render still saw "loading" while the server (with a warm cache) had
  // already rendered real children, a genuine hydration mismatch.
  loader: async () => ({ alphaGateEnabled: await fetchAlphaGateEnabled() }),
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "poŻeramy - Foodies App" },
      {
        name: "description",
        content:
          "Najlepsze restauracje w Poznaniu - mapa, oceny i rolki z Instagrama. Znajdź gdzie zjeść kebaba, ramen, śniadanie i więcej.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "theme-color", content: "#221e50" },
      { property: "og:title", content: "poŻeramy - Foodies App" },
      { name: "twitter:title", content: "poŻeramy - Foodies App" },
      {
        property: "og:description",
        content:
          "Najlepsze restauracje w Poznaniu - mapa, oceny i rolki z Instagrama. Znajdź gdzie zjeść kebaba, ramen, śniadanie i więcej.",
      },
      {
        name: "twitter:description",
        content:
          "Najlepsze restauracje w Poznaniu - mapa, oceny i rolki z Instagrama. Znajdź gdzie zjeść kebaba, ramen, śniadanie i więcej.",
      },
      {
        property: "og:image",
        content: `${BASE_URL}/brand/po_zeramy-logo-dark.png`,
      },
      {
        name: "twitter:image",
        content: `${BASE_URL}/brand/po_zeramy-logo-dark.png`,
      },
      // Two tokens, deliberately. The first belongs to whichever Google account
      // originally claimed the site; the second is sugoi.biznes@gmail.com, which is
      // the account that owns the OAuth app. Google's brand verification refuses to
      // show our name and logo on the sign-in screen until the account behind the
      // OAuth client can prove it owns the homepage, and removing either tag
      // un-verifies whoever it belongs to.
      { name: "google-site-verification", content: "otoVs-bqss54Ne6ibX-Y8ik3re9mnh-tGFJ-TQbA0Ac" },
      { name: "google-site-verification", content: "jFdXoxCFp47bXmfH86zDEKB7QoYxC1rsVpAhyoOd1Zs" },
    ],
    links: [
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "icon", href: "/favicon.ico", sizes: "any" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,500;12..96,600;12..96,700;12..96,800&family=Fraunces:wght@400;600;700;900&family=Manrope:wght@400;500;600;700&display=swap",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
    scripts: [
      {
        // Applies the saved theme before the first paint - without it the page
        // renders light and flips once React hydrates, which is worse than having
        // no dark theme at all.
        //
        // It also writes the RESOLVED value back, because "system" is only knowable
        // in the browser and the server has to render the same class on <html> or
        // React reports a hydration mismatch it explicitly will not reconcile. So a
        // brand-new visitor on a dark OS gets one mismatched load; from the second
        // request on, the server already knows. Same cookie names and same rules as
        // src/lib/theme.ts - if one changes, both must.
        children: `(function(){try{var g=function(n){var m=document.cookie.match(new RegExp('(?:^|; )'+n+'=([^;]*)'));return m?decodeURIComponent(m[1]):null;};var c=g('pz-theme');var d=c==='dark'||((!c||c==='system')&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);var v=d?'dark':'light';if(g('pz-theme-resolved')!==v){document.cookie='pz-theme-resolved='+v+'; path=/; max-age=31536000; samesite=lax';}}catch(e){}})();`,
      },
      {
        // Google Consent Mode v2 - ustaw defaulty PRZED jakimikolwiek tagami reklamowo-analitycznymi.
        // Skrypt gtag.js jest ładowany dynamicznie z src/lib/analytics.ts dopiero po zgodzie na analytics_storage.
        children: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',functionality_storage:'granted',security_storage:'granted',wait_for_update:500});`,
      },

      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              "@id": "https://pozeramy.live/#organization",
              name: "poŻeramy",
              url: "https://pozeramy.live",
              logo: "https://pozeramy.live/favicon.ico",
              sameAs: ["https://instagram.com/po_zeramy"],
            },
            {
              "@type": "WebSite",
              "@id": "https://pozeramy.live/#website",
              url: "https://pozeramy.live",
              name: "poŻeramy",
              description: "Foodies App - mapa, recenzje i rolki najlepszych miejscówek.",
              publisher: { "@id": "https://pozeramy.live/#organization" },
              inLanguage: "pl-PL",
            },
          ],
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  // The resolved theme travels in a cookie so the server can render the same
  // class the boot script already applied - see src/lib/theme.ts.
  const { resolved: theme } = readThemeCookies();
  return (
    // The boot script in the route's `scripts` stamps class="dark" and the
    // color-scheme onto this element before React runs, so the server markup and
    // the live DOM deliberately differ here. Without this, React warns on every
    // load and - by its own message - does not reconcile the attributes at all.
    // Rendered from the cookie so it matches exactly what the boot script has
    // already put on the element - see readResolvedTheme above.
    <html lang="pl" className={theme === "dark" ? "dark" : undefined}>
      <head>
        <HeadContent />
      </head>
      <body>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-md focus:bg-navy focus:text-cream focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:shadow-lg"
        >
          Przejdź do treści
        </a>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const { alphaGateEnabled } = Route.useLoaderData();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isAdmin = pathname.startsWith("/admin");
  const isAuth =
    pathname.startsWith("/auth") ||
    pathname.startsWith("/zaproszenie") ||
    pathname.startsWith("/i/");
  const showShell = !isAdmin && !isAuth;

  useEffect(() => {
    installPolishStripper();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <InAppBrowserBanner />
      <AlphaGate enabled={alphaGateEnabled}>
        {showShell ? (
          <div className="min-h-dvh lg:pl-[236px]">
            <AppSidebar />
            <div className="lg:hidden">
              <SiteNav />
            </div>

            {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
            <div className="pz-route-view pb-20 lg:pb-0">
              <Outlet />
            </div>
            <BottomTabBar />
          </div>
        ) : (
          <Outlet />
        )}
        <VisitEventListener />
        <AuthAnalytics />
        {!isAdmin && <ScrollToTop />}
      </AlphaGate>
      <Toaster position="top-right" closeButton />
      <CookieConsent />
      {showShell && <OnboardingTour />}
      {showShell && <PatchNotesModal />}
    </QueryClientProvider>
  );
}
