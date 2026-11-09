import { describe, expect, it } from "vitest";
import { podpisSerii, zwinSerie } from "./notification-stacks";

const n = (type: string, id: number) => ({ type, id });

describe("zwinSerie", () => {
  it("zwija 3+ odznaki pod rząd", () => {
    const w = zwinSerie([n("achievement", 1), n("achievement", 2), n("achievement", 3), n("friend_request", 4)]);
    expect(w).toHaveLength(2);
    expect(w[0].kind).toBe("seria");
    expect(w[1].kind).toBe("jeden");
  });
  it("zostawia 2 odznaki i inne typy bez zmian", () => {
    expect(zwinSerie([n("achievement", 1), n("achievement", 2)]).every((x) => x.kind === "jeden")).toBe(true);
    expect(zwinSerie([n("place_post", 1), n("place_post", 2), n("place_post", 3)]).every((x) => x.kind === "jeden")).toBe(true);
  });
  it("przerwa innym typem rozdziela serie", () => {
    const w = zwinSerie([n("achievement", 1), n("achievement", 2), n("outing", 3), n("achievement", 4), n("achievement", 5)]);
    expect(w.every((x) => x.kind === "jeden")).toBe(true);
  });
  it("podpis", () => {
    expect(podpisSerii("achievement", 5)).toBe("5 nowych odznak");
  });
});
