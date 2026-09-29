import { describe, expect, it } from "vitest";
import { cechyLokalu, liniaZnajomych, odlegloscKm, pierwszaPozycjaMenu } from "./karty-utils";

describe("liniaZnajomych", () => {
  it("odmienia dla 1, 2 i więcej osób", () => {
    expect(liniaZnajomych([])).toBe("");
    expect(liniaZnajomych(["Ola"])).toBe("Ola chce tu iść");
    expect(liniaZnajomych(["Ola", "Zuza"])).toBe("Ola i Zuza chcą tu iść");
    expect(liniaZnajomych(["Ola", "Zuza", "Kasia"])).toBe("Ola i 2 znajomych chcą tu iść");
  });
});

describe("pierwszaPozycjaMenu", () => {
  it("bierze pierwszą niepustą pozycję i pomija puste kategorie", () => {
    expect(
      pierwszaPozycjaMenu({
        menu_items: [
          { category: "Puste", items: [] },
          { category: "Burgery", items: [{ name: "  " }, { name: " Classic " }] },
        ],
      }),
    ).toBe("Classic");
  });
  it("zwraca null bez menu", () => {
    expect(pierwszaPozycjaMenu({ menu_items: null })).toBeNull();
  });
});

describe("cechyLokalu", () => {
  it("składa cechy tylko z prawdziwych pól", () => {
    expect(cechyLokalu({ has_takeaway: true, wheelchair_accessible: false, district: "Wilda" })).toEqual([
      "Na wynos",
      "Wilda",
    ]);
    expect(cechyLokalu({ has_takeaway: false, wheelchair_accessible: false, district: null })).toEqual([]);
  });
});

describe("odlegloscKm", () => {
  it("liczy do najbliższej lokalizacji", () => {
    const rynek = { lat: 52.4082, lng: 16.9335 };
    const d = odlegloscKm(
      {
        lat: 52.5,
        lng: 17.5,
        locations: [{ id: "1", place_id: "p", label: null, address: "", lat: 52.409, lng: 16.934, sort_order: 0 }],
      },
      rynek,
    );
    expect(d).toBeLessThan(0.2);
  });
});
