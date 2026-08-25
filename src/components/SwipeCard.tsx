import { motion, useMotionValue, useTransform, animate } from "motion/react";
import { MapPin } from "lucide-react";
import { cuisineMeta } from "@/data/places";
import { YummyFace, NopeFace } from "@/components/SwipeFaces";
import type { Place } from "@/lib/places-api";

const SWIPE_THRESHOLD = 120;
const VELOCITY_THRESHOLD = 500;

export function SwipeCard({
  place,
  isTop,
  onSwipeCommit,
  onSwipe,
}: {
  place: Place;
  isTop: boolean;
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

  return (
    <motion.div
      className="absolute inset-0"
      style={{ x, rotate }}
      drag={isTop ? "x" : false}
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
        <div className="absolute inset-0">
          {place.cover_image_url ? (
            <img
              src={place.cover_image_url}
              alt=""
              className="h-full w-full object-cover"
              aria-hidden="true"
            />
          ) : (
            // No real photo yet: a lone giant cuisine emoji here (used to be
            // text-[12rem], nearly half the card) read as a cheap placeholder
            // sticker (flagged live 2026-08-25 - "wygląda tandetnie"). Reuse
            // the same illustrated brand pattern already used for the
            // homepage's cuisine chips instead - designed, tileable art that
            // was otherwise sitting unused at chip scale only.
            <div
              className="h-full w-full bg-cover bg-center"
              style={{
                backgroundImage: `linear-gradient(180deg, ${meta.color}00 0%, ${meta.color}3d 55%, #17143d 100%), url(${meta.chipBackground ?? meta.cover})`,
              }}
            />
          )}
        </div>

        {place.avatar_url && (
          <div className="absolute left-5 top-5 h-14 w-14 overflow-hidden rounded-2xl border-2 border-cream/80 bg-cream shadow-lg">
            <img src={place.avatar_url} alt="" className="h-full w-full object-contain p-1" aria-hidden="true" />
          </div>
        )}

        {/* Hierarchy tightened 2026-08-25: name -> description (the actual
            "why visit" content) -> a small muted cuisine+address meta line,
            replacing a stack of four same-weight lines (chip, name, address,
            description) that read as cluttered/unrefined per live feedback. */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-5 pt-24 text-cream">
          <h2 className="font-display text-2xl font-extrabold leading-tight">{place.name}</h2>
          {place.description && (
            <p className="mt-1.5 line-clamp-2 text-sm leading-snug text-cream/90">
              {place.description}
            </p>
          )}
          <p className="mt-2 flex items-center gap-1.5 text-xs text-cream/60">
            <span className="shrink-0">
              {meta.emoji} {place.cuisine}
            </span>
            <span aria-hidden="true" className="shrink-0">
              ·
            </span>
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
      </div>
    </motion.div>
  );
}
