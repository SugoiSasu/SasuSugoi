import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useTransform, animate } from "motion/react";
import { MapPin, Star, Users, ExternalLink } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { cuisineMeta } from "@/data/places";
import { placeOpenState } from "@/lib/places-api";
import type { Place } from "@/lib/places-api";
import { useCutoutLogoReady } from "@/lib/chroma-cutout";
import { InstagramReelPoster } from "@/components/InstagramReelEmbed";
import { UserAvatar } from "@/components/UserAvatar";
import { imieZnajomego, type ZnajomyLite } from "@/lib/karty-api";
import { cechyLokalu, liniaZnajomych, pierwszaPozycjaMenu } from "@/lib/karty-utils";
import { formatDistancePl } from "@/lib/geo";
import { formatCena } from "@/lib/price";
import { TrophyIcon } from "@/components/TrophyIcon";
import { podpisTrofeum, type Trofeum } from "@/lib/trophies";

const SWIPE_THRESHOLD = 120;
const UP_THRESHOLD = 130;
const VELOCITY_THRESHOLD = 500;

export type SwipeDirection = "left" | "right" | "up";

/** The single strongest thing your friends have done with this place, in
 *  priority order: a friend's opinion outweighs just having gone, which
 *  outweighs only having saved it. Null when none apply. */
export type FriendSignal = { kind: "recommend" | "visited" | "want"; count: number } | null;

const FRIEND_SIGNAL_TEXT: Record<
  "recommend" | "visited" | "want",
  (count: number) => string
