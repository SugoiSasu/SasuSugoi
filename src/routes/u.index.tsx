import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery, keepPreviousData, useQueryClient } from "@tanstack/react-query";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useEffect, useState } from "react";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Users,
  Loader2,
  X,
  Trophy,
  Crown,
  ChevronDown,
  Globe2,
  UserPlus2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeIlikeTerm } from "@/lib/postgrest-filter";
import { UserAvatar } from "@/components/UserAvatar";
import { useUser } from "@/lib/use-auth";
import type { AvatarSource } from "@/lib/profile-api";
import { Skeleton } from "@/components/ui/skeleton";
import { VipBadge, isVipActive, vipNameStyle } from "@/components/VipBadge";
import { useFriendLeaderboard } from "@/lib/friends-api";

const PAGE_SIZE = 24;

const searchSchema = z.object({
  q: fallback(z.string(), "").default(""),
  page: fallback(z.number().int().min(1), 1).default(1),
  scope: fallback(z.enum(["all", "friends"]), "all").default("all"),
});

interface BrowseProfile {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  avatar_source: AvatarSource;
  bio: string | null;
  district: string | null;
  points_total: number;
  is_vip: boolean;
  vip_until: string | null;
  vip_nick_color: string | null;
}

interface BrowseResult {
  rows: BrowseProfile[];
  total: number;
}

async function fetchProfiles(q: string, page: number): Promise<BrowseResult> {
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  let query = supabase
    .from("profiles")
    .select(
      "id, username, display_name, avatar_url, avatar_source, bio, district, points_total, is_vip, vip_until, vip_nick_color",
      { count: "exact" },
    )
    .or("username.not.is.null,display_name.not.is.null")
    .order("points_total", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, to);
  const safe = sanitizeIlikeTerm(q);
  if (safe) {
    const like = `%${safe}%`;
    query = query.or(`username.ilike.${like},display_name.ilike.${like}`);
  }
  const { data, error, count } = await query;
  if (error) throw error;
  return { rows: (data ?? []) as BrowseProfile[], total: count ?? 0 };
}

export const Route = createFileRoute("/u/")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Ranking - poŻeramy" },
      {
        name: "description",
        content:
          "Ranking poŻeraczy - top użytkownicy według punktów poŻarcia. Znajdź najbardziej głodnych recenzentów.",
      },
    ],
  }),
  component: UsersBrowse,
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <main id="main-content" className="min-h-dvh grid place-items-center p-4">
        <div className="text-center">
          <p className="text-muted-foreground mb-3">Nie udało się załadować listy.</p>
          <p className="text-xs text-muted-foreground/70 mb-4">{error.message}</p>
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="chip bg-tomato text-cream"
          >
            Spróbuj ponownie
          </button>
        </div>
      </main>
    );
  },
  notFoundComponent: () => (
    <main className="min-h-dvh grid place-items-center p-4">
      <p>Nie znaleziono.</p>
    </main>
  ),
});

type Search = z.infer<typeof searchSchema>;

