import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Search, SlidersHorizontal, Star, X } from "lucide-react";
import { useCuisines } from "@/lib/cuisines-api";
import { useMyProfile } from "@/lib/profile-api";
import { cuisineMeta } from "@/data/places";
import { pluralPl } from "@/lib/plural-pl";
import { NotificationBell } from "@/components/NotificationBell";
import { QuickFilters, type QuickFilter } from "@/components/QuickFilters";

interface DiscoverHeaderProps {
  query: string;
  onQueryChange: (value: string) => void;
  cuisine: string | null;
  onCuisineChange: (value: string | null) => void;
  quick: QuickFilter;
  onQuickChange: (value: QuickFilter) => void;
  quickAvailable: Set<QuickFilter>;
  quickCounts: Partial<Record<QuickFilter, number>>;
  /** Ile opublikowanych lokali jest w bazie - do podtytulu pod naglowkiem. */
  placesCount?: number;
  /** Ile z nich doszlo w ostatnich 30 dniach. */
  newPlacesCount?: number;
}

/**
 * "Odkrywaj" header - greeting, live search input and cuisine categories.
 * Search + category state is owned by the page so the lists below can filter.
 */
const WIDOCZNYCH_KATEGORII = 7;

export function DiscoverHeader({
  query,
  onQueryChange,
  cuisine,
  onCuisineChange,
  quick,
  onQuickChange,
  quickAvailable,
  quickCounts,
  placesCount,
  newPlacesCount,
}: DiscoverHeaderProps) {
  const [wszystkieKategorie, setWszystkieKategorie] = useState(false);
  const { data: profile } = useMyProfile();
  const { data: cuisines } = useCuisines();
  const name = profile?.display_name?.split(" ")[0] ?? profile?.username;
  const list = (cuisines ?? []).filter((c) => c.enabled !== false);

  return (
    <section className="bg-background px-4 pb-9 pt-6 sm:px-6 sm:pb-10 lg:pt-8">
      <div className="mx-auto w-full max-w-5xl lg:max-w-7xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {name ? `Cześć, ${name}` : "Cześć, poŻeraczu"}
            </p>
            <h1 className="font-display text-3xl leading-tight sm:text-4xl">Co dziś pożeramy? 😋</h1>
            {!!placesCount && (
              <p className="mt-1 text-sm text-muted-foreground">
                {placesCount} {pluralPl(placesCount, "lokal", "lokale", "lokali")} w okolicy
                {/* "· 0 nowych" brzmi jak zarzut, wiec doklejamy to tylko,
                    gdy faktycznie cos doszlo. */}
                {!!newPlacesCount && <> · {newPlacesCount} {pluralPl(newPlacesCount, "nowy", "nowe", "nowych")}</>}
              </p>
            )}
          </div>
          <div className="shrink-0 pt-1">
            <NotificationBell />
          </div>
        </div>

        <div className="mt-5 flex items-center gap-2">
          <div className="relative flex-1">
            <Search
              size={16}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Szukaj lokalu, kuchni…"
              aria-label="Szukaj knajpy lub kuchni"
              className="h-12 w-full rounded-full border border-border bg-card pl-11 pr-10 text-sm outline-none transition focus:border-tomato"
            />
            {!!query && (
              <button
                type="button"
                onClick={() => onQueryChange("")}
                aria-label="Wyczyść wyszukiwanie"
                className="absolute right-1 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full text-muted-foreground transition hover:text-tomato"
              >
                <X size={16} />
              </button>
            )}
          </div>
          <Link
            to="/mapa"
            aria-label="Więcej filtrów na mapie"
            title="Więcej filtrów na mapie"
            className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-border bg-card text-foreground transition hover:border-tomato active:scale-95"
          >
            <SlidersHorizontal size={18} />
          </Link>
        </div>

        <QuickFilters
          value={quick}
          onChange={onQuickChange}
          available={quickAvailable}
          counts={quickCounts}
        />

        {!!list.length && (
          <div className="mt-8">
            <div className="mb-4 flex items-baseline justify-between gap-3">
              <h2 className="font-display text-lg">Kategorie</h2>
              {list.length > WIDOCZNYCH_KATEGORII && (
                <button
                  type="button"
                  onClick={() => setWszystkieKategorie((v) => !v)}
                  className="pz-hit inline-flex items-center text-xs font-semibold text-tomato hover:underline"
                >
                  {wszystkieKategorie ? "Pokaż mniej" : "Zobacz wszystkie"}
                </button>
              )}
            </div>

            <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-none [mask-image:linear-gradient(to_right,black_calc(100%-28px),transparent)] sm:mx-0 sm:grid sm:grid-cols-5 sm:gap-3 sm:overflow-visible sm:px-0 sm:[mask-image:none] lg:grid-cols-10 xl:grid-cols-12">
              <button
                type="button"
                onClick={() => onCuisineChange(null)}
                aria-pressed={!cuisine}
                className="flex w-16 shrink-0 flex-col items-center gap-1.5 text-[11px] font-semibold sm:w-auto"
              >
                <span
                  className={`pz-hex grid h-14 w-14 transform-gpu place-items-center p-[3px] transition-all duration-200 ease-out hover:-translate-y-1 hover:scale-105 active:scale-95 active:duration-75 ${
                    cuisine ? "bg-transparent" : "bg-tomato"
                  }`}
                >
                  <span className="pz-hex grid h-full w-full place-items-center bg-navy">
                    <Star size={20} className="text-tomato-on-dark" fill="currentColor" />
                  </span>
                </span>
                <span className="text-center leading-tight text-muted-foreground">Wszystko</span>
              </button>

              {(wszystkieKategorie
                ? list
                : (() => {
                    const widoczne = list.slice(0, WIDOCZNYCH_KATEGORII);
                    // Wybrana kuchnia musi byc widoczna, nawet gdy siedzi poza
                    // pierwsza osemka - inaczej filtr dziala, a nic tego nie pokazuje.
                    const wybrana = list.find((c) => c.name === cuisine);
                    return wybrana && !widoczne.includes(wybrana)
                      ? [...widoczne.slice(0, WIDOCZNYCH_KATEGORII - 1), wybrana]
                      : widoczne;
                  })()
              ).map((c) => {
                const active = cuisine === c.name;
                const meta = cuisineMeta(c.name);
                const color = c.color ?? meta.color;
                const emoji = c.emoji ?? meta.emoji;
                const bg = meta.chipBackground;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onCuisineChange(active ? null : c.name)}
                    aria-pressed={active}
                    className="flex w-16 shrink-0 flex-col items-center gap-1.5 text-[11px] font-semibold sm:w-auto"
                  >
                    <span
                      className={`pz-hex grid h-14 w-14 transform-gpu place-items-center p-[3px] transition-all duration-200 ease-out hover:-translate-y-1 hover:scale-105 active:scale-95 active:duration-75 ${
                        active ? "bg-navy" : "bg-transparent"
                      }`}
                      aria-hidden
                    >
                      <span
                        className="pz-hex relative grid h-full w-full place-items-center overflow-hidden text-2xl"
                        style={
                          bg
                            ? {
                                backgroundImage: `url(${bg})`,
                                backgroundSize: "cover",
                                backgroundPosition: "center",
                              }
                            : { backgroundColor: color }
                        }
                      >
                        {bg && <span className="absolute inset-0 bg-navy/35" />}
                        <span className="relative drop-shadow-[0_1px_3px_rgba(0,0,0,0.4)]">
                          {emoji}
                        </span>
                      </span>
                    </span>
                    <span className="line-clamp-2 text-center leading-tight text-muted-foreground">
                      {c.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
