/**
 * Polish plurals take three forms, not two.
 *
 *   1              -> odznakę   (singular, here in the accusative)
 *   2, 3, 4        -> odznaki   ("few")
 *   0, 5..21, ...  -> odznak    ("many")
 *
 * The trap is the teens: 12, 13 and 14 end in 2-4 but take the "many" form,
 * and so do 112-114. Anything that just checks `n > 1` produces "5 odznaki",
 * which reads as plainly broken to a Polish speaker.
 */
export function pluralPl(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  const last = n % 10;
  const lastTwo = n % 100;
  if (last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14)) return few;
  return many;
}

/** "odznakę" / "3 odznaki" / "5 odznak" - the count is included for n > 1. */
export function badgesLabel(n: number): string {
  return n === 1 ? "odznakę" : `${n} ${pluralPl(n, "odznaka", "odznaki", "odznak")}`;
}
