import type { MedalTier, SeriesConfig } from "../series/types";
import { maxDailyTokens, relaxedDailyTokens, tokensForBounties } from "./bounties";
import { daysBetween } from "./dates";
import { evaluateEvent, type EventEvaluation } from "./events";
import { add, clamp, exact, map, scale, sub, type Range } from "./range";
import type { UserState } from "./state";

/**
 * How many days must be done at the maximum bounty rate to reach a tier,
 * doing only the easy ("relaxed") bounties on the remaining days.
 */
export interface BountyPlan {
  /** Days needed with every bounty, or `null` when bounties are not enough. */
  fullDays: number | null;
  /** Days that can stay at the relaxed rate. */
  relaxedDays: number;
  /** Tokens still missing after doing every bounty every day (0 if feasible). */
  shortfall: number;
}

/** Minimum in-person events needed to reach a tier at a given bounty rate. */
export interface InPersonPlan {
  /** Daily bounties assumed for every remaining day. */
  bountiesPerDay: number;
  /**
   * Events needed per category (empty when none are needed), or `null` when
   * even attending every remaining in-person event is not enough.
   */
  needed: { category: string; count: number }[] | null;
}

/** Outlook for one medal tier. */
export interface TierAnalysis {
  tier: MedalTier;
  /** Already unlocked with the current total. */
  reached: boolean;
  /**
   * Whether the current pace plus committed events gets there: "yes" even in
   * the worst case, "maybe" only in the best case, "no" otherwise, `null`
   * when there is no pace yet (season not started or on its first day).
   */
  atPace: "yes" | "maybe" | "no" | null;
  /** Bounty effort needed with committed events, worst and best case. */
  bountyPlan: { pessimistic: BountyPlan; optimistic: BountyPlan };
  /** In-person events needed at the relaxed and at the maximum bounty rate. */
  inPerson: InPersonPlan[];
}

/**
 * Inconsistency detected in the agent's input. Returned as a code rather than
 * a message so that the UI can translate it.
 */
export type ForecastWarning =
  /** Declared event tokens exceed the current total. */
  | { code: "events-exceed-total" }
  /** The total is higher than bounties and declared events can explain. */
  | { code: "unexplained-tokens"; dailyMax: number };

/** Full result of a forecast. */
export interface Forecast {
  season: "upcoming" | "running" | "over";
  /** Length of the season in days. */
  totalDays: number;
  /** Whole days already elapsed (today excluded). */
  elapsedDays: number;
  /** Days after today until the end of the season. */
  remainingDays: number;
  /** Whether today is a season day whose bounties can still be done. */
  todayInSeason: boolean;
  /** Tokens from the bounties done today. */
  todayTokens: number;
  /** Tokens per day at the relaxed and maximum bounty rates. */
  dailyRelaxed: number;
  dailyMax: number;
  /** Event tokens already included in the current total. */
  eventsEarned: Range;
  /** Tokens obtained from daily bounties before today. */
  pastBountyTokens: Range;
  /** Average daily bounty tokens per elapsed day, `null` without history. */
  averagePerDay: Range | null;
  /** Event tokens still to come from events marked "yes". */
  committedRemaining: Range;
  /** Final total if the pace is kept, `null` without history. */
  projection: Range | null;
  tiers: TierAnalysis[];
  evaluations: EventEvaluation[];
  /** Events marked "maybe" that could still grant tokens. */
  undecided: EventEvaluation[];
  /** Inconsistencies detected in the input. */
  warnings: ForecastWarning[];
}

/**
 * Compute the full forecast for a series.
 *
 * The approach:
 * 1. Event tokens already earned are subtracted from the current total (and
 *    today's bounties) to isolate what came from past daily bounties.
 * 2. Dividing by the elapsed days gives the agent's daily pace.
 * 3. The pace is extended over the remaining days and committed events are
 *    added to project the final total.
 * 4. For every medal tier we also work out how many "maximum bounty" days or
 *    in-person events would be needed if the pace is not enough.
 *
 * Every uncertain figure is an interval, so the output reports worst and
 * best cases instead of a falsely precise number.
 *
 * @param config - Series config.
 * @param state - Agent's answers.
 * @param today - Forecast date (`YYYY-MM-DD`).
 * @returns The forecast.
 */
