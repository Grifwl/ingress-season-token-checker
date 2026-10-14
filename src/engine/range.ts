/**
 * Closed numeric intervals.
 *
 * Many token sources cannot be known exactly (e.g. a campaign whose bounty
 * breakdown is unpublished), so the engine carries every uncertain quantity
 * as a [min, max] interval instead of a single value. Results then read as
 * "between X and Y", and refining a config simply narrows the intervals.
 */

/** Inclusive interval [min, max]. */
export interface Range {
  min: number;
  max: number;
}

/**
 * Build a degenerate interval holding a single known value.
 *
 * @param value - The exact value.
 * @returns The interval [value, value].
 */
export function exact(value: number): Range {
  return { min: value, max: value };
}

/**
 * Add any number of intervals.
 *
 * @param ranges - Intervals to add.
 * @returns The interval of all possible sums.
 */
export function add(...ranges: Range[]): Range {
  return ranges.reduce((acc, r) => ({ min: acc.min + r.min, max: acc.max + r.max }), exact(0));
}

/**
 * Subtract one interval from another.
 *
 * @param a - Minuend.
 * @param b - Subtrahend.
 * @returns The interval of all possible differences `a - b`.
 */
export function sub(a: Range, b: Range): Range {
  return { min: a.min - b.max, max: a.max - b.min };
}

/**
 * Multiply an interval by a non-negative scalar.
 *
 * @param r - Interval.
 * @param factor - Non-negative factor.
 * @returns The scaled interval.
 */
export function scale(r: Range, factor: number): Range {
  return { min: r.min * factor, max: r.max * factor };
}

/**
 * Restrict both ends of an interval to [lo, hi].
 *
 * @param r - Interval.
 * @param lo - Lower bound.
 * @param hi - Upper bound.
 * @returns The clamped interval.
 */
export function clamp(r: Range, lo: number, hi: number): Range {
  const c = (v: number) => Math.min(hi, Math.max(lo, v));
  return { min: c(r.min), max: c(r.max) };
}

/**
 * Apply a monotonically non-decreasing function to both ends.
 *
 * @param r - Interval.
 * @param fn - Non-decreasing function.
 * @returns The mapped interval.
 */
export function map(r: Range, fn: (v: number) => number): Range {
  return { min: fn(r.min), max: fn(r.max) };
}
