import { describe, expect, it } from "vitest";
import { formatCena, poziomCeny, poziomZKwoty, wartoscCeny } from "./price";

describe("poziomCeny", () => {
  it("skala z dolarow, piaty poziom schodzi na 4", () => {
    expect(poziomCeny("$")).toBe(1);
    expect(poziomCeny("$$$")).toBe(3);
    expect(poziomCeny("$$$$")).toBe(4);
    expect(poziomCeny("$$$$$")).toBe(4);
  });
  it("tekst w zlotowkach: srodek przedzialu", () => {
    expect(poziomCeny("20-50zł")).toBe(2); // 35
    expect(poziomCeny("20-200zł")).toBe(4); // 110
    expect(poziomCeny("45 zł")).toBe(3);
  });
  it("puste i bezsensowne = 0", () => {
    expect(poziomCeny("")).toBe(0);
    expect(poziomCeny(null)).toBe(0);
    expect(poziomCeny("tanio")).toBe(0);
  });
});

describe("formatowanie", () => {
  it("zl zl zl", () => {
    expect(formatCena("$$")).toBe("zł zł");
    expect(formatCena("")).toBe("");
    expect(formatCena("$$$$$")).toBe("zł zł zł zł");
  });
  it("progi i zapis", () => {
    expect([24, 25, 39, 40, 59, 60].map(poziomZKwoty)).toEqual([1, 2, 2, 3, 3, 4]);
    expect(wartoscCeny(0)).toBe("");
    expect(wartoscCeny(3)).toBe("$$$");
    expect(wartoscCeny(9)).toBe("$$$$");
  });
});
