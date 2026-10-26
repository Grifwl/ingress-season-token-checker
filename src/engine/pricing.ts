import type { CmuPack, UnlockPack, UnlockPricing } from "../series/types";

/**
 * Cost of unlocking the paid daily bounties.
 *
 * Paid bounties are unlocked with packs priced in CMU (1, 3 or 7 days...),
 * and CMU are bought with euros, either from the store or, for C.O.R.E.
 * subscribers, through the monthly subscription. Every figure is the
 * cheapest combination of purchases, so it is a lower bound of what an
 * agent actually spent. CMU left over from earlier months are ignored: only
 * purchases made within the dates involved are considered.
 *
 * Euros are handled in cents internally so that sums of prices such as
 * 2.09 + 4.99 never accumulate floating-point errors.
 */

/** Cheapest cost of unlocking the paid bounties on a number of days. */
export interface PaidDaysCost {
  /** Days on which the paid bounties are unlocked. */
  days: number;
  /** CMU needed for the unlock packs. */
  cmu: number;
  /** Euro cents to buy those CMU from the store. */
  eurCents: number;
  /**
   * C.O.R.E. subscriptions whose included CMU are used: at most one per
   * calendar month involved, and no more than needed.
   */
  coreSubscriptions: number;
  /** Euro cents those subscriptions cost. */
  coreCents: number;
  /**
   * Euro cents a C.O.R.E. subscriber still spends in the store once the
   * CMU included in the subscriptions are used up.
   */
  eurCentsWithCore: number;
}

/**
 * Minimum cost of buying enough units with packages that can be bought any
 * number of times (unbounded covering knapsack).
 *
 * @param need - Units needed.
 * @param packs - Size and cost of each package.
 * @returns Lowest total cost reaching at least `need` units.
 */
function cheapestCover(need: number, packs: { size: number; cost: number }[]): number {
  if (need <= 0) return 0;
  if (!packs.length) return Infinity;
  // Work in units of the greatest common divisor of the package sizes, so
  // that e.g. CMU packages (multiples of 500) need a small table.
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const unit = packs.reduce((g, p) => gcd(g, p.size), 0);
  const target = Math.ceil(need / unit);
  // best[i]: cheapest cost to obtain at least i units.
  const best = new Array<number>(target + 1).fill(Infinity);
  best[0] = 0;
  for (let i = 1; i <= target; i++) {
    for (const p of packs) {
      const cost = p.cost + best[Math.max(0, i - p.size / unit)]!;
      if (cost < best[i]!) best[i] = cost;
    }
  }
  return best[target]!;
}

/**
 * CMU needed to unlock the paid bounties on a number of days.
 *
 * @param packs - Unlock packs offered.
 * @param days - Days to cover.
 * @returns Lowest CMU covering at least `days` days.
 */
export function unlockCmu(packs: UnlockPack[], days: number): number {
  return cheapestCover(
    days,
    packs.map((p) => ({ size: p.days, cost: p.cmu })),
  );
}

/**
 * Euro cents needed to buy an amount of CMU from the store.
 *
 * @param store - CMU packages.
 * @param cmu - CMU needed.
 * @returns Lowest price in cents.
 */
export function cmuStoreCents(store: CmuPack[], cmu: number): number {
  return cheapestCover(
    cmu,
    store.map((p) => ({ size: p.cmu, cost: Math.round(p.eur * 100) })),
  );
}

/**
 * Cheapest cost of unlocking the paid bounties on a number of days, with and
 * without a C.O.R.E. subscription.
 *
 * @param pricing - Prices of the series.
 * @param days - Days with the paid bounties unlocked.
 * @param months - Calendar months over which the purchases can be made
 *   (limits how many monthly subscriptions can be counted).
 * @returns The cost.
 */
export function paidDaysCost(pricing: UnlockPricing, days: number, months: number): PaidDaysCost {
  const cmu = unlockCmu(pricing.packs, days);
  const eurCents = cmuStoreCents(pricing.cmuStore, cmu);
  // A subscriber pays the subscription anyway, so its CMU count as free:
  // every month involved contributes its CMU (only as many months as
  // needed), and just the rest is bought in the store. The subscriptions'
  // price is still reported apart, for reference.
  const coreSubscriptions = Math.min(Math.max(1, months), Math.ceil(cmu / pricing.core.cmu));
  const coreCents = coreSubscriptions * Math.round(pricing.core.eur * 100);
  const eurCentsWithCore = cmuStoreCents(pricing.cmuStore, cmu - coreSubscriptions * pricing.core.cmu);
  return { days, cmu, eurCents, coreSubscriptions, coreCents, eurCentsWithCore };
}
