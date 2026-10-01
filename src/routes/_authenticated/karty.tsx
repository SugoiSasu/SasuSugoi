import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Heart, Loader2, MapPin, PartyPopper, RotateCcw, Shuffle, Star, Undo2, X } from "lucide-react";
import { toast } from "sonner";
import { useSwipeDeck, useSkipPlace, useUnskipPlace, useResetSkips, useSkippedPlaceIds } from "@/lib/swipe-api";
import { useToggleVisit, useFriendVisitedCounts } from "@/lib/visits-api";
import { usePlaceRatingsMap } from "@/lib/places-api";
import { useFriendFavoriteCounts, useToggleFavorite } from "@/lib/favorites-api";
import { useFriendRecommendCounts } from "@/lib/reviews-api";
import { useMyProfile } from "@/lib/profile-api";
import { useProponujWyjscie, useZnajomiChcacy, imieZnajomego, type ZnajomyLite } from "@/lib/karty-api";
import {
  PROMIENIE_KM,
  etykietaPromienia,
  odlegloscKm,
  type PromienKm,
} from "@/lib/karty-utils";
import type { LatLng } from "@/lib/geo";
import type { FriendSignal, SwipeDirection } from "@/components/SwipeCard";
import { pluralPl } from "@/lib/plural-pl";
import { trackEvent } from "@/lib/analytics";
import { SwipeCard } from "@/components/SwipeCard";
import { DecisionsList, SwipeHistoryRail, type SwipeDecision, type SwipeDecisionType } from "@/components/SwipeHistoryRail";
import { SwipeBurst } from "@/components/SwipeBurst";
import { UserAvatar } from "@/components/UserAvatar";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { Place } from "@/lib/places-api";
import { cuisineMeta } from "@/data/places";

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
const DIR_TO_TYPE: Record<SwipeDirection, SwipeDecisionType> = { right: "want", left: "skip", up: "fav" };

type Lokalizacja = { stan: "brak" | "czeka" | "odmowa" | "ok"; loc: LatLng | null };

/**
 * Lokalizacja na żądanie: nie pytamy przy wejściu na Karty, tylko gdy ktoś
 * otworzy filtr obszaru. Jeśli zgoda była już udzielona wcześniej, bierzemy
 * pozycję po cichu, żeby filtr działał od razu.
 */
function useLokalizacjaNaZadanie() {
  const [s, setS] = useState<Lokalizacja>({ stan: "brak", loc: null });
  const popros = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setS({ stan: "odmowa", loc: null });
      return;
    }
    setS((p) => ({ ...p, stan: "czeka" }));
    navigator.geolocation.getCurrentPosition(
      (pos) => setS({ stan: "ok", loc: { lat: pos.coords.latitude, lng: pos.coords.longitude } }),
      () => setS({ stan: "odmowa", loc: null }),
      { timeout: 8000, maximumAge: 300000 },
    );
  }, []);
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.permissions?.query) return;
    let anulowano = false;
    navigator.permissions
      .query({ name: "geolocation" as PermissionName })
      .then((r) => {
        if (!anulowano && r.state === "granted") popros();
      })
      .catch(() => {});
    return () => {
      anulowano = true;
    };
  }, [popros]);
  return { ...s, popros };
}

function WyborPromienia({
  promien,
  onChange,
  maLokalizacje,
  tlo = "bg-foreground/5",
}: {
  promien: PromienKm;
  onChange: (r: PromienKm) => void;
  maLokalizacje: boolean;
  tlo?: string;
}) {
  return (
    <div className={`flex gap-0.5 rounded-2xl p-1 ${tlo}`} role="group" aria-label="Obszar od Ciebie">
      {PROMIENIE_KM.map((r) => {
        const wybrany = promien === r;
        const wylaczony = r !== 0 && !maLokalizacje;
        return (
          <button
            key={r}
            type="button"
            disabled={wylaczony}
            aria-pressed={wybrany}
            onClick={() => onChange(r)}
            className={`flex-1 whitespace-nowrap rounded-xl px-2 py-2.5 text-[12.5px] font-extrabold transition disabled:opacity-40 ${
              wybrany ? "bg-navy text-cream" : "text-foreground/65 hover:text-foreground"
            }`}
          >
            {etykietaPromienia(r)}
          </button>
        );
      })}
    </div>
  );
}

