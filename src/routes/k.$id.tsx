import { BackButton } from "@/components/BackButton";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { lazy, Suspense, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Place, OpeningHours } from "@/lib/places-api";

import { cuisineMeta, CUISINES } from "@/data/places";
import {
  ArrowLeft, Star, MapPin, Loader2, BookOpen, ExternalLink, Home,
  Map as MapIcon, Heart, Play, Navigation, Phone, Globe, Clock, Wallet,
  ShoppingBag, Accessibility, Copy, Share2, ChevronDown,
} from "lucide-react";
import { PlaceReviewsSection } from "@/components/PlaceReviewsSection";
import { Skeleton } from "@/components/ui/skeleton";
import { usePlaceReviewStats } from "@/lib/reviews-api";
import { SmartText } from "@/components/SmartText";
import { UserAvatar } from "@/components/UserAvatar";
import { useUser, useIsAdmin } from "@/lib/use-auth";
import { useIsFavorite, useToggleFavorite, useFriendsWhoFavorited, useFavoriteCount } from "@/lib/favorites-api";
import { useIsFollowing, useToggleFollow, useFollowCount } from "@/lib/follows-api";
import { usePlaceOwner, useIsOwnerOf } from "@/lib/owners-api";
import { OwnerRequestModal } from "@/components/OwnerRequestModal";
import { EditableImageButton } from "@/components/EditableImageButton";
import { Bell, BellOff, ShieldCheck, Trophy } from "lucide-react";
import { usePlaceAwardWins } from "@/lib/awards-api";
import { VisitStatusButton } from "@/components/VisitStatus";
import { InstagramReelPoster } from "@/components/InstagramReelEmbed";
import sadPizza from "@/assets/brand/sad-pizza-404.png";

const FoodMap = lazy(() => import("@/components/FoodMap"));

function clamp(str: string, max: number) {
  if (str.length <= max) return str;
  return str.slice(0, max - 1).trimEnd() + "…";
}

export const Route = createFileRoute("/k/$id")({
  loader: async ({ params }) => {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.id);
    const q = supabase
      .from("places")
      .select("name,description,cover_image_url,address,rating,cuisine,slug,id");
    const { data } = await (isUuid ? q.eq("id", params.id) : q.eq("slug", params.id)).maybeSingle();
    if (!data) throw notFound();
    return { place: data };
  },
  head: ({ params, loaderData }) => {
    const place = loaderData?.place ?? null;
    const fallbackDesc = `Profil lokalu na poŻeramy - adres, menu, recenzje i opinie poznańskich foodies.`;
    const name = place?.name ?? "Profil knajpy";
    const title = clamp(`${name} - poŻeramy Poznań`, 60);
    const description = clamp(
      place?.description?.trim() ||
        (place ? `${name} w Poznaniu - ${place.cuisine ?? "kuchnia"}, ${place.address ?? "Poznań"}. Recenzje, menu i ocena na poŻeramy.` : fallbackDesc),
      160,
    );
    const url = `https://pozeramy.live/k/${params.id}`;
    const meta: Array<Record<string, string>> = [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:url", content: url },
      { property: "og:type", content: "restaurant" },
    ];
    if (place?.cover_image_url) {
      meta.push({ property: "og:image", content: place.cover_image_url });
      meta.push({ name: "twitter:image", content: place.cover_image_url });
    }
    const scripts = place
      ? [
          {
            type: "application/ld+json",
            children: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Restaurant",
              name: place.name,
              description: place.description ?? undefined,
              image: place.cover_image_url ? [place.cover_image_url] : undefined,
              address: place.address
                ? { "@type": "PostalAddress", streetAddress: place.address, addressLocality: "Poznań", addressCountry: "PL" }
                : undefined,
              servesCuisine: place.cuisine ?? undefined,
              aggregateRating: undefined,
              url,
            }),
          },
        ]
      : undefined;
    return {
      meta,
      links: [{ rel: "canonical", href: url }],
      scripts,
    };
  },
  component: PlaceProfile,
  errorComponent: ({ error }) => (
    <div className="max-w-2xl mx-auto py-20 px-6 text-center">
      <h1 className="font-display text-3xl mb-2">Coś poszło nie tak</h1>
      <p className="text-muted-foreground">{error.message}</p>
    </div>
  ),
  notFoundComponent: () => {
    const { id } = Route.useParams();
    return <PlaceNotFound id={id} />;
  },
});

