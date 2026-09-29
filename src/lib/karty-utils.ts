import { haversineKm, type LatLng } from "@/lib/geo";
import type { Place } from "@/lib/places-api";

/** Promienie filtra "Obszar od Ciebie" w km; 0 = całe miasto. */
export const PROMIENIE_KM = [1, 2, 3, 5, 0] as const;
export type PromienKm = (typeof PROMIENIE_KM)[number];

export function etykietaPromienia(km: PromienKm): string {
  return km === 0 ? "Całe miasto" : `${km} km`;
}

/** Odległość do najbliższego adresu lokalu (lokal może mieć kilka lokalizacji). */
export function odlegloscKm(place: Pick<Place, "lat" | "lng" | "locations">, loc: LatLng): number {
  const punkty: LatLng[] = [{ lat: place.lat, lng: place.lng }];
  for (const l of place.locations ?? []) punkty.push({ lat: l.lat, lng: l.lng });
  return Math.min(...punkty.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng)).map((p) => haversineKm(loc, p)));
}

/** Pierwsza pozycja z menu - jedyne, co o daniach naprawdę wiemy. */
export function pierwszaPozycjaMenu(place: Pick<Place, "menu_items">): string | null {
  for (const kat of place.menu_items ?? []) {
    const poz = kat.items?.find((i) => i.name?.trim());
    if (poz) return poz.name.trim();
  }
  return null;
}

/** Krótkie cechy lokalu z pól, które są w bazie. */
export function cechyLokalu(
  place: Pick<Place, "has_takeaway" | "wheelchair_accessible" | "district">,
): string[] {
  const t: string[] = [];
  if (place.has_takeaway) t.push("Na wynos");
  if (place.wheelchair_accessible) t.push("Dostępne dla wózków");
  if (place.district) t.push(place.district);
  return t;
}

/** "Ola chce tu iść" / "Ola i Zuza chcą tu iść" / "Ola i 2 znajomych chcą tu iść". */
export function liniaZnajomych(imiona: string[]): string {
  if (imiona.length === 0) return "";
  if (imiona.length === 1) return `${imiona[0]} chce tu iść`;
  if (imiona.length === 2) return `${imiona[0]} i ${imiona[1]} chcą tu iść`;
  return `${imiona[0]} i ${imiona.length - 1} znajomych chcą tu iść`;
}
