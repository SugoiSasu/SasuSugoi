import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Dices, RefreshCw } from "lucide-react";
import { usePlaces } from "@/lib/places-api";
import { useUserVisitedPlaces } from "@/lib/visits-api";
import { cuisineMeta } from "@/data/places";
import { seededIndex } from "@/lib/seeded-pick";

/**
 * "Which one should I go to?" - the question a food app exists to answer and
 * the hardest one to answer yourself.
 *
 * The pick is seeded by user + day so it stays put across reloads instead of
 * flickering to something else on every render, but the whole point is that
 * you can reject it: "Losuj ponownie" walks to a different one, and never
 * hands you back the place you just rejected.
 *
 * Two shapes: `sidebar` is the compact desktop widget, `panel` is the fuller
 * card the homepage shows below lg, where the sidebar does not exist at all.
 * In both it is solid tomato - it is the one warm block in an otherwise navy
 * column, and the one piece of the homepage that asks you to act.
 */
export function RandomPlaceCard({
  userId,
  variant = "sidebar",
}: {
  userId: string | null | undefined;
  variant?: "sidebar" | "panel";
}) {
  const { data: places } = usePlaces();
  const { data: visited } = useUserVisitedPlaces(userId ?? undefined, "visited");
  const [rerolls, setRerolls] = useState(0);

  // The seed contains today's date, which differs between a UTC server and a
  // visitor in Europe/Warsaw for two hours every night. Pick only after mount
  // so SSR and hydration can never disagree about which place this is.
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => setToday(new Date().toISOString().slice(0, 10)), []);

  const pool = useMemo(() => {
    const published = (places ?? []).filter((p) => p.is_published !== false);
    const visitedIds = new Set((visited ?? []).map((p) => p.id));
    const unvisited = published.filter((p) => !visitedIds.has(p.id));
    // Once you've been everywhere, suggest from everywhere rather than
    // showing nothing.
    return unvisited.length > 0 ? unvisited : published;
  }, [places, visited]);

  const pick = useMemo(() => {
    if (!today || pool.length === 0) return null;
    const base = `${userId ?? "anon"}-${today}`;
    let idx = seededIndex(`${base}:${rerolls}`, pool.length);
    // Two different seeds can hash to the same slot; rerolling into the place
    // you just rejected feels like a broken button, so step off it.
    if (rerolls > 0 && pool.length > 1) {
      const prev = seededIndex(`${base}:${rerolls - 1}`, pool.length);
      if (idx === prev) idx = (idx + 1) % pool.length;
    }
    return pool[idx];
  }, [pool, userId, today, rerolls]);

  if (!pick) return null;

  const meta = cuisineMeta(pick.cuisine);
  const cover = pick.avatar_url ?? pick.cover_image_url;

  function reroll(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setRerolls((n) => n + 1);
  }

  if (variant === "panel") {
    return (
      <section className="pz-fade-in overflow-hidden rounded-3xl bg-tomato text-cream">
        <div className="flex items-center gap-2 px-5 pt-4">
          <Dices size={14} />
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-cream">
            Losowa polecajka
          </h2>
        </div>
        <Link
          to="/k/$id"
          params={{ id: pick.slug ?? pick.id }}
          className="flex items-center gap-4 px-5 py-3"
        >
          <span
            className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-cream/15 text-2xl"
            style={
              cover
                ? {
                    backgroundImage: `url(${cover})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }
                : undefined
            }
          >
            {!cover && meta.emoji}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-display text-xl leading-tight">{pick.name}</span>
            <span className="block truncate text-sm text-cream">
              {pick.cuisine}
              {pick.district ? ` · ${pick.district}` : ""}
            </span>
          </span>
        </Link>
        <div className="px-5 pb-4">
          <button
            type="button"
            onClick={reroll}
            className="inline-flex items-center gap-2 rounded-full bg-cream/20 px-4 py-2 text-xs font-bold transition hover:bg-cream/30 active:scale-95"
          >
            <RefreshCw size={13} /> Losuj ponownie
          </button>
        </div>
      </section>
    );
  }

  return (
    <div className="pz-fade-in overflow-hidden rounded-2xl bg-tomato text-cream">
      <div className="flex items-center justify-between gap-2 px-3 pt-2.5">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-cream">
          <Dices size={12} /> Losowa polecajka
        </span>
        <button
          type="button"
          onClick={reroll}
          aria-label="Losuj ponownie"
          title="Losuj ponownie"
          className="pz-hit grid h-6 w-6 place-items-center rounded-full text-cream transition hover:bg-cream/20 hover:text-cream active:scale-90"
        >
          <RefreshCw size={12} />
        </button>
      </div>
      <Link
        to="/k/$id"
        params={{ id: pick.slug ?? pick.id }}
        className="group flex items-center gap-3 px-3 py-2 pb-2.5"
      >
        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-cream/15 text-xl transition-transform duration-200 ease-out group-hover:scale-105"
          style={
            cover
              ? {
                  backgroundImage: `url(${cover})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : undefined
          }
        >
          {!cover && meta.emoji}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{pick.name}</span>
          <span className="block truncate text-[11px] font-medium text-cream">{pick.cuisine}</span>
        </span>
      </Link>
    </div>
  );
}
