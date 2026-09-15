import { describe, it, expect } from "vitest";
import { progressFor } from "@/components/ChallengesSection";
import type { Challenge } from "@/lib/challenges-api";

// progressFor mirrors check_challenges() in
// supabase/migrations/20260821170000_wall_v2_lists_and_challenges.sql. The SQL
// stays the source of truth for awarding a completion; if the two drift, the
// UI quietly promises a completion the database will not grant (or hides one
// it will). These pin the three criteria types and the time window.

function challenge(criteria: Challenge["criteria"]): Challenge {
  return { id: "c", slug: "s", title: "t", criteria } as Challenge;
}

function review(daysAgo: number, cuisine: string | null) {
  return {
    created_at: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString(),
    place: { cuisine },
  };
}

describe("progressFor", () => {
  it("counts reviews of one cuisine inside the window", () => {
    const c = challenge({ type: "cuisine_reviews", cuisine: "Kebaby", threshold: 3, window_days: 7 });
    const reviews = [review(1, "Kebaby"), review(2, "Kebaby"), review(3, "Włoska")];
    expect(progressFor(c, reviews)).toEqual({ current: 2, threshold: 3 });
  });

  it("ignores reviews older than the window", () => {
    const c = challenge({ type: "cuisine_reviews", cuisine: "Kebaby", threshold: 3, window_days: 7 });
    const reviews = [review(1, "Kebaby"), review(30, "Kebaby")];
    expect(progressFor(c, reviews).current).toBe(1);
  });

  it("counts every in-window review for new_places_reviewed", () => {
    const c = challenge({ type: "new_places_reviewed", threshold: 5, window_days: 31 });
    const reviews = [review(1, "A"), review(2, "B"), review(40, "C")];
    expect(progressFor(c, reviews).current).toBe(2);
  });

  it("counts distinct cuisines, not reviews, for unique_cuisines_reviewed", () => {
    const c = challenge({ type: "unique_cuisines_reviewed", threshold: 4, window_days: 31 });
    const reviews = [review(1, "Kebaby"), review(2, "Kebaby"), review(3, "Włoska")];
    expect(progressFor(c, reviews).current).toBe(2);
  });

  it("does not count places with no cuisine towards distinct cuisines", () => {
    const c = challenge({ type: "unique_cuisines_reviewed", threshold: 4, window_days: 31 });
    expect(progressFor(c, [review(1, null), review(2, "Włoska")]).current).toBe(1);
  });

  // The SQL defaults window_days to 30 via COALESCE; the UI has to agree or a
  // challenge without an explicit window shows the wrong progress.
  it("falls back to a 30-day window when the challenge omits one", () => {
    const c = challenge({ type: "new_places_reviewed", threshold: 5 } as never);
    expect(progressFor(c, [review(29, "A"), review(31, "B")]).current).toBe(1);
  });

  it("reports zero for an unknown criteria type instead of throwing", () => {
    const c = challenge({ type: "nonsense", threshold: 5, window_days: 7 } as never);
    expect(progressFor(c, [review(1, "A")])).toEqual({ current: 0, threshold: 5 });
  });
});
