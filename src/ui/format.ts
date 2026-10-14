import type { Range } from "../engine/range";
import { locale } from "./i18n";

/**
 * Format an integer with the thousands separator of the current language.
 *
 * @param n - Number to format.
 * @returns e.g. "24,000" (English) or "24.000" (Spanish).
 */
export function fmt(n: number): string {
  // useGrouping "always" so Spanish also groups 4-digit numbers (1.000).
  return new Intl.NumberFormat(locale(), { maximumFractionDigits: 0, useGrouping: "always" }).format(Math.round(n));
}

/**
 * Format an interval, collapsing it to one value when both ends match.
 *
 * @param r - Interval.
 * @param decimals - Whether to keep one decimal (for averages).
 * @returns e.g. "1,200" or "1,200–1,700".
 */
export function fmtRange(r: Range, decimals = false): string {
  const f = decimals
    ? (n: number) => new Intl.NumberFormat(locale(), { maximumFractionDigits: 1 }).format(n)
    : fmt;
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
    new Date(`${iso}T00:00:00Z`).toLocaleDateString(locale(), { day: "numeric", month: "short", timeZone: "UTC" });
  return start === end ? f(start) : `${f(start)} – ${f(end)}`;
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
