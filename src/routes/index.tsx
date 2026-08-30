import { createFileRoute, Link } from "@tanstack/react-router";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Instagram, Star, Heart, X, MapPin, Sparkles, Clock, Mail } from "lucide-react";
import { toast } from "sonner";
import { SmartText } from "@/components/SmartText";
import { DiscoverHeader } from "@/components/DiscoverHeader";
import { SuggestPlacePanel } from "@/components/SuggestPlacePanel";
import { cuisineMeta } from "@/data/places";
import {
  usePlaces,
  usePlaceRatingsMap,
  placesQueryOptions,
  placeRatingsMapQueryOptions,
  isPlaceOpenNow,
  type Place,
} from "@/lib/places-api";
import { searchPlaces } from "@/lib/place-search";
import { useDebounced } from "@/lib/use-debounced";
import { useUser } from "@/lib/use-auth";
import { useMyProfile, useUpdateProfile } from "@/lib/profile-api";
import { useIsFavorite, useToggleFavorite } from "@/lib/favorites-api";
import { useFriendRecommendations } from "@/lib/friends-api";
import { useActiveAds, type Ad } from "@/lib/ads-api";
import { SponsoredDiscoverCard } from "@/components/SponsoredDiscoverCard";
import { pickSeeded } from "@/lib/seeded-pick";
import { useCutoutLogo } from "@/lib/chroma-cutout";
import { CuisineFallbackCover } from "@/components/CuisineFallbackCover";
import { OpenStatus, isNewPlace } from "@/components/OpenStatus";
import { readableTextClass } from "@/lib/readable-text";
import { HomeSocialBand } from "@/components/HomeSocialBand";
import { RandomPlaceCard } from "@/components/RandomPlaceCard";
import { RecentlyViewedStrip } from "@/components/RecentlyViewedStrip";
import { type QuickFilter } from "@/components/QuickFilters";
import { useMyFavoritePlaceIds } from "@/lib/favorites-api";
import logoDark from "@/assets/brand/po_zeramy-logo-dark.png.asset.json";
import { BASE_URL } from "@/lib/site-config";
import { trackEvent } from "@/lib/analytics";

