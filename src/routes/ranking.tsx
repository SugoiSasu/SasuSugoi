import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Ranking mieszka pod /u (menu prowadzi tam), ale ludzie wpisują /ranking - dotąd kończyło się 404.
 * Przekierowanie zostawia też stare linki z udostępnień.
 */
export const Route = createFileRoute("/ranking")({
  beforeLoad: () => {
    throw redirect({ to: "/u", replace: true });
  },
});
