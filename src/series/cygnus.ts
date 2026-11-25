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
  base: {
    idPrefix: string;
    name: { en: string; es: string };
    category: string;
    tokens: number;
    tokensGrantedLater?: boolean;
    infoUrl?: string;
    notes?: { en: string; es: string };
  },
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
    tokensGrantedLater: base.tokensGrantedLater,
    infoUrl: base.infoUrl,
    notes: base.notes,
  }));
}

/**
 * Cygnus anomaly season (1 October – 31 December 2026).
 *
 * Sources:
 * - https://ingress.com/news/2026-cygnus
 * - https://ingress.com/news/2026-cygnus-shardstorm
 * - https://ingress.com/news/2026-cygnus-globalbattles
 * - https://ingress.com/news/2026-cygnus-globaldeploy
 * - https://ingress.com/news/2026-thekeeperswerefirst (Noise Floor details)
 * - https://ingress.com/news/2026-leonids (Leonids: Through the Ages)
 * - https://ingress.com/news/2026-crystalhorizon (Crystal Horizon)
 *
 * Global Battles: the post gives the per-assignment totals (1,000 / 2,500 /
 * 4,500). The bounty breakdowns of the three assignments were read in
 * the Dispatch app.
 *
 * Global Deploy: the post gives each Stage 1 assignment's Reso Point
 * threshold and its tokens (2,000 / 2,000 / 4,000), but not how they are
 * split between its bounties and its completion reward. The bounty
 * breakdowns of the three assignments were read in Dispatch once the
 * campaign started.
 */
