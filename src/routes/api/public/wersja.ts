import { createFileRoute } from "@tanstack/react-router";

/**
 * Wersja aktualnego deployu. Klient porownuje ja ze swoim __PZ_WERSJA__ po
 * powrocie do aplikacji (useNowaWersja) - rozne = na serwerze jest nowszy
 * build niz ten, ktory telefon trzyma w pamieci.
 */
export const Route = createFileRoute("/api/public/wersja")({
  server: {
    handlers: {
      GET: async () =>
        new Response(JSON.stringify({ wersja: __PZ_WERSJA__ }), {
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        }),
    },
  },
});
