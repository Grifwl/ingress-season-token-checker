import type { EventConfig, SeriesConfig } from "./types";

/**
 * Build the one-day, all-or-nothing events of a category (First Saturdays,
 * Shard Storms...). Each date becomes its own event, so agents can answer
 * for every occurrence separately.
 *
 * @param base - Fields shared by every occurrence.
 * @param occurrences - Id suffix, English and Spanish date label, ISO date.
 * @returns One fixed event per occurrence.
 */
function oneDayEvents(
  base: { idPrefix: string; name: { en: string; es: string }; category: string; tokens: number; notes?: { en: string; es: string } },
  occurrences: [string, string, string, string][],
): EventConfig[] {
  return occurrences.map(([suffix, en, es, date]) => ({
    id: `${base.idPrefix}-${suffix}`,
    name: { en: `${base.name.en} – ${en}`, es: `${base.name.es} – ${es}` },
    category: base.category,
    startDate: date,
    endDate: date,
    inPerson: true,
    kind: "fixed",
    tokens: base.tokens,
    notes: base.notes,
  }));
}

/**
 * Cygnus anomaly season (1 October – 31 December 2026).
 *
 * Sources:
 * - https://ingress.com/news/2026-cygnus
 * - https://ingress.com/news/2026-thekeeperswerefirst (Noise Floor details)
 *
 * Global Battles: the page only states 8,000 tokens over 3 assignments. The
 * per-assignment totals and the breakdowns of assignments 1 and 2 were read
 * in the Dispatch app; assignment 3 has no per-bounty details yet.
 */
export const cygnus: SeriesConfig = {
  id: "cygnus",
  name: "Cygnus",
  tokenName: { en: "Cygnus Tokens", es: "Cygnus Tokens" },
  infoUrl: "https://ingress.com/news/2026-cygnus",
  startDate: "2026-10-01",
  endDate: "2026-12-31",
  medals: [
    { name: { en: "Bronze", es: "Bronce" }, tokens: 6000 },
    { name: { en: "Silver", es: "Plata" }, tokens: 12000 },
    { name: { en: "Gold", es: "Oro" }, tokens: 24000 },
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
    {
      id: "global-op",
      label: { en: "Global campaign", es: "Campaña global" },
      pluralLabel: { en: "Global campaigns", es: "Campañas globales" },
    },
    {
      id: "dispatch",
      label: { en: "Dispatch operation", es: "Operación de Dispatch" },
      pluralLabel: { en: "Dispatch operations", es: "Operaciones de Dispatch" },
    },
  ],
  events: [
    // First Saturdays: 2,500 tokens for checking in, once per month.
    ...oneDayEvents(
      { idPrefix: "fs", name: { en: "First Saturday", es: "First Saturday" }, category: "first-saturday", tokens: 2500 },
      [
        ["oct", "October", "octubre", "2026-10-03"],
        ["nov", "November", "noviembre", "2026-11-07"],
        ["dec", "December", "diciembre", "2026-12-05"],
      ],
    ),

    // Shard Storms: three separate days, each one worth 2,500 tokens, but
    // only for agents attending in person.
    ...oneDayEvents(
      {
        idPrefix: "ss",
        name: { en: "Shard Storm", es: "Shard Storm" },
        category: "shard-storm",
        tokens: 2500,
        notes: {
          en: "Tokens are only granted to agents attending in person.",
          es: "Solo los agentes que asisten en persona reciben tokens.",
        },
      },
      [
        ["oct-17", "17 October", "17 de octubre", "2026-10-17"],
        ["oct-24", "24 October", "24 de octubre", "2026-10-24"],
        ["nov-21", "21 November", "21 de noviembre", "2026-11-21"],
      ],
    ),

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
        {
          name: { en: "Assignment 1 (5 battle beacons)", es: "Asignación 1 (5 balizas de batalla)" },
          bounties: [200, 200, 200],
          reward: 400,
          required: 3,
        },
        {
          name: { en: "Assignment 2 (50 battle beacons)", es: "Asignación 2 (50 balizas de batalla)" },
          bounties: [500, 500, 500],
          reward: 1000,
          required: 3,
        },
        { name: { en: "Assignment 3 (200 battle beacons)", es: "Asignación 3 (200 balizas de batalla)" }, total: 4500 },
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
      notes: {
        en: "3 assignments; per-assignment details not published yet.",
        es: "3 asignaciones; aún no se ha publicado el detalle de cada una.",
      },
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
        { name: { en: "Assignment 1", es: "Asignación 1" }, bounties: [30, 30, 30, 30], reward: 80, required: 3 },
        { name: { en: "Assignment 2", es: "Asignación 2" }, bounties: [60, 60, 60, 60], reward: 160, required: 3 },
        { name: { en: "Assignment 3", es: "Asignación 3" }, bounties: [90, 90, 90, 90], reward: 240, required: 3 },
        { name: { en: "Assignment 4", es: "Asignación 4" }, bounties: [120, 120, 120, 120], reward: 320, required: 3 },
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
      notes: {
        en: "Assignment details will be published closer to the start date.",
        es: "El detalle de las asignaciones se publicará cerca de la fecha de inicio.",
      },
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
      notes: {
        en: "Assignment details will be published closer to the start date.",
        es: "El detalle de las asignaciones se publicará cerca de la fecha de inicio.",
      },
    },
  ],
};
