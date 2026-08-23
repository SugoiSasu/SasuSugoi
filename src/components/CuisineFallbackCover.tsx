import { cuisineMeta } from "@/data/places";

/**
 * Shared "no real photo yet" cover: the cuisine's own color, fading toward
 * navy, with its emoji centered - used everywhere a place card/hero would
 * otherwise show a real cover_image_url/avatar_url. Keeps every fallback
 * looking like one deliberate design instead of N slightly-different ones.
 */
export function CuisineFallbackCover({
  cuisine,
  emojiClassName = "text-6xl",
  className = "",
}: {
  cuisine: string;
  emojiClassName?: string;
  className?: string;
}) {
  const meta = cuisineMeta(cuisine);
  return (
    <div
      className={`grid h-full w-full place-items-center ${className}`}
      style={{
        background: `linear-gradient(160deg, ${meta.color} 0%, ${meta.color}cc 55%, #211e50 130%)`,
      }}
    >
      <span
        className={`${emojiClassName} drop-shadow-[0_10px_24px_rgba(0,0,0,0.35)]`}
        aria-hidden="true"
      >
        {meta.emoji}
      </span>
    </div>
  );
}
