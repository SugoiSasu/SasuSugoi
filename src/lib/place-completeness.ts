import { czyDomyslnyPunkt } from "@/lib/geocode";
import type { Place } from "@/lib/places-api";

export type PunktKompletnosci = { ok: boolean; tekst: string; wazne: boolean };

type Pola = Pick<
  Place,
  "avatar_url" | "description" | "address" | "lat" | "lng" | "opening_hours" | "menu_items" | "menu_url"
>;

/**
 * Lista kontrolna kompletnosci lokalu. Jedno zrodlo dla panelu publikacji w
 * edytorze i dla listy lokali w adminie, zeby oba mowily to samo.
 * "wazne" = bez tego lokal wyglada na niedokonczony; reszta to mile widziane.
 */
export function punktyKompletnosci(p: Pola): PunktKompletnosci[] {
  return [
    { ok: !!p.avatar_url, tekst: "Logo", wazne: true },
    { ok: !!p.description?.trim(), tekst: "Opis", wazne: true },
    { ok: !!p.address?.trim(), tekst: "Adres", wazne: true },
    { ok: !czyDomyslnyPunkt(p.lat, p.lng), tekst: "Pinezka w dobrym miejscu", wazne: true },
    { ok: !!p.opening_hours && Object.keys(p.opening_hours).length > 0, tekst: "Godziny otwarcia", wazne: false },
    { ok: !!p.menu_items?.length || !!p.menu_url, tekst: "Menu", wazne: false },
  ];
}

export function brakiLokalu(p: Pola): { wazne: string[]; dodatkowe: string[] } {
  const braki = punktyKompletnosci(p).filter((x) => !x.ok);
  return {
    wazne: braki.filter((x) => x.wazne).map((x) => x.tekst),
    dodatkowe: braki.filter((x) => !x.wazne).map((x) => x.tekst),
  };
}
