import { Sparkles } from "lucide-react";

/** Small pill for a player's chosen title (LoL-style: picked by the player
 * from unlocked achievements, not auto-displayed) - shown next to a name on
 * profiles, Ranking, and Friends. */
export function TitleTag({
  title,
  size = "sm",
}: {
  title: string | null | undefined;
  size?: "sm" | "md";
}) {
  if (!title) return null;
  const isMd = size === "md";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-tomato/40 bg-tomato/10 font-semibold text-tomato ${
        isMd ? "px-2.5 py-1 text-xs" : "px-1.5 py-0.5 text-[10px]"
      }`}
    >
      <Sparkles size={isMd ? 12 : 10} className="shrink-0" />
      {title}
    </span>
  );
}
