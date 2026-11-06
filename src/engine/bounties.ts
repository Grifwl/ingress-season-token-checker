import type { DailyBountyConfig } from "../series/types";

/**
 * Tokens obtained in one day by completing a number of daily bounties,
 * including the milestone bonuses reached.
 *
 * @param cfg - Daily bounty rewards of the series.
 * @param count - Bounties completed that day.
 * @returns Tokens earned that day from daily bounties.
 *
 * @example
 * // Standard 10/10/10/10 with +10 after the 2nd and 4th:
 * tokensForBounties(cfg, 3); // 40
 */
export function tokensForBounties(cfg: DailyBountyConfig, count: number): number {
  const n = Math.max(0, Math.min(count, cfg.bountyTokens.length));
  const base = cfg.bountyTokens.slice(0, n).reduce((a, b) => a + b, 0);
  const bonus = cfg.milestones
    .filter((m) => m.afterBounties <= n)
    .reduce((a, m) => a + m.tokens, 0);
  return base + bonus;
}

/**
 * Maximum tokens obtainable per day from daily bounties, paid ones included.
 *
 * @param cfg - Daily bounty rewards of the series.
 * @returns Tokens for completing every bounty.
 */
export function maxDailyTokens(cfg: DailyBountyConfig): number {
  return tokensForBounties(cfg, cfg.bountyTokens.length);
}

/**
 * Maximum tokens obtainable per day from the free daily bounties.
 *
 * @param cfg - Daily bounty rewards of the series.
 * @returns Tokens for completing `freeCount` bounties.
 */
export function freeDailyTokens(cfg: DailyBountyConfig): number {
  return tokensForBounties(cfg, cfg.freeCount);
}

/**
 * Tokens per day on a "relaxed" day (only the easy bounties).
 *
 * @param cfg - Daily bounty rewards of the series.
 * @returns Tokens for completing `relaxedCount` bounties.
 */
export function relaxedDailyTokens(cfg: DailyBountyConfig): number {
  return tokensForBounties(cfg, cfg.relaxedCount);
}

/**
 * A daily bounty pace expressed as a mix of two neighbouring bounty counts.
 *
 * Only the tokens are known, not how many bounties were done on each day,
 * so this is an *equivalent* mix: the same tokens could also come from
 * other combinations (e.g. some days with fewer bounties and some with more).
 */
export interface PaceBreakdown {
  /**
   * Equivalent bounties a day, interpolated between `lower` and `upper` by
   * tokens (not by bounties, since milestones make the token curve uneven).
   */
  bounties: number;
  /** Largest bounty count whose daily tokens do not exceed the pace. */
  lower: number;
  /** Next bounty count (equal to `lower` at the maximum). */
  upper: number;
  /** Days at `upper` bounties in the equivalent mix. */
  upperDays: number;
  /** Days at `lower` bounties in the equivalent mix. */
  lowerDays: number;
}

/**
 * Break a daily bounty pace down into a mix of two neighbouring bounty
 * counts over a number of days.
 *
 * Days at the higher count are rounded down, so the mix never claims more
 * bounties than the tokens can explain.
 *
 * @param cfg - Daily bounty rewards of the series.
 * @param perDay - Average daily bounty tokens.
 * @param days - Days the average was taken over.
 * @returns The equivalent mix.
 *
 * @example
 * // 1,880 tokens over 36 days with the standard rewards (40 = 3, 60 = 4):
 * paceBreakdown(cfg, 1880 / 36, 36);
 * // { bounties: 3.61, lower: 3, upper: 4, upperDays: 22, lowerDays: 14 }
 */
export function paceBreakdown(cfg: DailyBountyConfig, perDay: number, days: number): PaceBreakdown {
  const max = cfg.bountyTokens.length;
  // A tiny tolerance absorbs floating point noise from the average.
  const eps = 1e-9;
  let lower = 0;
  while (lower < max && tokensForBounties(cfg, lower + 1) <= perDay + eps) lower++;
  if (lower === max) return { bounties: max, lower: max, upper: max, upperDays: days, lowerDays: 0 };

  const upper = lower + 1;
  const lo = tokensForBounties(cfg, lower);
  const hi = tokensForBounties(cfg, upper);
  const share = hi > lo ? Math.max(0, perDay - lo) / (hi - lo) : 0;
  const upperDays = Math.min(days, Math.floor(share * days + eps));
  return { bounties: lower + share, lower, upper, upperDays, lowerDays: days - upperDays };
}
