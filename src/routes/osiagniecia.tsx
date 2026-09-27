import { displayNameOf } from "@/lib/display-name";
import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Search, Trophy, X } from "lucide-react";
import { useUser } from "@/lib/use-auth";
import { useMyProfile } from "@/lib/profile-api";
import {
  useAchievements,
  useUserAchievements,
  useMyAchievementProgress,
} from "@/lib/achievements-api";
import {
  RARITY_ORDER,
  rarityDostepna,
  rarityOf,
  useAchievementStats,
  type Rarity,
} from "@/lib/achievement-rarity";
import { BEZ_KATEGORII, kategoriaKolor, kategoriaLabel, posortujKategorie } from "@/lib/achievement-categories";
import { useFriendLeaderboard } from "@/lib/friends-api";
import { UserAvatar } from "@/components/UserAvatar";
import { LevelProgressCard } from "@/components/LevelProgress";
import { AuthGate } from "@/components/AuthGate";
import { ChallengesSection } from "@/components/ChallengesSection";
import { CollectionSummary } from "@/components/CollectionSummary";
import { AchievementTile, type TileProgress } from "@/components/AchievementTile";
import { AchievementDetail } from "@/components/AchievementDetail";

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

type Status = "all" | "earned" | "progress" | "locked";
type Uklad = "category" | "near" | "rarity";

const STATUSY: [Status, string][] = [
  ["all", "Wszystkie"],
  ["earned", "Zdobyte"],
  ["progress", "W toku"],
  ["locked", "Do zdobycia"],
];

/** Ile odznak pokazac w kategorii przed "Pokaż wszystkie". */
const LIMIT_W_KATEGORII = 12;