function PlaceNotFound({ id }: { id: string }) {
  const shortId = id.length > 8 ? `${id.slice(0, 8)}…` : id;
  return (
    <main id="main-content" className="min-h-dvh bg-navy text-cream overflow-hidden relative">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <span className="absolute top-[12%] left-[42%] w-2.5 h-2.5 rounded-full bg-tomato" />
        <span className="absolute top-[18%] right-[8%] w-3 h-3 rounded-full bg-tomato/80" />
      </div>
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-10 pb-16">
        <div className="grid lg:grid-cols-[1.1fr_1fr] gap-8 items-center">
          <div>
            <h1 className="font-display leading-none text-[140px] sm:text-[200px]">404</h1>
            <SmartText as="h2" className="text-3xl sm:text-5xl leading-[1.05] mt-2 mb-5 uppercase font-display">
              Tego lokalu <span className="text-tomato">nie pożarliśmy.</span>
            </SmartText>
            <p className="text-cream/75 mb-6">Wróć na główną i znajdź coś pysznego 😋</p>
            <div className="flex flex-wrap gap-3">
              <Link to="/" className="inline-flex items-center gap-2 rounded-full bg-tomato text-cream px-6 py-3 font-bold uppercase text-sm">
                <Home size={16} /> Strona główna
              </Link>
              <Link to="/" hash="mapa" className="inline-flex items-center gap-2 rounded-full border-2 border-cream/80 px-6 py-3 font-bold uppercase text-sm">
                <MapIcon size={16} /> Mapa
              </Link>
            </div>
          </div>
          <img src={sadPizza} alt="Smutna pizza" className="w-full h-auto drop-shadow-2xl" />
        </div>
        <div className="mt-10 rounded-3xl border border-cream/15 bg-cream/5 p-5">
          <div className="text-cream/90 mb-4 font-display uppercase">A może coś innego?</div>
          <div className="flex flex-wrap gap-2.5">
            {CUISINES.map((c) => {
              const meta = cuisineMeta(c);
              return (
                <Link key={c} to="/" hash="mapa" className="chip text-cream" style={{ backgroundColor: meta.color }}>
                  <span>{meta.emoji}</span> {c}
                </Link>
              );
            })}
          </div>
          <div className="mt-4 text-xs text-cream/50">ID: {shortId}</div>
        </div>
      </div>
    </main>
  );
}

function usePlace(idOrSlug: string) {
  return useQuery({
    queryKey: ["place", idOrSlug],
    queryFn: async () => {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
      const query = supabase
        .from("places")
        .select("*, locations:place_locations(*)");
      const { data, error } = await (isUuid ? query.eq("id", idOrSlug) : query.eq("slug", idOrSlug)).maybeSingle();
      if (error) throw error;
      if (!data) throw notFound();
      const place = data as unknown as Place;
      return {
        ...place,
        locations: (place.locations ?? []).slice().sort((a, b) => a.sort_order - b.sort_order),
      } as Place;
    },
  });
}