export const Route = createFileRoute("/")({
  // Without this, SSR rendered nothing but a loading spinner - usePlaces()
  // had no data yet during the server render pass, so crawlers and link-
  // preview bots (which don't run client JS) saw an empty shell instead of
  // the actual homepage content. Prefetching into the shared queryClient
  // here means it's already cached by the time the component renders.
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(placesQueryOptions()),
      context.queryClient.ensureQueryData(placeRatingsMapQueryOptions()),
    ]);
  },
  head: () => ({
    meta: [
      { title: "poŻeramy - Foodies App" },
      {
        name: "description",
        content:
          "poŻeramy Poznań łyżka po łyżce. Recenzje restauracji, kebaby, ramen, śniadania i słodkości - z mapą i rolkami z Instagrama.",
      },
      { property: "og:title", content: "poŻeramy - Foodies App" },
      {
        property: "og:description",
        content: "Mapa, recenzje i rolki najlepszych miejscówek w Poznaniu.",
      },
      { property: "og:image", content: `${BASE_URL}${logoDark.url}` },
      { property: "og:url", content: BASE_URL },
    ],
    links: [{ rel: "canonical", href: BASE_URL },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Manrope:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  component: Index,
});

type PlaceWithDate = Place & { created_at?: string };

function Index() {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounced(query, 200);
  const [cuisine, setCuisine] = useState<string | null>(null);
  const [quick, setQuick] = useState<QuickFilter>("all");
  // "Otwarte teraz" and "Nowe" both depend on the current clock, and the
  // server runs in UTC while the visitor is in Europe/Warsaw. Computing them
  // during SSR would hand the client different chips than the markup it is
  // hydrating - a place open 12:00-22:00 is "open" at 20:30 UTC and closed
  // at 22:30 local, the same instant. So the row is client-only.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { data: places, isLoading } = usePlaces();
  const { data: ratings } = usePlaceRatingsMap();
  const { user } = useUser();
  const { data: friendRecs } = useFriendRecommendations();
  const { data: activeAds } = useActiveAds();
  const today = new Date().toISOString().slice(0, 10);
  const feedAd = pickSeeded(activeAds ?? [], `feed-${user?.id ?? "anon"}-${today}`) ?? undefined;

  const published = useMemo(
    () => ((places ?? []) as PlaceWithDate[]).filter((p) => p.is_published !== false),
    [places],
  );

  const { data: favIds } = useMyFavoritePlaceIds();

  /** One predicate per intent filter, reused for both the filtering and the
   *  chip counts so the badge can never disagree with the result. */
  const quickTests = useMemo(() => {
    const favSet = new Set(favIds ?? []);
    return {
      all: () => true,
      open: (p: PlaceWithDate) => isPlaceOpenNow(p.opening_hours),
      top: (p: PlaceWithDate) => (ratings?.get(p.id)?.avg ?? 0) >= 4.5,
      new: (p: PlaceWithDate) => isNewPlace(p.created_at),
      fav: (p: PlaceWithDate) => favSet.has(p.id),
    } satisfies Record<QuickFilter, (p: PlaceWithDate) => boolean>;
  }, [favIds, ratings]);

  const quickCounts = useMemo(() => {
    const out: Partial<Record<QuickFilter, number>> = {};
    if (!mounted) return out;
    for (const k of ["open", "top", "new", "fav"] as const) {
      out[k] = published.filter(quickTests[k]).length;
    }
    return out;
  }, [published, quickTests, mounted]);

  /** Offer a chip only when it would return something. A filter that can
   *  only produce an empty state is worse than no filter at all - and with
   *  no reviews in the database yet, "Ocena 4,5+" is exactly that. */
  const quickAvailable = useMemo(() => {
    const s = new Set<QuickFilter>();
    for (const k of ["open", "top", "new", "fav"] as const) {
      if ((quickCounts[k] ?? 0) > 0) s.add(k);
    }
    return s;
  }, [quickCounts]);

  // If the active filter stops being offered (e.g. the last favourite was
  // removed), fall back rather than showing an empty page under a chip that
  // is no longer rendered.
  useEffect(() => {
    if (quick !== "all" && !quickAvailable.has(quick)) setQuick("all");
  }, [quick, quickAvailable]);

  const byCuisine = useMemo(
    () =>
      published
        .filter((p) => (cuisine ? p.cuisine === cuisine : true))
        .filter(quickTests[quick]),
    [published, cuisine, quick, quickTests],
  );

  const search = useMemo(
    () => searchPlaces(byCuisine, debouncedQuery),
    [byCuisine, debouncedQuery],
  );
  const filtered = search.results;
  const filteredIds = useMemo(() => new Set(filtered.map((p) => p.id)), [filtered]);

  // GA4 "search" event - separately (longer) debounced from the filtering
  // query above, so it fires once the user actually pauses instead of on
  // every near-keystroke; lastTracked guards against re-firing the same term.
  const trackedQuery = useDebounced(query, 800);
  const lastTracked = useRef<string | null>(null);
  useEffect(() => {
    const term = trackedQuery.trim();
    if (!term || term === lastTracked.current) return;
    lastTracked.current = term;
    trackEvent("search", { search_term: term });
  }, [trackedQuery]);

  /** Friends' picks and general top-rated are two independent rails, not a
   * fallback pair - a user with only 1-2 friend recs still gets a full
   * "Polecane dla Ciebie" rail underneath instead of a near-empty homepage. */
  const friendPicks = useMemo(() => {
    if (!user || !friendRecs?.length) return [];
    const byId = new Map(published.map((p) => [p.id, p]));
    return friendRecs
      .map((r) => byId.get(r.place_id))
      .filter((p): p is PlaceWithDate => !!p)
      .filter((p) => filteredIds.has(p.id))
      .slice(0, 12);
  }, [user, friendRecs, published, filteredIds]);

  const topPicks = useMemo(
    () =>
      filtered
        .slice()
        .sort((a, b) => (ratings?.get(b.id)?.avg ?? 0) - (ratings?.get(a.id)?.avg ?? 0))
        .slice(0, 12),
    [filtered, ratings],
  );

  const NEWEST_WINDOW_DAYS = 20;
  const newest = useMemo(() => {
    const cutoff = Date.now() - NEWEST_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    return filtered
      .filter((p) => p.created_at && new Date(p.created_at).getTime() >= cutoff)
      .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
      .slice(0, 8);
  }, [filtered]);

  const empty = !isLoading && filtered.length === 0;

  return (
    <main
      id="main-content"
      className="min-h-dvh overflow-x-hidden bg-background pb-10 text-foreground"
    >
      <DiscoverHeader
        query={query}
        onQueryChange={setQuery}
        cuisine={cuisine}
        onCuisineChange={setCuisine}
        quick={quick}
        onQuickChange={setQuick}
        quickAvailable={quickAvailable}
        quickCounts={quickCounts}
      />

      <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:max-w-7xl">
        {!empty && search.fuzzy && (
          <p className="mb-4 rounded-2xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
            Nie znaleźliśmy dokładnego dopasowania dla „{debouncedQuery}" - pokazujemy najbliższe
            wyniki.
          </p>
        )}

        {empty && (
          <div className="surface rounded-3xl border border-border bg-card p-8 text-center">
            <p className="font-display text-xl">Nic nie znaleźliśmy</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {debouncedQuery
                ? "Sprawdź pisownię frazy, spróbuj krótszego słowa albo przejdź do pełnej mapy z filtrami."
                : "Spróbuj innej frazy albo wyczyść kategorię."}
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setCuisine(null);
                  setQuick("all");
                }}
                className="chip bg-navy text-cream"
              >
                Wyczyść filtry
              </button>
              <Link to="/mapa" className="chip border border-border">
                <MapPin size={12} /> Otwórz mapę z filtrami
              </Link>
            </div>
          </div>
        )}

        {!empty && (
          <>
            <RecentlyViewedStrip />
            <PlaceRail
              title="Polecane dla Ciebie"
              icon={<Sparkles size={12} />}
              places={topPicks}
              loading={isLoading}
              ratings={ratings}
              ad={feedAd}
              adPosition={2}
            />
            {friendPicks.length > 0 && (
              <PlaceRail
                title="Polecane przez znajomych"
                icon={<Heart size={12} />}
                places={friendPicks}
                loading={isLoading}
                ratings={ratings}
              />
            )}
            <PlaceRail
              title="Nowo otwarte"
              icon={<Clock size={12} />}
              places={newest}
              loading={isLoading}
              ratings={ratings}
            />
          </>
        )}

        {/* Below lg only: on desktop the same widget already lives in the
            sidebar, and two random picks on one screen would contradict
            each other. */}
        <div className="py-4 lg:hidden">
          <RandomPlaceCard userId={user?.id} variant="panel" />
        </div>

        <HomeSocialBand />

        <section id="zglos-lokal" className="scroll-mt-24 py-8">
          <SuggestPlacePanel />
        </section>

        <nav
          aria-label="Informacje"
          className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t border-border pt-6 text-xs text-muted-foreground"
        >
          <Link
            to="/polityka-prywatnosci"
            className="pz-hit inline-flex items-center hover:text-tomato hover:underline"
          >
            Polityka prywatności
          </Link>
          <Link
            to="/regulamin"
            className="pz-hit inline-flex items-center hover:text-tomato hover:underline"
          >
            Regulamin
          </Link>
          <Link
            to="/wspolpraca"
            className="pz-hit inline-flex items-center hover:text-tomato hover:underline"
          >
            Współpraca
          </Link>
          <a
            href="mailto:po.zeramy@gmail.com"
            className="pz-hit inline-flex items-center gap-1 hover:text-tomato hover:underline"
          >
            <Mail size={12} /> po.zeramy@gmail.com
          </a>
        </nav>
      </div>

      <FirstVisitPopup />
    </main>
  );
}

