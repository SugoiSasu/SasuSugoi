import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { RankingBoard } from "@/components/ranking/RankingBoard";

/**
 * Ranking v2 - paczka designu "ranking" (2026-09-28). Cala logika w
 * src/lib/ranking.ts (testy) i RPC ranking_tablica; tu tylko stan w URL-u,
 * zeby widok (okres, metryka, zakres, szukanie) dalo sie podlinkowac.
 *
 * Dawny katalog profili z paginacja zniknal: wyszukiwarka rankingu siega
 * tez poza ranking ("Poza rankingiem"), wiec kazdy profil nadal da sie
 * znalezc po nicku.
 */
const searchSchema = z.object({
  q: fallback(z.string(), "").default(""),
  scope: fallback(z.enum(["all", "friends"]), "all").default("all"),
  okres: fallback(z.enum(["week", "month", "all"]), "month").default("month"),
  metryka: fallback(z.enum(["pts", "reviews", "badges"]), "pts").default("pts"),
});

export const Route = createFileRoute("/u/")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Ranking - poŻeramy" },
      {
        name: "description",
        content:
          "Ranking poŻeraczy - kto w tym tygodniu i miesiącu zebrał najwięcej punktów, recenzji i odznak w Poznaniu.",
      },
    ],
  }),
  component: Ranking,
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <main id="main-content" className="min-h-dvh grid place-items-center p-4">
        <div className="text-center">
          <p className="text-muted-foreground mb-3">Nie udało się załadować rankingu.</p>
          <p className="text-xs text-muted-foreground/70 mb-4">{error.message}</p>
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="chip bg-tomato text-cream"
          >
            Spróbuj ponownie
          </button>
        </div>
      </main>
    );
  },
});

type Search = z.infer<typeof searchSchema>;

function Ranking() {
  const { q, scope, okres, metryka } = Route.useSearch();
  const navigate = useNavigate({ from: "/u/" });
  return (
    <main id="main-content" className="min-h-dvh bg-background">
      <RankingBoard
        okres={okres}
        metryka={metryka}
        zakres={scope}
        q={q}
        onZmien={(patch) =>
          navigate({ search: (prev: Search) => ({ ...prev, ...patch }), replace: true, resetScroll: false })
        }
      />
    </main>
  );
}
