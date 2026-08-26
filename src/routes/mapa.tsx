import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, ChevronDown, ChevronRight, Clock, Heart, List, Map as MapIcon, Search, Star, Users, X } from "lucide-react";
import FoodMap, { type MapBounds } from "@/components/FoodMap";
import { useMyFavoritePlaceIds, useFriendFavoriteCounts } from "@/lib/favorites-api";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { usePlaces, usePlaceRatingsMap, isPlaceOpenNow, type Place } from "@/lib/places-api";
import { useCuisines } from "@/lib/cuisines-api";
import { searchPlaces } from "@/lib/place-search";
import { useUserLocation, haversineKm, formatDistancePl } from "@/lib/geo";
import { useUser } from "@/lib/use-auth";
import { pluralPl } from "@/lib/plural-pl";
import { cuisineMeta } from "@/data/places";

export const Route = createFileRoute("/mapa")({
  head: () => ({
    meta: [
      { title: "Mapa knajp w Poznaniu - poŻeramy" },
      {
        name: "description",
        content:
          "Interaktywna mapa poznańskich knajp: filtruj po kuchni i ocenie, sprawdź co jest w pobliżu.",
      },
      { property: "og:title", content: "Mapa knajp w Poznaniu - poŻeramy" },
      {
        property: "og:description",
        content: "Interaktywna mapa poznańskich knajp: filtruj po kuchni i ocenie.",
      },
    ],
  }),
  component: MapaPage,
});

/** How close a visitor has to be to one of our places before we open the map on
 *  them rather than on the city. Roughly the Poznan agglomeration. */
const COVERAGE_KM = 20;

