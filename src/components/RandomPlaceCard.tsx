import { Link } from "@tanstack/react-router";
import { Dices } from "lucide-react";
import { usePlaces } from "@/lib/places-api";
import { useUserVisitedPlaces } from "@/lib/visits-api";
import { cuisineMeta } from "@/data/places";
import { pickSeeded } from "@/lib/seeded-pick";

/** Sidebar widget: a random place the user hasn't marked as visited yet.
 *  Seeded by user + day so it stays put on repeat visits within the same day. */
export function RandomPlaceCard({ userId }: { userId: string | null | undefined }) {
  const { data: places } = usePlaces();
  const { data: visited } = useUserVisitedPlaces(userId ?? undefined, "visited");

  if (!places || places.length === 0) return null;

  const visitedIds = new Set((visited ?? []).map((p) => p.id));
  const published = places.filter((p) => p.is_published !== false);
  const candidates = published.filter((p) => !visitedIds.has(p.id));
  const pool = candidates.length > 0 ? candidates : published;

  const today = new Date().toISOString().slice(0, 10);
  const pick = pickSeeded(pool, `${userId ?? "anon"}-${today}`);
  if (!pick) return null;

  const meta = cuisineMeta(pick.cuisine);

  return (
    <Link
      to="/k/$id"
      params={{ id: pick.slug ?? pick.id }}
      className="pz-fade-in group block overflow-hidden rounded-2xl border border-cream/15 bg-cream/[0.06] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-cream/25 hover:bg-cream/10 hover:shadow-lg"
    >
      <div className="flex items-center gap-2 px-3 pt-2.5">
        <Dices size={13} className="text-tomato" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-cream/50">
          Losowa polecajka
        </span>
      </div>
      <div className="flex items-center gap-3 px-3 py-2 pb-2.5">
        <div
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-xl transition-transform duration-200 ease-out group-hover:scale-105"
          style={{
            backgroundImage: pick.cover_image_url ? `url(${pick.cover_image_url})` : undefined,
            backgroundColor: pick.cover_image_url ? undefined : `${meta.color}33`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          {!pick.cover_image_url && meta.emoji}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-cream">{pick.name}</p>
          <p className="truncate text-[11px] text-cream/55">{pick.cuisine}</p>
        </div>
      </div>
    </Link>
  );
}