export function forecast(config: SeriesConfig, state: UserState, today: string): Forecast {
  const bounty = config.dailyBounties;
  const dailyMax = maxDailyTokens(bounty);
  const dailyRelaxed = relaxedDailyTokens(bounty);
  const totalDays = daysBetween(config.startDate, config.endDate) + 1;

  // Position of the forecast date within the season.
  let season: Forecast["season"];
  let elapsedDays: number;
  let remainingDays: number;
  if (today < config.startDate) {
    season = "upcoming";
    elapsedDays = 0;
    remainingDays = totalDays;
  } else if (today > config.endDate) {
    season = "over";
    elapsedDays = totalDays;
    remainingDays = 0;
  } else {
    season = "running";
    elapsedDays = daysBetween(config.startDate, today);
    remainingDays = daysBetween(today, config.endDate);
  }
  const todayInSeason = season === "running";
  const todayTokens = todayInSeason ? tokensForBounties(bounty, state.bountiesToday) : 0;
  const current = state.currentTokens;

  const evaluations = config.events.map((e) =>
    evaluateEvent(e, state.events[e.id] ?? fallbackState(), today),
  );
  // Declared bonuses are already part of the current total, like any other
  // earned event tokens, so they are subtracted along with them.
  const eventsEarned = add(...evaluations.map((e) => add(e.earned, exact(e.bonus))));
  const committedRemaining = add(...evaluations.map((e) => e.committed));
  const undecided = evaluations.filter(
    (e) => !e.awaitingTokens && e.state.intent === "maybe" && e.potential.max > 0,
  );

  // Step 1: tokens attributable to past daily bounties.
  const warnings: ForecastWarning[] = [];
  const rawPast = sub(exact(current - todayTokens), eventsEarned);
  const pastCap = elapsedDays * dailyMax;
  if (rawPast.max < 0) {
    warnings.push({ code: "events-exceed-total" });
  } else if (rawPast.min > pastCap) {
    warnings.push({ code: "unexplained-tokens", dailyMax });
  }
  const pastBountyTokens = clamp(rawPast, 0, pastCap);

  // Step 2: daily pace.
  const averagePerDay = elapsedDays > 0 ? scale(pastBountyTokens, 1 / elapsedDays) : null;

  /**
   * Bounty tokens still to come at a given daily rate: every remaining day
   * plus whatever today's unfinished bounties would add.
   */
  const futureBounties = (rate: Range): Range =>
    add(
      scale(rate, remainingDays),
      todayInSeason ? map(rate, (v) => Math.max(0, v - todayTokens)) : exact(0),
    );

  // Step 3: projection at the current pace.
  const projection = averagePerDay
    ? add(exact(current), futureBounties(averagePerDay), committedRemaining)
    : null;

  // Step 4: per-tier analysis.
  const tiers = config.medals.map((tier): TierAnalysis => {
    let atPace: TierAnalysis["atPace"] = null;
    if (projection) {
      atPace = projection.min >= tier.tokens ? "yes" : projection.max >= tier.tokens ? "maybe" : "no";
    }
    const plan = (committed: number) =>
      bountyPlan({
        target: tier.tokens,
        base: current + committed,
        remainingDays,
        todayInSeason,
        todayTokens,
        dailyRelaxed,
        dailyMax,
      });
    const rates = [...new Set([bounty.relaxedCount, bounty.bountyTokens.length])];
    return {
      tier,
      reached: current >= tier.tokens,
      atPace,
      bountyPlan: { pessimistic: plan(committedRemaining.min), optimistic: plan(committedRemaining.max) },
      inPerson: rates.map((count) => {
        const rate = tokensForBounties(bounty, count);
        return {
          bountiesPerDay: count,
          needed: inPersonNeeded(tier.tokens, current + futureBounties(exact(rate)).min, evaluations),
        };
      }),
    };
  });

  return {
    season,
    totalDays,
    elapsedDays,
    remainingDays,
    todayInSeason,
    todayTokens,
    dailyRelaxed,
    dailyMax,
    eventsEarned,
    pastBountyTokens,
    averagePerDay,
    committedRemaining,
    projection,
    tiers,
    evaluations,
    undecided,
    warnings,
  };
}