function KartyPage() {
  const [kolejnosc, setKolejnosc] = useState(0);
  const { deck, isLoading } = useSwipeDeck(kolejnosc);
  const toggleVisit = useToggleVisit();
  const toggleFavorite = useToggleFavorite();
  const skipPlace = useSkipPlace();
  const unskipPlace = useUnskipPlace();
  const resetSkips = useResetSkips();
  const proponuj = useProponujWyjscie();
  const { data: skippedIds } = useSkippedPlaceIds();
  const { data: profil } = useMyProfile();
  // All of these are already fetched elsewhere in the app (map, homepage, profile),
  // so putting them on the card costs no extra request.
  const { data: ratings } = usePlaceRatingsMap();
  const { data: friendWantCounts } = useFriendFavoriteCounts();
  const { data: friendVisitedCounts } = useFriendVisitedCounts();
  const { data: friendRecommendCounts } = useFriendRecommendCounts();
  const { data: znajomiChca } = useZnajomiChcacy();
  const lok = useLokalizacjaNaZadanie();

  // One badge, not three: a friend's opinion ("poleca") is stronger proof than
  // just having gone, which in turn says more than only having saved it -
  // showing all three at once was tried and read as clutter, so the card shows
  // whichever is true.
  function topFriendSignal(placeId: string): FriendSignal {
    const recommend = friendRecommendCounts?.get(placeId) ?? 0;
    if (recommend > 0) return { kind: "recommend", count: recommend };
    const visited = friendVisitedCounts?.get(placeId) ?? 0;
    if (visited > 0) return { kind: "visited", count: visited };
    const want = friendWantCounts?.get(placeId) ?? 0;
    if (want > 0) return { kind: "want", count: want };
    return null;
  }

  const [promien, setPromien] = useState<PromienKm>(0);
  const [arkusz, setArkusz] = useState<"filtry" | "decyzje" | null>(null);
  const [rozwinieteId, setRozwinieteId] = useState<string | null>(null);
  const [match, setMatch] = useState<{ place: Place; znajomi: ZnajomyLite[] } | null>(null);
  const [propozycja, setPropozycja] = useState<"brak" | "wyslana">("brak");
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [burst, setBurst] = useState<{ id: number; type: "like" | "nope" } | null>(null);
  // Every decision is reversible, so each one is remembered with what it was.
  // Newest last. A skip used to exile a place for the full five-day cooldown
  // with no way back, which made a mis-swipe genuinely costly.
  const [history, setHistory] = useState<SwipeDecision[]>([]);

  // Odleglosc liczona tylko gdy mamy lokalizacje; bez niej filtr obszaru sie nie stosuje.
  const odleglosci = useMemo(() => {
    const m = new Map<string, number>();
    if (!lok.loc) return m;
    for (const p of deck) m.set(p.id, odlegloscKm(p, lok.loc));
    return m;
  }, [deck, lok.loc]);
  const promienAktywny = promien !== 0 && !!lok.loc;

  // Karty w trakcie odlotu po przeciagnieciu. Zapis decyzji (i optymistyczna
  // aktualizacja talii) dzieje sie od razu, wiec bez tej listy karta znikalaby z
  // ekranu w tej samej chwili, a razem z nia animacja i cala reszta (historia,
  // konfetti, ekran matcha). Lista trzyma ja na wierzchu do konca animacji.
  const [exiting, setExiting] = useState<Place[]>([]);
  const exitingRef = useRef<Set<string>>(new Set());

  const visible = useMemo(
    () =>
      deck.filter(
        (p) =>
          !hiddenIds.has(p.id) &&
          !exitingRef.current.has(p.id) &&
          (!promienAktywny || (odleglosci.get(p.id) ?? Infinity) <= promien),
      ),
    // exiting w zaleznosciach: ref sam nie wywoluje przeliczenia.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [deck, hiddenIds, promienAktywny, odleglosci, promien, exiting],
  );
  const stack = [...exiting, ...visible].slice(0, VISIBLE_STACK);
  // Do przyciskow i klawiszy liczy sie pierwsza karta, ktora nie odlatuje.
  const top = visible[0];

  // A drag-commit and the visual "remove from stack" that follows it are
  // separated by the fly-away animation - `top` still points at the same place
  // for that whole window. SwipeCard's own internal guard only stops a second
  // onDragEnd on the SAME gesture; it does nothing for the buttons or arrow
  // keys below, which call decide() directly and would otherwise double-fire
  // the mutation on that place if pressed during the window. This ref closes
  // that gap for every path, not just re-dragging.
  const pendingCommitRef = useRef<string | null>(null);

  // Fires the instant a drag passes the threshold - guarantees the write
  // happens even if the user navigates away from /karty before the fly-away
  // animation finishes (an unmount mid-animation can silently drop its
  // .then() callback - confirmed live, the write used to be lost that way).
  function handleSwipeCommit(type: SwipeDecisionType, place: Place) {
    if (type === "want") {
      trackEvent("karty_want", { item_id: place.id, cuisine: place.cuisine });
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
    } else if (type === "fav") {
      trackEvent("karty_fav", { item_id: place.id, cuisine: place.cuisine });
      toggleFavorite.mutate(
        { placeId: place.id, on: true },
        {
          onSuccess: () =>
            toast.success(`Dodano „${place.name}" do ulubionych`, {
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
  // bookkeeping (remove the card from the stack, burst, match screen).
  function handleSwipeEnd(type: SwipeDecisionType, place: Place) {
    // Jedno zakonczenie na kartę: animacja i awaryjny timer nie mogą go
    // zrobić dwa razy (podwójny wpis w historii, dwa ekrany matcha).
    if (!exitingRef.current.delete(place.id)) return;
    setExiting((prev) => prev.filter((p) => p.id !== place.id));
    setHiddenIds((prev) => new Set(prev).add(place.id));
    setBurst({ id: Date.now(), type: type === "skip" ? "nope" : "like" });
    setHistory((prev) => [...prev, { place, type }]);
    setRozwinieteId(null);
    if (pendingCommitRef.current === place.id) pendingCommitRef.current = null;
    // "Match": ktos z Twoich znajomych tez chce tu isc.
    const znajomi = znajomiChca?.get(place.id) ?? [];
    if (type !== "skip" && znajomi.length > 0) {
      setPropozycja("brak");
      setTimeout(() => setMatch({ place, znajomi }), 380);
    }
  }

  // Buttons and keys take the same path a completed drag does, so a decision is
  // written and recorded identically however it was made.
  function decide(type: SwipeDecisionType, place: Place) {
    if (pendingCommitRef.current === place.id) return;
    pendingCommitRef.current = place.id;
    exitingRef.current.add(place.id);
    handleSwipeCommit(type, place);
    handleSwipeEnd(type, place);
  }

  // Przeciagniecie: zapis od razu, karta odlatuje, reszta po animacji.
  function decideByDrag(type: SwipeDecisionType, place: Place) {
    pendingCommitRef.current = place.id;
    exitingRef.current.add(place.id);
    setExiting((prev) => (prev.some((p) => p.id === place.id) ? prev : [...prev, place]));
    handleSwipeCommit(type, place);
    // Awaryjnie: gdyby animacja nie zakonczyla sie (karta odmontowana, karta w
    // tle), i tak zamykamy decyzje.
    setTimeout(() => handleSwipeEnd(type, place), 1600);
  }

  // The mutation and the toast stay OUT of the setState updater: React calls those
  // twice under StrictMode, which would fire the write and the toast twice each.
  const undo = useCallback(
    (placeId: string) => {
      const entry = history.find((h) => h.place.id === placeId);
      if (!entry) return;
      // A failed reversal must not look like a successful one: the card would come
      // back on screen while the row that hides it is still in the database.
      const onError = (err: unknown) => {
        setHiddenIds((ids) => new Set(ids).add(entry.place.id));
        setHistory((prev) => [...prev, entry]);
        toast.error(err instanceof Error ? err.message : "Nie udało się cofnąć");
      };
      if (entry.type === "want") {
        toggleVisit.mutate({ placeId, status: "want", on: false }, { onError });
      } else if (entry.type === "fav") {
        toggleFavorite.mutate({ placeId, on: false }, { onError });
      } else {
        unskipPlace.mutate(placeId, { onError });
      }
      setHiddenIds((ids) => {
        const next = new Set(ids);
        next.delete(placeId);
        return next;
      });
      setHistory((prev) => prev.filter((h) => h.place.id !== placeId));
      setMatch(null);
      toast(`Cofnięto: ${entry.place.name}`);
    },
    [history, toggleVisit, toggleFavorite, unskipPlace],
  );
  const undoLast = useCallback(() => {
    const last = history[history.length - 1];
    if (last) undo(last.place.id);
  }, [history, undo]);

  // Undo walks back one decision at a time. This is the other end of the same
  // problem: the deck runs dry and everything you passed on is locked behind a
  // five-day cooldown with no way to look again.
  const skippedCount = skippedIds?.size ?? 0;
  function resetDeck() {
    resetSkips.mutate(undefined, {
      onSuccess: (count) => {
        // The local hide-set and the undo stack both describe the run that just
        // ended. Leaving them would keep the returning cards invisible.
        setHiddenIds(new Set());
        setHistory([]);
        setArkusz(null);
        toast.success(
          `Wróciło ${count} ${pluralPl(count, "pominięta karta", "pominięte karty", "pominiętych kart")}`,
        );
      },
      onError: (err) =>
        toast.error(err instanceof Error ? err.message : "Nie udało się zresetować kart"),
    });
  }

  function wyslijPropozycje() {
    if (!match) return;
    proponuj.mutate(match.place.id, {
      onSuccess: () => {
        setPropozycja("wyslana");
        trackEvent("karty_propose_outing", { item_id: match.place.id });
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : "Nie udało się wysłać propozycji"),
    });
  }

  // Arrow keys on desktop; up = ulubione, Z / Backspace = cofnij, spacja = rozwiń.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = document.activeElement;
      if (el instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (arkusz || match) return;
      if (e.key === "ArrowRight" && top) {
        e.preventDefault();
        decide("want", top);
      } else if (e.key === "ArrowLeft" && top) {
        e.preventDefault();
        decide("skip", top);
      } else if (e.key === "ArrowUp" && top) {
        e.preventDefault();
        decide("fav", top);
      } else if (e.key === "z" || e.key === "Z") {
        undoLast();
      } else if (e.key === " " && top && !(el instanceof HTMLElement && ["BUTTON", "A"].includes(el.tagName))) {
        e.preventDefault();
        setRozwinieteId((id) => (id === top.id ? null : top.id));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // decide() bierze swieze wartosci z domkniecia; efekt odswieza sie razem z top.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [top, arkusz, match, undoLast]);

  useEffect(() => {
    if (!match) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMatch(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [match]);

  const zrobione = history.length;
  const razem = zrobione + visible.length;
  const pasek = razem > 0 ? Math.round((zrobione / razem) * 100) : 0;
  const etykietaKart = `${visible.length} ${pluralPl(visible.length, "karta", "karty", "kart")} do przejrzenia`;
  const filtrAktywny = promienAktywny;

  const radiusChange = (r: PromienKm) => {
    setPromien(r);
    setRozwinieteId(null);
  };

  return (
    <main
      id="main-content"
      className="flex min-h-dvh flex-col items-center bg-background px-4 pb-6 pt-4 lg:justify-center lg:py-10"
    >
      <div className="flex w-full items-start justify-center gap-10">
        <div className="w-full max-w-md lg:max-w-lg">
          {/* Nagłówek: tytuł po lewej, po prawej mały filtr i decyzje (telefon). Na
              komputerze tytuł jest wyśrodkowany, a decyzje stoją w panelu obok. */}
          <div className="flex items-center justify-between gap-3 lg:flex-col lg:gap-1 lg:text-center">
            <div className="min-w-0">
              <h1 className="font-display text-2xl font-extrabold leading-none sm:text-3xl lg:text-4xl">
                Karty 🎴
              </h1>
              {!isLoading && (
                <p className="mt-1 whitespace-nowrap text-[11px] font-bold uppercase tracking-wide text-muted-foreground lg:mt-2 lg:text-xs [@media(max-height:620px)]:hidden lg:[@media(max-height:620px)]:block">
                  {etykietaKart}
                </p>
              )}
            </div>
            <div className="flex shrink-0 gap-1.5 lg:hidden">
              <button
                type="button"
                onClick={() => setArkusz("filtry")}
                className="inline-flex h-10 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-extrabold"
              >
                <MapPin size={13} aria-hidden="true" />
                {filtrAktywny ? etykietaPromienia(promien) : "Miasto"}
              </button>
              <button
                type="button"
                onClick={() => setArkusz("decyzje")}
                className="inline-flex h-10 items-center gap-2 rounded-full bg-navy px-3 text-xs font-extrabold text-cream"
              >
                Decyzje
                <span className="rounded-full bg-tomato px-1.5 text-[10.5px] leading-[17px]">{history.length}</span>
              </button>
            </div>
          </div>

          <p className="mt-2 hidden text-center text-sm text-muted-foreground lg:block">
            Przesuń w prawo - „Chcę odwiedzić”. W lewo - pomiń, wróci za 5 dni. W górę - do ulubionych.
          </p>

          {/* Komputer: obszar od razu pod tytułem, bez arkusza. */}
          <div className="mt-3 hidden items-center justify-center gap-2.5 lg:flex">
            <span className="text-[11px] font-extrabold tracking-[0.1em] text-muted-foreground">OBSZAR OD CIEBIE</span>
            {lok.loc ? (
              <WyborPromienia promien={promien} onChange={radiusChange} maLokalizacje tlo="bg-card" />
            ) : (
              <button
                type="button"
                onClick={lok.popros}
                disabled={lok.stan === "czeka"}
                className="rounded-full border border-border bg-card px-3.5 py-2 text-xs font-extrabold disabled:opacity-60"
              >
                {lok.stan === "czeka"
                  ? "Ustalam lokalizację…"
                  : lok.stan === "odmowa"
                    ? "Lokalizacja zablokowana"
                    : "Włącz lokalizację"}
              </button>
            )}
            <button
              type="button"
              onClick={() => setKolejnosc((k) => k + 1)}
              title="Wylosuj nową kolejność"
              aria-label="Wylosuj nową kolejność"
              className="grid h-9 w-9 place-items-center rounded-full border border-border bg-card"
            >
              <Shuffle size={15} />
            </button>
          </div>

          <div className="mt-2.5 flex items-center gap-2.5 lg:mt-3">
            <span className="hidden whitespace-nowrap text-[11px] font-extrabold tracking-wide text-muted-foreground lg:block">
              {razem > 0 ? `${Math.min(zrobione + 1, razem)} z ${razem}` : "0 z 0"}
            </span>
            <div
              className="h-1 flex-1 overflow-hidden rounded-full bg-foreground/10 lg:h-1.5"
              role="progressbar"
              aria-label="Postęp przeglądania kart"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={pasek}
            >
              <div className="h-full rounded-full bg-tomato transition-[width] duration-300" style={{ width: `${pasek}%` }} />
            </div>
          </div>

          {/* Wysokosc karty z wysokosci okna na KAZDYM rozmiarze, szerokosc z
              proporcji (4:5 na telefonie, 3:4 od sm). Zmierzone 2026-09-28: iPhone SE (320x548, 375x553)
              mial przyciski ~60 px pod dolnym menu, laptop 1280x800 - 29 px pod
              krawedzia okna. Budzety: telefon = naglowek strony, tytul, przyciski
              i dolne menu; niski ekran bez instrukcji; desktop bez dolnego menu,
              ale z paddingiem strony. */}
          <div className="relative mx-auto mt-3 aspect-[4/5] h-[clamp(15rem,calc(100dvh-18.5rem),28.5rem)] max-w-full sm:mt-5 sm:aspect-[3/4] md:h-[clamp(20rem,calc(100dvh-26rem),36.5rem)] lg:h-[clamp(22rem,calc(100dvh-24rem),36.5rem)] [@media(max-height:620px)]:h-[clamp(13rem,calc(100dvh-18.5rem),28.5rem)]">
            {isLoading ? (
              <div className="grid h-full place-items-center rounded-3xl border border-dashed border-border">
                <Loader2 className="animate-spin text-tomato" size={28} />
              </div>
            ) : stack.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-border bg-card/60 px-6 text-center">
                <span className="grid h-16 w-16 place-items-center rounded-full bg-blush text-navy">
                  <PartyPopper size={28} aria-hidden="true" />
                </span>
                <p className="font-display text-xl font-extrabold">Talia przejrzana</p>
                <p className="text-sm text-muted-foreground">
                  {filtrAktywny
                    ? `W promieniu ${promien} km nic już nie zostało. Poszerz obszar albo wróć do całego miasta.`
                    : zrobione > 0
                      ? `Zdecydowałeś o ${zrobione} ${pluralPl(zrobione, "miejscu", "miejscach", "miejscach")}. Pominięte wrócą za 5 dni.`
                      : "Zajrzyj później po nowe propozycje."}
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {skippedCount > 0 && (
                    <button
                      type="button"
                      onClick={resetDeck}
                      disabled={resetSkips.isPending}
                      className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:-translate-y-0.5 disabled:opacity-50"
                    >
                      <RotateCcw size={16} aria-hidden="true" />
                      Zresetuj karty ({skippedCount})
                    </button>
                  )}
                  {filtrAktywny && (
                    <button
                      type="button"
                      onClick={() => radiusChange(0)}
                      className="rounded-full border border-border px-4 py-2 text-sm font-semibold"
                    >
                      Całe miasto
                    </button>
                  )}
                </div>
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
                      className={`absolute inset-0 ${exitingRef.current.has(place.id) ? "pointer-events-none" : ""}`}
                      style={{
                        transform:
                          idxFromTop === 0
                            ? undefined
                            : `translateY(${idxFromTop * 10}px) scale(${1 - idxFromTop * 0.05})`,
                        zIndex: 10 - idxFromTop,
                      }}
                    >
                      <SwipeCard
                        place={place}
                        isTop={idxFromTop === 0}
                        rating={ratings?.get(place.id)}
                        friendSignal={topFriendSignal(place.id)}
                        friendsWant={znajomiChca?.get(place.id) ?? []}
                        distanceKm={odleglosci.get(place.id) ?? null}
                        expanded={idxFromTop === 0 && rozwinieteId === place.id}
                        onToggleExpanded={() => setRozwinieteId((id) => (id === place.id ? null : place.id))}
                        onSwipeCommit={(dir) => decideByDrag(DIR_TO_TYPE[dir], place)}
                        onSwipe={(dir) => handleSwipeEnd(DIR_TO_TYPE[dir], place)}
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
            <div className="mt-4 flex items-center justify-center gap-3.5 sm:mt-6">
              <button
                type="button"
                aria-label="Cofnij ostatnią decyzję"
                onClick={undoLast}
                disabled={history.length === 0}
                className="grid h-11 w-11 place-items-center rounded-full border-[1.5px] border-foreground/15 bg-card text-foreground/70 shadow-sm transition hover:-translate-y-0.5 hover:border-foreground/40 hover:text-foreground active:scale-95 disabled:pointer-events-none disabled:opacity-30"
              >
                <Undo2 size={19} />
              </button>
              <button
                type="button"
                aria-label="Pomiń"
                onClick={() => decide("skip", top)}
                className="grid h-[60px] w-[60px] place-items-center rounded-full border-2 border-[#D0453F]/30 bg-card text-[#D0453F] shadow-md transition hover:-translate-y-0.5 hover:border-[#D0453F] hover:shadow-lg active:scale-95 sm:h-16 sm:w-16"
              >
                <X size={26} strokeWidth={3} />
              </button>
              <button
                type="button"
                aria-label="Dodaj do ulubionych"
                onClick={() => decide("fav", top)}
                className="grid h-12 w-12 place-items-center rounded-full border-2 border-mustard/50 bg-card text-[#B8912A] shadow-md transition hover:-translate-y-0.5 hover:border-mustard hover:shadow-lg active:scale-95"
              >
                <Star size={21} className="fill-current" />
              </button>
              <button
                type="button"
                aria-label="Chcę odwiedzić"
                onClick={() => decide("want", top)}
                className="grid h-[60px] w-[60px] place-items-center rounded-full border-2 border-tomato bg-tomato text-cream shadow-md transition hover:-translate-y-0.5 hover:shadow-lg active:scale-95 sm:h-16 sm:w-16"
              >
                <Heart size={26} className="fill-current" />
              </button>
            </div>
          )}
          {top && skippedCount > 0 && (
            <div className="text-center">
              <button
                type="button"
                onClick={resetDeck}
                disabled={resetSkips.isPending}
                className="mt-4 hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground disabled:opacity-50 lg:inline-flex"
              >
                <RotateCcw size={13} aria-hidden="true" />
                Zresetuj karty ({skippedCount} {pluralPl(skippedCount, "pominięta", "pominięte", "pominiętych")})
              </button>
            </div>
          )}
        </div>

        <SwipeHistoryRail history={history} onUndo={undo} />
      </div>

      {/* Telefon: filtr obszaru w arkuszu od dołu. */}
      <Sheet open={arkusz === "filtry"} onOpenChange={(o) => setArkusz(o ? "filtry" : null)}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader className="text-left">
            <SheetTitle className="font-display text-xl font-extrabold">Obszar od Ciebie</SheetTitle>
            <SheetDescription>Losujemy spośród wszystkich knajp w poŻeramy w tym promieniu.</SheetDescription>
          </SheetHeader>
          <div className="mt-4 flex flex-col gap-3">
            {!lok.loc && (
              <div className="rounded-2xl border border-border bg-background p-3 text-sm">
                <p className="text-muted-foreground">
                  {lok.stan === "odmowa"
                    ? "Lokalizacja jest zablokowana. Włącz ją dla tej strony w ustawieniach przeglądarki, potem spróbuj ponownie."
                    : "Żeby liczyć odległość od Ciebie, potrzebujemy Twojej lokalizacji. Nie zapisujemy jej."}
                </p>
                <button
                  type="button"
                  onClick={lok.popros}
                  disabled={lok.stan === "czeka"}
                  className="mt-2 rounded-full bg-tomato px-4 py-2 text-sm font-extrabold text-cream disabled:opacity-60"
                >
                  {lok.stan === "czeka" ? "Ustalam lokalizację…" : "Włącz lokalizację"}
                </button>
              </div>
            )}
            <WyborPromienia promien={promien} onChange={radiusChange} maLokalizacje={!!lok.loc} />
            <button
              type="button"
              onClick={() => setKolejnosc((k) => k + 1)}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border-[1.5px] border-foreground/15 py-3 text-sm font-extrabold"
            >
              <Shuffle size={15} aria-hidden="true" /> Wylosuj nową kolejność
            </button>
            <button
              type="button"
              onClick={() => setArkusz(null)}
              className="rounded-2xl bg-tomato py-3.5 text-sm font-extrabold text-cream"
            >
              Pokaż {etykietaKart.replace(" do przejrzenia", "")}
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Telefon: decyzje z tej sesji. */}
      <Sheet open={arkusz === "decyzje"} onOpenChange={(o) => setArkusz(o ? "decyzje" : null)}>
        <SheetContent side="bottom" className="flex max-h-[78dvh] flex-col rounded-t-3xl">
          <SheetHeader className="text-left">
            <SheetTitle className="font-display text-xl font-extrabold">Twoje decyzje</SheetTitle>
            <SheetDescription className="sr-only">Lista decyzji z tej sesji, każdą można cofnąć.</SheetDescription>
          </SheetHeader>
          <div className="mt-3 flex min-h-0 flex-1 flex-col">
            <DecisionsList history={history} onUndo={undo} />
          </div>
          {skippedCount > 0 && (
            <button
              type="button"
              onClick={resetDeck}
              disabled={resetSkips.isPending}
              className="mt-3 inline-flex items-center justify-center gap-2 rounded-2xl border-[1.5px] border-dashed border-foreground/25 py-3 text-sm font-extrabold disabled:opacity-50"
            >
              <RotateCcw size={14} aria-hidden="true" />
              Zresetuj karty ({skippedCount} {pluralPl(skippedCount, "pominięta", "pominięte", "pominiętych")})
            </button>
          )}
        </SheetContent>
      </Sheet>

      {match && (
        <MatchOverlay
          place={match.place}
          znajomi={match.znajomi}
          ja={profil ?? null}
          wyslana={propozycja === "wyslana"}
          wysylanie={proponuj.isPending}
          onPropose={wyslijPropozycje}
          onClose={() => setMatch(null)}
        />
      )}
    </main>
  );
}

function MatchOverlay({
  place,
  znajomi,
  ja,
  wyslana,
  wysylanie,
  onPropose,
  onClose,
}: {
  place: Place;
  znajomi: ZnajomyLite[];
  ja: { avatar_url: string | null; avatar_source: "google" | "upload" | "initials"; display_name: string | null; username: string | null } | null;
  wyslana: boolean;
  wysylanie: boolean;
  onPropose: () => void;
  onClose: () => void;
}) {
  const meta = cuisineMeta(place.cuisine);
  const imiona = znajomi.map(imieZnajomego);
  const kto = imiona.length <= 2 ? imiona.join(" i ") : `${imiona[0]} i ${imiona.length - 1} znajomych`;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Match ze znajomymi"
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-4 overflow-hidden bg-[rgba(27,29,66,0.96)] p-7 text-center text-cream"
    >
      <span aria-hidden="true" className="absolute top-[22%] h-72 w-72 rounded-full bg-tomato opacity-45 blur-[90px]" />
      <p className="relative text-[11px] font-extrabold tracking-[0.14em] text-blush">MATCH ZE ZNAJOMYMI</p>
      <h2 className="relative font-display text-3xl font-extrabold leading-tight">Macie wspólny cel!</h2>
      <div className="relative flex items-center gap-3">
        <div className="flex">
          <UserAvatar
            avatarUrl={ja?.avatar_url}
            avatarSource={ja?.avatar_source}
            displayName={ja?.display_name}
            username={ja?.username}
            size={60}
            className="ring-2 ring-cream"
          />
          {znajomi.slice(0, 3).map((f) => (
            <span key={f.id} className="-ml-3.5">
              <UserAvatar
                avatarUrl={f.avatar_url}
                avatarSource={f.avatar_source}
                displayName={f.display_name}
                username={f.username}
                size={60}
                className="ring-2 ring-cream"
              />
            </span>
          ))}
        </div>
        <span className="font-display text-2xl font-extrabold text-[#E8807E]">+</span>
        <span
          className="grid h-[92px] w-[92px] place-items-center overflow-hidden rounded-full ring-4 ring-cream"
          style={{ backgroundColor: meta.color }}
        >
          {place.avatar_url ? (
            <img loading="lazy" decoding="async" src={place.avatar_url} alt="" aria-hidden="true" className="h-full w-full object-contain p-2" />
          ) : null}
        </span>
      </div>
      <p className="relative max-w-xs text-sm leading-relaxed text-cream/85">
        Ty i {kto} chcecie iść do {place.name}.
      </p>
      {wyslana ? (
        <p className="relative self-stretch rounded-full bg-[rgba(111,211,154,0.16)] px-5 py-3.5 text-sm font-extrabold text-[#9FD9B4]">
          ✓ Znajomi dostali powiadomienie
        </p>
      ) : (
        <button
          type="button"
          autoFocus
          onClick={onPropose}
          disabled={wysylanie}
          className="relative self-stretch rounded-full bg-tomato px-5 py-3.5 text-sm font-extrabold text-cream disabled:opacity-60"
        >
          {wysylanie ? "Wysyłam…" : "Zaproponuj wspólne wyjście"}
        </button>
      )}
      <button type="button" onClick={onClose} className="relative p-2.5 text-[13.5px] font-extrabold text-cream/70">
        Przeglądaj dalej
      </button>
    </div>
  );
}
