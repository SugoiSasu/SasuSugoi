import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Instagram, Star, Heart, X, MapPin, Sparkles, Clock, Mail } from "lucide-react";
import { toast } from "sonner";
import { SmartText } from "@/components/SmartText";
import { DiscoverHeader } from "@/components/DiscoverHeader";
import { SuggestPlacePanel } from "@/components/SuggestPlacePanel";
import { cuisineMeta } from "@/data/places";
import { usePlaces, usePlaceRatingsMap, type Place } from "@/lib/places-api";
import { searchPlaces } from "@/lib/place-search";
import { useDebounced } from "@/lib/use-debounced";
import { useUser } from "@/lib/use-auth";
import { useIsFavorite, useToggleFavorite } from "@/lib/favorites-api";
import { useFriendRecommendations } from "@/lib/friends-api";
import { useActiveAds, type Ad } from "@/lib/ads-api";
import { SponsoredDiscoverCard } from "@/components/SponsoredDiscoverCard";
import { pickSeeded } from "@/lib/seeded-pick";
import { useCutoutLogo } from "@/lib/chroma-cutout";
import { CuisineFallbackCover } from "@/components/CuisineFallbackCover";
import logoDark from "@/assets/brand/po_zeramy-logo-dark.png.asset.json";

export const Route = createFileRoute("/")({
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
      { property: "og:image", content: logoDark.url },
    ],
    links: [
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

  const byCuisine = useMemo(
    () => published.filter((p) => (cuisine ? p.cuisine === cuisine : true)),
    [published, cuisine],
  );

  const search = useMemo(
    () => searchPlaces(byCuisine, debouncedQuery),
    [byCuisine, debouncedQuery],
  );
  const filtered = search.results;
  const filteredIds = useMemo(() => new Set(filtered.map((p) => p.id)), [filtered]);

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
      />

      <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:max-w-7xl">
        {!empty && search.fuzzy && (
          <p className="mb-4 rounded-2xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
            Nie znaleźliśmy dokładnego dopasowania dla „{debouncedQuery}" - pokazujemy najbliższe
            wyniki.
          </p>
        )}

        {empty && (
          <div className="rounded-3xl border border-border bg-card p-8 text-center">
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
            href="mailto:kontakt@pozeramy.live"
            className="pz-hit inline-flex items-center gap-1 hover:text-tomato hover:underline"
          >
            <Mail size={12} /> kontakt@pozeramy.live
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
                className="w-[15rem] shrink-0 overflow-hidden rounded-3xl border border-border bg-card lg:w-auto lg:shrink"
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
function DiscoverCard({ place, stat }: { place: Place; stat?: { avg: number; count: number } }) {
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
          <span
            className="absolute bottom-3 left-3 chip text-cream shadow-sm"
            style={{ backgroundColor: meta.color }}
          >
            {meta.emoji} {place.cuisine}
          </span>
        </div>
        <div className="p-4">
          <SmartText as="h3" className="font-display text-lg leading-tight">
            {place.name}
          </SmartText>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {place.cuisine}
            {place.price_range ? ` • ${place.price_range}` : ""}
          </p>
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
}

/* --------------------------- first visit popup --------------------------- */
function FirstVisitPopup() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem("pozeramy_ig_popup_seen")) {
        const t = setTimeout(() => setOpen(true), 1200);
        return () => clearTimeout(t);
      }
    } catch {
      /* ignore */
    }
  }, []);

  if (!open) return null;
  const close = () => {
    try {
      localStorage.setItem("pozeramy_ig_popup_seen", "1");
    } catch {
      /* ignore */
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
        className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-cream shadow-2xl"
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
          <p className="mb-4 font-semibold text-navy">
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
            className="mt-3 text-xs text-muted-foreground underline hover:text-navy"
          >
            może później
          </button>
        </div>
      </div>
    </div>
  );
}
