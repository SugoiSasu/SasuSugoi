import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, PartyPopper, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { useSwipeDeck, useSkipPlace, useUnskipPlace } from "@/lib/swipe-api";
import { useToggleVisit } from "@/lib/visits-api";
import { usePlaceRatingsMap } from "@/lib/places-api";
import { useFriendFavoriteCounts } from "@/lib/favorites-api";
import { pluralPl } from "@/lib/plural-pl";
import { trackEvent } from "@/lib/analytics";
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
  const unskipPlace = useUnskipPlace();
  // Both of these are already fetched for the map and the homepage, so putting
  // them on the card costs no extra request.
  const { data: ratings } = usePlaceRatingsMap();
  const { data: friendCounts } = useFriendFavoriteCounts();
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [burst, setBurst] = useState<{ id: number; type: "like" | "nope" } | null>(null);
  // Every decision is reversible, so each one is remembered with the direction it
  // went. Newest last. A skip used to exile a place for the full five-day cooldown
  // with no way back, which made a mis-swipe genuinely costly.
  const [history, setHistory] = useState<{ place: Place; direction: "left" | "right" }[]>([]);

  const visible = deck.filter((p) => !hiddenIds.has(p.id));
  const stack = visible.slice(0, VISIBLE_STACK);
  const top = stack[0];

  // Fires the instant a drag passes the threshold - guarantees the write
  // happens even if the user navigates away from /karty before the
  // ~700ms fly-away animation below finishes. That animation's promise
  // gates onSwipeEnd, not this: a component unmount mid-animation (a fast
  // route change, or a backgrounded/throttled tab) can silently kill an
  // in-flight animation's .then() callback, which is where this used to
  // live - confirmed live that a swipe followed by an immediate navigate
  // away dropped the write entirely with this in the animation callback.
  function handleSwipeCommit(direction: "left" | "right", place: Place) {
    if (direction === "right") {
      toggleVisit.mutate(
        { placeId: place.id, status: "want", on: true },
        {
          onSuccess: () =>
            toast.success(`Dodano „${place.name}" do „Chcę odwiedzić"`, {
              description: "Znajdziesz to w Moje miejsca.",
            }),
          onError: (err) => toast.error(err instanceof Error ? err.message : "Nie udało się dodać"),
        },
      );
    } else {
      trackEvent("karty_skip", { item_id: place.id });
      skipPlace.mutate(place.id);
    }
  }

  // Fires after the fly-away animation completes - purely visual
  // bookkeeping (remove the card from the stack, show the emoji burst).
  function handleSwipeEnd(direction: "left" | "right", place: Place) {
    setHiddenIds((prev) => new Set(prev).add(place.id));
    setBurst({ id: Date.now(), type: direction === "right" ? "like" : "nope" });
    setHistory((prev) => [...prev, { place, direction }]);
  }

  // Buttons and keys both take the same path a completed drag does, so a decision
  // is written and recorded identically however it was made.
  function decide(direction: "left" | "right", place: Place) {
    handleSwipeCommit(direction, place);
    handleSwipeEnd(direction, place);
  }

  // The mutation and the toast stay OUT of the setState updater: React calls those
  // twice under StrictMode, which would fire the write and the toast twice each.
  const undoLast = useCallback(() => {
    const last = history[history.length - 1];
    if (!last) return;
    // A failed reversal must not look like a successful one: the card would come
    // back on screen while the row that hides it is still in the database, and it
    // would vanish again on the next refetch with no explanation.
    const onError = (err: unknown) => {
      setHiddenIds((ids) => new Set(ids).add(last.place.id));
      setHistory((prev) => [...prev, last]);
      toast.error(err instanceof Error ? err.message : "Nie udało się cofnąć");
    };
    if (last.direction === "right") {
      toggleVisit.mutate({ placeId: last.place.id, status: "want", on: false }, { onError });
    } else {
      unskipPlace.mutate(last.place.id, { onError });
    }
    setHiddenIds((ids) => {
      const next = new Set(ids);
      next.delete(last.place.id);
      return next;
    });
    setHistory((prev) => prev.slice(0, -1));
    toast(`Cofnięto: ${last.place.name}`);
  }, [history, toggleVisit, unskipPlace]);

  // Arrow keys on desktop. The deck was mouse-drag only, which left it unusable
  // for anyone navigating by keyboard even though the two buttons underneath do
  // exactly the same thing.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = document.activeElement;
      if (el instanceof HTMLElement && ["INPUT", "TEXTAREA"].includes(el.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowRight" && top) {
        e.preventDefault();
        decide("right", top);
      } else if (e.key === "ArrowLeft" && top) {
        e.preventDefault();
        decide("left", top);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <main
      id="main-content"
      className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-10"
    >
      <div className="mx-auto w-full max-w-md text-center">
        <h1 className="font-display text-3xl font-extrabold sm:text-4xl">Karty 🎴</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Przesuń w prawo - trafi do „Chcę odwiedzić”. W lewo - pomiń, wróci za 5 dni.
        </p>
        {!isLoading && visible.length > 0 && (
          <p className="mt-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            {visible.length}{" "}
            {pluralPl(visible.length, "karta", "karty", "kart")} do przejrzenia
          </p>
        )}

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
                      rating={ratings?.get(place.id)}
                      friendCount={friendCounts?.get(place.id) ?? 0}
                      onSwipeCommit={(dir) => handleSwipeCommit(dir, place)}
                      onSwipe={(dir) => handleSwipeEnd(dir, place)}
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
              onClick={() => decide("left", top)}
              className="grid h-16 w-16 place-items-center rounded-full border-2 border-navy/15 bg-card shadow-md transition hover:-translate-y-0.5 hover:border-navy/40 hover:shadow-lg active:scale-95"
            >
              <NopeFace size={34} />
            </button>
            <button
              type="button"
              aria-label="Cofnij ostatnią decyzję"
              onClick={undoLast}
              disabled={history.length === 0}
              className="grid h-12 w-12 place-items-center rounded-full border-2 border-navy/15 bg-card text-navy/70 shadow-sm transition hover:-translate-y-0.5 hover:border-navy/40 hover:text-navy hover:shadow-md active:scale-95 disabled:pointer-events-none disabled:opacity-30"
            >
              <Undo2 size={20} />
            </button>
            <button
              type="button"
              aria-label="Chcę odwiedzić"
              onClick={() => decide("right", top)}
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
