/**
 * Data model describing an Ingress anomaly season ("series").
 *
 * Everything that changes from one series to the next lives in a value of
 * type {@link SeriesConfig}: dates, medal thresholds, how daily bounties are
 * rewarded and every event that grants tokens. The forecasting engine never
 * hardcodes any of these numbers, so supporting a new series only requires
 * writing a new config file and registering it in `src/series/index.ts`.
 *
 * All dates are calendar dates in ISO format (`YYYY-MM-DD`) and every range
 * of dates is inclusive on both ends.
 */

/**
 * Text shown to users: either a plain string (same in every language) or a
 * map of language code to translation. English is mandatory and is used as
 * the fallback for any missing translation.
 */
export type LocalizedText = string | { en: string; es?: string };

/** One tier of the season medal, e.g. Bronze / Silver / Gold. */
export interface MedalTier {
  /** Display name of the tier. */
  name: LocalizedText;
  /** Tokens needed to unlock the tier. */
  tokens: number;
}

/** Extra tokens granted once a given number of daily bounties is reached. */
export interface BountyMilestone {
  /** Number of daily bounties that must be completed to get the bonus. */
  afterBounties: number;
  /** Bonus tokens granted for the milestone. */
  tokens: number;
}

/**
 * Daily Research Bounty rewards.
 *
 * Usually 4 bounties of 10 tokens with a 10-token bonus after the 2nd and the
 * 4th (10 + 20 + 10 + 20 = 60 per day), but it is configurable per series.
 */
export interface DailyBountyConfig {
  /** Tokens granted by each bounty, in completion order. */
  bountyTokens: number[];
  /** Bonus milestones reached after completing a number of bounties. */
  milestones: BountyMilestone[];
  /**
   * Number of bounties considered "easy" (doable every day without leaving
   * home). It is the baseline rate used for "relaxed" days.
   */
  relaxedCount: number;
}

/** Grouping of events, used for display and for the in-person planner. */
export interface EventCategory {
  /** Identifier referenced by {@link EventBase.category}. */
  id: string;
  /** Singular label, e.g. "First Saturday". */
  label: LocalizedText;
  /** Plural label, e.g. "First Saturdays". */
  pluralLabel: LocalizedText;
}

/** Fields shared by every kind of token-granting event. */
interface EventBase {
  /** Stable identifier, used as the key of the user's saved answers. */
  id: string;
  /** Display name. */
  name: LocalizedText;
  /** Id of an {@link EventCategory}. */
  category: string;
  /** First day of the event. */
  startDate: string;
  /** Last day of the event (same as `startDate` for one-day events). */
  endDate: string;
  /** Whether attending requires being physically at a site. */
  inPerson: boolean;
  /** Link to the official announcement. */
  infoUrl?: string;
  /** Free text shown to the user (caveats, assumptions...). */
  notes?: LocalizedText;
}

/** An all-or-nothing event, such as checking in at a First Saturday. */
export interface FixedEvent extends EventBase {
  kind: "fixed";
  /** Tokens granted for taking part. */
  tokens: number;
}

/**
 * A Dispatch campaign whose assignment structure is (at least partially)
 * known, so progress can be converted into tokens.
 */
export interface CampaignEvent extends EventBase {
  kind: "campaign";
  /** Assignments in completion order. */
  assignments: Assignment[];
}

/**
 * An event for which only the maximum is known (e.g. a campaign whose details
 * have not been published yet). The user reports earned tokens directly.
 */
export interface OpenEvent extends EventBase {
  kind: "open";
  /** Maximum tokens obtainable from the event. */
  maxTokens: number;
}

/** Any token-granting event. */
export type EventConfig = FixedEvent | CampaignEvent | OpenEvent;

/**
 * An assignment whose bounties and completion reward are known.
 *
 * Each completed bounty grants its tokens, and the assignment reward is
 * granted once `required` bounties are done (often 3 of 4, so skipping the
 * 4th bounty leaves tokens on the table).
 */
export interface DetailedAssignment {
  name: LocalizedText;
  /** Tokens granted by each bounty. */
  bounties: number[];
  /** Tokens granted when the assignment is completed. */
  reward: number;
  /** Number of bounties needed to complete the assignment. */
  required: number;
  /** Caveats about this assignment's figures. */
  note?: LocalizedText;
}

/**
 * An assignment of which only the total (bounties + reward) is known. The
 * user can only say whether it is not started, in progress or completed, and
 * the page flags it as lacking per-bounty details.
 */
export interface OpaqueAssignment {
  name: LocalizedText;
  /** Total tokens granted by the assignment, bounties included. */
  total: number;
  /** Caveats about this assignment's figures. */
  note?: LocalizedText;
}

/** Any assignment of a {@link CampaignEvent}. */
export type Assignment = DetailedAssignment | OpaqueAssignment;

/** Complete description of a season. */
export interface SeriesConfig {
  /** URL slug, e.g. "cygnus" for `/cygnus`. */
  id: string;
  /** Display name, e.g. "Cygnus". */
  name: string;
  /** Name of the season currency, e.g. "Cygnus Tokens". */
  tokenName: LocalizedText;
  /** Link to the official season announcement. */
  infoUrl: string;
  /** First day of the season. */
  startDate: string;
  /** Last day of the season. */
  endDate: string;
  /** Medal tiers, sorted by ascending token threshold. */
  medals: MedalTier[];
  dailyBounties: DailyBountyConfig;
  categories: EventCategory[];
  events: EventConfig[];
}
