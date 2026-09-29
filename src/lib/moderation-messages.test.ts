import { describe, it, expect } from "vitest";
import { asError, dataBlokady, moderationMessage } from "@/lib/moderation-messages";

describe("moderationMessage", () => {
  it("wulgaryzmy -> komunikat o regulaminie", () => {
    expect(moderationMessage({ message: "PZ_PROFANITY" })).toMatch(/narusza regulamin/);
  });

  it("ban czasowy -> data i godzina", () => {
    const m = moderationMessage({ message: "PZ_BANNED", details: "2026-10-05T23:59:18.968424+00:00" });
    expect(m).toMatch(/^Masz blokadę pisania do \d{2}\.\d{2}\.2026/);
  });

  it("ban staly", () => {
    expect(moderationMessage({ message: "PZ_BANNED", details: "permanent" })).toMatch(/stałą blokadę/);
    expect(dataBlokady(null)).toMatch(/stałą blokadę/);
  });

  it("inne bledy - null (obsluzy je zwykla obsluga bledow)", () => {
    expect(moderationMessage({ message: "duplicate key value" })).toBeNull();
    expect(moderationMessage(null)).toBeNull();
  });
});

describe("asError", () => {
  it("blad moderacji -> Error z polskim tekstem i flaga", () => {
    const e = asError({ message: "PZ_PROFANITY" }) as Error & { moderacja?: boolean };
    expect(e).toBeInstanceOf(Error);
    expect(e.message).toMatch(/narusza regulamin/);
    expect(e.moderacja).toBe(true);
  });

  it("zwykly Error przechodzi bez zmian, obiekt bazy dostaje message", () => {
    const orig = new Error("x");
    expect(asError(orig)).toBe(orig);
    expect(asError({ message: "brak uprawnien" }).message).toBe("brak uprawnien");
  });
});
