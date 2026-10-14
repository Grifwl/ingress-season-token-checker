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
 * Maximum tokens obtainable per day from daily bounties.
 *
 * @param cfg - Daily bounty rewards of the series.
 * @returns Tokens for completing every bounty.
 */
export function maxDailyTokens(cfg: DailyBountyConfig): number {
  return tokensForBounties(cfg, cfg.bountyTokens.length);
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
