import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Trophy, Users } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { pl } from "date-fns/locale";
import { UserAvatar } from "@/components/UserAvatar";
import { useUser } from "@/lib/use-auth";
import { useMyProfile } from "@/lib/profile-api";
import { useWallFeed, type WallItem } from "@/lib/wall-api";
import { useFriendLeaderboard, useFriendsCount, useInviteStats } from "@/lib/friends-api";
import {
  useAchievements,
  useUserAchievements,
  computeProgress,
  type CriteriaType,
} from "@/lib/achievements-api";
import { useUserReviewStats } from "@/lib/reviews-api";


/**
 * The social band that closes the homepage.
 *
 * Above it sit three rails that are visually identical - same card, same
 * grid, same spacing - so the page reads as one long list with nothing for
 * the eye to catch on. This gives the page a second "floor" with a
 * different shape: a wide feed column beside a narrow stack of two small
 * widgets, on a different background.
 *
 * It also surfaces three things that were previously only reachable by
 * navigating away: the friends' feed (/wall), the friends ranking (/u) and
 * achievement progress (/osiagniecia).
 *
 * Logged out, it renders nothing - every part of it is about *your* friends.
 */
export function HomeSocialBand() {
  const { user } = useUser();
  if (!user) return null;
  return <Band />;
}

