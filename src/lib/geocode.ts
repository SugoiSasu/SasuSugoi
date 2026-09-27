/**
 * Adres -> wspolrzedne, przez Nominatim (OpenStreetMap - z tych samych danych
 * jest mapa w apce, wiec punkt trafia tam, gdzie ulica na mapie).
 *
 * Powstalo po tym, jak 36 lokali stalo w jednej pinezce na Starym Rynku:
 * formularz lokalu wpisywal domyslny punkt, a jedyna droga do prawdziwego
 * polozenia bylo reczne przepisanie liczb z Google Maps. Nikt tego nie robil.
 *
 * Polityka Nominatim: najwyzej 1 zapytanie na sekunde - tu kazde zapytanie
 * wychodzi z klikniecia admina, wiec jest z duzym zapasem.
 */

/** Punkt wpisywany domyslnie w formularzu nowego lokalu (centrum Poznania). */
export const DOMYSLNY_PUNKT = { lat: 52.4082, lng: 16.9335 } as const;

export function czyDomyslnyPunkt(lat: number | null | undefined, lng: number | null | undefined): boolean {
  if (lat == null || lng == null) return false;
  return lat.toFixed(4) === DOMYSLNY_PUNKT.lat.toFixed(4) && lng.toFixed(4) === DOMYSLNY_PUNKT.lng.toFixed(4);
}

/** Obszar Poznania z okolicami - wynik spoza niego to pomylka, nie lokal. */
function wPoznaniu(lat: number, lng: number): boolean {
  return lat > 52.25 && lat < 52.55 && lng > 16.7 && lng < 17.15;
}

export interface RozbiorAdresu {
  ulica: string;
  numer: string | null;
}

/**
 * "ul. Sciegiennego 109 (wejscie od ul. Listopadowej), 60-147 Poznan"
 *   -> { ulica: "Sciegiennego", numer: "109" }
 *
 * Kazda z ponizszych regul wziela sie z prawdziwego adresu, ktory OSM odrzucil:
 * dopiski w nawiasach, numer lokalu po ukosniku, skroty "abpa" i "Sw.".
 */
export function rozbierzAdres(adres: string): RozbiorAdresu {
  const pierwszy = adres
    .replace(/\([^)]*\)/g, " ") // "(wejscie od ul. Listopadowej)", "(Pasaz Rondo, I pietro)"
    .split(",")[0]
    .replace(/\s+/g, " ")
    .trim();
  let reszta = pierwszy.replace(/^(ul\.|ulica)\s+/i, "");
  reszta = reszta.replace(/^abpa\.?\s+/i, "Arcybiskupa ").replace(/^(św\.|sw\.)\s*/i, "Świętego ");
  // Pozostale skroty z kropka - inicjaly ("A.") i tytuly ("gen.", "ks.",
  // "prof.") - wycinane. OSM ma pelne formy ("Arcybiskupa Antoniego
  // Baraniaka"), a skrot rozwala dopasowanie: "Arcybiskupa A. Baraniaka 77"
  // daje 0 wynikow, samo "Baraniaka 77" - trafienie. Sprawdzone w przegladarce.
  reszta = reszta.replace(/(^|\s)\p{L}{1,5}\.(?=\s|$)/gu, " ").replace(/\s+/g, " ").trim();
  const m = reszta.match(/^(.*?)\s+(\d+[a-zA-Z]?)(?:\/\S+)?$/);
  if (!m) return { ulica: reszta, numer: null };
  return { ulica: m[1].trim(), numer: m[2].toLowerCase() };
}

const norm = (s: string | undefined) =>
  (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");

export interface WynikGeokodowania {
  lat: number;
  lng: number;
  /** true - zgadza sie ulica i numer domu; false - tylko ulica (punkt przyblizony). */
  dokladny: boolean;
  /** Co OSM znalazl - do pokazania adminowi, zeby mogl potwierdzic. */
  opis: string;
}

interface NominatimTrafienie {
  lat: string;
  lon: string;
  display_name: string;
  address?: { house_number?: string; road?: string; square?: string };
}

async function zapytaj(params: Record<string, string>): Promise<NominatimTrafienie[]> {
  const u = new URL("https://nominatim.openstreetmap.org/search");
  const wszystkie = { format: "jsonv2", addressdetails: "1", limit: "5", countrycodes: "pl", ...params };
  for (const [k, v] of Object.entries(wszystkie)) u.searchParams.set(k, v);
  const r = await fetch(u.toString(), { headers: { "Accept-Language": "pl" } });
  if (!r.ok) throw new Error(`Wyszukiwarka adresow odpowiedziala bledem ${r.status}`);
  return r.json();
}

/** null = nic sensownego w Poznaniu; wtedy admin wpisuje wspolrzedne recznie. */
export async function geokodujAdres(adres: string): Promise<WynikGeokodowania | null> {
  const { ulica, numer } = rozbierzAdres(adres);
  if (!ulica) return null;

  let trafienia = await zapytaj({ street: `${numer ?? ""} ${ulica}`.trim(), city: "Poznań" });
  if (!trafienia.length) trafienia = await zapytaj({ q: `${ulica} ${numer ?? ""}, Poznań` });

  let przyblizony: WynikGeokodowania | null = null;
  for (const t of trafienia) {
    const lat = Number(t.lat);
    const lng = Number(t.lon);
    if (!wPoznaniu(lat, lng)) continue;
    const a = t.address ?? {};
    const miejsce = a.road ?? a.square ?? "";
    const klucz = norm(ulica).slice(-8);
    const ulicaOk = norm(miejsce).includes(klucz) || norm(t.display_name).includes(klucz);
    if (!ulicaOk) continue;
    if (numer && a.house_number && norm(a.house_number).startsWith(norm(numer))) {
      return { lat, lng, dokladny: true, opis: t.display_name };
    }
    przyblizony ??= { lat, lng, dokladny: false, opis: t.display_name };
  }
  return przyblizony;
}
