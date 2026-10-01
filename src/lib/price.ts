/**
 * Poziom cen lokalu. W bazie: "$", "$$", "$$$", "$$$$" (1-4). Pokazujemy go
 * zawsze jako "zł", "zł zł", ... (Mateusz 2026-10-01: wczesniej mieszaly sie
 * dolary i zlote). Progi dotycza ceny typowego dania glownego.
 */
export const MAX_POZIOM_CENY = 4;

export const OPISY_POZIOMOW = ["", "Poniżej 25 zł", "25-40 zł", "40-60 zł", "Powyżej 60 zł"] as const;
export const NAZWY_POZIOMOW = ["Bez oceny", "Bardzo tanio", "Tanio", "Średnio", "Drogo"] as const;

/** Poziom z progow cen (danie glowne w zl). */
export function poziomZKwoty(zl: number): number {
  if (zl < 25) return 1;
  if (zl < 40) return 2;
  if (zl < 60) return 3;
  return 4;
}

/**
 * Wartosc z bazy -> poziom 0-4 (0 = brak). Rozumie: "$".."$$$$", dawne "$$$$$"
 * (-> 4) oraz tekst w zlotowkach ("20-50zł" -> srodek przedzialu na skali).
 */
export function poziomCeny(wartosc: string | null | undefined): number {
  const v = (wartosc ?? "").trim();
  if (!v) return 0;
  if (/^\${1,}$/.test(v)) return Math.min(v.length, MAX_POZIOM_CENY);
  const liczby = (v.match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => parseFloat(n.replace(",", ".")));
  if (!liczby.length) return 0;
  const srodek = liczby.reduce((a, b) => a + b, 0) / liczby.length;
  return poziomZKwoty(srodek);
}

/** "zł zł zł" albo "" gdy brak ceny. */
export function formatCena(wartosc: string | null | undefined): string {
  const n = poziomCeny(wartosc);
  return n ? Array(n).fill("zł").join(" ") : "";
}

/** Wartosc do zapisania w bazie dla poziomu 0-4. */
export function wartoscCeny(poziom: number): string {
  return poziom > 0 ? "$".repeat(Math.min(poziom, MAX_POZIOM_CENY)) : "";
}