function AchievementsPage() {
  const { user } = useUser();
  const { data: profile } = useMyProfile();
  const { data: all, isLoading: loadingAll } = useAchievements();
  const { data: mine } = useUserAchievements(user?.id);
  const { data: postepy, isLoading: loadingPostepy } = useMyAchievementProgress(user?.id);
  const { data: stats } = useAchievementStats();
  const { data: leaders, isLoading: loadingLeaders } = useFriendLeaderboard();

  const [status, setStatus] = useState<Status>("all");
  const [kategoria, setKategoria] = useState<string>("all");
  const [uklad, setUklad] = useState<Uklad>("category");
  const [query, setQuery] = useState("");
  const [rozwinieta, setRozwinieta] = useState<Record<string, boolean>>({});
  const [wybranaId, setWybranaId] = useState<string | null>(null);

  const points = profile?.points_total ?? 0;
  const zdobyteMapa = useMemo(
    () => new Map((mine ?? []).map((m) => [m.achievement_id, m.unlocked_at])),
    [mine],
  );

  // Postep dociera osobnym zapytaniem i ustawia sie pozniej niz sama lista
  // odznak. Zanim dotrze, kazda niezdobyta odznaka wygladalaby na calkiem
  // zamknieta, po czym doskakiwalaby do swojego paska.
  const statsLoading = loadingPostepy;

  const enabled = useMemo(() => (all ?? []).filter((a) => a.enabled !== false), [all]);
  const pokazRzadkosc = rarityDostepna(stats);

  /** Jedno przejscie po liscie: stan, postep i rzadkosc kazdej odznaki. */
  const wzbogacone = useMemo(() => {
    return enabled.map((a) => {
      const zdobyta = zdobyteMapa.has(a.id);
      const m = postepy?.get(a.id);
      // Pasek rysujemy tylko dla kryteriow mierzalnych i rosnacych.
      // "ranking_position" jest odwrotne (im mniej tym lepiej), wiec pasek
      // "12/10" mowilby, ze jestesmy po celu - lepiej nie pokazac nic.
      const postep: TileProgress | null =
        !zdobyta && m && m.measurable && !m.lower_better && m.value !== null && m.target > 0
          ? {
              current: m.value,
              threshold: m.target,
              pct: Math.min(100, Math.round((m.value / m.target) * 100)),
            }
          : null;
      return {
        a,
        zdobyta,
        zdobytaKiedy: zdobyteMapa.get(a.id) ?? null,
        postep,
        wToku: !!postep && postep.pct > 0,
        rarity: rarityOf(stats?.get(a.id)),
        kat: a.category ?? BEZ_KATEGORII,
      };
    });
  }, [enabled, zdobyteMapa, stats, postepy]);

  const kategorie = useMemo(
    () => posortujKategorie([...new Set(wzbogacone.map((w) => w.kat))]),
    [wzbogacone],
  );

  const widoczne = useMemo(() => {
    const q = query.trim().toLowerCase();
    let lista = wzbogacone.filter((w) => {
      if (kategoria !== "all" && w.kat !== kategoria) return false;
      if (status === "earned" && !w.zdobyta) return false;
      if (status === "progress" && (w.zdobyta || !w.wToku)) return false;
      if (status === "locked" && (w.zdobyta || w.wToku)) return false;
      if (!q) return true;
      return (
        w.a.name.toLowerCase().includes(q) || (w.a.description ?? "").toLowerCase().includes(q)
      );
    });
    if (uklad === "near") {
      // Najblizej zdobycia: najpierw te w toku, im wyzszy procent tym wyzej,
      // potem nietkniete, na koncu juz zdobyte.
      const waga = (w: (typeof wzbogacone)[number]) =>
        w.zdobyta ? -1 : w.wToku ? 1 + (w.postep?.pct ?? 0) / 100 : 0;
      lista = [...lista].sort((x, y) => waga(y) - waga(x));
    }
    if (uklad === "rarity") {
      lista = [...lista].sort(
        (x, y) => indeksRzadkosci(x.rarity) - indeksRzadkosci(y.rarity),
      );
    }
    return lista;
  }, [wzbogacone, kategoria, status, query, uklad]);

  const sekcje = useMemo(() => {
    if (uklad !== "category") {
      return [
        {
          klucz: "flat",
          label: uklad === "near" ? "Najbliżej zdobycia" : "Od najrzadszych",
          kolor: "bg-navy",
          items: widoczne,
          zdobyteWKat: null as number | null,
          lacznieWKat: null as number | null,
        },
      ];
    }
    return kategorie
      .map((k) => {
        const wKategorii = wzbogacone.filter((w) => w.kat === k);
        return {
          klucz: k,
          label: kategoriaLabel(k === BEZ_KATEGORII ? null : k),
          kolor: kategoriaKolor(k === BEZ_KATEGORII ? null : k),
          items: widoczne.filter((w) => w.kat === k),
          zdobyteWKat: wKategorii.filter((w) => w.zdobyta).length,
          lacznieWKat: wKategorii.length,
        };
      })
      .filter((s) => s.items.length > 0);
  }, [uklad, kategorie, widoczne, wzbogacone]);

  const podsumowanie = useMemo(() => {
    const zdobyte = wzbogacone.filter((w) => w.zdobyta).length;
    const wToku = wzbogacone.filter((w) => !w.zdobyta && w.wToku).length;
    if (!pokazRzadkosc) return { zdobyte, wToku, wgRzadkosci: null };
    const wgRzadkosci = {} as Record<Rarity, { zdobyte: number; lacznie: number }>;
    for (const r of RARITY_ORDER) wgRzadkosci[r] = { zdobyte: 0, lacznie: 0 };
    for (const w of wzbogacone) {
      if (!w.rarity) continue;
      wgRzadkosci[w.rarity].lacznie += 1;
      if (w.zdobyta) wgRzadkosci[w.rarity].zdobyte += 1;
    }
    return { zdobyte, wToku, wgRzadkosci };
  }, [wzbogacone, pokazRzadkosc]);

  const wybrana = wybranaId ? wzbogacone.find((w) => w.a.id === wybranaId) : undefined;
  const filtryAktywne = status !== "all" || kategoria !== "all" || query.trim() !== "";
  const podium = (leaders ?? []).slice(0, 3);
  const rest = (leaders ?? []).slice(3);

  if (!user) {
    return (
      <main id="main-content" className="mx-auto max-w-2xl px-4 py-10 sm:py-16">
        <AuthGate
          icon={Trophy}
          title="Zaloguj się, żeby zobaczyć swoje osiągnięcia"
          description="Zdobywaj odznaki poŻeracza, awansuj poziomy i rywalizuj ze znajomymi w Poznaniu."
        />
      </main>
    );
  }

  return (
    <main id="main-content" className="mx-auto max-w-3xl px-4 py-6 sm:py-10 lg:max-w-6xl lg:px-6">
      <h1 className="font-display text-2xl font-extrabold sm:text-3xl">Osiągnięcia 🏅</h1>

      <div className="lg:grid lg:grid-cols-[1.5fr_1fr] lg:items-start lg:gap-8">
        <div>
          <LevelProgressCard
            points={points}
            // Liczymy tylko odznaki nadal wlaczone. `zdobyteMapa` trzyma kazdy
            // wiersz, jaki uzytkownik kiedykolwiek dostal, wiec odznaka
            // wylaczona pozniej w adminie wypychala licznik ponad mianownik
            // ("13 z 12 odznak").
            unlockedCount={podsumowanie.zdobyte}
            totalBadges={enabled.length}
            className="mt-4"
          />

          <div className="mt-4">
            <CollectionSummary
              zdobyte={podsumowanie.zdobyte}
              lacznie={enabled.length}
              wToku={podsumowanie.wToku}
              wgRzadkosci={podsumowanie.wgRzadkosci}
            />
          </div>

          <section className="mt-8">
            <h2 className="font-display text-lg font-extrabold">Kolekcja odznak</h2>

            {/* Chipy kategorii z licznikiem zdobytych - pozwalaja zobaczyc, w
                ktorej kategorii jest najwiecej do nadrobienia, bez wchodzenia
                w kazda po kolei. */}
            <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none sm:mx-0 sm:flex-wrap sm:px-0">
              {[
                { klucz: "all", label: "Wszystkie", kolor: "bg-navy" },
                ...kategorie.map((k) => ({
                  klucz: k,
                  label: kategoriaLabel(k === BEZ_KATEGORII ? null : k),
                  kolor: kategoriaKolor(k === BEZ_KATEGORII ? null : k),
                })),
              ].map((c) => {
                const pula =
                  c.klucz === "all" ? wzbogacone : wzbogacone.filter((w) => w.kat === c.klucz);
                const on = kategoria === c.klucz;
                return (
                  <button
                    key={c.klucz}
                    type="button"
                    onClick={() => setKategoria(c.klucz)}
                    aria-pressed={on}
                    className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-xs font-extrabold transition ${
                      on
                        ? "border-navy bg-navy text-cream"
                        : "border-border bg-card hover:border-tomato"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rotate-45 rounded-[1px] ${on ? "bg-cream" : c.kolor}`}
                      aria-hidden
                    />
                    {c.label}
                    <span className={`text-[11px] font-bold ${on ? "opacity-70" : "text-muted-foreground"}`}>
                      {pula.filter((w) => w.zdobyta).length}/{pula.length}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
              <div className="flex flex-wrap gap-1.5">
                {STATUSY.map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setStatus(key)}
                    aria-pressed={status === key}
                    className={`rounded-full px-3 py-1.5 text-xs font-extrabold transition ${
                      status === key
                        ? "bg-tomato text-cream"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="ml-auto flex items-center gap-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  Układ
                </span>
                {([["category", "Kategorie"], ["near", "Najbliżej"]] as [Uklad, string][])
                  // Sortowanie po rzadkosci ma sens dopiero, gdy rzadkosc w
                  // ogole jest policzalna - inaczej byloby to sortowanie po
                  // pustym polu.
                  .concat(pokazRzadkosc ? ([["rarity", "Rzadkość"]] as [Uklad, string][]) : [])
                  .map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setUklad(key)}
                      aria-pressed={uklad === key}
                      className={`rounded-full px-2.5 py-1.5 text-[11px] font-extrabold transition ${
                        uklad === key
                          ? "bg-navy text-cream"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
              </div>
            </div>

            <div className="relative mt-3">
              <Search
                size={16}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Szukaj odznaki po nazwie…"
                aria-label="Szukaj odznaki"
                className="h-11 w-full rounded-full border border-border bg-card pl-10 pr-10 text-sm outline-none transition focus:border-tomato"
              />
              {!!query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Wyczyść wyszukiwanie"
                  className="absolute right-1 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-muted-foreground transition hover:text-tomato"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {loadingAll || statsLoading ? (
              <ul
                className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5"
                aria-busy="true"
              >
                {Array.from({ length: 10 }).map((_, i) => (
                  <li key={i} className="pz-skel h-[124px] rounded-2xl" />
                ))}
              </ul>
            ) : sekcje.length === 0 ? (
              <div className="mt-5 rounded-2xl border border-dashed border-border p-8 text-center">
                <p className="text-sm text-muted-foreground">Brak odznak dla tych filtrów.</p>
                {filtryAktywne && (
                  <button
                    type="button"
                    onClick={() => {
                      setStatus("all");
                      setKategoria("all");
                      setQuery("");
                    }}
                    className="mt-4 inline-flex rounded-full bg-navy px-5 py-2.5 text-xs font-semibold text-cream"
                  >
                    Wyczyść filtry
                  </button>
                )}
              </div>
            ) : (
              <div key={`${uklad}-${status}-${kategoria}`} className="pz-fade-in mt-5 space-y-7">
                {sekcje.map((s) => {
                  const ograniczona = s.items.length > LIMIT_W_KATEGORII;
                  const rozwin = !ograniczona || rozwinieta[s.klucz];
                  const doPokazania = rozwin ? s.items : s.items.slice(0, LIMIT_W_KATEGORII);
                  return (
                    <section key={s.klucz}>
                      <div className="mb-2.5 flex items-center gap-2.5">
                        <span
                          className={`h-2.5 w-2.5 shrink-0 rotate-45 rounded-[2px] ${s.kolor}`}
                          aria-hidden
                        />
                        <h3 className="font-display text-sm font-extrabold">{s.label}</h3>
                        {s.lacznieWKat != null ? (
                          <>
                            <span className="text-xs font-bold text-muted-foreground">
                              {s.zdobyteWKat} / {s.lacznieWKat}
                            </span>
                            <span
                              className="h-1 min-w-[40px] max-w-[160px] flex-1 overflow-hidden rounded-full bg-muted"
                              aria-hidden
                            >
                              <span
                                className={`block h-full rounded-full ${s.kolor}`}
                                style={{
                                  width: `${Math.round((s.zdobyteWKat! / s.lacznieWKat) * 100)}%`,
                                }}
                              />
                            </span>
                          </>
                        ) : (
                          <span className="text-xs font-bold text-muted-foreground">
                            {s.items.length}
                          </span>
                        )}
                      </div>

                      <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
                        {doPokazania.map((w) => (
                          <li key={w.a.id}>
                            <AchievementTile
                              a={w.a}
                              zdobyta={w.zdobyta}
                              postep={w.postep}
                              rarity={w.rarity}
                              wybrana={w.a.id === wybranaId}
                              onSelect={(id) => setWybranaId((c) => (c === id ? null : id))}
                            />
                          </li>
                        ))}
                      </ul>

                      {ograniczona && (
                        <button
                          type="button"
                          onClick={() =>
                            setRozwinieta((r) => ({ ...r, [s.klucz]: !r[s.klucz] }))
                          }
                          className="mx-auto mt-3 block rounded-full border border-border bg-card px-4 py-2 text-xs font-extrabold transition hover:border-tomato"
                        >
                          {rozwin ? "Zwiń" : `Pokaż wszystkie (${s.items.length})`}
                        </button>
                      )}
                    </section>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <div className="lg:sticky lg:top-4 lg:space-y-4">
          {wybrana && (
            <AchievementDetail
              a={wybrana.a}
              zdobyta={wybrana.zdobyta}
              zdobytaKiedy={formatDataPl(wybrana.zdobytaKiedy)}
              postep={wybrana.postep}
              rarity={wybrana.rarity}
              stat={stats?.get(wybrana.a.id)}
              onClose={() => setWybranaId(null)}
            />
          )}

          <ChallengesSection userId={user.id} />

          <section className="mt-10 lg:mt-0">
            <h2 className="font-display text-lg font-extrabold">Podium znajomych</h2>

            {loadingLeaders ? (
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
            ) : (
              <>
                {podium.length > 0 && (
                  <ol className="mt-4 grid grid-cols-3 items-end gap-2">
                    {[1, 0, 2].map((idx) => {
                      const row = podium[idx];
                      if (!row) return <li key={idx} />;
                      const isMe = row.user_id === user?.id;
                      // Wysokosc stopnia musi siedziec na karcie, nie na <li>:
                      // siatka jest items-end, wiec padding nad linkiem dodawal
                      // tylko martwe miejsce, a wszystkie trzy karty i tak
                      // konczyly sie na tej samej wysokosci - podium bez podium.
                      const step = idx === 0 ? "pt-7 pb-4" : idx === 1 ? "pt-5 pb-3.5" : "pt-3 pb-3";
                      return (
                        <li key={row.user_id}>
                          <Link
                            to="/u/$username"
                            params={{ username: row.username ?? row.user_id }}
                            className={`flex flex-col items-center gap-1.5 rounded-2xl border px-3 text-center transition ${step} ${
                              isMe ? "border-accent bg-accent/15" : "border-border bg-card hover:border-accent"
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
                            <p className="w-full truncate text-xs font-semibold">
                              {isMe ? "Ty" : displayNameOf(row)}
                            </p>
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
                            isMe ? "border-accent bg-accent/15" : "border-border bg-card hover:border-accent"
                          }`}
                        >
                          <span className="w-5 shrink-0 text-center text-sm font-extrabold text-muted-foreground">
                            {i + 4}
                          </span>
                          <UserAvatar
                            avatarUrl={row.avatar_url}
                            displayName={row.display_name}
                            username={row.username}
                            size={40}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">
                              {isMe ? "Ty" : displayNameOf(row)}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {row.points_total} pkt • {row.achievements_count} odznak
                            </p>
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                  {(leaders ?? []).length === 0 && (
                    <li className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                      Dodaj znajomych, żeby zobaczyć ranking.
                      <Link to="/friends" className="mt-4 block min-h-11">
                        <span className="inline-flex rounded-full bg-navy px-5 py-2.5 text-xs font-semibold text-cream">
                          Znajdź znajomych
                        </span>
                      </Link>
                    </li>
                  )}
                </ul>
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function indeksRzadkosci(r: Rarity | null): number {
  if (!r) return RARITY_ORDER.length;
  return RARITY_ORDER.indexOf(r);
}

function formatDataPl(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" });
}