function Band() {
  return (
    <section className="grid items-start gap-4 py-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      <FriendsFeedCard />
      <div className="flex flex-col gap-4">
        <FriendsRankingCard />
        <NextBadgeCard />
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- feed */

/**
 * Polish counts take three forms, not two: 1 odznakę, 2-4 odznaki,
 * 5+ odznak - and the teens (12-14) go back to the "many" form despite
 * ending in 2-4. Saying "5 odznaki" is plainly wrong to a Polish reader.
 */
function odznakiLabel(n: number): string {
  if (n === 1) return "odznakę";
  const last = n % 10;
  const lastTwo = n % 100;
  if (last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14)) return `${n} odznaki`;
  return `${n} odznak`;
}

/** Matches the phrasing already used on /wall so the two never diverge. */
function feedLabel(item: WallItem): { action: string; object: string | null } {
  switch (item.kind) {
    case "review":
      return { action: "ocenił(a)", object: item.place?.name ?? null };
    case "favorite":
      return { action: "dodał(a) do ulubionych", object: item.place?.name ?? null };
    case "achievement_group": {
      const n = item.achievements?.length ?? 1;
      return {
        action: `zdobył(a) ${odznakiLabel(n)}`,
        object: n === 1 ? (item.achievements?.[0]?.name ?? null) : null,
      };
    }
    case "place_post":
      return { action: "ma nowy wpis", object: item.place?.name ?? null };
    case "post":
      return item.place
        ? { action: "jadł(a) w", object: item.place.name }
        : { action: "dodał(a) wpis", object: null };
    case "list":
      return { action: "stworzył(a) listę", object: item.meta ?? null };
    case "challenge_complete":
      return { action: "ukończył(a) wyzwanie", object: item.meta ?? null };
    default:
      return { action: "coś zrobił(a)", object: null };
  }
}

/**
 * A row inserted a second ago can carry a timestamp a hair ahead of the
 * browser's clock, and formatDistanceToNow then cheerfully reports "za
 * minutę" - an event in the future. Clamp it.
 */
function timeAgo(iso: string, now: Date = new Date()): string {
  const t = new Date(iso);
  if (t.getTime() > now.getTime()) return "przed chwilą";
  return formatDistanceToNow(t, { addSuffix: true, locale: pl });
}

function feedChip(item: WallItem): string | null {
  if (item.kind === "review" && item.rating) return `★ ${item.rating.toFixed(1).replace(".", ",")}`;
  if (item.kind === "favorite") return "Zapisane";
  if (item.kind === "achievement_group") return "Odznaka";
  if (item.kind === "challenge_complete") return "Wyzwanie";
  return null;
}

function FriendsFeedCard() {
  const { data: feed, isLoading } = useWallFeed();
  const items = (feed ?? []).slice(0, 4);

  return (
    <div className="rounded-3xl border border-border bg-card p-5">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="font-display text-lg">Aktywność znajomych</h2>
        <Link to="/wall" className="text-xs font-semibold text-tomato hover:underline">
          Zobacz kanał
        </Link>
      </div>

      {isLoading ? (
        <ul className="flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <li key={i} className="flex items-start gap-3" aria-hidden="true">
              <div className="pz-skel h-9 w-9 shrink-0 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <div className="pz-skel h-3 w-3/4 rounded-full" />
                <div className="pz-skel h-2.5 w-1/4 rounded-full" />
              </div>
            </li>
          ))}
        </ul>
      ) : items.length === 0 ? (
        <EmptyHint
          text="Kiedy znajomi zaczną oceniać knajpy, zobaczysz to tutaj."
          cta="Znajdź znajomych"
          to="/friends"
        />
      ) : (
        <ul className="flex flex-col gap-4">
          {items.map((item) => {
            const { action, object } = feedLabel(item);
            const chip = feedChip(item);
            return (
              <li key={item.id} className="flex items-start gap-3">
                <UserAvatar
                  avatarUrl={item.author?.avatar_url}
                  avatarSource={item.author?.avatar_source}
                  displayName={item.author?.display_name}
                  username={item.author?.username}
                  size={36}
                  className="shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-snug text-balance">
                    <span className="font-bold">
                      {item.author?.display_name ?? item.author?.username ?? "Ktoś"}
                    </span>{" "}
                    {action}
                    {object && <span className="font-bold"> {object}</span>}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {timeAgo(item.created_at)}
                  </p>
                </div>
                {chip && (
                  <span className="shrink-0 rounded-full bg-background px-2.5 py-1 text-[11px] font-bold">
                    {chip}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ---------------------------------------------------------- ranking */

function FriendsRankingCard() {
  const { user } = useUser();
  const { data: leaders, isLoading } = useFriendLeaderboard();
  const top = (leaders ?? []).slice(0, 3);

  return (
    <div className="rounded-3xl bg-blush p-5 text-navy">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="font-display text-lg">Ranking znajomych</h2>
        <Link to="/u" className="text-[11px] font-bold uppercase tracking-wide text-navy/55 hover:text-navy">
          Pełny
        </Link>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="pz-skel h-12 rounded-2xl" aria-hidden="true" />
          ))}
        </div>
      ) : top.length === 0 ? (
        <p className="py-2 text-sm text-navy/65">
          Dodaj znajomych, żeby ścigać się na wizyty.{" "}
          <Link to="/friends" className="font-bold underline">
            Zacznij tutaj
          </Link>
        </p>
      ) : (
        <ol className="flex flex-col gap-2">
          {top.map((p, i) => {
            const isMe = p.user_id === user?.id;
            return (
              <li key={p.user_id}>
                <Link
                  to="/u/$username"
                  params={{ username: p.username ?? "" }}
                  className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 transition ${
                    isMe ? "border-2 border-tomato bg-cream" : "bg-cream/60 hover:bg-cream"
                  }`}
                >
                  <span className="relative shrink-0">
                    <UserAvatar
                      avatarUrl={p.avatar_url}
                      avatarSource={p.avatar_source}
                      displayName={p.display_name}
                      username={p.username}
                      size={36}
                    />
                    <span
                      className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full border-2 border-blush bg-navy text-[10px] font-bold text-cream"
                      aria-hidden="true"
                    >
                      {i + 1}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-bold">
                    {isMe ? "Ty" : (p.display_name ?? p.username)}
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-navy/60">
                    {p.points_total} pkt
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

/* ------------------------------------------------------- next badge */

function NextBadgeCard() {
  const { user } = useUser();
  const { data: profile } = useMyProfile();
  const { data: all } = useAchievements();
  const { data: mine } = useUserAchievements(user?.id);
  const { data: reviewStats } = useUserReviewStats(user?.id);
  const { data: friendsCount } = useFriendsCount(user?.id);
  const { data: inviteStats } = useInviteStats();

  const next = useMemo(() => {
    const unlocked = new Set((mine ?? []).map((m) => m.achievement_id));
    const stats: Record<CriteriaType, number> = {
      reviews_count: reviewStats?.reviewsCount ?? 0,
      unique_places: reviewStats?.uniquePlaces ?? 0,
      points_total: profile?.points_total ?? 0,
      friends_count: friendsCount ?? 0,
      referrals_count: inviteStats?.accepted ?? 0,
    };
    // "Nearest" = highest completion among the ones still locked. An
    // achievement with no measurable threshold can never be "nearest",
    // so those are dropped rather than shown at 0%.
    return (all ?? [])
      .filter((a) => a.enabled !== false && !unlocked.has(a.id))
      .map((a) => ({ a, p: computeProgress(a, stats) }))
      .filter((x) => x.p.threshold > 0)
      .sort((x, y) => y.p.pct - x.p.pct)[0];
  }, [all, mine, reviewStats, friendsCount, inviteStats, profile]);

  return (
    <div className="rounded-3xl border border-border bg-card p-5">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="font-display text-lg">Najbliższa odznaka</h2>
        <Link to="/osiagniecia" className="text-xs font-semibold text-tomato hover:underline">
          Wszystkie
        </Link>
      </div>

      {!next ? (
        <p className="py-2 text-sm text-muted-foreground">
          {all?.length ? "Masz już wszystkie dostępne odznaki. Szacun 🏆" : "Ładowanie…"}
        </p>
      ) : (
        <div className="flex items-center gap-4">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-tomato/12 text-2xl">
            {next.a.icon_url && !next.a.icon_url.startsWith("http") ? (
              next.a.icon_url
            ) : (
              <Trophy size={24} className="text-tomato" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold">{next.a.name}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {next.p.current} z {next.p.threshold}
              {next.p.remaining > 0 && ` · zostało ${next.p.remaining}`}
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-tomato transition-[width] duration-500"
                style={{ width: `${next.p.pct}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- misc */

function EmptyHint({ text, cta, to }: { text: string; cta: string; to: string }) {
  return (
    <div className="py-4 text-center">
      <p className="text-sm text-muted-foreground">{text}</p>
      <Link
        to={to}
        className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-navy px-4 py-2 text-xs font-semibold text-cream transition hover:bg-navy/90"
      >
        <Users size={13} /> {cta}
      </Link>
    </div>
  );
}
