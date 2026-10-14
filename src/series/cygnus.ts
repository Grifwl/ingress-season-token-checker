import type { SeriesConfig } from "./types";

/**
 * Cygnus anomaly season (1 October – 31 December 2026).
 *
 * Sources:
 * - https://ingress.com/news/2026-cygnus
 * - https://ingress.com/news/2026-thekeeperswerefirst (Noise Floor details)
 *
 * The Global Battles breakdown is only partially official: the page states
 * 8,000 tokens over 3 assignments, and the per-assignment totals were read in
 * the Dispatch app. Refine these values as more information is published.
 */
export const cygnus: SeriesConfig = {
  id: "cygnus",
  name: "Cygnus",
  tokenName: "Cygnus Tokens",
  infoUrl: "https://ingress.com/news/2026-cygnus",
  startDate: "2026-10-01",
  endDate: "2026-12-31",
  medals: [
    { name: "Bronze", tokens: 6000 },
    { name: "Silver", tokens: 12000 },
    { name: "Gold", tokens: 24000 },
  ],
  dailyBounties: {
    bountyTokens: [10, 10, 10, 10],
    milestones: [
      { afterBounties: 2, tokens: 10 },
      { afterBounties: 4, tokens: 10 },
    ],
    relaxedCount: 3,
  },
  categories: [
    { id: "first-saturday", label: "First Saturday", pluralLabel: "First Saturdays" },
    { id: "shard-storm", label: "Shard Storm", pluralLabel: "Shard Storms" },
    { id: "global-op", label: "Global campaign", pluralLabel: "Global campaigns" },
    { id: "dispatch", label: "Dispatch operation", pluralLabel: "Dispatch operations" },
  ],
  events: [
    // First Saturdays: 2,500 tokens for checking in, once per month.
    ...[
      ["fs-oct", "First Saturday – October", "2026-10-03"],
      ["fs-nov", "First Saturday – November", "2026-11-07"],
      ["fs-dec", "First Saturday – December", "2026-12-05"],
    ].map(([id, name, date]) => ({
      id: id!,
      name: name!,
      category: "first-saturday",
      startDate: date!,
      endDate: date!,
      inPerson: true,
      kind: "fixed" as const,
      tokens: 2500,
    })),

    // Shard Storms: in-person only; remote participation grants no tokens.
    ...[
      ["ss-oct-17", "Shard Storm – 17 October", "2026-10-17"],
      ["ss-oct-24", "Shard Storm – 24 October", "2026-10-24"],
      ["ss-nov-21", "Shard Storm – 21 November", "2026-11-21"],
    ].map(([id, name, date]) => ({
      id: id!,
      name: name!,
      category: "shard-storm",
      startDate: date!,
      endDate: date!,
      inPerson: true,
      kind: "fixed" as const,
      tokens: 2500,
      notes: "Tokens are only granted to agents attending in person.",
    })),

    {
      id: "global-battles",
      name: "Cygnus Global Battles",
      category: "global-op",
      startDate: "2026-10-01",
      endDate: "2026-10-28",
      inPerson: false,
      infoUrl: "https://ingress.com/news/2026-cygnus",
      kind: "campaign",
      assignments: [
        { name: "Assignment 1", total: 1000 },
        {
          name: "Assignment 2 (50 battle beacons)",
          bounties: [500, 500, 500],
          reward: 1000,
          required: 3,
          note:
            "Breakdown inferred: only the 1,000 assignment reward and the last " +
            "500-token bounty are visible in the app.",
        },
        { name: "Assignment 3", total: 4500 },
      ],
    },
    {
      id: "global-deploy",
      name: "Cygnus Global Deploy",
      category: "global-op",
      startDate: "2026-11-25",
      endDate: "2026-12-16",
      inPerson: false,
      infoUrl: "https://ingress.com/news/2026-cygnus",
      kind: "open",
      maxTokens: 8000,
      notes: "3 assignments; per-assignment breakdown not published yet.",
    },
    {
      id: "noise-floor",
      name: "Noise Floor (Día de los Muertos)",
      category: "dispatch",
      startDate: "2026-10-12",
      endDate: "2026-11-11",
      inPerson: false,
      infoUrl: "https://ingress.com/news/2026-thekeeperswerefirst",
      kind: "campaign",
      assignments: [
        { name: "Assignment 1", bounties: [30, 30, 30, 30], reward: 80, required: 3 },
        { name: "Assignment 2", bounties: [60, 60, 60, 60], reward: 160, required: 3 },
        { name: "Assignment 3", bounties: [90, 90, 90, 90], reward: 240, required: 3 },
        { name: "Assignment 4", bounties: [120, 120, 120, 120], reward: 320, required: 3 },
      ],
    },
    {
      id: "leonids",
      name: "Leonids: Through the Ages",
      category: "dispatch",
      startDate: "2026-11-05",
      endDate: "2026-11-30",
      inPerson: false,
      kind: "open",
      maxTokens: 2000,
      notes: "Assignment details will be published closer to the start date.",
    },
    {
      id: "crystal-horizon",
      name: "Operation Crystal Horizon",
      category: "dispatch",
      startDate: "2026-12-02",
      endDate: "2026-12-21",
      inPerson: false,
      kind: "open",
      maxTokens: 2000,
      notes: "Assignment details will be published closer to the start date.",
    },
  ],
};
