import { describe, expect, it } from "vitest";
import { najwyzszeTrofeum, nazwaTrofeum, normalizujPropozycje, podpisTrofeum, posortujTrofea } from "./trophies";

const T = (kind: any, year: number, tier: number | null = null, label: string | null = null) => ({
  place_id: "p",
  kind,
  tier,
  year,
  label,
  source_url: null,
});

describe("nazwy i podpisy", () => {
  it("odmienia gwiazdki", () => {
    expect(nazwaTrofeum({ kind: "michelin_star", tier: 1 })).toBe("Gwiazdka Michelin");
    expect(nazwaTrofeum({ kind: "michelin_star", tier: 2 })).toBe("2 gwiazdki Michelin");
    expect(nazwaTrofeum({ kind: "michelin_star", tier: 3 })).toBe("3 gwiazdki Michelin");
  });
  it("Warte poŻarcia dopisuje kategorię", () => {
    expect(podpisTrofeum({ kind: "warte_pozarcia", tier: null, year: 2026, label: "Kebaby" })).toBe(
      "Warte poŻarcia · Kebaby 2026",
    );
    expect(podpisTrofeum({ kind: "michelin_bib", tier: null, year: 2025, label: null })).toBe(
      "Bib Gourmand Michelin 2025",
    );
  });
});

describe("kolejność", () => {
  it("gwiazdki wyżej niż nasze, Bib, wyróżnienie; wyższa gwiazdka pierwsza", () => {
    const lista = [
      T("michelin_recommended", 2025),
      T("michelin_bib", 2025),
      T("warte_pozarcia", 2026, null, "Pizza"),
      T("michelin_star", 2024, 1),
      T("michelin_star", 2023, 2),
    ];
    expect(posortujTrofea(lista).map((t) => t.kind + (t.tier ?? ""))).toEqual([
      "michelin_star2",
      "michelin_star1",
      "warte_pozarcia",
      "michelin_bib",
      "michelin_recommended",
    ]);
    expect(najwyzszeTrofeum(lista)?.tier).toBe(2);
    expect(najwyzszeTrofeum([])).toBeNull();
  });
});

describe("normalizujPropozycje (AI)", () => {
  const ok = { rodzaj: "michelin_star", poziom: 1, rok: 2025, opis: "", zrodlo: "https://guide.michelin.com/x" };
  it("przyjmuje poprawną", () => {
    expect(normalizujPropozycje(ok, 2026)).toEqual({
      kind: "michelin_star",
      tier: 1,
      year: 2025,
      label: null,
      source_url: "https://guide.michelin.com/x",
    });
  });
  it("odrzuca zły rodzaj, rok z przyszłości, gwiazdki bez poziomu i brak źródła", () => {
    expect(normalizujPropozycje({ ...ok, rodzaj: "oscar" }, 2026)).toBeNull();
    expect(normalizujPropozycje({ ...ok, rok: 2031 }, 2026)).toBeNull();
    expect(normalizujPropozycje({ ...ok, poziom: 5 }, 2026)).toBeNull();
    expect(normalizujPropozycje({ ...ok, zrodlo: "" }, 2026)).toBeNull();
    expect(normalizujPropozycje({ ...ok, zrodlo: "javascript:alert(1)" }, 2026)).toBeNull();
  });
  it("Bib nie wymaga poziomu", () => {
    expect(normalizujPropozycje({ ...ok, rodzaj: "michelin_bib", poziom: undefined }, 2026)?.tier).toBeNull();
  });
});
