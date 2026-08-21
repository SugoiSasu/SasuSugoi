import { useEffect, useState } from "react";

export const LEVEL_STEP = 150;

export function levelInfo(points: number) {
  const level = Math.floor(points / LEVEL_STEP) + 1;
  const inLevel = points % LEVEL_STEP;
  const pct = Math.round((inLevel / LEVEL_STEP) * 100);
  return { level, inLevel, pct, xpToNext: Math.max(0, LEVEL_STEP - inLevel) };
}

export interface AvatarRingTier {
  name: string;
  /** CSS background for the ring - solid color or gradient. */
  background: string;
  shimmer?: boolean;
}

/** One tier every 5 levels. Colors escalate from a muted brand tone up to a
 * two-hue gradient, mirroring the common → rare → legendary progression
 * pattern from game rank/loot borders - but built from the app's own navy/
 * tomato/blush palette instead of generic gold-silver-bronze. */
const AVATAR_RING_TIERS: AvatarRingTier[] = [
  { name: "Stały bywalec", background: "oklch(0.855 0.055 25)" },
  { name: "Koneser smaku", background: "oklch(0.72 0.1 165)" },
  { name: "Ekspert kuchni", background: "oklch(0.78 0.15 75)" },
  {
    name: "Mistrz Poznania",
    background: "conic-gradient(from 0deg, oklch(0.615 0.205 36), oklch(0.855 0.055 25), oklch(0.615 0.205 36))",
  },
  {
    name: "Legenda poŻeramy",
    background:
      "conic-gradient(from 0deg, oklch(0.31 0.14 268), oklch(0.615 0.205 36), oklch(0.78 0.15 75), oklch(0.31 0.14 268))",
    shimmer: true,
  },
];

/** Level 1-5 → no ring (tier not yet earned), then one new tier every 5
 * levels, capping at the top tier for anyone past the last defined one. */
export function avatarRingForLevel(level: number): AvatarRingTier | null {
  const idx = Math.floor((level - 1) / 5) - 1;
  if (idx < 0) return null;
  return AVATAR_RING_TIERS[Math.min(idx, AVATAR_RING_TIERS.length - 1)];
}

interface LevelProgressCardProps {
  points: number;
  /** Optional "Zdobyto X z Y odznak" footer line - pass both to show it. */
  unlockedCount?: number;
  totalBadges?: number;
  className?: string;
}

/** Shared "Poziom X · Y/Z XP" card - keep this the single source of truth for
 * the level formula so /osiagniecia and /u/$username never drift apart. */
export function LevelProgressCard({ points, unlockedCount, totalBadges, className = "" }: LevelProgressCardProps) {
  const { level, pct, xpToNext } = levelInfo(points);
  const [barPct, setBarPct] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setBarPct(pct));
    return () => cancelAnimationFrame(id);
  }, [pct]);
  return (
    <section
      className={`relative overflow-hidden rounded-3xl bg-navy p-5 text-cream shadow-[0_16px_40px_-16px_rgba(0,0,0,0.55)] ring-1 ring-cream/10 ${className}`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{
          background:
            "radial-gradient(70% 90% at 100% 0%, hsl(var(--tomato) / 0.22), transparent 60%), radial-gradient(60% 80% at 0% 100%, hsl(var(--cream) / 0.06), transparent 65%)",
        }}
      />
      <div className="relative">
        <p className="text-xs font-semibold uppercase tracking-wide text-cream/60">Twój postęp</p>
        <div className="mt-1 flex items-end justify-between gap-3">
          <p className="font-display text-3xl font-extrabold">Poziom {level}</p>
          <p className="text-sm font-semibold text-cream/70">
            {points} / {level * LEVEL_STEP} XP
          </p>
        </div>
        <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-cream/15 shadow-inner">
          <div
            className="h-full rounded-full bg-gradient-to-r from-tomato to-[oklch(0.68_0.19_36)] shadow-[0_0_10px_-2px_theme(colors.tomato)] transition-all duration-700 ease-out"
            style={{ width: `${barPct}%` }}
          />
        </div>
        {unlockedCount !== undefined && totalBadges !== undefined && (
          <p className="mt-3 text-xs text-cream/70">
            Zdobyto {unlockedCount} z {totalBadges} odznak · brakuje {xpToNext} XP do kolejnego poziomu
          </p>
        )}
      </div>
    </section>
  );
}
