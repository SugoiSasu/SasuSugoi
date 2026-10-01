import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  // Domyslne ustawienia cache: bez nich kazda zmiana karty przegladarki i kazde
  // wejscie na strone odpytywalo baze od nowa (staleTime 0 + refetchOnWindowFocus).
  // 30 s swiezosci wystarcza dla wiekszosci danych; zapytania, ktore musza byc
  // swiezsze (powiadomienia, wall), ustawiaja wlasny staleTime/refetchInterval.
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 10 * 60_000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultViewTransition: true,
    // Preladowanie trasy po najechaniu/dotknieciu linku: nastepna strona jest
    // gotowa zanim klikniesz. Wynik loadera zyje 30 s, wiec nie odpytuje bazy dwa razy.
    defaultPreload: "intent",
    defaultPreloadStaleTime: 30_000,
  });

  // Without this, a route loader's queryClient.ensureQueryData(...) only
  // ever warms the SERVER's queryClient - the client hydrates with a fresh,
  // empty one, so any component reading that query (e.g. usePlaces()) starts
  // "loading" on the client while the server already rendered real data,
  // a genuine hydration mismatch. This wires up react-query's own
  // dehydrate/hydrate boundary through the router so both sides agree.
  setupRouterSsrQueryIntegration({ router, queryClient });

  return router;
};
