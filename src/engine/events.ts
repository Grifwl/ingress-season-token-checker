import type { Assignment, DetailedAssignment, EventConfig } from "../series/types";
import { add, exact, sub, type Range } from "./range";
import {
  OPAQUE_COMPLETED,
  OPAQUE_IN_PROGRESS,
  type CampaignPlan,
  type EventState,
} from "./state";

/** Where an event stands relative to the forecast date. */
export type Phase = "upcoming" | "active" | "past";

/** Token figures of one event, derived from its config and the agent's answers. */
export interface EventEvaluation {
  event: EventConfig;
  state: EventState;
  phase: Phase;
  /** Tokens from this event already included in the agent's total. */
  earned: Range;
  /** Tokens still obtainable if the agent goes for it (following the plan). */
  potential: Range;
  /** Part of `potential` the agent has committed to (intent "yes"). */
  committed: Range;
}

/**
 * Classify an event relative to a date.
 *
 * @param event - Event config.
 * @param today - Forecast date (`YYYY-MM-DD`).
 * @returns "upcoming", "active" (today is within its dates) or "past".
 */
export function eventPhase(event: EventConfig, today: string): Phase {
  if (today < event.startDate) return "upcoming";
  if (today > event.endDate) return "past";
  return "active";
}

/**
 * Narrow an assignment to the detailed variant.
 *
 * @param a - Assignment.
 * @returns Whether its bounty breakdown is known.
 */
export function isDetailed(a: Assignment): a is DetailedAssignment {
  return "bounties" in a;
}

/**
 * Total tokens an assignment can grant (all bounties plus the reward).
 *
 * @param a - Assignment.
 * @returns Maximum tokens.
 */
export function assignmentTotal(a: Assignment): number {
  return isDetailed(a) ? a.bounties.reduce((s, b) => s + b, 0) + a.reward : a.total;
}

/**
 * Maximum tokens an event can grant.
 *
 * @param event - Event config.
 * @returns Maximum tokens.
 */
export function eventMaxTokens(event: EventConfig): number {
  switch (event.kind) {
    case "fixed":
      return event.tokens;
    case "campaign":
      return event.assignments.reduce((s, a) => s + assignmentTotal(a), 0);
    case "open":
      return event.maxTokens;
  }
}

/**
 * Tokens granted by `count` bounties out of a list when we do not know which
 * ones were done: the minimum is the `count` cheapest, the maximum the
 * `count` most valuable.
 *
 * @param bounties - Token value of each bounty.
 * @param count - Number of bounties done.
 * @returns Interval of possible token sums.
 */
function bountySum(bounties: number[], count: number): Range {
  const sorted = [...bounties].sort((a, b) => a - b);
  const n = Math.max(0, Math.min(count, sorted.length));
  const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
  return { min: sum(sorted.slice(0, n)), max: sum(sorted.slice(sorted.length - n)) };
}

/**
 * Tokens already earned from one assignment.
 *
 * @param a - Assignment config.
 * @param progress - Bounties done (detailed) or opaque status code.
 * @returns Interval of earned tokens.
 */
export function assignmentEarned(a: Assignment, progress: number): Range {
  if (isDetailed(a)) {
    const done = Math.min(progress, a.bounties.length);
    const reward = done >= a.required ? a.reward : 0;
    return add(bountySum(a.bounties, done), exact(reward));
  }
  if (progress >= OPAQUE_COMPLETED) return exact(a.total);
  // In progress without a breakdown: anything from nothing to almost all.
  if (progress === OPAQUE_IN_PROGRESS) return { min: 0, max: a.total };
  return exact(0);
}

/**
 * Tokens still obtainable from one assignment under a plan.
 *
 * @param a - Assignment config.
 * @param progress - Bounties done (detailed) or opaque status code.
 * @param plan - "full" = every bounty, "minimum" = just enough to complete it.
 * @returns Interval of remaining tokens.
 */
export function assignmentRemaining(a: Assignment, progress: number, plan: CampaignPlan): Range {
  const earned = assignmentEarned(a, progress);
  if (!isDetailed(a)) {
    // Without a breakdown both plans are the same: finish the assignment.
    return progress >= OPAQUE_COMPLETED ? exact(0) : sub(exact(a.total), earned);
  }
  if (plan === "full") return sub(exact(assignmentTotal(a)), earned);

  const done = Math.min(progress, a.bounties.length);
  if (done >= a.required) return exact(0);
  // Which bounties are still pending is unknown, so value the missing ones
  // with the cheapest/most valuable options of the whole list.
  return add(bountySum(a.bounties, a.required - done), exact(a.reward));
}

/**
 * Compute the token figures of one event.
 *
 * @param event - Event config.
 * @param state - Agent's answers for the event.
 * @param today - Forecast date.
 * @returns Earned, potential and committed tokens.
 */
export function evaluateEvent(event: EventConfig, state: EventState, today: string): EventEvaluation {
  const phase = eventPhase(event, today);
  let earned = exact(0);
  let potential = exact(0);

  switch (event.kind) {
    case "fixed":
      // A one-day event can only have been completed once it has started.
      if (phase !== "upcoming" && state.completed) earned = exact(event.tokens);
      else if (phase !== "past") potential = exact(event.tokens);
      break;

    case "campaign":
      if (phase !== "upcoming") {
        earned = add(...event.assignments.map((a, i) => assignmentEarned(a, state.assignments[i] ?? 0)));
      }
      if (phase !== "past") {
        // Upcoming campaigns are evaluated with zero progress regardless of
        // what may be stored, so stale answers cannot inflate the forecast.
        const progressOf = (i: number) => (phase === "upcoming" ? 0 : state.assignments[i] ?? 0);
        potential = add(
          ...event.assignments.map((a, i) => assignmentRemaining(a, progressOf(i), state.plan)),
        );
      }
      break;

    case "open":
      if (phase !== "upcoming") {
        earned = { min: state.earnedMin, max: Math.max(state.earnedMin, state.earnedMax) };
      }
      if (phase !== "past") {
        potential = {
          min: Math.max(0, event.maxTokens - earned.max),
          max: Math.max(0, event.maxTokens - earned.min),
        };
      }
      break;
  }

  return {
    event,
    state,
    phase,
    earned,
    potential,
    committed: state.intent === "yes" ? potential : exact(0),
  };
}