/* ---- Helpers ---- */
const DAY_KEYS: (keyof OpeningHours)[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_LABELS: Record<keyof OpeningHours, string> = {
  mon: "Pon", tue: "Wt", wed: "Śr", thu: "Czw", fri: "Pt", sat: "Sob", sun: "Nd",
};

function todayKey(): keyof OpeningHours {
  // JS getDay: 0=Sun ... 6=Sat
  const d = new Date().getDay();
  return (["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const)[d];
}

function isOpenNow(hours: OpeningHours | null): { open: boolean; today?: { open: string; close: string } | null } {
  if (!hours) return { open: false };
  const today = hours[todayKey()] ?? null;
  if (!today) return { open: false, today: null };
  const now = new Date();
  const [oh, om] = today.open.split(":").map(Number);
  const [ch, cm] = today.close.split(":").map(Number);
  const cur = now.getHours() * 60 + now.getMinutes();
  const openMin = oh * 60 + om;
  let closeMin = ch * 60 + cm;
  if (closeMin <= openMin) closeMin += 24 * 60; // past midnight
  const curAdj = cur < openMin ? cur + 24 * 60 : cur;
  return { open: cur >= openMin && cur < closeMin || curAdj >= openMin && curAdj < closeMin, today };
}

function HoursTable({ hours }: { hours: OpeningHours }) {
  const today = todayKey();
  return (
    <ul className="divide-y divide-border rounded-xl border border-border overflow-hidden">
      {DAY_KEYS.map((d) => {
        const slot = hours[d];
        const isToday = d === today;
        return (
          <li
            key={d}
            className={`flex items-center justify-between px-3 py-2 text-sm ${isToday ? "bg-cream/60 font-semibold" : ""}`}
          >
            <span className="text-navy/80">{DAY_LABELS[d]}{isToday ? " · dziś" : ""}</span>
            <span className={slot ? "text-navy" : "text-muted-foreground"}>
              {slot ? `${slot.open}–${slot.close}` : "Zamknięte"}
            </span>
          </li>
        );
      })}
    </ul>
  );
}



function PlaceAvatar({ name, cover, color }: { name: string; cover: string | null; color: string }) {
  const initials = (name || "?")
    .split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
  const box = { width: "clamp(56px, 12vw, 88px)", height: "clamp(56px, 12vw, 88px)" };
  if (cover) {
    return (
      <img
        src={cover}
        alt=""
        loading="lazy"
        style={box}
        className="aspect-square rounded-2xl object-cover border-2 border-navy flex-shrink-0 shadow-sm bg-cream"
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
      />
    );
  }
  return (
    <div
      style={{ ...box, backgroundColor: color }}
      className="aspect-square rounded-2xl grid place-items-center text-cream font-display text-xl flex-shrink-0 shadow-sm border-2 border-navy"
      aria-hidden
    >
      {initials}
    </div>
  );
}

function PlaceProfileSkeleton() {
  return (
    <div className="bg-cream min-h-dvh">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-5 pb-24">
        <Skeleton className="h-9 w-40 rounded-full mb-5" />
        <div className="flex items-start gap-3 mb-5">
          <Skeleton className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
        <Skeleton className="h-12 rounded-full mb-2" />
        <div className="grid grid-cols-2 gap-2 mb-3">
          <Skeleton className="h-11 rounded-full" />
          <Skeleton className="h-11 rounded-full" />
        </div>
        <div className="flex gap-2 mb-6">
          <Skeleton className="h-8 w-24 rounded-full" />
          <Skeleton className="h-8 w-20 rounded-full" />
          <Skeleton className="h-8 w-28 rounded-full" />
        </div>
        <Skeleton className="h-14 rounded-2xl mb-3" />
        <Skeleton className="h-14 rounded-2xl mb-3" />
        <Skeleton className="h-60 rounded-2xl" />
      </div>
    </div>
  );
}



function PlaceProfile() {
  const { id } = Route.useParams();
  const { data: place, isLoading } = usePlace(id);
  const { data: verifiedOwner } = usePlaceOwner((place as Place | undefined)?.id ?? "");
  const { data: awardWins } = usePlaceAwardWins((place as Place | undefined)?.id);
  const reviewStats = usePlaceReviewStats((place as Place | undefined)?.id);
  const { data: isOwnerOfPlace } = useIsOwnerOf((place as Place | undefined)?.id ?? "");
  const { data: isAdmin } = useIsAdmin();
  const canEditImages = !!isOwnerOfPlace || !!isAdmin;

  if (isLoading) {
    return <PlaceProfileSkeleton />;
  }
  if (!place) return null;

  const meta = cuisineMeta(place.cuisine);
  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.address)}`;
  const openInfo = isOpenNow(place.opening_hours);
  const showPromo = !!place.promo_active && !!place.promo_label?.trim();

  const badges = [place.cuisine, place.district].filter(Boolean).join(" · ");

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(place!.address);
      toast.success("Skopiowano adres");
    } catch { toast.error("Nie udało się skopiować"); }
  }

  async function share() {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: place!.name, url }); return; } catch {}
    }
    try { await navigator.clipboard.writeText(url); toast.success("Skopiowano link"); }
    catch { toast.error("Nie udało się skopiować"); }
  }

  return (
    <div className="bg-cream min-h-dvh">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-5 pb-40 lg:max-w-6xl lg:pb-24">
        <div className="mb-5">
          <BackButton to="/" hash="mapa" label="Wróć do mapy" ariaLabel="Wróć do mapy lokali" />
        </div>

        {showPromo && (
          <div className="mb-4 rounded-2xl px-4 py-2.5 text-sm font-medium text-center" style={{ backgroundColor: "#F5BDA6", color: "#221e50" }}>
            {place.promo_label}
          </div>
        )}

      <div className="lg:grid lg:grid-cols-[1.6fr_1fr] lg:items-start lg:gap-8">
      <div className="lg:col-start-1 lg:row-start-1">
        {/* HERO cover */}
        <div className="mb-5 relative rounded-3xl overflow-hidden border-2 border-navy/10 shadow-lg h-[180px] sm:h-[280px]">
          {place.cover_image_url ? (
            <img
              src={place.cover_image_url}
              alt={`Zdjęcie lokalu ${place.name}`}
              className="w-full h-full object-cover"
              loading="eager"
            />
          ) : (
            <div className="w-full h-full grid place-items-center text-6xl" style={{ backgroundColor: meta.color }}>
              <span aria-hidden="true">{meta.emoji}</span>
            </div>
          )}
          <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-navy/80 via-navy/15 to-transparent" />
          <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between gap-3">
            <span className="chip bg-cream/95 text-navy text-xs font-semibold">{meta.emoji} {place.cuisine}</span>
            {reviewStats.count > 0 && reviewStats.avg !== null && (
              <span className="chip bg-navy text-cream text-xs font-bold inline-flex items-center gap-1">
                <Star size={12} className="fill-cream text-cream" /> {reviewStats.avg.toFixed(1)}
              </span>
            )}
          </div>
          {canEditImages && (
            <EditableImageButton
              placeId={place.id}
              kind="cover"
              label="Zmień okładkę"
              className="absolute right-3 top-3 h-9 w-9"
            />
          )}
        </div>




        {/* Name + badges + rating summary (no colored image card) */}
        <header className="mb-5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0 flex-1 flex items-start gap-3">
              <div className="relative shrink-0">
                <PlaceAvatar name={place.name} cover={place.avatar_url ?? place.cover_image_url} color={meta.color} />
                {canEditImages && (
                  <EditableImageButton
                    placeId={place.id}
                    kind="avatar"
                    label="Zmień logo"
                    className="absolute -right-1 -bottom-1 h-7 w-7"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <SmartText as="h1" className="font-persona text-3xl sm:text-5xl text-balance leading-tight mb-2">{place.name}</SmartText>
                <div className="flex flex-wrap gap-2 items-center mb-2">
                  <span className="chip text-cream text-xs" style={{ backgroundColor: meta.color }}>
                    {meta.emoji} {badges}
                  </span>
                  {verifiedOwner && (
                    <span className="chip bg-emerald-600 text-white text-xs inline-flex items-center gap-1" title="Profil zarządzany przez zweryfikowanego właściciela">
                      <ShieldCheck size={12} /> Zweryfikowany właściciel
                    </span>
                  )}
                  {(awardWins ?? []).map((w) => (
                    <span
                      key={w.id}
                      className="chip bg-mustard text-navy text-xs inline-flex items-center gap-1"
                      title={`${w.vote_count} głosów`}
                    >
                      <Trophy size={12} /> {w.event?.name ?? "Warte poŻarcia"} - {w.cuisine?.name}
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-3 text-sm flex-wrap">
                  {reviewStats.count > 0 && reviewStats.avg !== null ? (
                    <span className="inline-flex items-center gap-1 font-bold">
                      <Star size={15} className="fill-tomato text-tomato" /> {reviewStats.avg.toFixed(1)}
                      <span className="text-muted-foreground font-normal">({reviewStats.count})</span>
                    </span>
                  ) : (
                    <span className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Brak ocen</span>
                  )}
                  <FavoriteCountBadge placeId={place.id} />
                  <FollowCountBadge placeId={place.id} />
                  <a href={mapsHref} target="_blank" rel="noreferrer" className="text-muted-foreground inline-flex items-center gap-1 hover:text-tomato">
                    <MapPin size={14} /> {place.address}
                  </a>
                </div>
              </div>
            </div>
            <div className="flex gap-2 shrink-0 items-center">
              <FollowButton placeId={place.id} />
            </div>
          </div>

          {place.description && (
            <p className="text-base text-navy/80 mt-3 leading-relaxed">{place.description}</p>
          )}
        </header>

        {/* Main action row: 3 equal primary buttons */}
        <div className="mb-3 grid grid-cols-3 gap-2">
          <VisitStatusButton placeId={place.id} status="want" className="w-full justify-center text-[10px] sm:text-xs px-2 sm:px-4 py-2.5 whitespace-nowrap" />
          <VisitStatusButton placeId={place.id} status="visited" className="w-full justify-center text-[10px] sm:text-xs px-2 sm:px-4 py-2.5 whitespace-nowrap" />
          <FavoriteIconButton placeId={place.id} variant="text" className="w-full text-[10px] sm:text-xs px-2 sm:px-4 py-2.5 whitespace-nowrap" />
        </div>

        {/* Secondary quick actions: Navigate / Call / Website / Share (icon-only on mobile) */}
        <div className="mb-4 flex items-center gap-2">
          <a
            href={mapsHref}
            target="_blank"
            rel="noreferrer"
            aria-label="Nawiguj do lokalu"
            className="flex-1 min-w-0 inline-flex items-center justify-center gap-1.5 rounded-full border-2 border-navy/80 text-navy px-2 py-2 text-xs sm:text-sm font-medium hover:bg-navy hover:text-cream transition"
          >
            <Navigation size={16} /> <span className="hidden sm:inline truncate">Nawiguj</span>
          </a>
          {place.phone ? (
            <a
              href={`tel:${place.phone.replace(/\s/g, "")}`}
              aria-label="Zadzwoń do lokalu"
              className="flex-1 min-w-0 inline-flex items-center justify-center gap-1.5 rounded-full border-2 border-navy/80 text-navy px-2 py-2 text-xs sm:text-sm font-medium hover:bg-navy hover:text-cream transition"
            >
              <Phone size={16} /> <span className="hidden sm:inline truncate">Zadzwoń</span>
            </a>
          ) : (
            <span
              title="Brak numeru telefonu"
              className="flex-1 min-w-0 inline-flex items-center justify-center gap-1.5 rounded-full border-2 border-border text-muted-foreground px-2 py-2 text-xs sm:text-sm font-medium cursor-not-allowed"
            >
              <Phone size={16} /> <span className="hidden sm:inline truncate">Zadzwoń</span>
            </span>
          )}
          {place.website ? (
            <a
              href={place.website}
              target="_blank"
              rel="noreferrer"
              aria-label="Strona www lokalu"
              className="flex-1 min-w-0 inline-flex items-center justify-center gap-1.5 rounded-full border-2 border-navy/80 text-navy px-2 py-2 text-xs sm:text-sm font-medium hover:bg-navy hover:text-cream transition"
            >
              <Globe size={16} /> <span className="hidden sm:inline truncate">Strona www</span>
            </a>
          ) : (
            <span
              title="Brak strony www"
              className="flex-1 min-w-0 inline-flex items-center justify-center gap-1.5 rounded-full border-2 border-border text-muted-foreground px-2 py-2 text-xs sm:text-sm font-medium cursor-not-allowed"
            >
              <Globe size={16} /> <span className="hidden sm:inline truncate">Strona www</span>
            </span>
          )}
          <button
            type="button"
            onClick={share}
            aria-label="Udostępnij"
            className="flex-1 min-w-0 inline-flex items-center justify-center gap-1.5 rounded-full border-2 border-navy/80 text-navy px-2 py-2 text-xs sm:text-sm font-medium hover:bg-navy hover:text-cream transition"
          >
            <Share2 size={16} /> <span className="hidden sm:inline truncate">Udostępnij</span>
          </button>
        </div>

        {/* QUICK INFO bar */}
        <div className="mb-6 -mx-4 sm:mx-0 px-4 sm:px-0 overflow-x-auto scrollbar-none">
          <div className="flex gap-2 min-w-min">
            {(openInfo.today || place.opening_hours) && (
              <QuickChip
                icon={<Clock size={14} />}
                label={openInfo.today ? `Dziś: ${openInfo.today.open}–${openInfo.today.close}` : "Dziś zamknięte"}
                badge={openInfo.open ? { text: "Otwarte", color: "#059669" } : { text: "Zamknięte", color: "#dc2626" }}
              />
            )}
            {place.price_range && <QuickChip icon={<Wallet size={14} />} label={place.price_range} />}
            {place.has_takeaway && <QuickChip icon={<ShoppingBag size={14} />} label="Na wynos" />}
            {place.wheelchair_accessible && <QuickChip icon={<Accessibility size={14} />} label="Bez schodów" />}
          </div>
        </div>
      </div>

      <div className="lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:sticky lg:top-6">
        {place.opening_hours && (
          <Collapsible
            title="Godziny otwarcia"
            icon={<Clock size={18} />}
            summary={
              <span className={openInfo.open ? "text-emerald-700 font-semibold" : "text-rose-700 font-semibold"}>
                {openInfo.open
                  ? `Otwarte${openInfo.today ? ` do ${openInfo.today.close}` : ""}`
                  : openInfo.today ? `Zamknięte · dziś ${openInfo.today.open}–${openInfo.today.close}` : "Dziś zamknięte"}
              </span>
            }
          >
            <HoursTable hours={place.opening_hours} />
          </Collapsible>
        )}

        {/* MINI-MAP - collapsible */}
        <Collapsible
          title="Mapa i dojazd"
          icon={<MapIcon size={18} />}
          defaultOpen
          summary={<span className="truncate">{place.address}</span>}
        >
          <div className="relative rounded-2xl overflow-hidden border-2 border-navy h-[200px] sm:h-[240px] touch-pan-y">
            <Suspense fallback={<div className="h-full bg-muted animate-pulse" />}>
              <FoodMap places={[place]} variant="mini" />
            </Suspense>
            <a
              href={mapsHref}
              target="_blank"
              rel="noreferrer"
              className="pz-hit absolute bottom-2 right-2 rounded-full bg-navy text-cream px-3 py-1.5 text-xs font-semibold shadow-lg inline-flex items-center gap-1 hover:bg-tomato transition z-[500]"
              aria-label="Otwórz w Google Maps"
            >
              <ExternalLink size={12} /> Otwórz w Maps
            </a>
          </div>
          <div className="mt-2 flex items-center gap-2 text-sm">
            <MapPin size={14} className="text-tomato flex-shrink-0" />
            <span className="text-navy/80 flex-1 truncate">{place.address}</span>
            <button onClick={copyAddress} className="pz-hit inline-flex items-center gap-1 text-xs font-semibold text-tomato hover:underline">
              <Copy size={12} /> Kopiuj
            </button>
          </div>
          {(place.locations?.length ?? 0) > 0 && (
            <>
              <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-navy/60">
                Inne lokalizacje {place.name}
              </p>
              <ul className="mt-1.5 grid sm:grid-cols-2 gap-2 text-sm">
                {place.locations!.map((l) => (
                  <li key={l.id} className="rounded-xl border border-border bg-card px-3 py-2">
                    {l.label && <div className="text-xs uppercase tracking-wider font-bold text-navy/70">{l.label}</div>}
                    <div>{l.address}</div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Collapsible>
      </div>

      <div className="lg:col-start-1 lg:row-start-2">
        <FriendsFavoritedNotice placeId={place.id} placeName={place.name} />

        {/* MENU - collapsible */}
        <MenuSection place={place} />

        {/* IG reel - branded poster; real embed loads only once opened */}
        {place.reel_url && (
          <Collapsible
            title="Rolka z Instagrama"
            icon={<Play size={18} />}
            defaultOpen={false}
          >
            <InstagramReelPoster
              reelUrl={place.reel_url}
              cuisine={place.cuisine}
              placeName={place.name}
            />
          </Collapsible>
        )}

        {/* REVIEWS (with rating summary + breakdown at top) */}
        <PlaceReviewsSection placeId={place.id} />

        <OwnerFooter placeId={place.id} placeName={place.name} />
      </div>
      </div>
      </div>

      {/* Sticky mobile action bar */}
      <div className="lg:hidden fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom,0px))] z-30 px-3 pb-2">
        <div className="flex items-center gap-2 rounded-full border border-border bg-card/95 backdrop-blur-md shadow-xl px-2 py-2">
          <a
            href={mapsHref}
            target="_blank"
            rel="noreferrer"
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-navy text-cream px-4 py-2.5 text-sm font-bold"
          >
            <Navigation size={16} /> Nawiguj
          </a>
          <FavoriteIconButton placeId={place.id} tone="dark" />
          <button onClick={share} aria-label="Udostępnij" className="w-11 h-11 shrink-0 rounded-full border-2 border-navy text-navy grid place-items-center">
            <Share2 size={18} />
          </button>
        </div>
      </div>
    </div>

  );
}



function FollowButton({ placeId }: { placeId: string }) {
  const { user } = useUser();
  const isFollowing = useIsFollowing(placeId);
  const toggleFollow = useToggleFollow();
  const busy = toggleFollow.isPending;

  if (!user) {
    return (
      <Link
        to="/auth"
        aria-label="Zaloguj się aby obserwować"
        className="h-11 px-4 inline-flex items-center gap-2 rounded-full border-2 border-navy text-navy hover:bg-navy hover:text-cream text-sm font-semibold transition"
      >
        <Bell size={16} /> <span className="hidden sm:inline">Obserwuj</span>
      </Link>
    );
  }

  const handleClick = async () => {
    if (busy) return;
    try {
      await toggleFollow.mutateAsync({ placeId, on: !isFollowing });
      if (isFollowing) {
        toast("Przestałeś obserwować knajpę", {
          icon: <BellOff size={16} className="text-muted-foreground" />,
          description: "Nie będziesz już dostawać powiadomień o nowościach i promocjach tego lokalu.",
        });
      } else {
        toast.success("Obserwujesz knajpę", {
          icon: <Bell size={16} className="text-tomato" />,
          description: "Będziesz dostawać powiadomienia o nowościach i promocjach tego lokalu.",
        });
      }
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <button
      type="button"
      disabled={busy}
      aria-pressed={isFollowing}
      aria-label={isFollowing ? "Przestań obserwować" : "Obserwuj knajpę"}
      onClick={handleClick}
      className={`h-11 px-4 inline-flex items-center gap-2 rounded-full text-sm font-semibold transition disabled:opacity-60 ${
        isFollowing
          ? "bg-navy text-cream hover:bg-tomato"
          : "border-2 border-navy text-navy hover:bg-navy hover:text-cream"
      }`}
    >
      {busy ? (
        <Loader2 size={16} className="animate-spin" />
      ) : isFollowing ? (
        <BellOff size={16} />
      ) : (
        <Bell size={16} />
      )}
      <span className="hidden sm:inline">{isFollowing ? "Przestań obserwować" : "Obserwuj"}</span>
    </button>
  );
}

function OwnerFooter({ placeId, placeName }: { placeId: string; placeName: string }) {
  const [modalOpen, setModalOpen] = useState(false);
  const { data: owner } = usePlaceOwner(placeId);
  const { data: isOwner } = useIsOwnerOf(placeId);

  return (
    <div className="mt-8 space-y-4">
      {owner && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 flex items-center gap-2 text-sm text-navy">
          <ShieldCheck size={18} className="text-emerald-600 shrink-0" />
          <span>Profil zarządzany przez zweryfikowanego właściciela</span>
        </div>
      )}

      {isOwner && (
        <div className="flex flex-wrap gap-2 items-center">
          <Link
            to="/owner/$placeId"
            params={{ placeId }}
            className="pz-hit inline-flex items-center gap-1.5 rounded-full bg-emerald-600 text-white px-3 py-1.5 text-xs font-bold hover:bg-emerald-700 transition"
          >
            <ShieldCheck size={12} /> Zarządzaj knajpą
          </Link>
        </div>
      )}

      <div className="pt-4 border-t border-border text-center">
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="text-xs text-navy/50 hover:text-tomato underline underline-offset-4"
        >
          Jesteś właścicielem tego miejsca? Zgłoś się
        </button>
        <div className="text-[10px] text-navy/40 mt-0.5">
          Zweryfikujemy to i odezwiemy się do Ciebie
        </div>
      </div>

      <OwnerRequestModal
        placeId={placeId}
        placeName={placeName}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}

/** Smooth expand/collapse card with grid-rows animation. */
function Collapsible({
  title, icon, defaultOpen = true, summary, children,
}: {
  title: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  summary?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="mb-6 rounded-2xl border border-border bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-cream/40 transition"
      >
        <span className="text-tomato shrink-0">{icon}</span>
        <span className="flex-1 min-w-0">
          <span className="block font-display text-xl leading-tight">{title}</span>
          {!open && summary && (
            <span className="block text-xs text-muted-foreground mt-0.5 truncate">{summary}</span>
          )}
        </span>
        <ChevronDown
          size={20}
          className={`shrink-0 text-navy/60 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        />
      </button>
      <div
        className="pz-collapse-grid"
        style={{ gridTemplateRows: open ? "1fr" : "0fr", opacity: open ? 1 : 0 }}
        aria-hidden={!open}
      >
        <div className="pz-collapse-inner">
          <div className="px-4 pb-4 pt-1">{children}</div>
        </div>
      </div>
    </section>
  );
}

