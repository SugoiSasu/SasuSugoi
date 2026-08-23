import { motion, useMotionValue, useTransform, animate } from "motion/react";
import { MapPin } from "lucide-react";
import { cuisineMeta } from "@/data/places";
import { YummyFace, NopeFace } from "@/components/SwipeFaces";
import { CuisineFallbackCover } from "@/components/CuisineFallbackCover";
import type { Place } from "@/lib/places-api";

const SWIPE_THRESHOLD = 120;
const VELOCITY_THRESHOLD = 500;

export function SwipeCard({
  place,
  isTop,
  onSwipe,
}: {
  place: Place;
  isTop: boolean;
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
            <CuisineFallbackCover cuisine={place.cuisine} emojiClassName="text-8xl" />
          )}
        </div>

        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent p-5 pt-20 text-cream">
          <span className="chip mb-2 bg-cream/15 text-cream">
            {meta.emoji} {place.cuisine}
          </span>
          <h2 className="font-display text-2xl font-extrabold leading-tight">{place.name}</h2>
          <p className="mt-1.5 flex items-center gap-1.5 text-sm text-cream/80">
            <MapPin size={13} className="shrink-0" /> {place.address}
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
