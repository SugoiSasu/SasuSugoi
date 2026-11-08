import { MAX_POZIOM_CENY, NAZWY_POZIOMOW, OPISY_POZIOMOW, poziomCeny } from "@/lib/price";

/**
 * Poziom cen jako skala: aktywne "zł" wyraźne, reszta wyblakła (np. "zł zł" z dwóch możliwych
 * czterech). Czytnik ekranu dostaje opis słowny zamiast powtórzonych "zł zł zł".
 */
export function PriceLevel({ value, className = "" }: { value: string | null | undefined; className?: string }) {
  const n = poziomCeny(value);
  if (!n) return null;
  return (
    <span
      className={`inline-flex items-center gap-0.5 font-semibold tabular-nums ${className}`}
      role="img"
      aria-label={`Ceny: ${NAZWY_POZIOMOW[n].toLowerCase()} (${OPISY_POZIOMOW[n]})`}
      title={OPISY_POZIOMOW[n]}
    >
      {Array.from({ length: MAX_POZIOM_CENY }, (_, i) => (
        <span key={i} aria-hidden="true" className={i < n ? "text-foreground" : "text-foreground/20"}>
          zł
        </span>
      ))}
    </span>
  );
}
