import { describe, it, expect } from "vitest";
import { rozbierzAdres, czyDomyslnyPunkt, DOMYSLNY_PUNKT } from "@/lib/geocode";

// Kazdy przypadek to prawdziwy adres lokalu z bazy, ktory Nominatim
// odrzucil przy pierwszym podejsciu do geokodowania 2026-09-28.
describe("rozbierzAdres", () => {
  it("zwykly adres z kodem pocztowym", () => {
    expect(rozbierzAdres("ul. Wrocławska 14, 61-838 Poznań")).toEqual({ ulica: "Wrocławska", numer: "14" });
  });

  it("numer lokalu po ukosniku jest odcinany", () => {
    expect(rozbierzAdres("ul. Jackowskiego 38/1, 60-512 Poznań")).toEqual({ ulica: "Jackowskiego", numer: "38" });
  });

  it("litera w numerze zostaje", () => {
    expect(rozbierzAdres("ul. Różana 9a, 61-577 Poznań")).toEqual({ ulica: "Różana", numer: "9a" });
  });

  it("dopisek w nawiasie nie psuje numeru", () => {
    expect(rozbierzAdres("ul. Ściegiennego 109 (wejście od ul. Listopadowej), 60-147 Poznań")).toEqual({
      ulica: "Ściegiennego",
      numer: "109",
    });
    expect(rozbierzAdres("ul. Zamenhofa 133 (Pasaż Rondo, I piętro), 61-131 Poznań")).toEqual({
      ulica: "Zamenhofa",
      numer: "133",
    });
  });

  it("skrot 'abpa' rozwijany, inicjal wyciety", () => {
    // Z inicjalem "A." Nominatim zwracal 0 wynikow - sprawdzone w przegladarce.
    expect(rozbierzAdres("ul. abpa A. Baraniaka 77, 61-131 Poznań")).toEqual({
      ulica: "Arcybiskupa Baraniaka",
      numer: "77",
    });
  });

  it("tytuly z kropka (gen., ks.) wyciete", () => {
    expect(rozbierzAdres("ul. gen. Dąbrowskiego 5, Poznań")).toEqual({ ulica: "Dąbrowskiego", numer: "5" });
    expect(rozbierzAdres("ul. ks. Popiełuszki 12, Poznań")).toEqual({ ulica: "Popiełuszki", numer: "12" });
  });

  it("skrot 'Sw.' rozwijany", () => {
    expect(rozbierzAdres("ul. Św. Rocha 8, 61-142 Poznań")).toEqual({ ulica: "Świętego Rocha", numer: "8" });
  });

  it("ulica z liczba w nazwie (27 Grudnia) nie myli numeru", () => {
    expect(rozbierzAdres("ul. 27 Grudnia 21, 61-737 Poznań")).toEqual({ ulica: "27 Grudnia", numer: "21" });
  });

  it("adres bez numeru domu", () => {
    expect(rozbierzAdres("pawilon nr 8, plac Wielkopolski, 60-101 Poznań").numer).toBe("8");
    expect(rozbierzAdres("Stary Rynek")).toEqual({ ulica: "Stary Rynek", numer: null });
  });
});

describe("czyDomyslnyPunkt", () => {
  it("rozpoznaje domyslny punkt formularza", () => {
    expect(czyDomyslnyPunkt(DOMYSLNY_PUNKT.lat, DOMYSLNY_PUNKT.lng)).toBe(true);
    expect(czyDomyslnyPunkt(52.40821, 16.93349)).toBe(true);
  });

  it("prawdziwe polozenie nie jest domyslne", () => {
    expect(czyDomyslnyPunkt(52.4079205, 16.9219203)).toBe(false);
  });

  it("brak wspolrzednych to nie domyslny punkt", () => {
    expect(czyDomyslnyPunkt(null, null)).toBe(false);
  });
});