function UsersBrowse() {
  const { q, page } = Route.useSearch();
  const navigate = useNavigate({ from: "/u/" });

  // Local input synced with URL - URL is debounced source of truth
  const [input, setInput] = useState(q);
  useEffect(() => {
    setInput(q);
  }, [q]);
  useEffect(() => {
    const t = setTimeout(() => {
      if (input !== q) {
        navigate({ search: (prev: Search) => ({ ...prev, q: input, page: 1 }) });
      }
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["users-browse", q, page],
    queryFn: () => fetchProfiles(q, page),
    placeholderData: keepPreviousData,
  });

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rows = data?.rows ?? [];

  const goTo = (p: number) => {
    const next = Math.min(totalPages, Math.max(1, p));
    navigate({ search: (prev: Search) => ({ ...prev, page: next }) });
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const { user } = useUser();

  return (
    <main className="min-h-dvh bg-background">
      <div className="bg-terrazzo-navy text-cream">
        <div className="mx-auto max-w-5xl px-4 py-8">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
            <div className="flex items-center gap-2 text-cream/70 text-sm">
              <Users size={14} /> Społeczność poŻeramy
            </div>
            {user && (
              <Link
                to="/friends"
                className="inline-flex items-center gap-1.5 rounded-full bg-cream/10 hover:bg-cream/20 text-cream text-xs font-semibold px-3 py-1.5 transition"
              >
                <Users size={14} /> Twoi znajomi
              </Link>
            )}
          </div>
          <h1 className="font-display text-3xl sm:text-4xl leading-tight">Ranking poŻeraczy</h1>
          <p className="text-cream/80 text-sm mt-2 max-w-prose">
            Top pożeracze wg punktów poŻarcia, Twoi znajomi i wyszukiwanie po nicku - wszystko w
            jednym.
          </p>
        </div>
      </div>

      <RankingSection />

      <section className="mx-auto max-w-5xl px-4 pt-10 pb-4 border-t border-border">
        <h2 className="font-display text-xl mb-1">Znajdź profil</h2>
        <p className="text-xs text-muted-foreground mb-3">
          Szukaj konkretnej osoby po nicku lub imieniu - niezależnie od miejsca w rankingu.
        </p>
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            type="search"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Szukaj po nicku lub imieniu…"
            aria-label="Szukaj użytkowników"
            className="w-full rounded-full border border-border bg-card pl-10 pr-10 py-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tomato"
          />
          {input && (
            <button
              type="button"
              onClick={() => setInput("")}
              aria-label="Wyczyść wyszukiwanie"
              className="absolute right-1 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full hover:bg-muted text-muted-foreground"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <div className="mt-2 text-xs text-muted-foreground flex items-center gap-2">
          {isFetching && <Loader2 size={12} className="animate-spin" />}
          {q ? (
            <span>
              Znaleziono {total} {pluralize(total, "profil", "profile", "profili")} dla „{q}".
            </span>
          ) : (
            <span>
              {total} {pluralize(total, "użytkownik", "użytkowników", "użytkowników")} łącznie.
            </span>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-10">
        {isLoading ? (
          <GridSkeleton />
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            Brak wyników. Spróbuj innego zapytania.
          </div>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {rows.map((p) => (
              <li key={p.id}>
                <Link
                  to="/u/$username"
                  params={{ username: p.username ?? p.id }}
                  className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-3 hover:border-tomato transition"
                >
                  <UserAvatar
                    avatarUrl={p.avatar_url}
                    avatarSource={p.avatar_source}
                    displayName={p.display_name}
                    username={p.username}
                    size={48}
                    className="group-hover:ring-2 group-hover:ring-tomato/50 transition shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1 min-w-0">
                      <span className="text-sm font-semibold truncate" style={vipNameStyle(p)}>
                        {p.display_name || `@${p.username ?? "user"}`}
                      </span>
                      {isVipActive(p) && <VipBadge />}
                    </div>
                    {p.username && (
                      <div className="text-xs text-muted-foreground truncate">@{p.username}</div>
                    )}
                    {(p.district || p.bio) && (
                      <div className="text-xs text-muted-foreground truncate mt-0.5">
                        {p.district && p.bio ? `${p.district} · ${p.bio}` : (p.district ?? p.bio)}
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-display text-lg leading-none text-tomato">
                      {p.points_total}
                    </div>
                    <div className="text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5">
                      pkt
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {totalPages > 1 && (
          <nav className="mt-6 flex items-center justify-center gap-2" aria-label="Paginacja">
            <button
              type="button"
              onClick={() => goTo(page - 1)}
              disabled={page <= 1}
              className="chip bg-card border border-border hover:border-tomato disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Poprzednia strona"
            >
              <ChevronLeft size={14} /> Poprzednia
            </button>
            <span className="text-sm text-muted-foreground px-2" aria-live="polite">
              Strona <strong className="text-foreground">{page}</strong> z {totalPages}
            </span>
            <button
              type="button"
              onClick={() => goTo(page + 1)}
              disabled={page >= totalPages}
              className="chip bg-card border border-border hover:border-tomato disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Następna strona"
            >
              Następna <ChevronRight size={14} />
            </button>
          </nav>
        )}
      </section>
    </main>
  );
}

function GridSkeleton() {
  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {Array.from({ length: 9 }).map((_, i) => (
        <li key={i}>
          <Skeleton className="h-20 rounded-2xl" />
        </li>
      ))}
    </ul>
  );
}

function pluralize(n: number, one: string, few: string, many: string) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (n === 1) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

/* ============================================================
 * RANKING - scope toggle (Wszyscy / Znajomi) + top 3 podium + list.
 *
 * Redesigned 2026-08-25: the old version had a "Sortuj"/"Typ" filter
 * bar (newest/alphabetical sort, filter by "has avatar"/"has bio"/"has
 * district") that didn't fit a leaderboard - those are directory-browse
 * concerns, not ranking ones (Mateusz: "słabe filtrowanie"). Real gap he
 * flagged was that this page lived in total isolation from Znajomi -
 * there was a SEPARATE, differently-styled friends-only leaderboard
 * buried in a Friends tab. Replaced the filter bar with a Wszyscy/Znajomi
 * scope toggle so there's exactly one ranking UI, reachable from both
 * places (see [[project_ranking_page_redesign_todo]]).
 * ============================================================ */
type RankScope = "all" | "friends";

interface RankProfile {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  avatar_source: AvatarSource | null;
  points_total: number;
  is_vip: boolean;
  vip_until: string | null;
  vip_nick_color: string | null;
  reviews_count?: number;
  achievements_count?: number;
}

async function fetchRanking(limit: number): Promise<RankProfile[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, username, display_name, avatar_url, avatar_source, points_total, is_vip, vip_until, vip_nick_color",
    )
    .or("username.not.is.null,display_name.not.is.null")
    .order("points_total", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as RankProfile[];
}

async function fetchMyGlobalRank(myPoints: number): Promise<number> {
  const { count, error } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .gt("points_total", myPoints);
  if (error) throw error;
  return (count ?? 0) + 1;
}

function RankingSection() {
  const { scope } = Route.useSearch();
  const navigate = useNavigate({ from: "/u/" });
  const { user } = useUser();
  const { data: myProfile } = useQuery({
    queryKey: ["my-rank-profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("points_total")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const setScope = (next: RankScope) =>
    navigate({ search: (prev: Search) => ({ ...prev, scope: next }) });

  const [expanded, setExpanded] = useState(false);
  const limit = expanded ? 30 : 10;
  const qc = useQueryClient();

  const globalQ = useQuery({
    queryKey: ["users-ranking", limit],
    queryFn: () => fetchRanking(limit),
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    placeholderData: keepPreviousData,
    enabled: scope === "all",
  });
  const friendsQ = useFriendLeaderboard();

  const myRankQ = useQuery({
    queryKey: ["my-global-rank", myProfile?.points_total],
    queryFn: () => fetchMyGlobalRank(myProfile!.points_total),
    enabled: scope === "all" && !!myProfile,
    staleTime: 15_000,
  });

  // Realtime: any change to profiles refreshes ranking without reload.
  useEffect(() => {
    const ch = supabase
      .channel("ranking-profiles")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, () => {
        qc.invalidateQueries({ queryKey: ["users-ranking"] });
        qc.invalidateQueries({ queryKey: ["my-global-rank"] });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "profiles" }, () =>
        qc.invalidateQueries({ queryKey: ["users-ranking"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const isLoading = scope === "all" ? globalQ.isLoading : friendsQ.isLoading;
  const isFetching = scope === "all" ? globalQ.isFetching : friendsQ.isFetching;
  const allRows: RankProfile[] =
    scope === "all"
      ? (globalQ.data ?? [])
      : (friendsQ.data ?? []).map((r) => ({
          id: r.user_id,
          username: r.username,
          display_name: r.display_name,
          avatar_url: r.avatar_url,
          avatar_source: r.avatar_source,
          points_total: r.points_total,
          is_vip: r.is_vip,
          vip_until: r.vip_until,
          vip_nick_color: r.vip_nick_color,
          reviews_count: r.reviews_count,
          achievements_count: r.achievements_count,
        }));
  const rows = scope === "friends" && !expanded ? allRows.slice(0, 10) : allRows;

  const hasNoFriendsYet = scope === "friends" && !friendsQ.isLoading && allRows.length <= 1;
  const showPodium = rows.length >= 3;
  const podium = showPodium ? rows.slice(0, 3) : [];
  const rest = showPodium ? rows.slice(3) : rows;

  return (
    <section className="mx-auto max-w-5xl px-4 pt-8 pb-2">
      <div className="flex items-end justify-between mb-4 flex-wrap gap-2">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider font-semibold text-tomato mb-1">
            <Trophy size={14} /> Ranking
          </div>
          <h2 className="font-display text-2xl sm:text-3xl leading-tight">Top pożeracze</h2>
          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
            Wg punktów poŻarcia
            {isFetching && (
              <Loader2 size={11} className="animate-spin" aria-label="Aktualizuję ranking" />
            )}
          </p>
        </div>

        {myProfile && scope === "all" && myRankQ.data && (
          <div className="flex items-center gap-2 rounded-2xl border border-tomato/40 bg-tomato/10 px-3 py-2">
            <span className="text-[10px] uppercase tracking-wider text-tomato font-semibold">
              Twoja pozycja
            </span>
            <span className="font-display text-lg leading-none text-tomato">
              #{myRankQ.data}
            </span>
            <span className="text-xs text-muted-foreground">
              · {myProfile.points_total} pkt
            </span>
          </div>
        )}
      </div>

      {/* Scope toggle: global vs. friends-only ranking, in one place */}
      <div className="mb-4 inline-flex rounded-full border border-border bg-card p-1">
        <button
          type="button"
          onClick={() => setScope("all")}
          className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${scope === "all" ? "bg-tomato text-cream" : "text-foreground hover:bg-muted"}`}
          aria-pressed={scope === "all"}
        >
          <Globe2 size={14} /> Wszyscy
        </button>
        <button
          type="button"
          onClick={() => user && setScope("friends")}
          disabled={!user}
          title={user ? undefined : "Zaloguj się, by zobaczyć ranking znajomych"}
          className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed ${scope === "friends" ? "bg-tomato text-cream" : "text-foreground hover:bg-muted"}`}
          aria-pressed={scope === "friends"}
        >
          <Users size={14} /> Znajomi
        </button>
      </div>

      {isLoading && rows.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      ) : hasNoFriendsYet ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground mb-3">
            Nie masz jeszcze znajomych do porównania. Zaproś kogoś i zobacz, kto poŻera więcej!
          </p>
          <Link
            to="/friends"
            search={{ tab: "invite" }}
            className="inline-flex items-center gap-1.5 rounded-full bg-tomato text-cream px-4 py-2 text-sm font-semibold hover:bg-tomato/90 transition"
          >
            <UserPlus2 size={14} /> Zaproś znajomych
          </Link>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Brak wyników.
        </div>
      ) : (
        <>
          {/* Podium - top 3 */}
          {podium.length > 0 && (
            <ol className="grid grid-cols-3 gap-2 sm:gap-3 mb-4" aria-label="Top 3 użytkowników">
              {podium.map((p, i) => (
                <PodiumCard key={p.id} profile={p} place={i + 1} isMe={p.id === user?.id} />
              ))}
            </ol>
          )}

          {/* Rest list */}
          {rest.length > 0 && (
            <ol
              className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden"
              start={podium.length + 1}
            >
              {rest.map((p, i) => (
                <RankRow
                  key={p.id}
                  profile={p}
                  place={podium.length + i + 1}
                  isMe={p.id === user?.id}
                />
              ))}
            </ol>
          )}

          {/* Toggle */}
          {allRows.length >= 10 && (
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-full bg-card border border-border hover:border-tomato px-4 py-2 text-sm font-semibold transition"
                aria-expanded={expanded}
              >
                {expanded ? "Zwiń ranking" : "Zobacz więcej"}
                <ChevronDown
                  size={14}
                  className={expanded ? "rotate-180 transition" : "transition"}
                />
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function PodiumCard({
  profile,
  place,
  isMe,
}: {
  profile: RankProfile;
  place: number;
  isMe?: boolean;
}) {
  const styles =
    place === 1
      ? {
          ring: "ring-2 ring-yellow-400",
          badge: "bg-yellow-400 text-navy",
          glow: "shadow-[0_8px_30px_-12px_rgba(250,204,21,0.55)]",
          label: "1. miejsce",
        }
      : place === 2
        ? {
            ring: "ring-2 ring-zinc-300",
            badge: "bg-zinc-300 text-navy",
            glow: "shadow-[0_8px_24px_-12px_rgba(212,212,216,0.5)]",
            label: "2. miejsce",
          }
        : {
            ring: "ring-2 ring-amber-600/70",
            badge: "bg-amber-600 text-cream",
            glow: "shadow-[0_8px_24px_-12px_rgba(217,119,6,0.5)]",
            label: "3. miejsce",
          };
  return (
    <li>
      <Link
        to="/u/$username"
        params={{ username: profile.username ?? profile.id }}
        className={`relative flex flex-col items-center text-center gap-1 sm:gap-2 rounded-2xl bg-card border p-2 pt-6 sm:p-4 sm:pt-7 transition ${styles.glow} ${isMe ? "border-tomato" : "border-border hover:border-tomato"}`}
        aria-label={`${styles.label}: ${profile.display_name || profile.username || "użytkownik"}`}
      >
        <span
          className={`absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 sm:px-2.5 sm:py-1 text-[10px] sm:text-[11px] font-bold ${styles.badge}`}
        >
          {place === 1 && <Crown size={12} />} #{place}
        </span>
        <UserAvatar
          avatarUrl={profile.avatar_url}
          avatarSource={profile.avatar_source}
          displayName={profile.display_name}
          username={profile.username}
          size={place === 1 ? 56 : 44}
          className={`${styles.ring} sm:hidden`}
        />
        <UserAvatar
          avatarUrl={profile.avatar_url}
          avatarSource={profile.avatar_source}
          displayName={profile.display_name}
          username={profile.username}
          size={place === 1 ? 72 : 56}
          className={`${styles.ring} hidden sm:block`}
        />
        <div className="min-w-0 w-full">
          <div className="text-xs sm:text-sm font-semibold truncate" style={vipNameStyle(profile)}>
            {profile.display_name || `@${profile.username ?? "user"}`}
            {isMe && <span className="text-tomato"> (Ty)</span>}
          </div>
          {profile.username && profile.display_name && (
            <div className="hidden sm:block text-[11px] text-muted-foreground truncate">
              @{profile.username}
            </div>
          )}
        </div>
        <div>
          <div className="font-display text-base sm:text-2xl leading-none text-tomato">
            {profile.points_total}
          </div>
          <div className="text-[8px] sm:text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5">
            pkt
          </div>
        </div>
      </Link>
    </li>
  );
}

function RankRow({
  profile,
  place,
  isMe,
}: {
  profile: RankProfile;
  place: number;
  isMe?: boolean;
}) {
  return (
    <li>
      <Link
        to="/u/$username"
        params={{ username: profile.username ?? profile.id }}
        className={`flex items-center gap-3 px-3 py-2.5 transition ${isMe ? "bg-tomato/[0.06]" : "hover:bg-muted/40"}`}
      >
        <span className="w-7 text-center text-sm font-bold text-muted-foreground tabular-nums">
          {place}
        </span>
        <UserAvatar
          avatarUrl={profile.avatar_url}
          avatarSource={profile.avatar_source}
          displayName={profile.display_name}
          username={profile.username}
          size={36}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 min-w-0">
            <span className="text-sm font-semibold truncate" style={vipNameStyle(profile)}>
              {profile.display_name || `@${profile.username ?? "user"}`}
            </span>
            {isMe && <span className="text-tomato text-xs">(Ty)</span>}
            {isVipActive(profile) && <VipBadge />}
          </div>
          {profile.reviews_count !== undefined ? (
            <div className="text-[11px] text-muted-foreground truncate">
              {profile.reviews_count} {pluralize(profile.reviews_count, "recenzja", "recenzje", "recenzji")} ·{" "}
              {profile.achievements_count} {pluralize(profile.achievements_count ?? 0, "odznaka", "odznaki", "odznak")}
            </div>
          ) : (
            profile.username &&
            profile.display_name && (
              <div className="text-[11px] text-muted-foreground truncate">@{profile.username}</div>
            )
          )}
        </div>
        <div className="text-right shrink-0">
          <div className="font-display text-base leading-none text-tomato">
            {profile.points_total}
          </div>
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5">
            pkt
          </div>
        </div>
      </Link>
    </li>
  );
}
