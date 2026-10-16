import { describe, expect, it } from "vitest";
import { tokensForBounties } from "../src/engine/bounties";
import { assignmentEarned, assignmentRemaining, eventMaxTokens } from "../src/engine/events";
import { bountyPlan, forecast } from "../src/engine/forecast";
import { normalizeState } from "../src/engine/state";
import { allSeries } from "../src/series";
import { cygnus } from "../src/series/cygnus";
import { enforceAssignmentOrder, isDetailed } from "../src/engine/events";

describe("series configs", () => {
  for (const series of allSeries) {
    it(`${series.id}: medals ascending and events well formed`, () => {
      const thresholds = series.medals.map((m) => m.tokens);
      expect([...thresholds].sort((a, b) => a - b)).toEqual(thresholds);
      const categories = new Set(series.categories.map((c) => c.id));
      const ids = new Set<string>();
      for (const e of series.events) {
        expect(ids.has(e.id), `duplicate id ${e.id}`).toBe(false);
        ids.add(e.id);
        expect(categories.has(e.category), `unknown category ${e.category}`).toBe(true);
        expect(e.startDate <= e.endDate).toBe(true);
        expect(e.startDate >= series.startDate && e.endDate <= series.endDate).toBe(true);
        if (e.kind === "campaign") {
          for (const a of e.assignments) {
            if (isDetailed(a)) expect(a.required).toBeLessThanOrEqual(a.bounties.length);
          }
        }
      }
    });
  }

  it("cygnus campaign totals match the announced maximums", () => {
    const max = (id: string) => eventMaxTokens(cygnus.events.find((e) => e.id === id)!);
    expect(max("global-battles")).toBe(8000);
    expect(max("noise-floor")).toBe(2000);
  });
});

describe("daily bounties", () => {
  it("applies milestone bonuses", () => {
    const counts = [0, 1, 2, 3, 4].map((n) => tokensForBounties(cygnus.dailyBounties, n));
    expect(counts).toEqual([0, 10, 30, 40, 60]);
  });
});

describe("assignments", () => {
  const nf = cygnus.events.find((e) => e.id === "noise-floor");
  if (nf?.kind !== "campaign") throw new Error("noise-floor must be a campaign");
  const [a1] = nf.assignments;

  it("grants the reward only once the required bounties are done", () => {
    expect(assignmentEarned(a1!, 2)).toEqual({ min: 60, max: 60 });
    expect(assignmentEarned(a1!, 3)).toEqual({ min: 170, max: 170 });
    expect(assignmentEarned(a1!, 4)).toEqual({ min: 200, max: 200 });
  });

  it("distinguishes full and minimum plans", () => {
    expect(assignmentRemaining(a1!, 0, "full")).toEqual({ min: 200, max: 200 });
    expect(assignmentRemaining(a1!, 0, "minimum")).toEqual({ min: 170, max: 170 });
    expect(assignmentRemaining(a1!, 3, "minimum")).toEqual({ min: 0, max: 0 });
  });

  it("reports the tokens a minimum plan leaves behind", () => {
    // Noise Floor with assignments 1-2 at 4/4: the minimum plan skips one
    // bounty in assignments 3 (90) and 4 (120).
    const state = normalizeState(cygnus, {
      events: { "noise-floor": { intent: "yes", plan: "minimum", assignments: [4, 4, 0, 0] } },
    });
    const ev = forecast(cygnus, state, "2026-10-14").evaluations.find((e) => e.event.id === "noise-floor")!;
    expect(ev.potential).toEqual({ min: 1190, max: 1190 });
    expect(ev.forfeited).toEqual({ min: 210, max: 210 });
  });
});

describe("bountyPlan", () => {
  const base = { todayInSeason: false, todayTokens: 0, dailyRelaxed: 40, dailyMax: 60 };

  it("needs no full days when relaxed is enough", () => {
    expect(bountyPlan({ ...base, target: 1000, base: 0, remainingDays: 25 })).toEqual({
      fullDays: 0,
      relaxedDays: 25,
      shortfall: 0,
    });
  });

  it("counts full days needed to close the gap", () => {
    // Relaxed: 400; missing 100 -> 5 days of +20.
    expect(bountyPlan({ ...base, target: 500, base: 0, remainingDays: 10 })).toEqual({
      fullDays: 5,
      relaxedDays: 5,
      shortfall: 0,
    });
  });

  it("reports the shortfall when even full days are not enough", () => {
    expect(bountyPlan({ ...base, target: 700, base: 0, remainingDays: 10 })).toEqual({
      fullDays: null,
      relaxedDays: 0,
      shortfall: 100,
    });
  });
});