function QuickChip({ icon, label, badge }: { icon: React.ReactNode; label: string; badge?: { text: string; color: string } }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-white border border-border px-3 py-2 text-sm whitespace-nowrap shadow-sm">
      <span className="text-navy/70">{icon}</span>
      <span className="font-medium text-navy">{label}</span>
      {badge && (
        <span className="text-xs font-bold text-white rounded-full px-2 py-0.5" style={{ backgroundColor: badge.color }}>
          {badge.text}
        </span>
      )}
    </div>
  );
}

function MenuSection({ place }: { place: Place }) {
  const cats = place.menu_items ?? [];
  const hasMenu = cats.length > 0 && cats.some((c) => c.items.length > 0);

  const itemCount = cats.reduce((s, c) => s + c.items.length, 0);
  const summary = hasMenu
    ? `${itemCount} pozycji w ${cats.filter((c) => c.items.length > 0).length} kategoriach`
    : place.menu_url || place.menu_image_url
      ? "Zobacz pełne menu"
      : "Menu jeszcze nieuzupełnione";

  return (
    <Collapsible title="Menu" icon={<BookOpen size={18} />} defaultOpen={hasMenu} summary={summary}>
      {hasMenu ? (
        <div className="space-y-5">
          {cats.map((cat, i) => cat.items.length > 0 && (
            <div key={i}>
              <h3 className="text-xs uppercase tracking-wider font-bold text-tomato mb-2">{cat.category}</h3>
              <ul className="divide-y divide-border rounded-2xl border border-border bg-card overflow-hidden">
                {cat.items.map((item, j) => (
                  <li key={j} className="px-4 py-3 flex items-baseline gap-3">
                    <span className="flex-1 font-medium">{item.name}</span>
                    {item.price && <span className="font-bold text-navy whitespace-nowrap">{item.price}</span>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {place.menu_url && (
            <a href={place.menu_url} target="_blank" rel="noreferrer"
               className="inline-flex items-center gap-2 text-sm text-navy hover:text-tomato font-semibold">
              <ExternalLink size={14} /> Pełne menu na stronie lokalu
            </a>
          )}
        </div>
      ) : place.menu_url || place.menu_image_url ? (
        <div className="space-y-3">
          {place.menu_image_url && (
            <a href={place.menu_url || place.menu_image_url} target="_blank" rel="noreferrer"
               className="block rounded-2xl overflow-hidden border-2 border-navy bg-card">
              <img src={place.menu_image_url} alt={`Menu ${place.name}`} className="w-full h-auto object-contain" style={{ maxHeight: 520 }} loading="lazy" />
            </a>
          )}
          {place.menu_url && (
            <a href={place.menu_url} target="_blank" rel="noreferrer"
               className="inline-flex items-center gap-2 rounded-full bg-navy text-cream px-5 py-2.5 font-semibold hover:bg-tomato transition">
              <ExternalLink size={16} /> Otwórz pełne menu
            </a>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-dashed border-border p-6 text-center">
          <p className="text-sm text-muted-foreground mb-3">Menu jeszcze nieuzupełnione. Wiesz co warto zjeść?</p>
          <Link to="/" hash="mapa" className="inline-flex items-center gap-2 rounded-full border-2 border-navy text-navy px-4 py-2 font-semibold hover:bg-navy hover:text-cream transition text-sm">
            Zaproponuj menu
          </Link>
        </div>
      )}
    </Collapsible>
  );
}


function FavoriteCountBadge({ placeId }: { placeId: string }) {
  const count = useFavoriteCount(placeId);
  if (count <= 0) return null;
  return (
    <span className="inline-flex items-center gap-1 text-navy/80 font-semibold text-sm">
      <Heart size={13} className="fill-tomato text-tomato" />
      {count}
    </span>
  );
}

function FollowCountBadge({ placeId }: { placeId: string }) {
  const count = useFollowCount(placeId);
  if (count <= 0) return null;
  return (
    <span
      className="inline-flex items-center gap-1 text-navy/80 font-semibold text-sm"
      title={`${count} ${count === 1 ? "obserwujący" : "obserwujących"}`}
    >
      <Bell size={13} className="fill-tomato text-tomato" />
      {count}
    </span>
  );
}

function FavoriteIconButton({
  placeId,
  tone = "light",
  variant = "icon",
  className = "",
}: {
  placeId: string;
  tone?: "light" | "dark";
  variant?: "icon" | "text";
  className?: string;
}) {
  const { user } = useUser();
  const isFav = useIsFavorite(placeId);
  const toggle = useToggleFavorite();

  if (variant === "text") {
    const base = "border-2 border-navy text-navy hover:bg-navy hover:text-cream";
    if (!user) {
      return (
        <Link
          to="/auth"
          className={`w-full inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 font-semibold transition ${isFav ? "bg-tomato text-cream hover:bg-tomato/90" : base} ${className}`}
        >
          <Heart size={16} className={isFav ? "fill-cream" : ""} /> Ulubione
        </Link>
      );
    }
    return (
      <button
        type="button"
        disabled={toggle.isPending}
        aria-pressed={isFav}
        aria-label={isFav ? "Usuń z ulubionych" : "Dodaj do ulubionych"}
        onClick={() => {
          const next = !isFav;
          toggle.mutate({ placeId, on: next }, {
            onSuccess: () => toast.success(next ? "Dodano do ulubionych ❤️" : "Usunięto z ulubionych"),
            onError: (e) => toast.error((e as Error).message),
          });
        }}
        className={`w-full inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 font-semibold transition disabled:opacity-50 ${isFav ? "bg-tomato text-cream hover:bg-tomato/90" : base} ${className}`}
      >
        <Heart size={16} className={isFav ? "fill-cream" : ""} /> Ulubione
      </button>
    );
  }

  const base = tone === "light"
    ? "bg-cream/90 hover:bg-cream text-navy"
    : "border-2 border-navy text-navy hover:bg-navy hover:text-cream";

  if (!user) {
    return (
      <Link to="/auth" aria-label="Zaloguj aby zapisać" className={`w-11 h-11 rounded-full grid place-items-center shadow-lg ${base} ${className}`}>
        <Heart size={18} />
      </Link>
    );
  }

  return (
    <button
      type="button"
      aria-label={isFav ? "Usuń z ulubionych" : "Dodaj do ulubionych"}
      disabled={toggle.isPending}
      onClick={() => {
        const next = !isFav;
        toggle.mutate({ placeId, on: next }, {
          onSuccess: () => toast.success(next ? "Dodano do ulubionych ❤️" : "Usunięto z ulubionych"),
          onError: (e) => toast.error((e as Error).message),
        });
      }}
      className={`w-11 h-11 rounded-full grid place-items-center shadow-lg disabled:opacity-50 ${isFav ? "bg-tomato text-cream hover:bg-tomato/90" : base} ${className}`}
    >
      <Heart size={18} className={isFav ? "fill-cream" : ""} />
    </button>
  );
}

function FriendsFavoritedNotice({ placeId, placeName }: { placeId: string; placeName: string }) {
  const { user } = useUser();
  const { data: friends } = useFriendsWhoFavorited(placeId);
  if (!user || !friends || friends.length === 0) return null;

  const names = friends
    .map((f) => f.display_name || (f.username ? `@${f.username}` : "Znajomy"))
    .filter(Boolean);
  const first = names.slice(0, 2).join(", ");
  const more = names.length > 2 ? ` i ${names.length - 2} innych` : "";
  const verb = names.length === 1 ? "ma" : "mają";

  return (
    <div className="mb-6 rounded-2xl border-2 border-tomato/40 bg-tomato/10 px-4 py-3 flex items-center gap-3 flex-wrap">
      <div className="flex -space-x-2">
        {friends.slice(0, 4).map((f) => (
          <Link
            key={f.user_id}
            to={f.username ? "/u/$username" : "/"}
            params={f.username ? { username: f.username } : undefined}
            className="ring-2 ring-cream rounded-full hover:scale-105 transition"
            title={f.display_name || f.username || ""}
          >
            <UserAvatar
              avatarUrl={f.avatar_url}
              avatarSource={f.avatar_source}
              displayName={f.display_name}
              username={f.username}
              size={32}
            />
          </Link>
        ))}
      </div>
      <p className="text-sm text-navy font-medium">
        <span className="font-bold">{first}</span>
        {more} {verb} <span className="font-bold">{placeName}</span> w ulubionych ❤️
      </p>
    </div>
  );
}



