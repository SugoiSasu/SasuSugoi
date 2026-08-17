export const LEVEL_STEP = 150;

export function levelInfo(points: number) {
  const level = Math.floor(points / LEVEL_STEP) + 1;
  const inLevel = points % LEVEL_STEP;
  const pct = Math.round((inLevel / LEVEL_STEP) * 100);
  return { level, inLevel, pct, xpToNext: Math.max(0, LEVEL_STEP - inLevel) };
}

interface LevelProgressCardProps {
  points: number;
  /** Optional "Zdobyto X z Y odznak" footer line — pass both to show it. */
  unlockedCount?: number;
  totalBadges?: number;
  className?: string;
}

/** Shared "Poziom X · Y/Z XP" card — keep this the single source of truth for
 * the level formula so /osiagniecia and /u/$username never drift apart. */
export function LevelProgressCard({ points, unlockedCount, totalBadges, className = "" }: LevelProgressCardProps) {
  const { level, pct, xpToNext } = levelInfo(points);
  return (
    <section className={`overflow-hidden rounded-3xl bg-navy p-5 text-cream ${className}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-cream/60">Twój postęp</p>
      <div className="mt-1 flex items-end justify-between gap-3">
        <p className="font-display text-3xl font-extrabold">Poziom {level}</p>
        <p className="text-sm font-semibold text-cream/70">
          {points} / {level * LEVEL_STEP} XP
        </p>
      </div>
      <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-cream/15">
        <div className="h-full rounded-full bg-tomato transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      {unlockedCount !== undefined && totalBadges !== undefined && (
        <p className="mt-3 text-xs text-cream/70">
          Zdobyto {unlockedCount} z {totalBadges} odznak · brakuje {xpToNext} XP do kolejnego poziomu
        </p>
      )}
    </section>
  );
}
