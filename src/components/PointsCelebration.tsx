import { useEffect, useRef, useState } from "react";
import { useMyProfile } from "@/lib/profile-api";
import { levelInfo } from "@/components/LevelProgress";

interface Burst {
  id: number;
  amount: number;
  levelUp: number | null;
}

/**
 * Pokazuje na zywo, ze punkty PoZarcia wlasnie wpadly.
 *
 * Dotad nic tego nie sygnalizowalo: licznik XP w panelu bocznym po prostu
 * zmienial sie po cichu, a na telefonie panelu w ogole nie widac. Uzytkownik
 * dodawal recenzje i nie mial zadnego potwierdzenia, ze cokolwiek dostal.
 *
 * Komponent nie wie, SKAD punkty przyszly - obserwuje points_total w profilu,
 * wiec dziala tak samo dla recenzji, wyzwan, zaproszen i wpisow na Pozeralni.
 */
export function PointsCelebration() {
  const { data: profile } = useMyProfile();
  const points = profile?.points_total ?? null;

  const prevRef = useRef<number | null>(null);
  const [burst, setBurst] = useState<Burst | null>(null);

  useEffect(() => {
    if (points == null) return;

    // Pierwszy odczyt po wejsciu na strone albo po zalogowaniu nie jest
    // zdobyciem punktow - bez tego kazde odswiezenie strony wywalaloby
    // "+150 pkt" tylko dlatego, ze wczesniej nie bylo czego porownac.
    if (prevRef.current === null) {
      prevRef.current = points;
      return;
    }

    const diff = points - prevRef.current;
    const before = prevRef.current;
    prevRef.current = points;
    if (diff <= 0) return;

    const levelBefore = levelInfo(before).level;
    const levelAfter = levelInfo(points).level;
    setBurst({
      id: Date.now(),
      amount: diff,
      levelUp: levelAfter > levelBefore ? levelAfter : null,
    });
  }, [points]);

  useEffect(() => {
    if (!burst) return;
    const t = setTimeout(() => setBurst(null), burst.levelUp ? 3600 : 2400);
    return () => clearTimeout(t);
  }, [burst]);

  return (
    // aria-live, a nie role="alert": to informacja radosna, nie pilna - ma
    // zostac przeczytana, gdy czytnik skonczy biezace zdanie.
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 z-[60] flex justify-center"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 6.5rem)" }}
    >
      {burst && (
        <div key={burst.id} className="pz-points-burst flex flex-col items-center gap-2">
          {burst.levelUp && (
            <span className="rounded-full bg-mustard px-4 py-1.5 text-sm font-extrabold text-navy shadow-lg">
              🎉 Poziom {burst.levelUp}!
            </span>
          )}
          <span className="rounded-full bg-tomato px-5 py-2.5 text-base font-extrabold text-cream shadow-[0_10px_30px_-8px_rgba(0,0,0,0.6)]">
            +{burst.amount} pkt PoŻarcia
          </span>
        </div>
      )}
    </div>
  );
}
