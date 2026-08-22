import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Lock, Trophy } from "lucide-react";
import { useUser } from "@/lib/use-auth";
import { useMyProfile } from "@/lib/profile-api";
import { useAchievements, useUserAchievements, computeProgress, type CriteriaType } from "@/lib/achievements-api";
import { useFriendLeaderboard, useFriendsCount, useInviteStats } from "@/lib/friends-api";
import { useUserReviewStats } from "@/lib/reviews-api";
import { UserAvatar } from "@/components/UserAvatar";
import { LevelProgressCard } from "@/components/LevelProgress";

export const Route = createFileRoute("/osiagniecia")({
  head: () => ({
    meta: [
      { title: "Osiągnięcia - poŻeramy" },
      { name: "description", content: "Zdobywaj odznaki poŻeracza, awansuj poziomy i rywalizuj ze znajomymi w Poznaniu." },
      { property: "og:title", content: "Osiągnięcia - poŻeramy" },
      { property: "og:description", content: "Zdobywaj odznaki, awansuj poziomy i rywalizuj ze znajomymi." },
    ],
  }),
  component: AchievementsPage,
});

type Filter = "all" | "unlocked" | "locked";

const BADGE_COLORS = ["bg-tomato", "bg-navy", "bg-sage", "bg-mustard", "bg-cobalt", "bg-blush"] as const;

function badgeColor(id: string): string {
  let sum = 0;
  for (const ch of id) sum += ch.charCodeAt(0);
  return BADGE_COLORS[sum % BADGE_COLORS.length];
}

