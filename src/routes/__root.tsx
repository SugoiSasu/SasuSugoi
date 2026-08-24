// tanstackStart({ client: { entry: "./src/client.tsx" } }) is silently
// ignored by this framework version in both dev and prod builds (confirmed
// by bundling a unique marker string into src/instrument.client.ts and
// finding it absent from the output either way) - initialize the client
// SDK here instead, guarded to browser-only so it never runs in the SSR
// bundle where server.ts already calls Sentry.init() itself.
if (typeof document !== "undefined") {
  import("../instrument.client");
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
import { Home, MapPin } from "lucide-react";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import sadPizza404 from "@/assets/brand/sad-pizza-404.png";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { ScrollToTop } from "@/components/ScrollToTop";

import { installPolishStripper } from "@/lib/polish-stripper";
import { VisitEventListener } from "@/components/VisitStatus";
import { AlphaGate } from "@/components/AlphaGate";
import { SiteNav } from "@/components/SiteNav";
import { AppSidebar } from "@/components/AppSidebar";
import { BottomTabBar } from "@/components/BottomTabBar";

import { Toaster } from "@/components/ui/sonner";
import { CookieConsent } from "@/components/CookieConsent";
import { OnboardingTour } from "@/components/OnboardingTour";
import { PatchNotesModal } from "@/components/PatchNotesModal";
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

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
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
      { name: "google-site-verification", content: "otoVs-bqss54Ne6ibX-Y8ik3re9mnh-tGFJ-TQbA0Ac" },
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
  return (
    <html lang="pl">
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
      <AlphaGate>
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
        {!isAdmin && <ScrollToTop />}
      </AlphaGate>
      <Toaster position="top-right" closeButton />
      <CookieConsent />
      {showShell && <OnboardingTour />}
      {showShell && <PatchNotesModal />}
    </QueryClientProvider>
  );
}
