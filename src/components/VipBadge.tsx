import { Crown } from "lucide-react";

/** True if a profile's VIP grant is still within its validity window. */
export function isVipActive(profile: { is_vip: boolean; vip_until: string | null } | null | undefined): boolean {
  if (!profile?.is_vip) return false;
  if (!profile.vip_until) return true;
  return new Date(profile.vip_until).getTime() > Date.now();
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
