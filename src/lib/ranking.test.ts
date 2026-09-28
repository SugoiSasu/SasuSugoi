import { describe, it, expect } from "vitest";
import {
  koniecOkresu,
  ileZostalo,
  policzRanking,
  sasiedzi,
  wskazowka,
  type WierszRankingu,
} from "@/lib/ranking";

const TERAZ = Date.parse("2026-09-28T12:00:00Z");
const DAWNO = "2026-06-01T00:00:00Z";

function w(id: string, wartosc: number, x: Partial<WierszRankingu> = {}): WierszRankingu {
  return {
    user_id: id,
    username: id,
    display_name: null,
    avatar_url: null,
    avatar_source: null,
    gender: null,
    is_vip: false,
    vip_until: null,
    vip_nick_color: null,
    active_title: null,
    points_total: wartosc,
    wartosc,
    wartosc_tydzien_temu: null,
    is_friend: false,
    is_me: false,
    created_at: DAWNO,
    ...x,
  };
}

describe("policzRanking", () => {
  it("remis = to samo miejsce, nastepne przeskakuje", () => {
    const r = policzRanking([w("a", 50), w("b", 30), w("c", 30), w("d", 10)], "all", TERAZ);
    expect(r.map((g) => g.miejsce)).toEqual([1, 2, 2, 4]);
  });

  it("zakres znajomych: tylko znajomi i ja, miejsca od nowa", () => {
    const r = policzRanking(
      [w("a", 50), w("b", 30, { is_friend: true }), w("ja", 20, { is_me: true })],
      "friends",
      TERAZ,
    );
    expect(r.map((g) => [g.user_id, g.miejsce])).toEqual([
      ["b", 1],
      ["ja", 2],
    ]);
  });

  it("zmiana miejsc wzgledem stanu sprzed 7 dni", () => {
    const r = policzRanking(
      [w("a", 50, { wartosc_tydzien_temu: 10 }), w("b", 40, { wartosc_tydzien_temu: 40 })],
      "all",
      TERAZ,
    );
    expect(r.find((g) => g.user_id === "a")!.zmiana).toBe(1); // bylo 2., jest 1.
    expect(r.find((g) => g.user_id === "b")!.zmiana).toBe(-1);
  });

  it("konto z ostatnich 7 dni = NOWY (null), w tygodniu/miesiacu bez zmian", () => {
    const nowe = policzRanking([w("a", 5, { wartosc_tydzien_temu: 0, created_at: "2026-09-26T00:00:00Z" })], "all", TERAZ);
    expect(nowe[0].zmiana).toBeNull();
    const tydzien = policzRanking([w("a", 5)], "all", TERAZ);
    expect(tydzien[0].zmiana).toBeUndefined();
  });
});

describe("wskazowka", () => {
  const reguly = { recenzja: 10, nowyLokal: 20 };
  it("liczy z prawdziwych regul punktow", () => {
    const l = policzRanking([w("lider", 70, { display_name: "Artur K" }), w("ja", 35, { is_me: true })], "all", TERAZ);
    // brakuje 36 -> dwie recenzje nowych lokali po 30
    expect(wskazowka(sasiedzi(l), "pts", reguly)).toBe("2 recenzje nowych lokali (+60 pkt) i wyprzedzasz Artur");
  });

  it("maly brak -> jedna zwykla recenzja", () => {
    const l = policzRanking([w("x", 40), w("ja", 35, { is_me: true })], "all", TERAZ);
    expect(wskazowka(sasiedzi(l), "pts", reguly)).toBe("Jedna recenzja (+10 pkt) i wyprzedzasz @x");
  });

  it("lider dostaje przewage nad drugim", () => {
    const l = policzRanking([w("ja", 12, { is_me: true }), w("y", 9)], "all", TERAZ);
    expect(wskazowka(sasiedzi(l), "badges", reguly)).toBe("@y traci do Ciebie 3 odzn. Pilnuj korony.");
  });
});

describe("koniecOkresu", () => {
  it("tydzien konczy sie w poniedzialek o polnocy czasu polskiego", () => {
    // Pon 28.09.2026 14:00 w Warszawie (CEST, UTC+2) -> pon 05.10 00:00 = 04.10 22:00 UTC
    expect(koniecOkresu("week", new Date("2026-09-28T12:00:00Z"))!.toISOString()).toBe("2026-10-04T22:00:00.000Z");
  });

  it("miesiac konczy sie 1. dnia nastepnego o polnocy", () => {
    expect(koniecOkresu("month", new Date("2026-09-28T12:00:00Z"))!.toISOString()).toBe("2026-09-30T22:00:00.000Z");
  });

  it("od poczatku - bez konca", () => {
    expect(koniecOkresu("all")).toBeNull();
  });

  it("czytelny czas", () => {
    const t = new Date("2026-09-28T12:00:00Z");
    expect(ileZostalo(new Date("2026-10-01T14:30:00Z"), t)).toBe("3 dni 2 h");
    expect(ileZostalo(new Date("2026-09-28T13:05:00Z"), t)).toBe("1 h 5 min");
  });
});