/* --------------------------- horizontal rail --------------------------- */
function PlaceRail({
  title,
  icon,
  places,
  loading,
  ratings,
  ad,
  adPosition = 2,
}: {
  title: string;
  icon: React.ReactNode;
  places: Place[];
  loading: boolean;
  ratings?: Map<string, { avg: number; count: number }>;
  /** Native ad tile spliced into the rail at `adPosition`, labeled "Reklama". */
  ad?: Ad;
  adPosition?: number;
}) {
  if (!loading && places.length === 0) return null;
  return (
    <section className="py-5">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="inline-flex items-center gap-2 font-display text-xl">
          <span className="chip bg-tomato text-cream">{icon}</span>
          {title}
        </h2>
        <Link
          to="/mapa"
          className="pz-hit inline-flex items-center text-xs font-semibold text-tomato hover:underline"
        >
          Zobacz na mapie
        </Link>
      </div>
      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 scrollbar-none sm:mx-0 sm:px-0 lg:grid lg:grid-cols-3 lg:gap-5 lg:overflow-visible lg:pb-0 xl:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="surface w-[15rem] shrink-0 overflow-hidden rounded-3xl border border-border bg-card lg:w-auto lg:shrink"
              >
                <div className="pz-skel aspect-[5/4] w-full" />
                <div className="space-y-2 p-4">
                  <div className="pz-skel h-4 w-2/3 rounded-full" />
                  <div className="pz-skel h-3 w-1/2 rounded-full" />
                </div>
              </div>
            ))
          : places.flatMap((p, i) => {
              const card = <DiscoverCard key={p.id} place={p} stat={ratings?.get(p.id)} />;
              return ad && i === adPosition
                ? [<SponsoredDiscoverCard key={`ad-${ad.id}`} ad={ad} />, card]
                : [card];
            })}
      </div>
    </section>
  );
}

