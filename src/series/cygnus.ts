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
 * - https://ingress.com/news/2026-thekeeperswerefirst (Noise Floor details)
 * - https://ingress.com/news/2026-leonids (Leonids: Through the Ages)
 *
 * Global Battles: the post gives the per-assignment totals (1,000 / 2,500 /
 * 4,500). The bounty breakdowns of the three assignments were read in
 * the Dispatch app.
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
            "The top 100 CAT-VI agents of the leaderboard published after the operation get bonus tokens " +
            "(amount not announced; at least one bounty must be claimed). Not counted in the forecast.",
          es:
            "Los 100 mejores agentes CAT-VI de la clasificación publicada tras la operación reciben tokens extra " +
            "(cantidad no anunciada; hay que reclamar al menos un bounty). No se tienen en cuenta en la previsión.",
        },
      },
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
        {
          name: { en: "Assignment 3 (200 battle beacons)", es: "Asignación 3 (200 balizas de batalla)" },
          bounties: [900, 900, 900],
          reward: 1800,
          required: 3,
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
      infoUrl: "https://ingress.com/news/2026-leonids",
      notes: {
        en:
          "Free campaign. Only Stages 1 and 2 grant tokens; Stage 3 (6 missions, 80 upgrades, " +
          "25 drone hacks, 300 destroyed resonators) only grants items. The paid Leonids campaigns " +
          "grant no tokens.",
        es:
          "Campaña gratuita. Solo las etapas 1 y 2 dan tokens; la etapa 3 (6 misiones, 80 mejoras, " +
          "25 hackeos con dron, 300 resonadores destruidos) solo da objetos. Las campañas de pago " +
          "de Leonids no dan tokens.",
      },
      kind: "campaign",
      // Each stage has one assignment of 4 bounties (150 tokens each) that
      // is completed with any 3 of them, granting 400 more tokens.
      assignments: [
        {
          name: {
            en: "Stage 1 (3 unique captures, 70 deploys, 3 drone hacks, 50 destroys)",
            es: "Etapa 1 (3 capturas únicas, 70 despliegues, 3 hackeos con dron, 50 destrucciones)",
          },
          bounties: [150, 150, 150, 150],
          reward: 400,
          required: 3,
        },
        {
          name: {
            en: "Stage 2 (3 unique visits, 20 mods, 8 daily bounties, 15 destroyed mods)",
            es: "Etapa 2 (3 visitas únicas, 20 mods, 8 bounties diarios, 15 mods destruidos)",
          },
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
      kind: "open",
      maxTokens: 2000,
      notes: {
        en: "Assignment details will be published closer to the start date.",
        es: "El detalle de las asignaciones se publicará cerca de la fecha de inicio.",
      },
    },
  ],
};