function MapaPage() {
  const { data: places } = usePlaces();
  const { data: ratings } = usePlaceRatingsMap();
  const { data: cuisines } = useCuisines();
  const [query, setQuery] = useState("");
  const [cuisine, setCuisine] = useState<string | null>(null);
  const [minRating, setMinRating] = useState(0);
  const [openNow, setOpenNow] = useState(false);
  const [selected, setSelected] = useState<Place | null>(null);
  const [focusTick, setFocusTick] = useState(0);
  const [mobileView, setMobileView] = useState<"map" | "list">("map");
  const userLoc = useUserLocation();
  const { user } = useUser();

  /** The viewport the visitor last asked us to search in, and the one they
   *  have panned to since. Two separate things: panning alone must not
   *  silently re-filter the list under them - it only offers the button. */
  /** Layers answer a different question from the cuisine/rating filters:
   *  not "what kind of food" but "whose". They stack with the filters. */
  const [layer, setLayer] = useState<"all" | "fav" | "friends">("all");
  const [sort, setSort] = useState<"dist" | "rating">("dist");
  const { data: favIds } = useMyFavoritePlaceIds();
  const { data: friendCounts } = useFriendFavoriteCounts();

  const [areaBounds, setAreaBounds] = useState<MapBounds | null>(null);
  const [pendingBounds, setPendingBounds] = useState<MapBounds | null>(null);
  const areaActive = areaBounds !== null;

  /** True when the place falls inside the box. Places with no coordinates can
   *  never be inside one, so an area search drops them. */
  const inBounds = (p: Place, b: MapBounds) =>
    typeof p.lat === "number" &&
    typeof p.lng === "number" &&
    p.lat <= b.north &&
    p.lat >= b.south &&
    p.lng <= b.east &&
    p.lng >= b.west;

  // Everything except the area filter. Kept separate so we can ask how many places
  // a candidate area would actually return before offering to search it.
  const filteredNoArea = useMemo(() => {
    const list = (places ?? []).filter((p) => p.is_published !== false);
    return list.filter((p) => {
      if (cuisine && p.cuisine !== cuisine) return false;
      if (minRating > 0) {
        const avg = ratings?.get(p.id)?.avg ?? 0;
        if (avg < minRating) return false;
      }
      if (openNow && !isPlaceOpenNow(p.opening_hours)) return false;
      if (layer === "fav" && !(favIds ?? []).includes(p.id)) return false;
      if (layer === "friends" && !(friendCounts?.get(p.id) ?? 0)) return false;
      return true;
    });
  }, [places, cuisine, minRating, openNow, ratings, layer, favIds, friendCounts]);

  const filtered = useMemo(
    () => (areaBounds ? filteredNoArea.filter((p) => inBounds(p, areaBounds)) : filteredNoArea),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filteredNoArea, areaBounds],
  );

  // How many places this candidate area would actually return. Offering to search
  // an empty stretch of countryside is offering an action we already know yields
  // nothing - so the button only appears where there is something to find.
  const areaHits = useMemo(
    () => (pendingBounds ? filteredNoArea.filter((p) => inBounds(p, pendingBounds)).length : 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filteredNoArea, pendingBounds],
  );

  const canSearchArea =
    pendingBounds !== null &&
    areaHits > 0 &&
    (areaBounds === null || JSON.stringify(pendingBounds) !== JSON.stringify(areaBounds));

  // Open the map where the visitor is - but only if we cover it. Someone opening
  // the app from Krakow would otherwise land on an empty field, which is worse
  // than landing on the city this app is actually about.
  const autoCenter = useMemo(() => {
    if (!userLoc) return null;
    const covered = (places ?? []).some(
      (p) =>
        p.is_published !== false &&
        typeof p.lat === "number" &&
        typeof p.lng === "number" &&
        haversineKm(userLoc, { lat: p.lat, lng: p.lng }) <= COVERAGE_KM,
    );
    return covered ? userLoc : null;
  }, [userLoc, places]);

  const distanceFor = (p: Place): number | null => {
    if (!userLoc || typeof p.lat !== "number" || typeof p.lng !== "number") return null;
    return haversineKm(userLoc, { lat: p.lat, lng: p.lng });
  };

  // Desktop list mirrors the map filters, plus the text query from the search box.
  const listResults = useMemo(() => {
    const found = searchPlaces(filtered, query).results;
    if (sort === "rating") {
      return found
        .slice()
        .sort((a, c) => (ratings?.get(c.id)?.avg ?? 0) - (ratings?.get(a.id)?.avg ?? 0));
    }
    // Distance sort is only meaningful once geolocation has been granted;
    // without it every place scores the same and the order would look random,
    // so fall back to the search relevance order we already have.
    if (!userLoc) return found;
    return found.slice().sort((a, c) => {
      const da = haversineKm(userLoc, { lat: a.lat as number, lng: a.lng as number });
      const dc = haversineKm(userLoc, { lat: c.lat as number, lng: c.lng as number });
      return da - dc;
    });
  }, [filtered, query, sort, ratings, userLoc]);

  const selRating = selected ? ratings?.get(selected.id) : undefined;

  const cuisineList = (cuisines ?? []).filter((c) => c.enabled !== false);
  const ratingOptions = [
    { value: 0, label: "Dowolna" },
    { value: 3, label: "3+" },
    { value: 4, label: "4+" },
    { value: 4.5, label: "4.5+" },
  ];

  const trigger = (active: boolean) =>
    `flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-all duration-200 ease-out hover:-translate-y-0.5 sm:flex-none sm:px-4 ${
      active
        ? "border-navy bg-gradient-to-br from-navy to-[oklch(0.3_0.13_268)] text-cream shadow-md shadow-navy/30"
        : "border-border bg-card text-foreground shadow-sm hover:border-tomato hover:shadow-md"
    }`;

  const optionRow = (active: boolean) =>
    `flex min-h-11 w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
      active ? "bg-navy/10 font-semibold text-navy" : "hover:bg-muted"
    }`;

  return (
    <div className="relative flex h-[calc(100dvh-8.5rem)] min-h-[520px] flex-col lg:h-dvh">
      <div
        className="relative overflow-hidden border-b border-border px-4 py-3 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.12)] backdrop-blur"
        style={{
          backgroundImage:
            "radial-gradient(120% 100% at 0% 0%, hsl(var(--tomato) / 0.10), transparent 55%), radial-gradient(120% 100% at 100% 0%, hsl(var(--navy) / 0.10), transparent 55%)",
        }}
      >
        <div className="relative mb-3">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Szukaj restauracji, kuchni, miejsca…"
            className="h-11 w-full rounded-full border border-border bg-card pl-9 pr-4 text-sm shadow-sm outline-none transition-shadow duration-200 focus:border-tomato focus:shadow-[0_0_0_4px_hsl(var(--tomato)/0.15)]"
          />
        </div>

        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger className={trigger(!!cuisine)} aria-label="Filtruj po kuchni">
              <span className="truncate">{cuisine ?? "Kuchnia"}</span>
              <ChevronDown size={14} className="shrink-0 opacity-70" />
            </PopoverTrigger>
            <PopoverContent align="start" className="max-h-72 w-56 overflow-y-auto p-2">
              <button
                type="button"
                className={optionRow(!cuisine)}
                onClick={() => setCuisine(null)}
              >
                Wszystkie kuchnie
                {!cuisine && <Check size={14} />}
              </button>
              {cuisineList.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={optionRow(cuisine === c.name)}
                  onClick={() => setCuisine(cuisine === c.name ? null : c.name)}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    {c.emoji && <span aria-hidden>{c.emoji}</span>}
                    <span className="truncate">{c.name}</span>
                  </span>
                  {cuisine === c.name && <Check size={14} className="shrink-0" />}
                </button>
              ))}
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger className={trigger(minRating > 0)} aria-label="Filtruj po ocenie">
              <Star size={13} className={minRating > 0 ? "fill-cream" : "text-tomato"} />
              <span className="truncate">{minRating > 0 ? `${minRating}+` : "Ocena"}</span>
              <ChevronDown size={14} className="shrink-0 opacity-70" />
            </PopoverTrigger>
            <PopoverContent align="start" className="w-44 p-2">
              {ratingOptions.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  className={optionRow(minRating === o.value)}
                  onClick={() => setMinRating(o.value)}
                >
                  {o.label}
                  {minRating === o.value && <Check size={14} />}
                </button>
              ))}
            </PopoverContent>
          </Popover>

          <button
            type="button"
            aria-pressed={openNow}
            onClick={() => setOpenNow((v) => !v)}
            className={trigger(openNow)}
          >
            <Clock size={13} className="shrink-0" />
            <span className="truncate">Otwarte teraz</span>
          </button>

          {/* Layers are a different axis from the filters above: not what kind
              of food, but whose. Only offered when signed in - both depend on
              your own favourites. */}
          {user && (
            <>
              <span className="mx-1 hidden h-6 w-px shrink-0 self-center bg-border sm:block" />
              {([
                { key: "fav", label: "Ulubione", icon: <Heart size={13} /> },
                { key: "friends", label: "U znajomych", icon: <Users size={13} /> },
              ] as const).map((l) => (
                <button
                  key={l.key}
                  type="button"
                  aria-pressed={layer === l.key}
                  onClick={() => setLayer((v) => (v === l.key ? "all" : l.key))}
                  className={trigger(layer === l.key)}
                >
                  {l.icon}
                  <span className="truncate">{l.label}</span>
                </button>
              ))}
            </>
          )}
        </div>
      </div>

      <div className="relative flex min-h-[320px] flex-1 lg:min-h-0">
        {/* Desktop: static column. Mobile: full-screen sheet over the map, toggled by the floating pill below. */}
        <aside
          className={`${mobileView === "list" ? "flex" : "hidden"} absolute inset-0 z-20 flex-col bg-background lg:static lg:z-auto lg:flex lg:w-96 lg:shrink-0 lg:border-r lg:border-border`}
        >
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
            <p className="text-sm font-bold">
              {listResults.length}{" "}
              {pluralPl(listResults.length, "lokal", "lokale", "lokali")}
            </p>
            <div className="flex items-center gap-1.5">
              <span className="hidden text-[11px] text-muted-foreground sm:inline">Sortuj</span>
              {([
                { key: "dist", label: "Odległość" },
                { key: "rating", label: "Ocena" },
              ] as const).map((o) => (
                <button
                  key={o.key}
                  type="button"
                  aria-pressed={sort === o.key}
                  onClick={() => setSort(o.key)}
                  disabled={o.key === "dist" && !userLoc}
                  title={o.key === "dist" && !userLoc ? "Włącz lokalizację, aby sortować po odległości" : undefined}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                    sort === o.key ? "bg-navy text-cream" : "bg-muted text-navy hover:bg-muted/70"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setMobileView("map")}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:border-tomato lg:hidden"
            >
              <MapIcon size={13} /> Pokaż mapę
            </button>
          </div>
          <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
            {listResults.map((p) => {
              const r = ratings?.get(p.id);
              const dist = distanceFor(p);
              const isActive = selected?.id === p.id;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(p);
                      setFocusTick((t) => t + 1);
                      setMobileView("map");
                    }}
                    className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition hover:border-tomato hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tomato ${
                      isActive ? "border-tomato bg-blush/40" : "border-border bg-card"
                    }`}
                  >
                    <div
                      className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl text-2xl"
                      style={
                        p.avatar_url || p.cover_image_url
                          ? { backgroundColor: p.avatar_url ? "#ffffff" : undefined }
                          : { background: `${cuisineMeta(p.cuisine).color}26` }
                      }
                    >
                      {p.avatar_url ? (
                        <img
                          src={p.avatar_url}
                          alt=""
                          className="h-full w-full object-contain p-1.5"
                          loading="lazy"
                        />
                      ) : p.cover_image_url ? (
                        <img
                          src={p.cover_image_url}
                          alt=""
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        cuisineMeta(p.cuisine).emoji
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display text-sm font-extrabold">{p.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{p.cuisine}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-xs font-semibold">
                        {r ? (
                          <>
                            <Star size={12} className="fill-tomato text-tomato" />
                            {r.avg.toFixed(1)}{" "}
                            <span className="font-normal text-muted-foreground">({r.count})</span>
                          </>
                        ) : (
                          <span className="font-normal text-muted-foreground">Brak ocen</span>
                        )}
                        {dist !== null && (
                          <span className="font-normal text-muted-foreground">
                            · {formatDistancePl(dist)}
                          </span>
                        )}
                      </p>
                    </div>
                    <ChevronRight size={18} className="shrink-0 text-muted-foreground" />
                  </button>
                </li>
              );
            })}
            {listResults.length === 0 && (
              <li className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                Brak lokali dla tych filtrów. Zmień kuchnię, ocenę albo sprawdź pisownię.
              </li>
            )}
          </ul>
        </aside>

        <div className="relative min-h-[320px] flex-1">
          <div className="absolute inset-0 [&>div]:h-full [&>div]:max-h-none [&>div]:min-h-0 [&>div]:rounded-none [&>div]:border-0">
            <FoodMap
              places={filtered}
              query={query}
              ratings={ratings}
              focusPlaceId={selected?.id ?? null}
              focusTick={focusTick}
              onSelect={(p) => setSelected(p)}
              userLocation={userLoc}
              onUserMove={setPendingBounds}
              friendCounts={friendCounts}
              areaBounds={areaBounds}
              autoCenter={autoCenter}
            />
          </div>

          {(canSearchArea || areaActive) && (
            <div className="absolute inset-x-0 top-4 z-20 flex justify-center gap-2 px-4">
              {canSearchArea && (
                <button
                  type="button"
                  onClick={() => {
                    setAreaBounds(pendingBounds);
                    setSelected(null);
                  }}
                  className="inline-flex items-center gap-2 rounded-full bg-tomato px-4 py-2.5 text-xs font-bold text-cream shadow-xl transition hover:bg-tomato/90 active:scale-95"
                >
                  <Search size={14} /> Szukaj w tym obszarze
                  <span className="rounded-full bg-cream/25 px-1.5 py-0.5 tabular-nums">
                    {areaHits}
                  </span>
                </button>
              )}
              {areaActive && (
                <button
                  type="button"
                  onClick={() => setAreaBounds(null)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2.5 text-xs font-semibold shadow-xl transition hover:border-tomato active:scale-95"
                >
                  <X size={13} /> Cały Poznań
                </button>
              )}
            </div>
          )}

          {!selected && mobileView === "map" && (
            <button
              type="button"
              onClick={() => setMobileView("list")}
              className="absolute bottom-4 left-1/2 z-10 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-navy px-4 py-2.5 text-xs font-semibold text-cream shadow-xl lg:hidden"
            >
              <List size={14} /> Pokaż listę · {listResults.length}
            </button>
          )}

          {selected && (
            <>
              {/* Mobile: card sliding in from the bottom (unchanged) */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4 lg:hidden">
                <div className="pointer-events-auto mx-auto max-w-md">
                  <SelectedCard place={selected} stat={selRating} dist={distanceFor(selected)} />
                </div>
              </div>
              {/* Desktop: floating panel next to the map */}
              <div className="pointer-events-none absolute right-4 top-4 hidden w-80 lg:block">
                <div className="pointer-events-auto">
                  <SelectedCard place={selected} stat={selRating} dist={distanceFor(selected)} />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SelectedCard({
  place,
  stat,
  dist,
}: {
  place: Place;
  stat?: { avg: number; count: number };
  dist?: number | null;
}) {
  return (
    <Link
      to="/k/$id"
      params={{ id: place.slug }}
      className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-xl transition hover:border-tomato"
    >
      <div
        className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl text-2xl"
        style={
          place.avatar_url || place.cover_image_url
            ? { backgroundColor: place.avatar_url ? "#ffffff" : undefined }
            : { background: `${cuisineMeta(place.cuisine).color}26` }
        }
      >
        {place.avatar_url ? (
          <img
            src={place.avatar_url}
            alt=""
            className="h-full w-full object-contain p-1.5"
            loading="lazy"
          />
        ) : place.cover_image_url ? (
          <img
            src={place.cover_image_url}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          cuisineMeta(place.cuisine).emoji
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-sm font-extrabold">{place.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {place.cuisine}
          {place.price_range ? ` • ${place.price_range}` : ""}
        </p>
        <p className="mt-0.5 flex items-center gap-1 text-xs font-semibold">
          {stat ? (
            <>
              <Star size={12} className="fill-tomato text-tomato" />
              {stat.avg.toFixed(1)}{" "}
              <span className="font-normal text-muted-foreground">({stat.count})</span>
            </>
          ) : (
            <span className="font-normal text-muted-foreground">Brak ocen</span>
          )}
          {dist != null && (
            <span className="font-normal text-muted-foreground">· {formatDistancePl(dist)}</span>
          )}
        </p>
      </div>
      <ChevronRight size={18} className="shrink-0 text-muted-foreground" />
    </Link>
  );
}
