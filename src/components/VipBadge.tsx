import { Crown } from "lucide-react";
import type { CSSProperties } from "react";

/** True if a profile's VIP grant is still within its validity window. */
export function isVipActive(
  profile: { is_vip: boolean; vip_until: string | null } | null | undefined,
): boolean {
  if (!profile?.is_vip) return false;
  if (!profile.vip_until) return true;
  return new Date(profile.vip_until).getTime() > Date.now();
}

/** Curated palette for the VIP nick-color picker - legible on both cream and navy backgrounds. */
export const VIP_NICK_COLORS = [
  "#E11D48", // rose
  "#F97316", // orange
  "#F59E0B", // amber
  "#10B981", // emerald
  "#06B6D4", // cyan
  "#3B82F6", // blue
  "#8B5CF6", // violet
  "#EC4899", // pink
] as const;

type VipProfile = { is_vip: boolean; vip_until: string | null; vip_nick_color?: string | null };

/** Inline style for a colored VIP nickname - spread onto whatever element already renders the name. */
export function vipNameStyle(profile: VipProfile | null | undefined): CSSProperties | undefined {
  if (!isVipActive(profile) || !profile?.vip_nick_color) return undefined;
  return { color: profile.vip_nick_color };
}

/** Small gold "VIP" pill shown next to a username. */
export function VipBadge({ size = "sm" }: { size?: "sm" | "md" }) {
  const isMd = size === "md";
  return (
    <span
      title="Status VIP"
      className={`inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 font-bold text-amber-950 shadow-sm ${
        isMd ? "px-2.5 py-1 text-xs" : "px-1.5 py-0.5 text-[10px]"
      }`}
    >
      <Crown size={isMd ? 13 : 11} className="shrink-0" />
      VIP
    </span>
  );
}
