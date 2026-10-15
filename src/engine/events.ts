import type { Assignment, DetailedAssignment, EventConfig } from "../series/types";
import { add, exact, sub, type Range } from "./range";
import type { CampaignPlan, EventState } from "./state";

/** Opaque assignment progress values stored in {@link EventState.assignments}. */
export const OPAQUE_NOT_STARTED = 0;
export const OPAQUE_IN_PROGRESS = 1;
export const OPAQUE_COMPLETED = 2;

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
  /**
   * Tokens the agent will not get: what was left unearned in a finished
   * event, the whole remainder of an event marked "no", or the bounties a
   * "minimum" campaign plan skips.
   */
  forfeited: Range;
  /**
   * Bonus tokens the agent declared to have received (see
   * {@link EventConfig.bonus}). Kept out of every other figure: it is never
   * forecast and never counted as forfeited.
   */
  bonus: number;
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
 * Whether an assignment is completed, which unlocks the next one: enough
 * bounties for a detailed assignment, or marked completed for an opaque one.
 *
 * @param a - Assignment config.
 * @param progress - Bounties done (detailed) or opaque status code.
 * @returns `true` when the next assignment is available.
 */
export function isAssignmentComplete(a: Assignment, progress: number): boolean {
  return isDetailed(a) ? progress >= a.required : progress >= OPAQUE_COMPLETED;
}

/**
 * Index of the first assignment that cannot be started yet because the
 * previous one is not completed (campaign assignments unlock in order).
 *
 * @param assignments - Assignment configs.
 * @param progress - Progress per assignment.
 * @returns First locked index, or `assignments.length` if none is locked.
 */
export function firstLockedAssignment(assignments: Assignment[], progress: number[]): number {
  for (let i = 0; i < assignments.length; i++) {
    if (!isAssignmentComplete(assignments[i]!, progress[i] ?? 0)) return i + 1;
  }
  return assignments.length;
}

/**
 * Reset the progress of every locked assignment to "not started". Used both
 * when loading saved answers and after each edit, so lowering an earlier
 * assignment below its completion threshold also clears the later ones.
 *
 * @param assignments - Assignment configs.
 * @param progress - Progress per assignment.
 * @returns A consistent copy of the progress.
 */
export function enforceAssignmentOrder(assignments: Assignment[], progress: number[]): number[] {
  const locked = firstLockedAssignment(assignments, progress);
  return assignments.map((_, i) => (i < locked ? progress[i] ?? 0 : 0));
}

/** How an assignment's progress is recorded: bounty count or status code. */
export type AssignmentKind = "detailed" | "opaque";

/**
 * Kind of an assignment config.
 *
 * @param a - Assignment config.
 * @returns "detailed" when its bounties are known, "opaque" otherwise.
 */
export function assignmentKind(a: Assignment): AssignmentKind {
  return isDetailed(a) ? "detailed" : "opaque";
}

/**
 * Translate saved progress when the config of an assignment has changed
 * kind since it was saved. This happens whenever per-bounty details get
 * published for a campaign: a stored "completed" status must not be read as
 * "2 bounties done".
 *
 * @param a - Current assignment config.
 * @param progress - Saved progress value.
 * @param savedKind - Kind the value was recorded with.
 * @returns Progress expressed for the current kind.
 */
export function convertAssignmentProgress(a: Assignment, progress: number, savedKind: AssignmentKind): number {
  if (isDetailed(a)) {
    if (savedKind === "detailed") return Math.min(progress, a.bounties.length);
    // A completed assignment had at least the required bounties done; how
    // many more is unknown, so assume the minimum and let the agent adjust.
    return progress >= OPAQUE_COMPLETED ? a.required : 0;
  }
  if (savedKind === "opaque") return Math.min(progress, OPAQUE_COMPLETED);
  // Bounties were counted but the requirement is no longer known.
  return progress > 0 ? OPAQUE_IN_PROGRESS : OPAQUE_NOT_STARTED;
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
 * Tokens of one assignment that a plan deliberately leaves behind: with the
 * "minimum" plan, the bounties beyond the required ones are never done.
 *
 * @param a - Assignment config.
 * @param progress - Bounties done (detailed) or opaque status code.
 * @param plan - Plan for the rest of the assignment.
 * @returns Interval of tokens that will not be earned.
 */
export function assignmentForfeited(a: Assignment, progress: number, plan: CampaignPlan): Range {
  // Opaque assignments cannot be partially skipped as far as we know.
  if (plan === "full" || !isDetailed(a)) return exact(0);
  const done = Math.min(progress, a.bounties.length);
  // Once the assignment is complete the agent stops; before that, only the
  // required bounties will be done.
  const skipped = a.bounties.length - Math.max(done, a.required);
  return bountySum(a.bounties, skipped);
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
  // Tokens the chosen campaign plan leaves behind even if the event is done.
  let planLoss = exact(0);

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
        planLoss = add(
          ...event.assignments.map((a, i) => assignmentForfeited(a, progressOf(i), state.plan)),
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

  let forfeited = planLoss;
  if (phase === "past") forfeited = sub(exact(eventMaxTokens(event)), earned);
  else if (state.intent === "no") forfeited = add(potential, planLoss);

  return {
    event,
    state,
    phase,
    earned,
    potential,
    committed: state.intent === "yes" ? potential : exact(0),
    forfeited,
    bonus: eventBonus(event, state, phase),
  };
}

/**
 * Bonus tokens declared for an event. A bonus is only granted once the event
 * is over, so answers stored for an event that has not finished yet (e.g.
 * after moving the forecast date back) are ignored.
 *
 * @param event - Event config.
 * @param state - Agent's answers for the event.
 * @param phase - Phase of the event at the forecast date.
 * @returns Declared bonus tokens, 0 when none.
 */
export function eventBonus(event: EventConfig, state: EventState, phase: Phase): number {
  return event.bonus && phase === "past" && state.bonusReceived ? state.bonusTokens : 0;
}
