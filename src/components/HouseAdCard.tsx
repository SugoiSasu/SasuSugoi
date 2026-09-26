import { Link } from "@tanstack/react-router";
import { Megaphone } from "lucide-react";
import { trackEvent } from "@/lib/analytics";

/**
 * Wypelniacz slotu reklamowego, gdy nie leci zadna platna kampania.
 *
 * Dotad SidebarAdCard zwracal w takiej sytuacji null i w panelu bocznym
 * zostawala martwa przestrzen. Zamiast niej - wlasna zajawka prowadzaca do
 * formularza wspolpracy.
 *
 * Celowo NIE podszywa sie pod platna reklame: ma przerywana ramke zamiast
 * pelnej i etykiete "Wolne miejsce" zamiast "Reklama". Inaczej mieszalaby sie
 * z prawdziwymi kampaniami - takze w statystykach, bo nie ma wiersza w `ads`
 * i nie zlicza odslon ani klikniec jako reklamowych.
 */
export function HouseAdCard() {
  return (
    <Link
      to="/wspolpraca"
      onClick={() => trackEvent("house_ad_click", { slot: "sidebar" })}
      className="pz-fade-in group block overflow-hidden rounded-2xl border-2 border-dashed border-tomato/55 bg-cream/[0.04] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-tomato hover:bg-cream/[0.08] hover:shadow-lg"
    >
      <div className="flex items-center justify-center gap-2 px-3 pt-2.5">
        <Megaphone size={13} className="text-tomato-on-dark" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-cream/50">
          Wolne miejsce
        </span>
      </div>
      <div className="flex flex-col items-center gap-1.5 px-3 py-2.5 text-center">
        <p className="text-sm font-semibold leading-snug text-cream">
          Tu może być Twoja reklama
        </p>
        <p className="text-[11px] leading-snug text-cream/60">
          Dotrzyj do głodnych poznaniaków
        </p>
      </div>
      <div className="flex justify-center px-3 pb-3">
        <span className="inline-flex items-center rounded-full bg-tomato px-3 py-1.5 text-[11px] font-semibold text-cream transition-colors group-hover:bg-tomato/90">
          Napisz do nas
        </span>
      </div>
    </Link>
  );
}
