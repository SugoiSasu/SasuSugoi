import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Bookmark, Check, ChevronRight, Heart, Search, Star, Users } from "lucide-react";
import { useUser } from "@/lib/use-auth";
import { useUserVisitedPlaces, useUserFavoritePlaces, type VisitedPlace } from "@/lib/visits-api";
import { useFriendProfiles } from "@/lib/friends-api";
import { usePlaceRatingsMap } from "@/lib/places-api";
import { UserAvatar } from "@/components/UserAvatar";
import { useUserLocation, haversineKm, formatDistancePl } from "@/lib/geo";

export const Route = createFileRoute("/moje-miejsca")({
  head: () => ({
    meta: [
      { title: "Moje miejsca — poŻeramy" },
      { name: "description", content: "Twoja lista knajp: do odwiedzenia, odwiedzone i ulubione. Wracaj do miejsc, które poŻarłeś." },
      { property: "og:title", content: "Moje miejsca — poŻeramy" },
      { property: "og:description", content: "Twoja lista knajp: do odwiedzenia, odwiedzone i ulubione." },
    ],
  }),
  component: MyPlacesPage,
});

type Tab = "want" | "visited" | "fav" | "friends";
type Sort = "recent" | "alpha" | "rating" | "near";

function MyPlacesPage() {
  const { user } = useUser();
  const [tab, setTab] = useState<Tab>("want");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("recent");
  const { data: want, isLoading: loadingWant } = useUserVisitedPlaces(user?.id, "want");
  const { data: visited, isLoading: loadingVisited } = useUserVisitedPlaces(user?.id, "visited");
  const { data: favs, isLoading: loadingFavs } = useUserFavoritePlaces(user?.id);
  const { data: friends, isLoading: loadingFriends } = useFriendProfiles(user?.id);
  const { data: ratings } = usePlaceRatingsMap();
  const userLoc = useUserLocation();

  const distanceFor = (p: VisitedPlace): number | null => {
    if (!userLoc || typeof p.lat !== "number" || typeof p.lng !== "number") return null;
    return haversineKm(userLoc, { lat: p.lat, lng: p.lng });
  };

  const loading =
    tab === "want" ? loadingWant : tab === "visited" ? loadingVisited : tab === "fav" ? loadingFavs : loadingFriends;

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "want", label: "Do odwiedzenia", count: want?.length ?? 0 },
    { key: "visited", label: "Odwiedzone", count: visited?.length ?? 0 },
    { key: "fav", label: "Ulubione", count: favs?.length ?? 0 },
    { key: "friends", label: "Znajomi", count: friends?.length ?? 0 },
  ];

  const base: VisitedPlace[] =
    tab === "want" ? want ?? [] : tab === "visited" ? visited ?? [] : tab === "fav" ? favs ?? [] : [];

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out = base.filter(
      (p) =>
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.cuisine ?? "").toLowerCase().includes(q) ||
        (p.address ?? "").toLowerCase().includes(q),
    );
    return [...out].sort((a, b) => {
      if (sort === "alpha") return a.name.localeCompare(b.name, "pl");
      if (sort === "rating") return (ratings?.get(b.id)?.avg ?? 0) - (ratings?.get(a.id)?.avg ?? 0);
      if (sort === "near") {
        const da = distanceFor(a);
        const db = distanceFor(b);
        return (da ?? Infinity) - (db ?? Infinity);
      }
      return (b.added_at ?? "").localeCompare(a.added_at ?? "");
    });
  }, [base, query, sort, ratings, userLoc]);

  const filteredFriends = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (friends ?? []).filter(
      (f) => !q || (f.display_name ?? "").toLowerCase().includes(q) || (f.username ?? "").toLowerCase().includes(q),
    );
  }, [friends, query]);

  if (!user) {
    return (
      <main id="main-content" className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-extrabold">Moje miejsca</h1>
        <p className="mt-2 text-sm text-muted-foreground">Zaloguj się, żeby zapisywać knajpy na swoich listach.</p>
        <Link to="/auth" className="mt-6 inline-flex rounded-full bg-tomato px-6 py-3 text-sm font-semibold text-cream">
          Zaloguj się
        </Link>
      </main>
    );
  }

  return (
    <main id="main-content" className="mx-auto max-w-3xl px-4 py-6 sm:py-10 lg:max-w-6xl lg:px-6">
      <h1 className="font-display text-2xl font-extrabold sm:text-3xl">Moje miejsca</h1>
      <p className="mt-1 text-sm text-muted-foreground">Wszystko, co zapisałeś w jednym miejscu.</p>

      <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-2 scrollbar-none">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`min-h-11 shrink-0 rounded-full border px-4 py-2 text-xs font-semibold transition ${
              tab === t.key ? "border-navy bg-navy text-cream" : "border-border bg-card hover:border-tomato"
            }`}
          >
            {t.label} <span className="opacity-70">{t.count}</span>
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tab === "friends" ? "Szukaj znajomego…" : "Szukaj na liście…"}
            aria-label="Szukaj na liście"
            className="h-11 w-full rounded-full border border-border bg-card pl-9 pr-4 text-sm outline-none focus:border-tomato"
          />
        </div>
        {tab !== "friends" && (
          <div className="flex gap-2">
            {(
              [
                ["recent", "Ostatnio dodane"],
                ["alpha", "A–Z"],
                ["rating", "Ocena"],
                ...(userLoc ? ([["near", "Najbliżej"]] as const) : []),
              ] as [Sort, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSort(key)}
                className={`min-h-11 rounded-full border px-3 py-2 text-xs font-semibold transition ${
                  sort === key ? "border-tomato bg-tomato/10 text-tomato" : "border-border bg-card hover:border-tomato"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <ul className="mt-5 space-y-2 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0 xl:grid-cols-3" aria-busy="true">
          {Array.from({ length: 5 }).map((_, i) => (
            <li key={i} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
              <div className="pz-skel h-16 w-16 shrink-0 rounded-xl" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="pz-skel h-3.5 w-2/5" />
                <div className="pz-skel h-3 w-1/4" />
                <div className="pz-skel h-3 w-16" />
              </div>
            </li>
          ))}
        </ul>
      ) : tab === "friends" ? (
        <ul key="friends" className="pz-fade-in mt-5 space-y-2 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0 xl:grid-cols-3">

          {filteredFriends.map((f) => (
            <li key={f.id}>
              <Link
                to="/u/$username"
                params={{ username: f.username ?? f.id }}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 transition hover:border-tomato"
              >
                <UserAvatar avatarUrl={f.avatar_url} displayName={f.display_name} username={f.username} size={44} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{f.display_name || f.username}</p>
                  {f.username && <p className="truncate text-xs text-muted-foreground">@{f.username}</p>}
                </div>
                <ChevronRight size={18} className="shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
          {filteredFriends.length === 0 && (
            <EmptyState
              icon={<Users size={20} />}
              text={query ? "Nic nie pasuje do wyszukiwania." : "Nie masz jeszcze znajomych."}
            />
          )}
        </ul>
      ) : (
        <ul key={tab} className="pz-fade-in mt-5 space-y-2 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0 xl:grid-cols-3">
          {list.map((p) => {
            const r = ratings?.get(p.id);
            const dist = distanceFor(p);
            return (
              <li key={p.id}>
                <Link
                  to="/k/$id"
                  params={{ id: p.slug ?? p.id }}
                  className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-3 transition hover:border-tomato hover:shadow-sm"
                >
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-muted">
                    {p.cover_image_url && (
                      <img
                        src={p.cover_image_url}
                        alt=""
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-sm font-extrabold">{p.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{p.cuisine}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs font-semibold">
                      {r ? (
                        <>
                          <Star size={12} className="fill-tomato text-tomato" />
                          {r.avg.toFixed(1)} <span className="font-normal text-muted-foreground">({r.count})</span>
                        </>
                      ) : (
                        <span className="font-normal text-muted-foreground">Brak ocen</span>
                      )}
                      {dist !== null && (
                        <span className="font-normal text-muted-foreground">· {formatDistancePl(dist)}</span>
                      )}
                    </p>
                  </div>
                  <ChevronRight size={18} className="shrink-0 text-muted-foreground transition group-hover:translate-x-0.5" />
                </Link>
              </li>
            );
          })}
          {list.length === 0 && (
            <EmptyState
              icon={tab === "fav" ? <Heart size={20} /> : tab === "visited" ? <Check size={20} /> : <Bookmark size={20} />}
              text={query ? "Nic nie pasuje do wyszukiwania." : "Tu jeszcze pusto — dodaj pierwszą knajpę z jej profilu."}
            />
          )}
        </ul>
      )}
    </main>
  );
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <li className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground lg:col-span-full">
      <span className="mb-2 inline-grid h-10 w-10 place-items-center rounded-full bg-muted">{icon}</span>
      <p>{text}</p>
      <Link to="/mapa" className="mt-4 inline-flex rounded-full bg-navy px-5 py-2.5 text-xs font-semibold text-cream">
        Przeglądaj knajpy
      </Link>
    </li>
  );
}
