import type { Range } from "../engine/range";

const numberFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const decimalFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

/**
 * Format an integer with thousands separators.
 *
 * @param n - Number to format.
 * @returns e.g. "24,000".
 */
export function fmt(n: number): string {
  return numberFormat.format(Math.round(n));
}

/**
 * Format an interval, collapsing it to one value when both ends match.
 *
 * @param r - Interval.
 * @param decimals - Whether to keep one decimal (for averages).
 * @returns e.g. "1,200" or "1,200–1,700".
 */
export function fmtRange(r: Range, decimals = false): string {
  const f = decimals ? (n: number) => decimalFormat.format(n) : fmt;
  return f(r.min) === f(r.max) ? f(r.min) : `${f(r.min)}–${f(r.max)}`;
}

/**
 * Format a date range for display.
 *
 * @param start - ISO start date.
 * @param end - ISO end date.
 * @returns e.g. "3 Oct" or "12 Oct – 11 Nov".
 */
export function fmtDates(start: string, end: string): string {
  const f = (iso: string) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  return start === end ? f(start) : `${f(start)} – ${f(end)}`;
}

/**
 * Pluralise a word in English.
 *
 * @param n - Count.
 * @param singular - Singular form.
 * @param plural - Plural form (defaults to singular + "s").
 * @returns e.g. "1 day" or "3 days".
 */
export function plural(n: number, singular: string, plural = `${singular}s`): string {
  return `${fmt(n)} ${n === 1 ? singular : plural}`;
}

/**
 * Escape text for safe insertion into HTML.
 *
 * @param s - Raw text.
 * @returns Escaped text.
 */
export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