> = {
  recommend: (n) => (n === 1 ? "1 znajomy poleca" : `${n} znajomych poleca`),
  visited: (n) => (n === 1 ? "1 znajomy tu był" : `${n} znajomych tu było`),
  want: (n) => (n === 1 ? "1 znajomy chce tu iść" : `${n} znajomych chce tu iść`),
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export function SwipeCard({
  place,
  isTop,
  rating,
  friendSignal = null,
  friendsWant = [],
  trofeum = null,
  distanceKm = null,
  expanded = false,
  onToggleExpanded,
  onSwipeCommit,
  onSwipe,
}: {
  place: Place;
  isTop: boolean;
  /** Real aggregated rating, when the place has any reviews at all. */
  rating?: { avg: number; count: number };
  /** The strongest reason your own friends give to swipe right - see FriendSignal. */
  friendSignal?: FriendSignal;
  /** Friends who marked this place "chcę odwiedzić" - avatars + names on the card. */
  friendsWant?: ZnajomyLite[];
  /** Najwyzsze trofeum lokalu (Michelin / Warte poZarcia), jesli jest. */
  trofeum?: Trofeum | null;
  /** Distance from the user, when they shared their location. */
  distanceKm?: number | null;
  expanded?: boolean;
  onToggleExpanded?: () => void;
  /** Fires the instant a drag passes the threshold - this is what actually
   * writes the decision, so it can never be lost to the user navigating
   * away before the (purely cosmetic) exit animation below finishes. */
  onSwipeCommit: (direction: SwipeDirection) => void;
  /** Fires after the fly-away animation completes - visual-only
   * bookkeeping (removing the card from the stack, the emoji burst). */
  onSwipe: (direction: SwipeDirection) => void;
}) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-240, 240], [-18, 18]);
  const wantOpacity = useTransform(x, [20, SWIPE_THRESHOLD], [0, 1]);
  const skipOpacity = useTransform(x, [-SWIPE_THRESHOLD, -20], [1, 0]);
  const favOpacity = useTransform([x, y], ([xv, yv]: number[]) => {
    const side = Math.max(clamp01(xv / SWIPE_THRESHOLD), clamp01(-xv / SWIPE_THRESHOLD));
    return clamp01(-yv / UP_THRESHOLD) * (1 - side);
  });
  const wantTint = useTransform(wantOpacity, (v) => v * 0.28);
  const skipTint = useTransform(skipOpacity, (v) => v * 0.28);
  const favTint = useTransform(favOpacity, (v) => v * 0.25);
  const meta = cuisineMeta(place.cuisine);
  // Same best-effort background removal the homepage already uses (a place
  // can opt out via avatar_cutout_enabled, e.g. a logo whose "background" is
  // actually part of the mark). Falls back to the raw file while the cutout
  // is still processing or unavailable, so the card never shows nothing.
  const cutout = useCutoutLogoReady(place.avatar_url, place.avatar_cutout_enabled !== false);
  const logoSrc = cutout.src ?? place.avatar_url ?? undefined;
  // Logo pokazujemy dopiero, gdy wycinanie sie skonczylo - wczesniej oryginal
  // z tlem podmienial sie po chwili na wyciety i logo "mrugalo".
  const logoWidoczne = cutout.gotowe;

  // Time-dependent state must not be computed during SSR or the first client
  // render: the server runs in UTC and the visitor does not, so the two would
  // disagree about whether a place is open and hydration would mismatch.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  const open = now ? placeOpenState(place.opening_hours, now) : { status: "unknown" as const };

  const imiona = friendsWant.map(imieZnajomego);
  const danie = pierwszaPozycjaMenu(place);
  const cechy = cechyLokalu(place);
  const rightChip = distanceKm != null ? formatDistancePl(distanceKm) : place.district;

  // A committed drag keeps flying off-screen for a moment while `isTop`/drag are
  // still both live (the parent only flips them once onSwipe fires at the end
  // of that animation) - without this guard, a second drag gesture started
  // during that window re-commits the same place, double-writing the mutation
  // and pushing a duplicate history entry. Ref, not state: must take effect
  // synchronously inside the same onDragEnd call that sets it, which a state
  // update scheduled for next render wouldn't.
  const committedRef = useRef(false);

  function commit(direction: SwipeDirection) {
    committedRef.current = true;
    onSwipeCommit(direction);
    const spring = { type: "spring" as const, stiffness: 250, damping: 30 };
    const anim =
      direction === "up"
        ? animate(y, -900, spring)
        : animate(x, direction === "right" ? 700 : -700, spring);
    anim.then(() => onSwipe(direction));
  }

  return (
    <motion.div
      className="absolute inset-0"
      // touch-action none: the card drags on both axes, so the browser must not
      // claim a vertical touch for page scroll. The expanded panel opts back in.
      style={{ x, y, rotate, touchAction: "none" }}
      // Nie wylaczamy dragu po zatwierdzeniu: zmiana tej wlasciwosci przerywa
      // animacje odlotu (framer zatrzymuje wartosci ruchu). Ponowny gest blokuje
      // committedRef, a strona wylacza zdarzenia myszy na odlatujacej karcie.
      drag={isTop}
      dragElastic={0.9}
      whileDrag={{ scale: 1.03 }}
      transition={{ scale: { type: "spring", stiffness: 400, damping: 25 } }}
      onTap={() => {
        if (isTop && !committedRef.current) onToggleExpanded?.();
      }}
      onDragEnd={(_event, info) => {
        if (committedRef.current) return;
        const { offset, velocity } = info;
        if (offset.x > SWIPE_THRESHOLD || velocity.x > VELOCITY_THRESHOLD) return commit("right");
        if (offset.x < -SWIPE_THRESHOLD || velocity.x < -VELOCITY_THRESHOLD) return commit("left");
        if (
          (offset.y < -UP_THRESHOLD || velocity.y < -VELOCITY_THRESHOLD) &&
          Math.abs(offset.x) < SWIPE_THRESHOLD
        ) {
          return commit("up");
        }
        animate(x, 0, { type: "spring", stiffness: 400, damping: 28 });
        animate(y, 0, { type: "spring", stiffness: 400, damping: 28 });
      }}
    >
      <div
        className="relative h-full w-full cursor-grab overflow-hidden rounded-[26px] border border-border bg-navy shadow-xl active:cursor-grabbing"
        style={{ backgroundColor: meta.color }}
      >
        {/* The card is built out of the logo: the same image twice, once blown
            past the card bounds and blurred into a wash of its own colours, once
            crisp in the middle. The blurred copy is scaled well over 100% because
            a blur samples transparent pixels past the edge and would otherwise
            fade the frame to nothing. The cuisine colour sits underneath so a
            logo that is mostly transparent still lands on something. */}
        <div className="absolute inset-0 overflow-hidden" style={{ backgroundColor: meta.color }}>
          <img loading="lazy" decoding="async"
            src={logoSrc}
            alt=""
            aria-hidden="true"
            className={`absolute left-1/2 top-1/2 h-full w-full object-cover transition-opacity duration-300 ${logoWidoczne ? "opacity-100" : "opacity-0"}`}
            style={{ filter: "blur(44px) saturate(2)", transform: "translate(-50%, -50%) scale(1.6)" }}
          />
          {/* A monochrome logo blurs to grey or near-black and the card loses
              all colour. Soft-light lifts a neutral wash towards the cuisine hue
              while barely touching one that is already saturated. */}
          <div
            className="absolute inset-0"
            style={{ backgroundColor: meta.color, mixBlendMode: "soft-light", opacity: 0.85 }}
          />
          <div className="absolute inset-0 bg-navy/45" />
          {/* Delikatna kropkowana siatka z projektu kart. */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: "radial-gradient(rgba(255,253,248,.07) 1.2px, transparent 1.6px)",
              backgroundSize: "16px 16px",
            }}
          />
        </div>

        {/* Kolumna zamiast pozycji absolutnych: logo bierze tyle miejsca, ile
            zostaje, a nazwa i stopka leza pod nim w przeplywie - na malej karcie
            (telefon) nic nie wjezdza na siebie. */}
        <div className="relative flex h-full flex-col">
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-6 pt-14 text-center sm:gap-3">
            <div
              className={`relative grid aspect-square min-h-16 flex-1 place-items-center transition-[max-height] duration-300 ${expanded ? "max-h-16" : "max-h-48"}`}
            >
              <span
                aria-hidden="true"
                className="absolute inset-[-18%] rounded-full blur-xl"
                style={{ backgroundColor: meta.color, opacity: 0.85 }}
              />
              <img loading="lazy" decoding="async"
                src={logoSrc}
                alt=""
                aria-hidden="true"
                draggable={false}
                // Prostokatne/kwadratowe logo w kole w kolorze wlasnego tla (spojnie z okraglymi).
                style={cutout.kafel ? { backgroundColor: cutout.kolor, borderRadius: "9999px", padding: "12%" } : undefined}
                className={`relative h-full w-full object-contain drop-shadow-[0_6px_16px_rgba(0,0,0,0.45)] transition-opacity duration-300 ${logoWidoczne ? "opacity-100" : "opacity-0"}`}
              />
            </div>
            {!expanded && (
              <h2 className="line-clamp-2 shrink-0 font-display text-xl font-extrabold leading-tight text-cream drop-shadow-[0_2px_8px_rgba(0,0,0,0.55)] sm:text-2xl">
                {place.name}
              </h2>
            )}
          </div>

          <div
            className={`shrink-0 bg-gradient-to-t from-black/90 via-black/65 to-transparent p-4 pt-8 text-cream sm:p-5 sm:pt-10 ${expanded ? "max-h-[78%] overflow-y-auto" : ""}`}
            // The expanded panel scrolls on its own: it must not start a card drag,
            // and it gets vertical panning back from the card's touch-action: none.
            style={expanded ? { touchAction: "pan-y" } : undefined}
            onPointerDownCapture={expanded ? (e) => e.stopPropagation() : undefined}
          >
            {expanded && (
              <h2 className="mb-2 font-display text-xl font-extrabold leading-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.55)]">
                {place.name}
              </h2>
            )}

            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              {open.status !== "unknown" && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-cream/15 px-2.5 py-1 text-[11px] font-bold backdrop-blur-sm">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      open.status === "open"
                        ? "bg-ok"
                        : open.status === "closing-soon"
                          ? "bg-tomato"
                          : "bg-cream/40"
                    }`}
                    aria-hidden="true"
                  />
                  {open.status === "open"
                    ? `Otwarte do ${open.closesAt}`
                    : open.status === "closing-soon"
                      ? open.minutesToClose <= 1
                        ? "Zamyka się"
                        : `Zamyka za ${open.minutesToClose} min`
                      : open.status === "closed" && open.opensAt
                        ? `Zamknięte, otwiera się o ${open.opensAt}`
                        : "Zamknięte"}
                </span>
              )}
              {rating && (
                <span className="inline-flex items-center gap-1 rounded-full bg-cream/15 px-2.5 py-1 text-[11px] font-extrabold backdrop-blur-sm">
                  <Star size={11} className="fill-mustard text-mustard" aria-hidden="true" />
                  {rating.avg.toFixed(1).replace(".", ",")}
                  <span className="font-semibold text-cream/70">({rating.count})</span>
                </span>
              )}
              {trofeum && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-cream/95 px-2.5 py-1 text-[11px] font-extrabold text-navy">
                  <TrophyIcon trofeum={trofeum} size={16} />
                  {podpisTrofeum(trofeum)}
                </span>
              )}
              {formatCena(place.price_range) && (
                <span className="rounded-full bg-cream/15 px-2.5 py-1 text-[11px] font-extrabold backdrop-blur-sm">
                  {formatCena(place.price_range)}
                </span>
              )}
              {friendSignal && friendSignal.kind !== "want" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-tomato px-2.5 py-1 text-[11px] font-bold text-cream">
                  <Users size={11} aria-hidden="true" />
                  {FRIEND_SIGNAL_TEXT[friendSignal.kind](friendSignal.count)}
                </span>
              )}
            </div>

            {place.description && (
              <p
                className={
                  expanded
                    ? "text-sm leading-relaxed text-cream/90"
                    : // Niski ekran (iPhone SE): znika sam tekst opisu, zostaje reszta -
                      // inaczej logo i nazwa nie mieszcza sie w karcie ~250 px.
                      "line-clamp-2 text-sm leading-snug text-cream/85 [@media(max-height:620px)]:hidden"
                }
              >
                {place.description}
              </p>
            )}

            {expanded && (
              <div className="mt-2.5 flex flex-col gap-2.5">
                {danie && (
                  <div className="flex items-center gap-2.5 rounded-2xl bg-cream/10 px-3 py-2">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-tomato text-xs font-extrabold">
                      ★
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[9px] font-extrabold tracking-[0.1em] text-cream/55">
                        Z MENU
                      </span>
                      <span className="block truncate text-xs font-extrabold">{danie}</span>
                    </span>
                  </div>
                )}
                {cechy.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {cechy.map((c) => (
                      <span
                        key={c}
                        className="rounded-full border border-cream/25 px-2.5 py-0.5 text-[10.5px] font-bold"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                )}
                <p className="flex items-start gap-1.5 text-xs text-cream/70">
                  <MapPin size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
                  <span>{place.address}</span>
                </p>
                {place.reel_url && (
                  <div>
                    <InstagramReelPoster
                      reelUrl={place.reel_url}
                      cuisine={place.cuisine}
                      placeName={place.name}
                    />
                  </div>
                )}
                <Link
                  to="/k/$id"
                  params={{ id: place.slug }}
                  className="pz-hit inline-flex items-center gap-1.5 self-start text-xs font-bold text-cream underline underline-offset-2"
                >
                  Otwórz stronę lokalu <ExternalLink size={12} aria-hidden="true" />
                </Link>
              </div>
            )}

            {(friendsWant.length > 0 || (friendSignal?.kind === "want" && friendsWant.length === 0)) && (
              <div className="mt-2.5 flex items-center gap-2">
                {friendsWant.length > 0 && (
                  <span className="flex shrink-0">
                    {friendsWant.slice(0, 3).map((f, i) => (
                      <span key={f.id} className={i ? "-ml-2" : ""}>
                        <UserAvatar
                          avatarUrl={f.avatar_url}
                          avatarSource={f.avatar_source}
                          displayName={f.display_name}
                          username={f.username}
                          size={24}
                          className="ring-2 ring-[#1E2050]"
                        />
                      </span>
                    ))}
                  </span>
                )}
                <span className="text-[11.5px] font-extrabold text-blush">
                  {friendsWant.length > 0
                    ? liniaZnajomych(imiona)
                    : FRIEND_SIGNAL_TEXT.want(friendSignal!.count)}
                </span>
              </div>
            )}
          </div>

          {/* Plakietki w rogach (kuchnia + odleglosc lub dzielnica) - nad wszystkim. */}
          <div className="pointer-events-none absolute inset-x-3.5 top-3.5 flex items-center justify-between gap-2">
            <span className="rounded-full bg-cream/95 px-3 py-1.5 text-xs font-extrabold text-navy">
              {meta.emoji} {place.cuisine}
            </span>
            {rightChip && (
              <span className="rounded-full bg-navy/45 px-3 py-1.5 text-[11.5px] font-bold text-cream backdrop-blur-md">
                {rightChip}
              </span>
            )}
          </div>
        </div>

        {/* Podswietlenie kierunku przeciagania. */}
        <motion.div
          aria-hidden="true"
          style={{ opacity: wantTint }}
          className="pointer-events-none absolute inset-0 bg-[#3C8A5A]"
        />
        <motion.div
          aria-hidden="true"
          style={{ opacity: skipTint }}
          className="pointer-events-none absolute inset-0 bg-[#D0453F]"
        />
        <motion.div
          aria-hidden="true"
          style={{ opacity: favTint }}
          className="pointer-events-none absolute inset-0 bg-[#D6B046]"
        />

        <motion.div
          aria-hidden="true"
          style={{ opacity: wantOpacity }}
          className="pointer-events-none absolute left-4 top-14 -rotate-12 rounded-2xl border-[3px] border-[#6FD39A] bg-[rgba(20,40,30,0.35)] px-3.5 py-1 font-display text-2xl font-extrabold tracking-wider text-[#6FD39A]"
        >
          CHCĘ
        </motion.div>
        <motion.div
          aria-hidden="true"
          style={{ opacity: skipOpacity }}
          className="pointer-events-none absolute right-4 top-14 rotate-12 rounded-2xl border-[3px] border-[#F2A5A0] bg-[rgba(60,20,20,0.35)] px-3.5 py-1 font-display text-2xl font-extrabold tracking-wider text-[#F2A5A0]"
        >
          POMIŃ
        </motion.div>
        <motion.div
          aria-hidden="true"
          style={{ opacity: favOpacity }}
          className="pointer-events-none absolute left-1/2 top-[40%] -translate-x-1/2 whitespace-nowrap rounded-2xl border-[3px] border-[#E3C25A] bg-[rgba(40,34,10,0.4)] px-3.5 py-1 font-display text-2xl font-extrabold tracking-wider text-[#E3C25A]"
        >
          ULUBIONE
        </motion.div>
      </div>
    </motion.div>
  );
}
