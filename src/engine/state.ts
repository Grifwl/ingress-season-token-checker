import type { EventConfig, SeriesConfig } from "../series/types";
import { enforceAssignmentOrder } from "./events";

/** What the agent intends to do about the not-yet-earned part of an event. */
export type Intent = "yes" | "maybe" | "no";

/**
 * For campaigns: whether the agent plans to complete every bounty ("full") or
 * just the bounties needed to complete each assignment ("minimum").
 */
export type CampaignPlan = "full" | "minimum";

/** The agent's answers about one event. */
export interface EventState {
  /** Intention for whatever is still obtainable. */
  intent: Intent;
  /** Fixed events: tokens already granted (checked in). */
  completed: boolean;
  /**
   * Campaign events, one entry per assignment. For detailed assignments it is
   * the number of bounties done; for opaque ones it is 0 = not started,
   * 1 = in progress, 2 = completed.
   */
  assignments: number[];
  /** Campaign events: how the remaining assignments will be done. */
  plan: CampaignPlan;
  /** Open events: lower estimate of tokens earned so far. */
  earnedMin: number;
  /** Open events: upper estimate of tokens earned so far. */
  earnedMax: number;
}

/** Everything the agent has entered for one series. */
export interface UserState {
  /** Season tokens the agent currently holds. */
  currentTokens: number;
  /** Daily bounties completed today (already included in currentTokens). */
  bountiesToday: number;
  /** Answers keyed by event id. */
  events: Record<string, EventState>;
}

/**
 * Default answers for an event. Remote events default to "yes" because they
 * can be done from anywhere; in-person ones default to "maybe" so that the
 * forecast does not silently assume the agent will travel.
 *
 * @param event - Event config.
 * @returns A fresh state.
 */
export function defaultEventState(event: EventConfig): EventState {
  return {
    intent: event.inPerson ? "maybe" : "yes",
    completed: false,
    assignments: event.kind === "campaign" ? event.assignments.map(() => 0) : [],
    plan: "full",
    earnedMin: 0,
    earnedMax: 0,
  };
}

/**
 * Build a valid state from untrusted data (e.g. read back from storage),
 * falling back to defaults for anything missing or malformed. This keeps
 * saved answers working even after a config gains or loses events.
 *
 * @param config - Series config.
 * @param raw - Previously saved value, or anything else.
 * @returns A complete, well-formed state.
 */
export function normalizeState(config: SeriesConfig, raw: unknown): UserState {
  const obj = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const num = (v: unknown, fallback = 0) =>
    typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : fallback;
  const rawEvents = (typeof obj.events === "object" && obj.events !== null ? obj.events : {}) as Record<
    string,
    Record<string, unknown> | undefined
  >;

  const events: Record<string, EventState> = {};
  for (const event of config.events) {
    const def = defaultEventState(event);
    const saved = rawEvents[event.id] ?? {};
    const savedAssignments = Array.isArray(saved.assignments) ? saved.assignments : [];
    events[event.id] = {
      intent: saved.intent === "yes" || saved.intent === "maybe" || saved.intent === "no" ? saved.intent : def.intent,
      completed: typeof saved.completed === "boolean" ? saved.completed : def.completed,
      assignments:
        event.kind === "campaign"
          ? enforceAssignmentOrder(event.assignments, def.assignments.map((d, i) => num(savedAssignments[i], d)))
          : [],
      plan: saved.plan === "minimum" ? "minimum" : "full",
      earnedMin: num(saved.earnedMin),
      earnedMax: num(saved.earnedMax),
    };
  }

  return {
    currentTokens: num(obj.currentTokens),
    bountiesToday: Math.min(num(obj.bountiesToday), config.dailyBounties.bountyTokens.length),
    events,
  };
}
