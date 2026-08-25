import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { History, X } from "lucide-react";
import { usePlaces } from "@/lib/places-api";
import { cuisineMeta } from "@/data/places";
import { useRecentlyViewed, clearRecentlyViewed } from "@/lib/recently-viewed";

/**
 * "Take me back to the one I was looking at."
 *
 * Deliberately a strip of small pills rather than another row of the big
 * place cards: this is a utility for returning visitors, not a discovery
 * surface, and it sits directly above "Polecane dla Ciebie". Given the same
 * visual weight it would compete with the recommendations it is supposed to
 * sit quietly above.
 *
 * Renders nothing until you have actually looked at something, so a first
 * visit never sees an empty box explaining a feature that hasn't happened.
 */
export function RecentlyViewedStrip() {
  const ids = useRecentlyViewed();
  const { data: places } = usePlaces();

  const items = useMemo(() => {
    if (ids.length === 0 || !places) return [];
    const byId = new Map(places.map((p) => [p.id, p]));
    // Order follows the stored ids (most recent first), not the places
    // array. Ids for places since unpublished or deleted just drop out.
    return ids
      .map((id) => byId.get(id))
      .filter((p): p is NonNullable<typeof p> => !!p && p.is_published !== false);
  }, [ids, places]);

  if (items.length === 0) return null;

  return (
    <section className="pz-fade-in pt-5">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="inline-flex items-center gap-2 font-display text-xl">
          <span className="chip bg-navy text-cream">
            <History size={12} />
          </span>
          Ostatnio oglądane
        </h2>
        <button
          type="button"
          onClick={clearRecentlyViewed}
          className="pz-hit inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground transition hover:text-tomato"
        >
          <X size={12} /> Wyczyść
        </button>
      </div>

      <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 scrollbar-none sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        {items.map((p) => {
          const meta = cuisineMeta(p.cuisine);
          const cover = p.avatar_url ?? p.cover_image_url;
          return (
            <li key={p.id} className="shrink-0">
              <Link
                to="/k/$id"
                params={{ id: p.slug ?? p.id }}
                className="flex items-center gap-2.5 rounded-full border border-border bg-card py-1.5 pl-1.5 pr-4 transition hover:border-tomato active:scale-95"
              >
                <span
                  className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full text-base"
                  style={
                    cover
                      ? {
                          backgroundImage: `url(${cover})`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                        }
                      : { backgroundColor: meta.color }
                  }
                >
                  {!cover && meta.emoji}
                </span>
                <span className="max-w-40 truncate text-sm font-semibold">{p.name}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
