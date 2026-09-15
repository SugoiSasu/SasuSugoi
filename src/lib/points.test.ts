import { describe, it, expect } from "vitest";
import { levelInfo, LEVEL_STEP, avatarRingForLevel } from "@/components/LevelProgress";
import { computeProgress } from "@/lib/achievements-api";
import type { Achievement } from "@/lib/achievements-api";
import { pluralPl, badgesLabel } from "@/lib/plural-pl";
import { sanitizeIlikeTerm } from "@/lib/postgrest-filter";

// These cover the arithmetic the app shows to users as their standing:
// level, XP, badge progress. Two real bugs shipped here before - a level
// label that disagreed with its own progress bar, and a badge counter that
// could exceed its maximum - so the boundaries are worth pinning down.

describe("levelInfo", () => {
  it("starts at level 1 with an empty bar", () => {
    expect(levelInfo(0)).toMatchObject({ level: 1, inLevel: 0, pct: 0 });
  });

  it("stays on level 1 right up to the threshold", () => {
    expect(levelInfo(LEVEL_STEP - 1)).toMatchObject({ level: 1, inLevel: LEVEL_STEP - 1 });
  });

  it("levels up exactly at the threshold, resetting progress within the level", () => {
    expect(levelInfo(LEVEL_STEP)).toMatchObject({ level: 2, inLevel: 0, pct: 0 });
  });

  // The regression: the "X / Y XP" label used to be computed against the
  // cumulative threshold while the bar used position within the current
  // level, so the two disagreed at every level past the first.
  it("keeps inLevel/pct consistent with each other above level 1", () => {
    const points = LEVEL_STEP + LEVEL_STEP / 2; // half way through level 2
    const { level, inLevel, pct } = levelInfo(points);
    expect(level).toBe(2);
    expect(inLevel).toBe(LEVEL_STEP / 2);
    expect(pct).toBe(50);
    expect(pct).toBe(Math.round((inLevel / LEVEL_STEP) * 100));
  });

  it("reports how much XP is left in the current level", () => {
    expect(levelInfo(LEVEL_STEP - 10).xpToNext).toBe(10);
    expect(levelInfo(LEVEL_STEP).xpToNext).toBe(LEVEL_STEP);
  });
});

describe("avatarRingForLevel", () => {
  it("gives no ring before level 6", () => {
    expect(avatarRingForLevel(1)).toBeNull();
    expect(avatarRingForLevel(5)).toBeNull();
  });

  it("awards the first tier at level 6 and holds it through level 10", () => {
    const first = avatarRingForLevel(6);
    expect(first).not.toBeNull();
    expect(avatarRingForLevel(10)).toEqual(first);
  });

  it("moves up a tier every five levels", () => {
    expect(avatarRingForLevel(11)).not.toEqual(avatarRingForLevel(6));
  });

  it("caps at the top tier instead of running off the end", () => {
    expect(avatarRingForLevel(999)).toEqual(avatarRingForLevel(30));
  });
});

function achievement(criteria: Achievement["criteria"]): Achievement {
  return { id: "a", slug: "s", name: "n", criteria } as Achievement;
}

describe("computeProgress", () => {
  const stats = {
    reviews_count: 3,
    unique_places: 2,
    points_total: 120,
    friends_count: 0,
    referrals_count: 0,
  };

  it("reports progress against the threshold", () => {
    const p = computeProgress(achievement({ type: "reviews_count", threshold: 6 }), stats);
    expect(p).toMatchObject({ current: 3, threshold: 6, pct: 50, remaining: 3 });
  });

  it("never exceeds 100% once the threshold is passed", () => {
    const p = computeProgress(achievement({ type: "reviews_count", threshold: 2 }), stats);
    expect(p.pct).toBe(100);
    expect(p.remaining).toBe(0);
  });

  it("treats a missing threshold as no progress rather than dividing by zero", () => {
    const p = computeProgress(achievement({ type: "reviews_count" } as never), stats);
    expect(p.pct).toBe(0);
    expect(Number.isNaN(p.pct)).toBe(false);
  });

  it("reads zero for a criterion the stats do not carry", () => {
    const p = computeProgress(achievement({ type: "nonsense", threshold: 5 } as never), stats);
    expect(p.current).toBe(0);
  });
});

describe("pluralPl", () => {
  it("uses the singular only for exactly one", () => {
    expect(pluralPl(1, "punkt", "punkty", "punktów")).toBe("punkt");
  });

  it("uses the few form for 2-4", () => {
    for (const n of [2, 3, 4, 22, 33, 104]) {
      expect(pluralPl(n, "punkt", "punkty", "punktów")).toBe("punkty");
    }
  });

  // The teens are the classic Polish pluralisation trap: 12-14 take the
  // many form even though they end in 2-4.
  it("uses the many form for the teens and for 5+", () => {
    for (const n of [0, 5, 11, 12, 13, 14, 25, 112]) {
      expect(pluralPl(n, "punkt", "punkty", "punktów")).toBe("punktów");
    }
  });

  it("labels badges with the count for everything but one", () => {
    expect(badgesLabel(1)).toBe("odznakę");
    expect(badgesLabel(3)).toBe("3 odznaki");
    expect(badgesLabel(5)).toBe("5 odznak");
  });
});

describe("sanitizeIlikeTerm", () => {
  // A raw "%" reaching .ilike() matched every row, which made a profile
  // lookup throw on multiple rows instead of returning a clean 404.
  it("strips the characters that break out of an ilike pattern", () => {
    expect(sanitizeIlikeTerm("%")).toBe("");
    expect(sanitizeIlikeTerm("a%b")).toBe("a b");
    expect(sanitizeIlikeTerm("a,b")).toBe("a b");
    expect(sanitizeIlikeTerm("a(b)c")).toBe("a b c");
  });

  it("leaves ordinary usernames untouched", () => {
    expect(sanitizeIlikeTerm("sasu")).toBe("sasu");
    expect(sanitizeIlikeTerm("gentle_menel")).toBe("gentle_menel");
  });
});
