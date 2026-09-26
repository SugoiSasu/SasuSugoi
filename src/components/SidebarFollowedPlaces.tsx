import { Link } from "@tanstack/react-router";
import { usePlaces } from "@/lib/places-api";
import { useMyFollowedPlaceIds } from "@/lib/follows-api";
import { cuisineMeta } from "@/data/places";

const MAKS_WIDOCZNYCH = 4;

/**
 * "Obserwowane lokale" z paczki designu Pozeralni - skrot do knajp, ktore
 * uzytkownik obserwuje.
 *
 * Panel boczny mial dotad tylko liczniki, losowa polecajke i slot reklamowy;
 * lista obserwowanych byla dostepna wylacznie przez Moje miejsca. Widzet
 * chowa sie calkowicie, gdy nie ma czego pokazac - pusta ramka w i tak
 * gestym panelu bylaby gorsza niz jej brak.
 */
export function SidebarFollowedPlaces() {
  const { data: followedIds } = useMyFollowedPlaceIds();
  const { data: places } = usePlaces();

  if (!followedIds?.length || !places?.length) return null;

  const byId = new Map(places.map((p) => [p.id, p]));
  const obserwowane = followedIds
    .map((id) => byId.get(id))
    .filter((p): p is NonNullable<typeof p> => !!p);

  if (obserwowane.length === 0) return null;

  const widoczne = obserwowane.slice(0, MAKS_WIDOCZNYCH);

  return (
    <section className="pz-fade-in rounded-2xl border border-cream/15 bg-cream/[0.06] p-3">
      <h2 className="mb-2.5 px-1 text-[9px] font-extrabold uppercase tracking-[0.09em] text-cream/45">
        Obserwowane lokale
      </h2>
      <ul className="flex flex-col gap-1">
        {widoczne.map((p) => {
          const meta = cuisineMeta(p.cuisine ?? "");
          return (
            <li key={p.id}>
              <Link
                to="/k/$id"
                params={{ id: p.slug ?? p.id }}
                className="flex items-center gap-2.5 rounded-xl px-1 py-1.5 transition hover:bg-cream/10"
              >
                <span
                  className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-lg text-sm"
                  style={
                    p.avatar_url
                      ? {
                          backgroundImage: `url(${p.avatar_url})`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                        }
                      : { backgroundColor: meta.color }
                  }
                  aria-hidden="true"
                >
                  {!p.avatar_url && meta.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-semibold text-cream/90">
                    {p.name}
                  </span>
                  <span className="block truncate text-[10.5px] text-cream/45">
                    {p.cuisine ?? ""}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      {obserwowane.length > widoczne.length && (
        <Link
          to="/moje-miejsca"
          className="mt-1.5 block px-1 text-[10.5px] font-bold text-tomato-on-dark hover:underline"
        >
          i {obserwowane.length - widoczne.length} więcej
        </Link>
      )}
    </section>
  );
}