/* ------------------------------- card ------------------------------- */
// Up to ~24 of these can be mounted at once across the three homepage rails.
// useIsFavorite() now only re-renders its own subscriber when its derived
// boolean flips (see favorites-api.ts), but memo still matters as a second,
// independent guard against any other prop/parent-driven re-render (e.g. the
// ratings map's identity changing) rippling across every mounted card.
const DiscoverCard = memo(function DiscoverCard({
  place,
  stat,
}: {
  place: Place;
  stat?: { avg: number; count: number };
}) {
  const meta = cuisineMeta(place.cuisine);
  const cutoutLogo = useCutoutLogo(place.avatar_cutout_enabled !== false ? place.avatar_url : null);
  const { user } = useUser();
  const isFav = useIsFavorite(place.id);
  const toggle = useToggleFavorite();

  function onToggleFav(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      toast.error("Zaloguj się, aby zapisywać ulubione lokale");
      return;
    }
    const next = !isFav;
    toggle.mutate(
      { placeId: place.id, on: next },
      {
        onSuccess: () => toast.success(next ? "Dodano do ulubionych ❤️" : "Usunięto z ulubionych"),
        onError: (err) => toast.error((err as Error).message),
      },
    );
  }

  return (
    <div className="group relative w-[15rem] shrink-0 snap-start overflow-hidden rounded-3xl border border-border bg-card card-hover sm:w-[16rem] lg:w-auto lg:shrink">
      <button
        type="button"
        onClick={onToggleFav}
        disabled={toggle.isPending}
        aria-label={isFav ? "Usuń z ulubionych" : "Dodaj do ulubionych"}
        aria-pressed={isFav}
        className={`absolute right-3 top-3 z-10 pz-hit grid h-9 w-9 place-items-center rounded-full border shadow-sm transition active:scale-95 ${
          isFav
            ? "border-tomato bg-tomato text-cream"
            : "border-border bg-cream/90 text-navy hover:bg-cream"
        } disabled:opacity-60`}
      >
        <Heart size={16} className={isFav ? "fill-cream" : ""} />
      </button>

      <Link to="/k/$id" params={{ id: place.slug ?? place.id }} className="block">
        <div
          className="relative aspect-[5/4] overflow-hidden"
          style={{ backgroundColor: place.avatar_url ? "#ffffff" : meta.color }}
        >
          {place.avatar_url ? (
            <img
              src={cutoutLogo ?? place.avatar_url}
              alt={place.name}
              loading="lazy"
              className="absolute inset-0 h-full w-full object-contain p-6 transition duration-500 group-hover:scale-[1.04]"
            />
          ) : place.cover_image_url ? (
            <img
              src={place.cover_image_url}
              alt={place.name}
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
            />
          ) : (
            <div className="absolute inset-0">
              <CuisineFallbackCover cuisine={place.cuisine} emojiClassName="text-[6rem]" />
            </div>
          )}
          {!place.avatar_url && (
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-navy/45 via-transparent to-transparent" />
          )}
          {isNewPlace(place.created_at) && (
            <span className="absolute left-3 top-3 rounded-full bg-tomato px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-cream shadow-sm">
              Nowość
            </span>
          )}
          <span
            className={`absolute bottom-3 left-3 chip shadow-sm ${readableTextClass(meta.color)}`}
            style={{ backgroundColor: meta.color }}
          >
            {meta.emoji} {place.cuisine}
          </span>
        </div>
        <div className="p-4">
          <SmartText as="h3" className="font-display text-lg leading-tight">
            {place.name}
          </SmartText>
          {/* This line used to repeat the cuisine, which the chip on the
              image already shows 40px above it. Spent on the opening state
              instead - the one thing that actually decides whether you go.
              Dropped entirely when we know neither hours nor price: for such
              a place the line has nothing new to say, and an empty 0-height
              paragraph just breaks the card's internal rhythm. */}
          {(place.opening_hours || place.price_range) && (
            <p className="mt-1 flex items-center gap-2 truncate text-xs">
              <OpenStatus hours={place.opening_hours} />
              {place.price_range && (
                <span className="text-muted-foreground">{place.price_range}</span>
              )}
            </p>
          )}
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="inline-flex items-center gap-1 font-semibold">
              {stat ? (
                <>
                  <Star size={12} className="fill-tomato text-tomato" />
                  {stat.avg.toFixed(1)}
                  <span className="font-normal text-muted-foreground">({stat.count})</span>
                </>
              ) : (
                <span className="font-normal text-muted-foreground">Brak ocen</span>
              )}
            </span>
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <MapPin size={12} /> {(place.district ?? place.address ?? "").split(",")[0]}
            </span>
          </div>
        </div>
      </Link>
    </div>
  );
});