export const cygnus: SeriesConfig = {
  id: "cygnus",
  name: "Cygnus",
  tokenName: { en: "Cygnus Tokens", es: "Cygnus Tokens" },
  infoUrl: "https://ingress.com/news/2026-cygnus",
  startDate: "2026-10-01",
  endDate: "2026-12-31",
  medals: [
    { name: { en: "Bronze", es: "Bronce" }, tokens: 6000, metal: "bronze" },
    { name: { en: "Silver", es: "Plata" }, tokens: 12000, metal: "silver" },
    { name: { en: "Gold", es: "Oro" }, tokens: 24000, metal: "gold" },
  ],
  dailyBounties: {
    // 4 free bounties (10 / 30 / 40 / 60 tokens a day) plus 4 paid ones
    // worth 10 tokens each (70 / 80 / 90 / 100).
    bountyTokens: [10, 10, 10, 10, 10, 10, 10, 10],
    milestones: [
      { afterBounties: 2, tokens: 10 },
      { afterBounties: 4, tokens: 10 },
    ],
    relaxedCount: 3,
    freeCount: 4,
    // Prices as of October 2026, as seen in the game store.
    unlockPricing: {
      packs: [
        { days: 1, cmu: 1500 },
        { days: 3, cmu: 3500 },
        { days: 7, cmu: 7000 },
      ],
      cmuStore: [
        { cmu: 2500, eur: 2.09 },
        { cmu: 7000, eur: 4.99 },
        { cmu: 15000, eur: 9.99 },
        { cmu: 32000, eur: 20.99 },
        { cmu: 90000, eur: 49.99 },
        { cmu: 200000, eur: 104.99 },
      ],
      core: { cmu: 10000, eur: 9.99 },
    },
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
    // First Saturdays: 2,500 tokens for checking in, once per month. The
    // tokens are granted some days after the event.
    ...oneDayEvents(
      {
        idPrefix: "fs",
        name: { en: "First Saturday", es: "First Saturday" },
        category: "first-saturday",
        tokens: 2500,
        tokensGrantedLater: true,
      },
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
        infoUrl: "https://ingress.com/news/2026-cygnus-shardstorm",
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
      infoUrl: "https://ingress.com/news/2026-cygnus-globalbattles",
      bonus: {
        name: { en: "Top 100 CAT-VI bonus", es: "Bonus del top 100 CAT-VI" },
        note: {
          en:
            "Each of the top 100 CAT-VI agents of the leaderboard published after the operation " +
            "was awarded 13,310 bonus tokens. Not counted in the forecast.",
          es:
            "Cada uno de los 100 mejores agentes CAT-VI de la clasificación publicada tras la operación " +
            "recibió 13.310 tokens extra. No se tienen en cuenta en la previsión.",
        },
        // Announced in https://ingress.com/news/2026-cygnus-globalbattles-top100
        tokens: 13310,
      },
      kind: "campaign",
      assignments: [
        {
          name: { en: "Assignment 1 (5 battle beacons)", es: "Asignación 1 (5 balizas de batalla)" },
          bounties: [200, 200, 200],
          reward: 400,
          required: 3,
          ordered: true,
        },
        {
          name: { en: "Assignment 2 (50 battle beacons)", es: "Asignación 2 (50 balizas de batalla)" },
          bounties: [500, 500, 500],
          reward: 1000,
          required: 3,
          ordered: true,
        },
        {
          name: { en: "Assignment 3 (200 battle beacons)", es: "Asignación 3 (200 balizas de batalla)" },
          bounties: [900, 900, 900],
          reward: 1800,
          required: 3,
          ordered: true,
        },
      ],
    },
    {
      id: "global-deploy",
      name: "Cygnus Global Deploy",
      category: "global-op",
      startDate: "2026-11-25",
      endDate: "2026-12-16",
      inPerson: false,
      infoUrl: "https://ingress.com/news/2026-cygnus-globaldeploy",
      notes: {
        en:
          "Only Stage 1 grants tokens; Stages 2 and 3 only grant items. " +
          "Reso Point thresholds are shown for reference only: this site cannot track them.",
        es:
          "Solo la etapa 1 da tokens; las etapas 2 y 3 solo dan objetos. " +
          "Los umbrales de Reso Points son solo orientativos: esta web no puede seguirlos.",
      },
      kind: "campaign",
      // Stage 1: three assignments, each one reached at a Reso Point
      // threshold (8,000 tokens together). Their bounties are themselves
      // Reso Point thresholds, up to the assignment's own.
      assignments: [
        {
          name: { en: "Bronze tier (500 Reso Points)", es: "Nivel Bronce (500 Reso Points)" },
          // Read in Dispatch on 2026-11-25: 150 / 300 / 500 Reso Points.
          bounties: [250, 250, 500],
          reward: 1000,
          required: 3,
          ordered: true,
        },
        {
          name: { en: "Silver tier (2,500 Reso Points)", es: "Nivel Plata (2.500 Reso Points)" },
          // Read in Dispatch on 2026-11-25: 1,200 / 1,800 / 2,500 Reso Points.
          bounties: [250, 250, 500],
          reward: 1000,
          required: 3,
          ordered: true,
        },
        {
          name: { en: "Gold tier (5,000 Reso Points)", es: "Nivel Oro (5.000 Reso Points)" },
          // Read in Dispatch on 2026-11-25: 3,300 / 4,200 / 5,000 Reso Points.
          bounties: [500, 500, 1000],
          reward: 2000,
          required: 3,
          ordered: true,
        },
      ],
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
      infoUrl: "https://ingress.com/news/2026-leonids",
      notes: {
        en: "Only Stages 1 and 2 grant tokens; Stage 3 only grants items.",
        es: "Solo las etapas 1 y 2 dan tokens; la etapa 3 solo da objetos.",
      },
      kind: "campaign",
      // Each stage has one assignment of 4 bounties (150 tokens each) that
      // is completed with any 3 of them, granting 400 more tokens.
      assignments: [
        {
          name: { en: "Stage 1", es: "Etapa 1" },
          bounties: [150, 150, 150, 150],
          reward: 400,
          required: 3,
        },
        {
          name: { en: "Stage 2", es: "Etapa 2" },
          bounties: [150, 150, 150, 150],
          reward: 400,
          required: 3,
        },
      ],
    },
    {
      id: "crystal-horizon",
      name: "Operation Crystal Horizon",
      category: "dispatch",
      startDate: "2026-12-02",
      endDate: "2026-12-21",
      inPerson: false,
      infoUrl: "https://ingress.com/news/2026-crystalhorizon",
      notes: {
        en:
          "Only Stages 1 and 2 grant tokens; Stages 3 and 4 only grant items. " +
          "Stage 2 starts after restarting the campaign.",
        es:
          "Solo las etapas 1 y 2 dan tokens; las etapas 3 y 4 solo dan objetos. " +
          "La etapa 2 empieza al reiniciar la campaña.",
      },
      kind: "campaign",
      // Each stage has four assignments, done one after the other, and
      // each completed assignment grants 250 tokens (its bounties grant
      // none, so they are left out). A stage is therefore modelled as one
      // entry whose steps are its assignments, all of them required and in
      // order, and Stage 2 stays locked until Stage 1 is completed.
      assignments: [
        {
          name: { en: "Stage 1", es: "Etapa 1" },
          bounties: [250, 250, 250, 250],
          reward: 0,
          required: 4,
          ordered: true,
          steps: "assignments",
        },
        {
          name: { en: "Stage 2", es: "Etapa 2" },
          bounties: [250, 250, 250, 250],
          reward: 0,
          required: 4,
          ordered: true,
          steps: "assignments",
        },
      ],
    },
  ],
};
