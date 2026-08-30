import { useEffect, useState } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from "motion/react";
import { MapPin, Star, Users, X } from "lucide-react";
import { cuisineMeta } from "@/data/places";
import { YummyFace, NopeFace } from "@/components/SwipeFaces";
import { placeOpenState } from "@/lib/places-api";
import type { Place } from "@/lib/places-api";
import { useCutoutLogo } from "@/lib/chroma-cutout";

const SWIPE_THRESHOLD = 120;
const VELOCITY_THRESHOLD = 500;

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

export function SwipeCard({
  place,
  isTop,
  rating,
  friendSignal = null,
  onSwipeCommit,
  onSwipe,
}: {
  place: Place;
  isTop: boolean;
  /** Real aggregated rating, when the place has any reviews at all. */
  rating?: { avg: number; count: number };
  /** The strongest reason your own friends give to swipe right - see FriendSignal. */
  friendSignal?: FriendSignal;
  /** Fires the instant a drag passes the threshold - this is what actually
   * writes the decision, so it can never be lost to the user navigating
   * away before the (purely cosmetic) exit animation below finishes. */
  onSwipeCommit: (direction: "left" | "right") => void;
  /** Fires after the ~700ms fly-away animation completes - visual-only
   * bookkeeping (removing the card from the stack, the emoji burst). */
  onSwipe: (direction: "left" | "right") => void;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-240, 240], [-18, 18]);
  const likeOpacity = useTransform(x, [20, 120], [0, 1]);
  const nopeOpacity = useTransform(x, [-120, -20], [1, 0]);
  const meta = cuisineMeta(place.cuisine);
  // Same best-effort background removal the homepage already uses (a place
  // can opt out via avatar_cutout_enabled, e.g. a logo whose "background" is
  // actually part of the mark). Falls back to the raw file while the cutout
  // is still processing or unavailable, so the card never shows nothing.
  const cutoutLogo = useCutoutLogo(place.avatar_cutout_enabled !== false ? place.avatar_url : null);
  const logoSrc = cutoutLogo ?? place.avatar_url ?? undefined;

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

  // Reading the full description isn't a decision, so it gets its own state
  // instead of hijacking the drag gesture - dragging is turned off while
  // open, and the panel that shows the text stays inside the card's own
  // rounded bounds instead of a page-covering modal, so the deck (and your
  // place in it) never leaves the screen.
  const [descriptionOpen, setDescriptionOpen] = useState(false);

  return (
    <motion.div
      className="absolute inset-0"
      style={{ x, rotate }}
      drag={isTop && !descriptionOpen ? "x" : false}
      dragElastic={0.9}
      whileDrag={{ scale: 1.04 }}
      transition={{ scale: { type: "spring", stiffness: 400, damping: 25 } }}
      onDragEnd={(_event, info) => {
        const passed =
          Math.abs(info.offset.x) > SWIPE_THRESHOLD ||
          Math.abs(info.velocity.x) > VELOCITY_THRESHOLD;
        if (passed) {
          const direction = info.offset.x > 0 ? "right" : "left";
          onSwipeCommit(direction);
          animate(x, direction === "right" ? 700 : -700, {
            type: "spring",
            stiffness: 250,
            damping: 30,
          }).then(() => onSwipe(direction));
        } else {
          animate(x, 0, { type: "spring", stiffness: 400, damping: 28 });
        }
      }}
    >
      <div className="relative h-full w-full touch-pan-y overflow-hidden rounded-3xl border border-border bg-card shadow-xl">
        {/* The card is built out of the logo now: the same image twice, once
            blown past the card bounds and blurred into a wash of its own
            colours, once crisp in the middle. The old card led with a tileable
            cuisine pattern, which meant every burger place looked identical -
            the brand was the one thing that could tell them apart, and it was a
            56px badge in a corner.
            The blurred copy is scaled well over 100% because a blur samples
            transparent pixels past the edge and would otherwise fade the frame
            to nothing. The cuisine colour sits underneath so a logo that is
            mostly transparent still lands on something. */}
        <div className="absolute inset-0 overflow-hidden" style={{ backgroundColor: meta.color }}>
          <img
            src={logoSrc}
            alt=""
            aria-hidden="true"
            className="absolute left-1/2 top-1/2 h-full w-full object-cover"
            style={{ filter: "blur(44px) saturate(2)", transform: "translate(-50%, -50%) scale(1.6)" }}
          />
          {/* A monochrome logo blurs to grey or near-black - Gemüse Spot and
              Parabar both do - and the card loses all colour. Soft-light lifts a
              neutral wash towards the cuisine hue while barely touching one that
              is already saturated, so a red logo stays red. */}
          <div
            className="absolute inset-0"
            style={{ backgroundColor: meta.color, mixBlendMode: "soft-light", opacity: 0.85 }}
          />
          {/* Enough scrim for cream text on any logo, not so much that the
              colour wash stops reading as colour. */}
          <div className="absolute inset-0 bg-navy/45" />
        </div>

        {/* Centre block: the logo at a size you can actually read, and the name
            directly under it. */}
        <div className="absolute inset-x-0 top-[24%] flex flex-col items-center gap-3 px-6 text-center">
          {/* No plate: the logo sits straight on the card, over a soft pool of the
              cuisine colour - the same colour the filters use, so a card reads as
              its category before you have read a word of it. A hard cream tile
              boxed every logo in, including the ones that already carry their own
              shape. A flat background (white, cream, black - common for an
              uploaded logo) is cut out client-side so it doesn't show as a
              coloured box; a place can turn that off (avatar_cutout_enabled)
              if its "background" is actually part of the mark. */}
          <div className="relative grid h-48 w-48 place-items-center">
            <span
              aria-hidden="true"
              className="absolute inset-[-18%] rounded-full blur-xl"
              style={{ backgroundColor: meta.color, opacity: 0.85 }}
            />
            <img
              src={logoSrc}
              alt=""
              aria-hidden="true"
              className="relative h-full w-full object-contain drop-shadow-[0_6px_16px_rgba(0,0,0,0.45)]"
            />
          </div>
          <h2 className="font-display text-2xl font-extrabold leading-tight text-cream drop-shadow-[0_2px_8px_rgba(0,0,0,0.55)]">
            {place.name}
          </h2>
        </div>

        {/* Everything that is not the identity stays at the foot of the card:
            the decision signals first, then the "why visit" line, then the
            muted address. Cuisine used to be a grey line down at the very
            bottom, easy to miss - it's the first thing you want to know
            before swiping, so it leads the signal row as its own coloured
            chip instead. The friend signal collapses three possible facts
            (recommends it / has been / wants to go) into whichever one is
            true and strongest - showing all three at once was tried and
            read as clutter. Rating and open-status still render only when
            they have something to say. */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent p-5 pt-20 text-cream">
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold text-cream"
              style={{ backgroundColor: meta.color }}
            >
              {meta.emoji} {place.cuisine}
            </span>
            {friendSignal && (
              <span className="inline-flex items-center gap-1 rounded-full bg-tomato px-2 py-1 text-[11px] font-bold text-cream">
                <Users size={11} aria-hidden="true" />
                {FRIEND_SIGNAL_TEXT[friendSignal.kind](friendSignal.count)}
              </span>
            )}
            {rating && (
              <span className="inline-flex items-center gap-1 rounded-full bg-cream/20 px-2 py-1 text-[11px] font-bold text-cream backdrop-blur-sm">
                <Star size={11} className="fill-mustard text-mustard" aria-hidden="true" />
                {rating.avg.toFixed(1).replace(".", ",")}
                <span className="font-semibold text-cream/70">({rating.count})</span>
              </span>
            )}
            {open.status !== "unknown" && (
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-bold backdrop-blur-sm ${
                  open.status === "closed"
                    ? "bg-cream/15 text-cream/70"
                    : "bg-cream/20 text-cream"
                }`}
              >
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
                    : "Zamknięte"}
              </span>
            )}
          </div>
          {place.description && (
            <>
              <p className="line-clamp-2 text-sm leading-snug text-cream/90">{place.description}</p>
              <button
                type="button"
                onPointerDownCapture={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  setDescriptionOpen(true);
                }}
                className="pz-hit mt-0.5 text-xs font-bold text-cream/80 underline underline-offset-2 hover:text-cream"
              >
                Zobacz pełny opis
              </button>
            </>
          )}
          <p className="mt-2 flex items-center gap-1.5 text-xs text-cream/70">
            <span className="inline-flex min-w-0 items-center gap-1 truncate">
              <MapPin size={11} className="shrink-0" />
              <span className="truncate">{place.address}</span>
            </span>
          </p>
        </div>

        <motion.div
          style={{ opacity: likeOpacity }}
          className="absolute right-4 top-4 flex -rotate-12 items-center gap-2 rounded-2xl border-4 border-tomato bg-cream/95 px-3 py-2 shadow-lg"
        >
          <YummyFace size={30} />
          <span className="font-display text-lg font-extrabold text-tomato">CHCĘ!</span>
        </motion.div>
        <motion.div
          style={{ opacity: nopeOpacity }}
          className="absolute left-4 top-4 flex rotate-12 items-center gap-2 rounded-2xl border-4 border-navy bg-cream/95 px-3 py-2 shadow-lg"
        >
          <NopeFace size={30} />
          <span className="font-display text-lg font-extrabold text-navy">OMIJAM</span>
        </motion.div>

        <AnimatePresence>
          {descriptionOpen && place.description && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onPointerDownCapture={(e) => e.stopPropagation()}
              onClick={() => setDescriptionOpen(false)}
              role="dialog"
              aria-modal="true"
              aria-label={`Pełny opis: ${place.name}`}
              className="absolute inset-0 z-10 flex flex-col bg-navy/95 p-5 text-cream backdrop-blur-sm"
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <h3 className="font-display text-lg font-extrabold leading-tight">{place.name}</h3>
                <button
                  type="button"
                  aria-label="Zamknij"
                  onClick={() => setDescriptionOpen(false)}
                  className="pz-hit grid h-8 w-8 shrink-0 place-items-center rounded-full bg-cream/15 hover:bg-cream/25"
                >
                  <X size={16} />
                </button>
              </div>
              <p className="overflow-y-auto text-sm leading-relaxed text-cream/90">
                {place.description}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
