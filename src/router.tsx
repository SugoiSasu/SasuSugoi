import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultViewTransition: true,
    defaultPreloadStaleTime: 0,
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