/* --------------------------- first visit popup --------------------------- */
function FirstVisitPopup() {
  const { user, loading } = useUser();
  // Server-side flag is the source of truth for logged-in accounts (survives
  // cache clears / new devices); anonymous visitors have no account to tie
  // it to, so they stay on localStorage only.
  const { data: profile, isLoading: profileLoading } = useMyProfile();
  const updateProfile = useUpdateProfile();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (user && profileLoading) return;
    if (user && profile?.ig_popup_dismissed_at) return;
    try {
      if (!localStorage.getItem("pozeramy_ig_popup_seen")) {
        const t = setTimeout(() => setOpen(true), 1200);
        return () => clearTimeout(t);
      }
    } catch {
      /* ignore */
    }
  }, [user, loading, profile, profileLoading]);

  if (!open) return null;
  const close = () => {
    try {
      localStorage.setItem("pozeramy_ig_popup_seen", "1");
    } catch {
      /* ignore */
    }
    if (user && !profile?.ig_popup_dismissed_at) {
      updateProfile.mutate({ ig_popup_dismissed_at: new Date().toISOString() });
    }
    setOpen(false);
  };
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-navy/70 p-4 backdrop-blur-sm animate-in fade-in"
      onClick={close}
    >
      <div
        className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={close}
          aria-label="Zamknij"
          className="pz-hit absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-navy text-cream transition hover:bg-tomato"
        >
          <X size={18} />
        </button>
        <div className="bg-terrazzo-navy p-8 text-center text-cream">
          <div className="mx-auto mb-4 grid h-20 w-20 rotate-[-4deg] place-items-center rounded-2xl bg-tomato shadow-lg">
            <Instagram size={40} />
          </div>
          <h3 className="mb-2 font-display text-3xl leading-tight">Cześć, poŻeraczu!</h3>
          <p className="text-sm text-cream/80">
            Jesteśmy poŻeramy i testujemy najlepsze miejscówki w Poznaniu.
          </p>
        </div>
        <div className="p-6 text-center">
          <p className="mb-4 font-semibold text-foreground">
            Obserwuj nas na Instagramie i nie przegap nowych rolek 🍕
          </p>
          <a
            href="https://instagram.com/po_zeramy"
            target="_blank"
            rel="noreferrer"
            onClick={close}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-tomato py-3 font-semibold text-cream transition hover:scale-[1.02]"
          >
            <Instagram size={18} /> Obserwuj @po_zeramy
          </a>
          <button
            onClick={close}
            className="pz-hit mt-3 text-xs text-muted-foreground underline hover:text-foreground"
          >
            może później
          </button>
        </div>
      </div>
    </div>
  );
}
