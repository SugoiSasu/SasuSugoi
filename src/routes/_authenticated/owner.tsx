import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { Store, Loader2, ChevronRight } from "lucide-react";
import { useMyOwnedPlaces } from "@/lib/owners-api";

export const Route = createFileRoute("/_authenticated/owner")({
  head: () => ({ meta: [{ title: "Panel właściciela - poŻeramy" }] }),
  component: OwnerLayout,
});

function OwnerLayout() {
  const { data, isLoading } = useMyOwnedPlaces();

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <div className="mb-6">
        <h1 className="font-display text-3xl text-navy">Panel właściciela</h1>
        <p className="text-sm text-navy/60 mt-1">
          Zarządzaj profilem swojej knajpy, danymi kontaktowymi, godzinami i menu.
        </p>
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="animate-spin text-tomato" size={28} />
        </div>
      ) : !data || data.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-navy/70">
          Nie zarządzasz jeszcze żadną knajpą. Wejdź na profil swojego lokalu i użyj linku
          „Jesteś właścicielem?", żeby wysłać zgłoszenie do weryfikacji.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3 mb-8">
          {data.map(({ id, place }) => place && (
            <Link
              key={id}
              to="/owner/$placeId"
              params={{ placeId: place.id }}
              className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-3 hover:border-tomato transition"
            >
              <div className="w-14 h-14 rounded-xl overflow-hidden bg-muted shrink-0 grid place-items-center">
                {place.cover_image_url ? (
                  <img src={place.cover_image_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Store size={22} className="text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-navy truncate">{place.name}</div>
                <div className="text-xs text-navy/60 truncate">{place.cuisine}</div>
              </div>
              <ChevronRight size={18} className="text-navy/40 group-hover:text-tomato" />
            </Link>
          ))}
        </div>
      )}

      <Outlet />
    </div>
  );
}