/**
 * State used for an event missing from the user's answers. `normalizeState`
 * normally prevents this; it only guards against hand-built states.
 *
 * @returns A neutral state that commits to nothing.
 */
function fallbackState() {
  return {
    intent: "no" as const,
    completed: false,
    attended: false,
    assignments: [],
    assignmentKinds: [],
    plan: "full" as const,
    earnedMin: 0,
    earnedMax: 0,
    bonusReceived: false,
    bonusTokens: 0,
  };
}

/** Inputs of {@link bountyPlan}. */
interface BountyPlanInput {
  target: number;
  /** Current tokens plus committed event tokens. */
  base: number;
  remainingDays: number;
  todayInSeason: boolean;
  todayTokens: number;
  dailyRelaxed: number;
  dailyMax: number;
}

/**
 * Minimum number of maximum-bounty days needed to reach a target, doing the
 * relaxed amount on every other day.
 *
 * Today counts as an available day only while its bounties are not all done;
 * its extra potential can be smaller than a regular day's (some bounties are
 * already done), so regular days are used first.
 *
 * @param input - Target, base tokens and calendar position.
 * @returns The plan.
 */
export function bountyPlan(input: BountyPlanInput): BountyPlan {
  const { target, base, remainingDays, todayInSeason, todayTokens, dailyRelaxed, dailyMax } = input;
  const todayOpen = todayInSeason && todayTokens < dailyMax;
  const daysLeft = remainingDays + (todayOpen ? 1 : 0);

  const relaxedTotal =
    base + dailyRelaxed * remainingDays + (todayInSeason ? Math.max(0, dailyRelaxed - todayTokens) : 0);
  const deficit = target - relaxedTotal;
  if (deficit <= 0) return { fullDays: 0, relaxedDays: daysLeft, shortfall: 0 };

  const dayExtra = dailyMax - dailyRelaxed;
  const todayExtra = todayOpen ? dailyMax - Math.max(dailyRelaxed, todayTokens) : 0;

  if (dayExtra > 0) {
    const n = Math.ceil(deficit / dayExtra);
    if (n <= remainingDays) return { fullDays: n, relaxedDays: daysLeft - n, shortfall: 0 };
  }
  const leftover = deficit - dayExtra * remainingDays;
  if (todayOpen && todayExtra >= leftover) {
    return { fullDays: remainingDays + 1, relaxedDays: 0, shortfall: 0 };
  }
  return { fullDays: null, relaxedDays: 0, shortfall: leftover - todayExtra };
}

/**
 * Minimum in-person events needed to reach a target, assuming every remote
 * event not ruled out ("yes" or "maybe") is completed at its potential and
 * that the tokens of attended events are eventually granted.
 *
 * Events are picked greedily from the most to the least valuable, which
 * minimises the number of trips needed.
 *
 * @param target - Tokens to reach.
 * @param base - Current tokens plus future bounty tokens.
 * @param evaluations - Evaluated events.
 * @returns Count per category, or `null` when it cannot be reached.
 */
export function inPersonNeeded(
  target: number,
  base: number,
  evaluations: EventEvaluation[],
): InPersonPlan["needed"] {
  const open = evaluations.filter((e) => (e.awaitingTokens || e.state.intent !== "no") && e.potential.min > 0);
  // Events already attended and awaiting their tokens are certain, not a
  // trip still to make, so they count towards the base like remote events.
  const certain = (e: EventEvaluation) => !e.event.inPerson || e.awaitingTokens;
  let total = base + open.filter(certain).reduce((s, e) => s + e.potential.min, 0);

  const levers = open.filter((e) => !certain(e)).sort((a, b) => b.potential.min - a.potential.min);
  const counts = new Map<string, number>();
  for (const lever of levers) {
    if (total >= target) break;
    total += lever.potential.min;
    counts.set(lever.event.category, (counts.get(lever.event.category) ?? 0) + 1);
  }
  if (total < target) return null;
  return [...counts].map(([category, count]) => ({ category, count }));
}
