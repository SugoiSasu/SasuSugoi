import { useMemo } from "react";
import { Target, Check } from "lucide-react";
import { useChallenges, type Challenge } from "@/lib/challenges-api";
import { useMyChallengeCompletions } from "@/lib/challenges-api";
import { useUserReviews } from "@/lib/reviews-api";
import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors check_challenges() in 20260821170000_wall_v2_lists_and_challenges.sql.
 *  The SQL function stays the source of truth for actually awarding a
 *  completion - this only recreates the same arithmetic so the user can see
 *  how far along they are before it fires. Keep the two in step. */
export function progressFor(
  c: Challenge,
  reviews: { created_at: string; place: { cuisine: string | null } | null }[],
): { current: number; threshold: number } {
  const windowDays = c.criteria?.window_days ?? 30;
  const since = Date.now() - windowDays * 24 * 60 * 60 * 1000;
  const inWindow = reviews.filter((r) => Date.parse(r.created_at) >= since);
  const threshold = c.criteria?.threshold ?? 0;

  switch (c.criteria?.type) {
    case "cuisine_reviews":
      return {
        current: inWindow.filter((r) => r.place?.cuisine === c.criteria.cuisine).length,
        threshold,
      };
    case "new_places_reviewed":
      return { current: inWindow.length, threshold };
    case "unique_cuisines_reviewed":
      return {
        current: new Set(inWindow.map((r) => r.place?.cuisine).filter(Boolean)).size,
        threshold,
      };
    default:
      return { current: 0, threshold };
  }
}

/** Challenges had a full engine (tables, SQL evaluator, admin CRUD) and no
 *  user-facing surface at all - the only way to learn one existed was to
 *  complete it and get the notification. */
export function ChallengesSection({ userId }: { userId: string }) {
  const { data: all, isLoading: loadingChallenges } = useChallenges();
  const { data: completions, isLoading: loadingCompletions } = useMyChallengeCompletions(userId);
  const { data: reviews, isLoading: loadingReviews } = useUserReviews(userId);

  const done = useMemo(
    () => new Set((completions ?? []).map((c) => c.challenge_id)),
    [completions],
  );

  const active = useMemo(() => {
    const now = Date.now();
    return (all ?? []).filter((c) => {
      if (!c.enabled) return false;
      if (c.starts_at && Date.parse(c.starts_at) > now) return false;
      if (c.ends_at && Date.parse(c.ends_at) < now) return false;
      return true;
    });
  }, [all]);

  const loading = loadingChallenges || loadingCompletions || loadingReviews;

  // Nothing configured yet is a normal state for this app (challenges are
  // admin-created), and an empty box explaining a feature that has no content
  // is worse than no box.
  if (!loading && active.length === 0) return null;

  return (
    <section className="mt-10">
      <h2 className="font-display text-lg font-extrabold">Wyzwania 🎯</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Ukończ, żeby zgarnąć punkty i wpis na Pożeralni.
      </p>

      {loading ? (
        <ul className="mt-4 space-y-2" aria-busy="true">
          {Array.from({ length: 2 }).map((_, i) => (
            <li key={i}>
              <Skeleton className="h-20 rounded-2xl" />
            </li>
          ))}
        </ul>
      ) : (
        <ul className="mt-4 space-y-2">
          {active.map((c) => {
            const isDone = done.has(c.id);
            const { current, threshold } = progressFor(c, reviews ?? []);
            const pct =
              threshold > 0 ? Math.min(100, Math.round((current / threshold) * 100)) : 0;
            return (
              <li
                key={c.id}
                className={`rounded-2xl border p-3 ${
                  isDone ? "border-ok/40 bg-ok/10" : "border-border bg-card"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-tomato/10 text-lg"
                    aria-hidden
                  >
                    {c.icon || <Target size={18} className="text-tomato" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{c.title}</p>
                    {c.description && (
                      <p className="truncate text-xs text-muted-foreground">{c.description}</p>
                    )}
                  </div>
                  {isDone ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-ok/20 px-2.5 py-1 text-xs font-bold text-ok">
                      <Check size={12} /> Ukończone
                    </span>
                  ) : (
                    <span className="shrink-0 text-xs font-bold tabular-nums text-muted-foreground">
                      {current}/{threshold}
                    </span>
                  )}
                </div>

                {!isDone && threshold > 0 && (
                  <div
                    className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-muted"
                    role="progressbar"
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Postęp wyzwania ${c.title}`}
                  >
                    <div
                      className="h-full rounded-full bg-tomato transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
