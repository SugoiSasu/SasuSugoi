/**
 * Etykiety i kolory kategorii odznak.
 *
 * Kategorie sa DANYMI - siedza w kolumnie `achievements.category` i admin moze
 * dolozyc nowa bez ruszania kodu. Dlatego mapa jest tylko slownikiem ladnych
 * nazw dla tych, ktore juz znamy, a nie zrodlem prawdy o tym, jakie kategorie
 * istnieja: nieznany klucz dostaje nazwe z siebie samego i kolor z hasza, wiec
 * pojawia sie na ekranie od razu, a nie dopiero po deployu.
 *
 * (Paczka designu pokazuje 8 innych kategorii - to jej wlasne dane
 * przykladowe. Decyzja Mateusza: bierzemy te, ktore sa w bazie.)
 */
const ZNANE: Record<string, { label: string; kolor: string }> = {
  recenzent: { label: "Recenzent", kolor: "bg-tomato" },
  odkrywca: { label: "Odkrywca", kolor: "bg-[oklch(66%_0.09_190)]" },
  kolekcjoner: { label: "Kolekcjoner", kolor: "bg-[oklch(66%_0.1_300)]" },
  spolecznosc: { label: "Społeczność", kolor: "bg-blush" },
  weteran: { label: "Weteran", kolor: "bg-mustard" },
};

const KOLORY_ZAPASOWE = [
  "bg-tomato",
  "bg-[oklch(66%_0.09_190)]",
  "bg-[oklch(66%_0.1_300)]",
  "bg-blush",
  "bg-mustard",
  "bg-navy",
];

export const BEZ_KATEGORII = "inne";

export function kategoriaLabel(klucz: string | null | undefined): string {
  if (!klucz) return "Inne";
  const znana = ZNANE[klucz];
  if (znana) return znana.label;
  // Nieznany klucz: "kuchnie_swiata" -> "Kuchnie swiata".
  const czytelny = klucz.replace(/[_-]+/g, " ").trim();
  return czytelny.charAt(0).toUpperCase() + czytelny.slice(1);
}

export function kategoriaKolor(klucz: string | null | undefined): string {
  if (!klucz) return "bg-muted-foreground/45";
  const znana = ZNANE[klucz];
  if (znana) return znana.kolor;
  let suma = 0;
  for (const ch of klucz) suma += ch.charCodeAt(0);
  return KOLORY_ZAPASOWE[suma % KOLORY_ZAPASOWE.length];
}

/** Kategorie w kolejnosci: najpierw znane (jak w slowniku), potem reszta. */
export function posortujKategorie(klucze: string[]): string[] {
  const znane = Object.keys(ZNANE);
  return [...klucze].sort((a, b) => {
    const ia = znane.indexOf(a);
    const ib = znane.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b, "pl");
  });
}