describe("forecast", () => {
  it("isolates bounty tokens and projects the pace", () => {
    const state = normalizeState(cygnus, {
      currentTokens: 3000,
      bountiesToday: 0,
      events: {
        // Global Battles: assignment 1 done, 2 bounties of assignment 2 done.
        "global-battles": { intent: "yes", assignments: [3, 2, 0] },
        "fs-oct": { completed: true },
      },
    });
    const f = forecast(cygnus, state, "2026-10-11");
    expect(f.elapsedDays).toBe(10);
    // 3000 - 2500 (FS) - 2000 (GB) is negative -> warning, clamped to 0.
    expect(f.warnings).toHaveLength(1);
    expect(f.pastBountyTokens).toEqual({ min: 0, max: 0 });
  });

  it("plans the in-person events needed before the season starts", () => {
    // Skipping both global campaigns: Gold needs in-person events.
    const state = normalizeState(cygnus, {
      events: { "global-battles": { intent: "no" }, "global-deploy": { intent: "no" } },
    });
    const f = forecast(cygnus, state, "2026-09-25");
    const gold = f.tiers.at(-1)!;
    // 3 bounties: 92 * 40 + 6,000 remote = 9,680 -> 14,320 missing -> 6 events.
    // 4 bounties: 92 * 60 + 6,000 remote = 11,520 -> 12,480 missing -> 5 events.
    const total = (p: (typeof gold.inPerson)[number]) => p.needed?.reduce((s, n) => s + n.count, 0);
    expect(gold.inPerson.map(total)).toEqual([6, 5]);
    expect(gold.bountyPlan.pessimistic.fullDays).toBeNull();
  });

  it("computes the daily average", () => {
    const state = normalizeState(cygnus, {
      currentTokens: 2900,
      bountiesToday: 0,
      events: { "fs-oct": { completed: true } },
    });
    const f = forecast(cygnus, state, "2026-10-11");
    expect(f.pastBountyTokens).toEqual({ min: 400, max: 400 });
    expect(f.averagePerDay).toEqual({ min: 40, max: 40 });
  });

  it("counts attended events as committed until their tokens arrive", () => {
    const state = normalizeState(cygnus, {
      currentTokens: 400,
      events: {
        // Attended the October FS (stated intent ignored); tokens not granted yet.
        "fs-oct": { intent: "no", attended: true },
        "ss-oct-17": { attended: true },
      },
    });
    const f = forecast(cygnus, state, "2026-10-11");
    const fs = f.evaluations.find((e) => e.event.id === "fs-oct")!;
    expect(fs.earned).toEqual({ min: 0, max: 0 });
    expect(fs.committed).toEqual({ min: 2500, max: 2500 });
    expect(fs.forfeited).toEqual({ min: 0, max: 0 });
    // Not part of the current total: all 400 tokens came from bounties.
    expect(f.pastBountyTokens).toEqual({ min: 400, max: 400 });
    expect(f.undecided.some((e) => e.event.id === "fs-oct")).toBe(false);
    // Shard Storms grant tokens on the spot: "attended" means nothing there.
    expect(f.evaluations.find((e) => e.event.id === "ss-oct-17")!.awaitingTokens).toBe(false);

    // Once received, the tokens move from committed to earned.
    state.events["fs-oct"]!.completed = true;
    state.currentTokens = 2900;
    const after = forecast(cygnus, state, "2026-10-11");
    const fsAfter = after.evaluations.find((e) => e.event.id === "fs-oct")!;
    expect(fsAfter.earned).toEqual({ min: 2500, max: 2500 });
    expect(fsAfter.committed).toEqual({ min: 0, max: 0 });
    expect(after.committedRemaining.min).toBe(f.committedRemaining.min - 2500);
  });

  it("subtracts a declared bonus only once the event is over", () => {
    const state = normalizeState(cygnus, {
      currentTokens: 12000,
      events: {
        "global-battles": { assignments: [3, 3, 2], bonusReceived: true, bonusTokens: 1000 },
      },
    });
    // Before the end the stored bonus is ignored.
    const during = forecast(cygnus, state, "2026-10-20");
    expect(during.evaluations.find((e) => e.event.id === "global-battles")!.bonus).toBe(0);

    // After it: 8,000 from the campaign + 1,000 bonus, never forfeited.
    const after = forecast(cygnus, state, "2026-11-01");
    const gb = after.evaluations.find((e) => e.event.id === "global-battles")!;
    expect(gb.bonus).toBe(1000);
    expect(gb.forfeited).toEqual({ min: 0, max: 0 });
    expect(after.eventsEarned).toEqual({ min: 9000, max: 9000 });
  });
});

describe("assignment order", () => {
  const gb = cygnus.events.find((e) => e.id === "global-battles");
  if (gb?.kind !== "campaign") throw new Error("global-battles must be a campaign");

  it("locks assignments until the previous one is completed", () => {
    // Assignment 1 at 2 of 3 bounties: 2 and 3 are reset.
    expect(enforceAssignmentOrder(gb.assignments, [2, 2, 1])).toEqual([2, 0, 0]);
    // Assignment 1 completed, 2 at 2 of 3 bounties: 3 stays not started.
    expect(enforceAssignmentOrder(gb.assignments, [3, 2, 2])).toEqual([3, 2, 0]);
    // Assignment 2 at the required 3 bounties unlocks assignment 3 (opaque).
    expect(enforceAssignmentOrder(gb.assignments, [3, 3, 1])).toEqual([3, 3, 1]);
  });

  it("converts progress saved before per-bounty details were known", () => {
    // Assignment 1 was saved as an opaque "completed" (2); it is now detailed.
    const state = normalizeState(cygnus, {
      events: {
        "global-battles": { assignments: [2, 2, 0], assignmentKinds: ["opaque", "detailed", "opaque"] },
      },
    });
    expect(state.events["global-battles"]!.assignments).toEqual([3, 2, 0]);
    expect(state.events["global-battles"]!.assignmentKinds).toEqual(["detailed", "detailed", "opaque"]);
  });

  it("applies the order to saved answers", () => {
    const state = normalizeState(cygnus, { events: { "noise-floor": { assignments: [2, 4, 4, 4] } } });
    expect(state.events["noise-floor"]!.assignments).toEqual([2, 0, 0, 0]);
  });
});
