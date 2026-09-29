/**
 * Trofea lokali. Czyste funkcje (bez importow), zeby dalo sie je testowac i
 * uzywac po stronie serwera (AI) tak samo jak w przegladarce.
 */
export const RODZAJE_TROFEUM = [
  "michelin_star",
  "michelin_bib",
  "michelin_recommended",
  "warte_pozarcia",
] as const;
export type RodzajTrofeum = (typeof RODZAJE_TROFEUM)[number];

export interface Trofeum {
  place_id: string;
  kind: RodzajTrofeum;
  /** Liczba gwiazdek (1-3), tylko dla michelin_star. */
  tier: number | null;
  year: number;
  /** Kategoria / dopisek, np. "Kebaby" dla Warte poZarcia. */
  label: string | null;
  source_url: string | null;
  /** "glosowanie" = wygrana w naszym glosowaniu (nie edytowalna z listy trofeow). */
  origin?: string;
}

/** Trofeum jak w tabeli (do edycji w adminie). */
export interface TrofeumWiersz extends Omit<Trofeum, "origin"> {
  id: string;
  status: "zatwierdzone" | "propozycja";
  proposed_by_ai: boolean;
}

export const OPIS_RODZAJU: Record<RodzajTrofeum, string> = {
  michelin_star: "Gwiazdka Michelin",
  michelin_bib: "Bib Gourmand Michelin",
  michelin_recommended: "Wyróżnienie Michelin",
  warte_pozarcia: "Warte poŻarcia",
};

export function nazwaTrofeum(t: Pick<Trofeum, "kind" | "tier">): string {
  if (t.kind === "michelin_star") {
    if (t.tier === 2) return "2 gwiazdki Michelin";
    if (t.tier === 3) return "3 gwiazdki Michelin";
    return "Gwiazdka Michelin";
  }
  return OPIS_RODZAJU[t.kind];
}

/** Krotki opis do pigulki: "Gwiazdka Michelin 2024", "Warte poŻarcia · Kebaby 2026". */
export function podpisTrofeum(t: Pick<Trofeum, "kind" | "tier" | "year" | "label">): string {
  const nazwa = nazwaTrofeum(t);
  const rok = String(t.year);
  if (t.kind === "warte_pozarcia" && t.label) return `${nazwa} · ${t.label} ${rok}`;
  return `${nazwa} ${rok}`;
}

/** Waga do sortowania: gwiazdki (wyzsze pierwsze), potem nasze, potem Bib, potem wyroznienie. */
function waga(t: Pick<Trofeum, "kind" | "tier" | "year">): number {
  const baza =
    t.kind === "michelin_star" ? 400 + (t.tier ?? 1) * 10
    : t.kind === "warte_pozarcia" ? 300
    : t.kind === "michelin_bib" ? 200
    : 100;
  return baza * 10000 + t.year;
}

export function posortujTrofea<T extends Pick<Trofeum, "kind" | "tier" | "year">>(lista: T[]): T[] {
  return lista.slice().sort((a, b) => waga(b) - waga(a));
}

/** Najwyzsze trofeum lokalu (do pojedynczej ikonki na kafelku), albo null. */
export function najwyzszeTrofeum<T extends Pick<Trofeum, "kind" | "tier" | "year">>(lista: T[]): T | null {
  return posortujTrofea(lista)[0] ?? null;
}

/** placeId -> trofea, posortowane. */
export function poLokalach(lista: Trofeum[]): Map<string, Trofeum[]> {
  const m = new Map<string, Trofeum[]>();
  for (const t of lista) {
    const a = m.get(t.place_id) ?? [];
    a.push(t);
    m.set(t.place_id, a);
  }
  for (const [k, v] of m) m.set(k, posortujTrofea(v));
  return m;
}

export function czyRodzaj(x: unknown): x is RodzajTrofeum {
  return typeof x === "string" && (RODZAJE_TROFEUM as readonly string[]).includes(x);
}

/**
 * Sprawdza propozycje trofeum z AI, zanim trafi do bazy: znany rodzaj, sensowny
 * rok (nie z przyszlosci), gwiazdki 1-3, zrodlo to publiczny adres http(s).
 * Zwraca znormalizowany wpis albo null.
 */
export function normalizujPropozycje(
  p: { rodzaj?: unknown; poziom?: unknown; rok?: unknown; opis?: unknown; zrodlo?: unknown },
  rokTeraz: number,
): { kind: RodzajTrofeum; tier: number | null; year: number; label: string | null; source_url: string } | null {
  if (!czyRodzaj(p.rodzaj)) return null;
  const year = Number(p.rok);
  if (!Number.isInteger(year) || year < 1950 || year > rokTeraz + 1) return null;
  let tier: number | null = null;
  if (p.rodzaj === "michelin_star") {
    tier = Number(p.poziom);
    if (!Number.isInteger(tier) || tier < 1 || tier > 3) return null;
  }
  const zrodlo = typeof p.zrodlo === "string" ? p.zrodlo.trim() : "";
  if (!/^https?:\/\/[^\s]+$/i.test(zrodlo) || zrodlo.length > 500) return null;
  const opis = typeof p.opis === "string" ? p.opis.trim().slice(0, 120) : "";
  return { kind: p.rodzaj, tier, year, label: opis || null, source_url: zrodlo };
}
