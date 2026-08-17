import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Lock, Trophy } from "lucide-react";
import { useUser } from "@/lib/use-auth";
import { useMyProfile } from "@/lib/profile-api";
import { useAchievements, useUserAchievements } from "@/lib/achievements-api";
import { useFriendLeaderboard } from "@/lib/friends-api";
import { UserAvatar } from "@/components/UserAvatar";

export const Route = createFileRoute("/osiagniecia")({
  head: () => ({
    meta: [
      { title: "Osiągnięcia — poŻeramy" },
      { name: "description", content: "Zdobywaj odznaki poŻeracza, awansuj poziomy i rywalizuj ze znajomymi w Poznaniu." },
      { property: "og:title", content: "Osiągnięcia — poŻeramy" },
      { property: "og:description", content: "Zdobywaj odznaki, awansuj poziomy i rywalizuj ze znajomymi." },
    ],
  }),
  component: AchievementsPage,
});

const LEVEL_STEP = 150;
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
  const [filter, setFilter] = useState<Filter>("all");

  const points = profile?.points_total ?? 0;
  const level = Math.floor(points / LEVEL_STEP) + 1;
  const inLevel = points % LEVEL_STEP;
  const pct = Math.round((inLevel / LEVEL_STEP) * 100);
  const unlocked = useMemo(() => new Set((mine ?? []).map((m) => m.achievement_id)), [mine]);

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
      <section className="mt-4 overflow-hidden rounded-3xl bg-navy p-5 text-cream">

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
        <p className="mt-3 text-xs text-cream/70">
          Zdobyto {unlocked.size} z {enabled.length} odznak · brakuje {Math.max(0, LEVEL_STEP - inLevel)} XP do kolejnego poziomu
        </p>
      </section>

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
            return (
              <li key={a.id} className="text-center" title={a.description ?? a.name}>
                <div
                  className={`relative mx-auto grid aspect-square w-full max-w-[92px] place-items-center rounded-full border-2 transition ${
                    has
                      ? `${badgeColor(a.id)} border-transparent text-cream hover:scale-105`
                      : "border-border bg-muted/50 opacity-60 grayscale"
                  }`}
                >
                  {a.icon_url && a.icon_url.startsWith("http") ? (
                    <img src={a.icon_url} alt="" className="h-10 w-10 object-contain" loading="lazy" />
                  ) : (
                    <span className="text-[26px] leading-none">{a.icon_url && !a.icon_url.startsWith("http") ? a.icon_url : <Trophy size={26} />}</span>
                  )}
                  {!has && (
                    <span className="absolute bottom-0 right-0 grid h-5 w-5 place-items-center rounded-full bg-background/90">
                      <Lock size={11} className="text-muted-foreground" />
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
