import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, PartyPopper } from "lucide-react";
import { useSwipeDeck, useSkipPlace } from "@/lib/swipe-api";
import { useToggleVisit } from "@/lib/visits-api";
import { SwipeCard } from "@/components/SwipeCard";
import { SwipeBurst } from "@/components/SwipeBurst";
import { YummyFace, NopeFace } from "@/components/SwipeFaces";
import type { Place } from "@/lib/places-api";

export const Route = createFileRoute("/_authenticated/karty")({
  head: () => ({
    meta: [
      { title: "Karty - poŻeramy" },
      {
        name: "description",
        content: "Przesuwaj karty knajp w prawo, żeby dodać je do „chcę odwiedzić”.",
      },
    ],
  }),
  component: KartyPage,
});

const VISIBLE_STACK = 3;

function KartyPage() {
  const { deck, isLoading } = useSwipeDeck();
  const toggleVisit = useToggleVisit();
  const skipPlace = useSkipPlace();
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [burst, setBurst] = useState<{ id: number; type: "like" | "nope" } | null>(null);

  const visible = deck.filter((p) => !hiddenIds.has(p.id));
  const stack = visible.slice(0, VISIBLE_STACK);
  const top = stack[0];

  function handleSwipe(direction: "left" | "right", place: Place) {
    setHiddenIds((prev) => new Set(prev).add(place.id));
    setBurst({ id: Date.now(), type: direction === "right" ? "like" : "nope" });
    if (direction === "right") {
      toggleVisit.mutate({ placeId: place.id, status: "want", on: true });
    } else {
      skipPlace.mutate(place.id);
    }
  }

  return (
    <main
      id="main-content"
      className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-10"
    >
      <div className="mx-auto w-full max-w-md text-center">
        <h1 className="font-display text-3xl font-extrabold sm:text-4xl">Karty</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Przesuń w prawo - trafi do „Chcę odwiedzić”. W lewo - pomiń, wróci za 5 dni.
        </p>

        <div className="relative mx-auto mt-6 aspect-[3/4] w-full max-w-[340px]">
          {isLoading ? (
            <div className="grid h-full place-items-center rounded-3xl border border-dashed border-border">
              <Loader2 className="animate-spin text-tomato" size={28} />
            </div>
          ) : stack.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-border px-6 text-center">
              <PartyPopper size={32} className="text-tomato" />
              <p className="font-display text-lg font-bold">To wszystkie karty na dziś!</p>
              <p className="text-sm text-muted-foreground">
                Pominięte knajpy wrócą do talii za kilka dni. Zajrzyj później po nowe propozycje.
              </p>
            </div>
          ) : (
            stack
              .slice()
              .reverse()
              .map((place, idxFromBack) => {
                const idxFromTop = stack.length - 1 - idxFromBack;
                return (
                  <div
                    key={place.id}
                    className="absolute inset-0"
                    style={{
                      transform:
                        idxFromTop === 0
                          ? undefined
                          : `translateY(${idxFromTop * 10}px) scale(${1 - idxFromTop * 0.04})`,
                      zIndex: 10 - idxFromTop,
                    }}
                  >
                    <SwipeCard
                      place={place}
                      isTop={idxFromTop === 0}
                      onSwipe={(dir) => handleSwipe(dir, place)}
                    />
                  </div>
                );
              })
          )}

          {burst && (
            <SwipeBurst
              key={burst.id}
              type={burst.type}
              onDone={() => setBurst((b) => (b?.id === burst.id ? null : b))}
            />
          )}
        </div>

        {top && (
          <div className="mt-6 flex items-center justify-center gap-6">
            <button
              type="button"
              aria-label="Pomiń"
              onClick={() => handleSwipe("left", top)}
              className="grid h-16 w-16 place-items-center rounded-full border-2 border-navy/15 bg-card shadow-md transition hover:-translate-y-0.5 hover:border-navy/40 hover:shadow-lg active:scale-95"
            >
              <NopeFace size={34} />
            </button>
            <button
              type="button"
              aria-label="Chcę odwiedzić"
              onClick={() => handleSwipe("right", top)}
              className="grid h-16 w-16 place-items-center rounded-full border-2 border-tomato/25 bg-card shadow-md transition hover:-translate-y-0.5 hover:border-tomato hover:shadow-lg active:scale-95"
            >
              <YummyFace size={34} />
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
