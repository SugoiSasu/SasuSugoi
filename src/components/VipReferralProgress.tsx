import { Crown } from "lucide-react";
import { useAchievements } from "@/lib/achievements-api";
import { useInviteStats } from "@/lib/friends-api";

/** Progress toward the invite-based achievement tiers (inviter / inviter_5 /
 * inviter_10), pulling real thresholds from the DB instead of hardcoding
 * them so tuning the achievement criteria doesn't drift this widget out of
 * sync. inviter_10 grants a year of VIP - that's the headline reward. */
export function VipReferralProgress({ compact = false }: { compact?: boolean }) {
  const { data: achievements } = useAchievements();
  const { data: stats } = useInviteStats();

  const tiers = (achievements ?? [])
    .filter((a) => a.criteria?.type === "referrals_count")
    .map((a) => ({ threshold: Number(a.criteria.threshold) || 0, name: a.name }))
    .filter((t) => t.threshold > 0)
    .sort((a, b) => a.threshold - b.threshold);

  if (tiers.length === 0) return null;

  const accepted = stats?.accepted ?? 0;
  const vipTier = tiers[tiers.length - 1];
  const maxTier = vipTier.threshold;
  const nextTier = tiers.find((t) => t.threshold > accepted);
  const pct = Math.min(100, Math.round((accepted / maxTier) * 100));
  const vipUnlocked = accepted >= maxTier;

  return (
    <div className={`rounded-2xl border ${vipUnlocked ? "border-tomato/40 bg-tomato/10" : "border-border bg-card"} p-4`}>
      <div className="flex items-center gap-2 mb-2">
        <Crown size={16} className={vipUnlocked ? "text-tomato" : "text-muted-foreground"} />
        <p className="text-sm font-semibold">
          {vipUnlocked ? "VIP odblokowane dzięki zaproszeniom!" : "Postęp do statusu VIP"}
        </p>
      </div>

      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-tomato transition-all duration-700 ease-out"
          style={{ width: `${pct}%` }}
        />
        {tiers.map((t) => (
          <span
            key={t.threshold}
            className={`absolute top-1/2 h-2.5 w-0.5 -translate-y-1/2 ${accepted >= t.threshold ? "bg-cream/70" : "bg-navy/20"}`}
            style={{ left: `${Math.min(100, (t.threshold / maxTier) * 100)}%` }}
          />
        ))}
      </div>

      {!compact && (
        <p className="mt-2 text-xs text-muted-foreground">
          {vipUnlocked
            ? `Zaprosiłeś już ${accepted} osób - status VIP jest Twój.`
            : nextTier
              ? `Zaprosiłeś ${accepted} ${accepted === 1 ? "osobę" : "osoby"}. Jeszcze ${nextTier.threshold - accepted} do „${nextTier.name}"${nextTier.threshold === maxTier ? " (VIP na rok!)" : ""}.`
              : `Zaprosiłeś ${accepted} osób.`}
        </p>
      )}
      {compact && !vipUnlocked && nextTier && (
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          Jeszcze {nextTier.threshold - accepted} do „{nextTier.name}"
        </p>
      )}
    </div>
  );
}
