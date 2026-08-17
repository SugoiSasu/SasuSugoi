import type { Rank } from "@/lib/ranks-api";

export function RankBadge({ rank, size = "md" }: { rank: Rank; size?: "sm" | "md" }) {
  const px = size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-bold uppercase tracking-wider ${px}`}
      style={{ backgroundColor: rank.color, color: "white" }}
      title={rank.description ?? rank.name}
    >
      {rank.icon && <span>{rank.icon}</span>}
      {rank.name}
    </span>
  );
}
