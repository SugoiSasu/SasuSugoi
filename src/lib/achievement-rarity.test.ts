import { describe, it, expect } from "vitest";
import {
  rarityOf,
  rarityDostepna,
  odsetekGraczyLabel,
  MIN_PROBKA_GRACZY,
  type AchievementStat,
} from "@/lib/achievement-rarity";

function stat(holders: number, total: number, id = "x"): AchievementStat {
  return { achievement_id: id, holders, total_players: total };
}

const DUZA = MIN_PROBKA_GRACZY;

describe("rarityOf przy wystarczajacej probce", () => {
  it("1% graczy to legendarna", () => {
    expect(rarityOf(stat(1, DUZA))).toBe("legendary");
  });

  it("odznaka, ktorej nie ma nikt, jest legendarna", () => {
    expect(rarityOf(stat(0, DUZA))).toBe("legendary");
  });

  it("5% to epicka", () => {
    expect(rarityOf(stat(5, DUZA))).toBe("epic");
  });

  it("20% to rzadka", () => {
    expect(rarityOf(stat(20, DUZA))).toBe("rare");
  });

  it("powyzej 20% to zwykla", () => {
    expect(rarityOf(stat(21, DUZA))).toBe("common");
  });

  it("odznaka, ktora ma kazdy, jest zwykla", () => {
    expect(rarityOf(stat(DUZA, DUZA))).toBe("common");
  });
});

describe("rarityOf przy za malej probce", () => {
  it("milczy zamiast zgadywac", () => {
    // Sedno: 0/10 to 0%, wiec sam odsetek wypchnalby na legendarna kazda
    // jeszcze niezdobyta odznake - na dzis 61 z 71.
    expect(rarityOf(stat(0, 10))).toBeNull();
    expect(rarityOf(stat(3, 10))).toBeNull();
  });

  it("brak statystyki to tez brak rzadkosci", () => {
    expect(rarityOf(undefined)).toBeNull();
  });

  it("prog wlacza sie dokladnie na MIN_PROBKA_GRACZY", () => {
    expect(rarityOf(stat(0, MIN_PROBKA_GRACZY - 1))).toBeNull();
    expect(rarityOf(stat(0, MIN_PROBKA_GRACZY))).not.toBeNull();
  });
});

describe("rarityDostepna", () => {
  it("false dla pustej mapy", () => {
    expect(rarityDostepna(new Map())).toBe(false);
    expect(rarityDostepna(undefined)).toBe(false);
  });

  it("false przy malej populacji", () => {
    expect(rarityDostepna(new Map([["a", stat(1, 10, "a")]]))).toBe(false);
  });

  it("true przy duzej populacji", () => {
    expect(rarityDostepna(new Map([["a", stat(1, DUZA, "a")]]))).toBe(true);
  });
});

describe("odsetekGraczyLabel", () => {
  it("milczy przy za malej probce", () => {
    expect(odsetekGraczyLabel(stat(1, 10))).toBeNull();
    expect(odsetekGraczyLabel(undefined)).toBeNull();
  });

  it("podaje odsetek przy duzej probce", () => {
    expect(odsetekGraczyLabel(stat(25, DUZA))).toBe("Ma ją 25% poŻeraczy");
  });

  it("ulamek procenta nie zaokragla sie do zera", () => {
    expect(odsetekGraczyLabel(stat(1, 1000))).toBe("Ma ją 0.1% poŻeraczy");
  });
});