function AchievementsPage() {
  const { user } = useUser();
  const { data: profile } = useMyProfile();
  const { data: all, isLoading: loadingAll } = useAchievements();
  const { data: mine } = useUserAchievements(user?.id);
  const { data: leaders, isLoading: loadingLeaders } = useFriendLeaderboard();
  const { data: reviewStats } = useUserReviewStats(user?.id);
  const { data: friendsCount } = useFriendsCount(user?.id);
  const { data: inviteStats } = useInviteStats();
  const [filter, setFilter] = useState<Filter>("all");

  const points = profile?.points_total ?? 0;
  const unlocked = useMemo(() => new Set((mine ?? []).map((m) => m.achievement_id)), [mine]);
  const userStats: Record<CriteriaType, number> = {
    reviews_count: reviewStats?.reviewsCount ?? 0,
    unique_places: reviewStats?.uniquePlaces ?? 0,
    points_total: points,
    friends_count: friendsCount ?? 0,
    referrals_count: inviteStats?.accepted ?? 0,
  };

  const enabled = useMemo(() => (all ?? []).filter((a) => a.enabled !== false), [all]);
  const shown = useMemo(
    () =>
      enabled.filter((a) =>
        filter === "all" ? true : filter === "unlocked" ? unlocked.has(a.id) : !unlocked.has(a.id),
      ),
    [enabled, filter, unlocked],
  );

  const podium = (leaders ?? []).slice(0, 3);
  const rest = (leaders ?? []).slice(3);

  return (
    <main id="main-content" className="mx-auto max-w-3xl px-4 py-6 sm:py-10 lg:max-w-6xl lg:px-6">
      <h1 className="font-display text-2xl font-extrabold sm:text-3xl">Osiągnięcia</h1>

      <div className="lg:grid lg:grid-cols-[1.5fr_1fr] lg:items-start lg:gap-8">
      <div>
      <LevelProgressCard
        points={points}
        unlockedCount={unlocked.size}
        totalBadges={enabled.length}
        className="mt-4"
      />

      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-extrabold">Odznaki</h2>
          <div className="flex gap-2">
            {(
              [
                ["all", "Wszystkie"],
                ["unlocked", "Zdobyte"],
                ["locked", "Do zdobycia"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`min-h-11 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  filter === key ? "border-tomato bg-tomato/10 text-tomato" : "border-border bg-card hover:border-tomato"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {loadingAll ? (
          <ul className="mt-4 grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7" aria-busy="true">
            {Array.from({ length: 8 }).map((_, i) => (
              <li key={i} className="text-center">
                <div className="pz-skel mx-auto aspect-square w-full max-w-[92px] rounded-2xl" />
                <div className="pz-skel mx-auto mt-2 h-3 w-3/4" />
              </li>
            ))}
          </ul>
        ) : (
        <ul key={filter} className="pz-fade-in mt-4 grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7">
          {shown.map((a) => {
            const has = unlocked.has(a.id);
            const progress = has ? null : computeProgress(a, userStats);
            const inProgress = !!progress && progress.pct > 0;
            const title = inProgress
              ? `${a.description ?? a.name} - ${progress!.current}/${progress!.threshold || "?"}`
              : (a.description ?? a.name);
            return (
              <li key={a.id} className="text-center" title={title}>
                <div
                  className={`relative mx-auto grid aspect-square w-full max-w-[92px] place-items-center rounded-full border-2 transition hover:scale-105 ${
                    has
                      ? `${badgeColor(a.id)} border-transparent text-cream`
                      : inProgress
                        ? "border-tomato/25 bg-muted/40"
                        : "border-border bg-muted/50 opacity-60 grayscale"
                  }`}
                >
                  {inProgress && (
                    <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100" aria-hidden="true">
                      <circle cx="50" cy="50" r="46" fill="none" stroke="var(--border)" strokeWidth="4" />
                      <circle
                        cx="50"
                        cy="50"
                        r="46"
                        fill="none"
                        stroke="var(--tomato)"
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeDasharray={`${(progress!.pct / 100) * 289} 289`}
                        className="transition-[stroke-dasharray] duration-700 ease-out"
                      />
                    </svg>
                  )}
                  <span className={!has && !inProgress ? "" : !has ? "opacity-90" : ""}>
                    {a.icon_url && a.icon_url.startsWith("http") ? (
                      <img src={a.icon_url} alt="" className="h-10 w-10 object-contain" loading="lazy" />
                    ) : (
                      <span className="text-[26px] leading-none">{a.icon_url && !a.icon_url.startsWith("http") ? a.icon_url : <Trophy size={26} />}</span>
                    )}
                  </span>
                  {!has && !inProgress && (
                    <span className="absolute bottom-0 right-0 grid h-5 w-5 place-items-center rounded-full bg-background/90">
                      <Lock size={11} className="text-muted-foreground" />
                    </span>
                  )}
                  {inProgress && (
                    <span className="absolute bottom-0 right-0 grid h-6 w-6 place-items-center rounded-full border border-tomato/40 bg-background text-[9px] font-bold text-tomato">
                      {progress!.pct}%
                    </span>
                  )}
                </div>
              </li>
            );
          })}
          {shown.length === 0 && (
            <li className="col-span-full rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Brak odznak w tym filtrze.
            </li>
          )}
        </ul>
        )}
      </section>
      </div>

      <section className="mt-10 lg:mt-4">

        <h2 className="font-display text-lg font-extrabold">Ranking znajomych</h2>

        {loadingLeaders && (
          <ul className="mt-4 space-y-2" aria-busy="true">
            {Array.from({ length: 4 }).map((_, i) => (
              <li key={i} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
                <div className="pz-skel h-10 w-10 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="pz-skel h-3.5 w-1/3" />
                  <div className="pz-skel h-3 w-1/4" />
                </div>
              </li>
            ))}
          </ul>
        )}

        {podium.length > 0 && (
          <ol className="mt-4 grid grid-cols-3 items-end gap-2">
            {[1, 0, 2].map((idx) => {
              const row = podium[idx];
              if (!row) return <li key={idx} />;
              const isMe = row.user_id === user?.id;
              const h = idx === 0 ? "pt-6" : "pt-3";
              return (
                <li key={row.user_id} className={h}>
                  <Link
                    to="/u/$username"
                    params={{ username: row.username ?? row.user_id }}
                    className={`flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-center transition ${
                      isMe ? "border-tomato bg-blush/40" : "border-border bg-card hover:border-tomato"
                    }`}
                  >
                    <span className="text-lg" aria-hidden>
                      {idx === 0 ? "🥇" : idx === 1 ? "🥈" : "🥉"}
                    </span>
                    <UserAvatar
                      avatarUrl={row.avatar_url}
                      displayName={row.display_name}
                      username={row.username}
                      size={idx === 0 ? 56 : 44}
                    />
                    <p className="w-full truncate text-xs font-semibold">{isMe ? "Ty" : row.display_name || row.username}</p>
                    <p className="text-[11px] text-muted-foreground">{row.points_total} pkt</p>
                  </Link>
                </li>
              );
            })}
          </ol>
        )}

        <ul className="mt-3 space-y-2">
          {rest.map((row, i) => {
            const isMe = row.user_id === user?.id;
            return (
              <li key={row.user_id}>
                <Link
                  to="/u/$username"
                  params={{ username: row.username ?? row.user_id }}
                  className={`flex items-center gap-3 rounded-2xl border p-3 transition ${
                    isMe ? "border-tomato bg-blush/40" : "border-border bg-card hover:border-tomato"
                  }`}
                >
                  <span className="w-5 shrink-0 text-center text-sm font-extrabold text-muted-foreground">{i + 4}</span>
                  <UserAvatar avatarUrl={row.avatar_url} displayName={row.display_name} username={row.username} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{isMe ? "Ty" : row.display_name || row.username}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {row.points_total} pkt • {row.achievements_count} odznak
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
          {!loadingLeaders && (leaders ?? []).length === 0 && (
            <li className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Dodaj znajomych, żeby zobaczyć ranking.
              <Link to="/friends" className="mt-4 block min-h-11">
                <span className="inline-flex rounded-full bg-navy px-5 py-2.5 text-xs font-semibold text-cream">Znajdź znajomych</span>
              </Link>
            </li>
          )}
        </ul>
      </section>
      </div>
    </main>

  );
}
