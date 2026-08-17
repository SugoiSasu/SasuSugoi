import type { Place } from "@/lib/places-api";

/** Lowercase + usuwa polskie diakrytyki, żeby "kawiarnia" łapało "kawiarnię". */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/ł/g, "l")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function tokenize(q: string): string[] {
  const n = normalize(q);
  return n ? n.split(" ").filter(Boolean) : [];
}

/** Cały tekst lokalu, po którym szukamy (nazwa, kuchnia, lokalizacja, opis, menu, promocja). */
export function placeHaystack(p: Place): string {
  const menu = (p.menu_items ?? [])
    .flatMap((c) => [c.category, ...(c.items ?? []).map((i) => `${i.name} ${i.description ?? ""}`)])
    .join(" ");
  return normalize(
    [p.name, p.cuisine, p.district ?? "", p.address ?? "", p.description ?? "", p.promo_label ?? "", menu].join(" "),
  );
}

/** Levenshtein z wczesnym wyjściem — lekka lokalna implementacja. */
export function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost);
      if (row[j] < best) best = row[j];
    }
    if (best > max) return max + 1;
    prev = row;
  }
  return prev[b.length];
}

/** Dokładne dopasowanie: każde słowo zapytania musi wystąpić (w dowolnej kolejności). */
export function matchesExact(haystack: string, tokens: string[]): boolean {
  return tokens.every((t) => haystack.includes(t));
}

/** Fuzzy: dla słów >4 znaków dopuszczamy 1-2 literówki względem słów z haystacka. */
export function matchesFuzzy(haystack: string, tokens: string[]): boolean {
  const words = haystack.split(" ");
  return tokens.every((t) => {
    if (haystack.includes(t)) return true;
    if (t.length <= 4) return false;
    const max = t.length > 7 ? 2 : 1;
    return words.some((w) => Math.abs(w.length - t.length) <= max && editDistance(t, w, max) <= max);
  });
}

/**
 * Filtruje lokale: najpierw dokładnie, a gdy zero wyników — z tolerancją literówek.
 * Zwraca też flagę `fuzzy`, żeby UI mógł to zakomunikować.
 */
export function searchPlaces<T extends Place>(places: T[], query: string): { results: T[]; fuzzy: boolean } {
  const tokens = tokenize(query);
  if (!tokens.length) return { results: places, fuzzy: false };
  const hay = places.map((p) => [p, placeHaystack(p)] as const);
  const exact = hay.filter(([, h]) => matchesExact(h, tokens)).map(([p]) => p);
  if (exact.length) return { results: exact, fuzzy: false };
  const fuzzy = hay.filter(([, h]) => matchesFuzzy(h, tokens)).map(([p]) => p);
  return { results: fuzzy, fuzzy: fuzzy.length > 0 };
}
