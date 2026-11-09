/**
 * Oznaczenia lokali na okazje. Ustawia je admin w edytorze lokalu, a na stronie głównej zasilają filtry
 * intencji ("Randka", "Na szybko", "Z ekipą"). Lista wartości musi zgadzać się z ograniczeniem
 * places_occasions_valid w bazie (pilnuje tego occasions.test.ts).
 */
export const OKAZJE = [
  { key: "randka", etykieta: "Randka", emoji: "🕯️", opis: "Dobre miejsce na randkę" },
  { key: "szybko", etykieta: "Na szybko", emoji: "⚡", opis: "Szybka obsługa, krótka przerwa" },
  { key: "ekipa", etykieta: "Z ekipą", emoji: "👥", opis: "Dobre dla większej grupy" },
] as const;

export type Okazja = (typeof OKAZJE)[number]["key"];

export const maOkazje = (p: { occasions?: string[] | null }, k: Okazja): boolean =>
  (p.occasions ?? []).includes(k);
