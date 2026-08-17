import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery, keepPreviousData, useQueryClient } from "@tanstack/react-query";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useEffect, useState } from "react";
import { Search, ChevronLeft, ChevronRight, Users, Loader2, X, Trophy, Crown, ChevronDown, ArrowUpDown, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { UserAvatar } from "@/components/UserAvatar";
import { useUser } from "@/lib/use-auth";
import type { AvatarSource } from "@/lib/profile-api";


const PAGE_SIZE = 24;

const searchSchema = z.object({
  q: fallback(z.string(), "").default(""),
  page: fallback(z.number().int().min(1), 1).default(1),
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
    .select("id, username, display_name, avatar_url, avatar_source, bio, district, points_total", { count: "exact" })
    .or("username.not.is.null,display_name.not.is.null")
    .order("points_total", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, to);
  const trimmed = q.trim();
  if (trimmed) {
    const safe = trimmed.replace(/[%,]/g, " ");
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
      { title: "Ranking — poŻeramy" },
      { name: "description", content: "Ranking poŻeraczy — top użytkownicy według punktów poŻarcia. Znajdź najbardziej głodnych recenzentów." },
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
          <button onClick={() => { router.invalidate(); reset(); }} className="chip bg-tomato text-cream">Spróbuj ponownie</button>
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

  // Local input synced with URL — URL is debounced source of truth
  const [input, setInput] = useState(q);
  useEffect(() => { setInput(q); }, [q]);
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
            Top pożeracze wg punktów poŻarcia, Twoi znajomi i wyszukiwanie po nicku — wszystko w jednym.
          </p>
        </div>
      </div>

      <RankingSection />


      <section className="mx-auto max-w-5xl px-4 pt-8 pb-4">
        <h2 className="font-display text-xl mb-3">Wszyscy użytkownicy</h2>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden />
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
            <span>Znaleziono {total} {pluralize(total, "profil", "profile", "profili")} dla „{q}".</span>
          ) : (
            <span>{total} {pluralize(total, "użytkownik", "użytkowników", "użytkowników")} łącznie.</span>
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
                    <div className="text-sm font-semibold truncate">{p.display_name || `@${p.username ?? "user"}`}</div>
                    {p.username && <div className="text-xs text-muted-foreground truncate">@{p.username}</div>}
                    {(p.district || p.bio) && (
                      <div className="text-xs text-muted-foreground truncate mt-0.5">
                        {p.district && p.bio ? `${p.district} · ${p.bio}` : (p.district ?? p.bio)}
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-display text-lg leading-none text-tomato">{p.points_total}</div>
                    <div className="text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5">pkt</div>
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
        <li key={i} className="h-20 rounded-2xl bg-muted/40 animate-pulse" />
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
 * RANKING — top 3 podium + top 10, then "Zobacz więcej"
 * ============================================================ */
type RankSort = "points" | "newest" | "alpha";
type RankFilter = "all" | "withAvatar" | "withBio" | "withDistrict";

const SORT_LABEL: Record<RankSort, string> = {
  points: "Punkty poŻarcia",
  newest: "Najnowsi",
  alpha: "Alfabetycznie",
};
const FILTER_LABEL: Record<RankFilter, string> = {
  all: "Wszyscy",
  withAvatar: "Z avatarem",
  withBio: "Z bio",
  withDistrict: "Z dzielnicą",
};

async function fetchRanking(limit: number, sort: RankSort, filter: RankFilter): Promise<BrowseProfile[]> {
  let q = supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, avatar_source, bio, district, points_total")
    .or("username.not.is.null,display_name.not.is.null");

  if (filter === "withAvatar") q = q.not("avatar_url", "is", null);
  if (filter === "withBio") q = q.not("bio", "is", null);
  if (filter === "withDistrict") q = q.not("district", "is", null);

  if (sort === "points") {
    q = q.order("points_total", { ascending: false }).order("created_at", { ascending: false });
  } else if (sort === "newest") {
    q = q.order("created_at", { ascending: false });
  } else {
    q = q.order("display_name", { ascending: true, nullsFirst: false }).order("username", { ascending: true, nullsFirst: false });
  }

  const { data, error } = await q.limit(limit);
  if (error) throw error;
  return (data ?? []) as BrowseProfile[];
}

function RankingSection() {
  const [expanded, setExpanded] = useState(false);
  const [sort, setSort] = useState<RankSort>("points");
  const [filter, setFilter] = useState<RankFilter>("all");
  const limit = expanded ? 30 : 10;
  const qc = useQueryClient();
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["users-ranking", limit, sort, filter],
    queryFn: () => fetchRanking(limit, sort, filter),
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    placeholderData: keepPreviousData,
  });

  // Realtime: any change to profiles refreshes ranking without reload.
  useEffect(() => {
    const ch = supabase
      .channel("ranking-profiles")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles" },
        () => qc.invalidateQueries({ queryKey: ["users-ranking"] }),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "profiles" },
        () => qc.invalidateQueries({ queryKey: ["users-ranking"] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);


  const rows = data ?? [];
  // In non-points sort modes, keep podium visible only when it makes sense
  const showPodium = sort === "points" && filter === "all";
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
            {SORT_LABEL[sort]}{filter !== "all" ? ` · ${FILTER_LABEL[filter]}` : ""}.
            {isFetching && <Loader2 size={11} className="animate-spin" aria-label="Aktualizuję ranking" />}
          </p>
        </div>
      </div>

      {/* Sort + filter controls */}
      <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-border bg-card p-3 sm:p-4 sm:flex-row sm:items-center sm:justify-between">
        <label className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground shrink-0">
          <ArrowUpDown size={14} aria-hidden /> Sortuj
          <select
            value={sort}
            onChange={(e) => { setSort(e.target.value as RankSort); setExpanded(false); }}
            className="min-h-11 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tomato"
            aria-label="Sortuj ranking"
          >
            {(Object.keys(SORT_LABEL) as RankSort[]).map((k) => (
              <option key={k} value={k}>{SORT_LABEL[k]}</option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground shrink-0">
            <Filter size={14} aria-hidden /> Typ
          </span>
          <div className="-mx-1 flex gap-1.5 overflow-x-auto scrollbar-none px-1">
            {(Object.keys(FILTER_LABEL) as RankFilter[]).map((k) => {
              const active = filter === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => { setFilter(k); setExpanded(false); }}
                  className={`min-h-11 shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition border ${active ? "bg-tomato text-cream border-tomato" : "bg-background text-foreground border-border hover:border-tomato"}`}
                  aria-pressed={active}
                >
                  {FILTER_LABEL[k]}
                </button>
              );
            })}
          </div>
        </div>
      </div>


      {isLoading && rows.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 rounded-2xl bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Brak wyników dla wybranych filtrów.
        </div>
      ) : (
        <>
          {/* Podium — top 3 (only in points+all mode) */}
          {podium.length > 0 && (
            <ol
              className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4"
              aria-label="Top 3 użytkowników"
            >
              {podium.map((p, i) => (
                <PodiumCard key={p.id} profile={p} place={i + 1} />
              ))}
            </ol>
          )}

          {/* Rest list */}
          {rest.length > 0 && (
            <ol className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden" start={podium.length + 1}>
              {rest.map((p, i) => (
                <RankRow key={p.id} profile={p} place={podium.length + i + 1} />
              ))}
            </ol>
          )}

          {/* Toggle */}
          {rows.length >= 10 && (
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-full bg-card border border-border hover:border-tomato px-4 py-2 text-sm font-semibold transition"
                aria-expanded={expanded}
              >
                {expanded ? "Zwiń ranking" : "Zobacz więcej"}
                <ChevronDown size={14} className={expanded ? "rotate-180 transition" : "transition"} />
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function PodiumCard({ profile, place }: { profile: BrowseProfile; place: number }) {
  const styles =
    place === 1
      ? { ring: "ring-2 ring-yellow-400", badge: "bg-yellow-400 text-navy", glow: "shadow-[0_8px_30px_-12px_rgba(250,204,21,0.55)]", label: "1. miejsce" }
      : place === 2
        ? { ring: "ring-2 ring-zinc-300", badge: "bg-zinc-300 text-navy", glow: "shadow-[0_8px_24px_-12px_rgba(212,212,216,0.5)]", label: "2. miejsce" }
        : { ring: "ring-2 ring-amber-600/70", badge: "bg-amber-600 text-cream", glow: "shadow-[0_8px_24px_-12px_rgba(217,119,6,0.5)]", label: "3. miejsce" };
  return (
    <li>
      <Link
        to="/u/$username"
        params={{ username: profile.username ?? profile.id }}
        className={`relative flex flex-col items-center text-center gap-2 rounded-2xl bg-card border border-border p-4 pt-7 hover:border-tomato transition ${styles.glow}`}
        aria-label={`${styles.label}: ${profile.display_name || profile.username || "użytkownik"}`}
      >
        <span className={`absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${styles.badge}`}>
          {place === 1 && <Crown size={12} />} #{place}
        </span>
        <UserAvatar
          avatarUrl={profile.avatar_url}
          avatarSource={profile.avatar_source}
          displayName={profile.display_name}
          username={profile.username}
          size={place === 1 ? 72 : 56}
          className={styles.ring}
        />
        <div className="min-w-0 w-full">
          <div className="text-sm font-semibold truncate">{profile.display_name || `@${profile.username ?? "user"}`}</div>
          {profile.username && profile.display_name && (
            <div className="text-[11px] text-muted-foreground truncate">@{profile.username}</div>
          )}
        </div>
        <div>
          <div className="font-display text-2xl leading-none text-tomato">{profile.points_total}</div>
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5">pkt PoŻarcia</div>
        </div>
      </Link>
    </li>
  );
}

function RankRow({ profile, place }: { profile: BrowseProfile; place: number }) {
  return (
    <li>
      <Link
        to="/u/$username"
        params={{ username: profile.username ?? profile.id }}
        className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/40 transition"
      >
        <span className="w-7 text-center text-sm font-bold text-muted-foreground tabular-nums">{place}</span>
        <UserAvatar
          avatarUrl={profile.avatar_url}
          avatarSource={profile.avatar_source}
          displayName={profile.display_name}
          username={profile.username}
          size={36}
        />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold truncate">{profile.display_name || `@${profile.username ?? "user"}`}</div>
          {profile.username && profile.display_name && (
            <div className="text-[11px] text-muted-foreground truncate">@{profile.username}</div>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className="font-display text-base leading-none text-tomato">{profile.points_total}</div>
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5">pkt</div>
        </div>
      </Link>
    </li>
  );
}
