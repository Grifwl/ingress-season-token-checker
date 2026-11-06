import type { Range } from "../engine/range";
import { daysBetween } from "../engine/dates";
import { locale, m } from "./i18n";

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
 * Format an amount of euros.
 *
 * @param cents - Amount in euro cents.
 * @returns e.g. "€19.16" (English) or "19,16 €" (Spanish).
 */
export function fmtEur(cents: number): string {
  return new Intl.NumberFormat(locale(), { style: "currency", currency: "EUR" }).format(cents / 100);
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
 * Format the dates of an event or season together with its length and, while
 * it has not finished yet, how long until it starts or ends.
 *
 * The countdown is measured from the forecast date rather than the real date
 * so it always agrees with the phase badge when the agent simulates another
 * day. Lengths count both ends (12 Oct – 11 Nov is 31 days), and the
 * countdown counts to the target day itself, so the last day of an event
 * reads "ends today" and the day before "ends tomorrow".
 *
 * One-day events skip both the length and the "ends" wording, which would
 * only repeat the date: they just say how long until they happen.
 *
 * @param start - ISO first day.
 * @param end - ISO last day.
 * @param today - ISO forecast date.
 * @param withYear - Whether to append the year after the dates.
 * @returns e.g. "12 Oct – 11 Nov · 31 days · ends in 5 days" or "7 Nov · tomorrow".
 */
export function fmtSchedule(start: string, end: string, today: string, withYear = false): string {
  const t = m();
  const parts = [withYear ? `${fmtDates(start, end)} ${start.slice(0, 4)}` : fmtDates(start, end)];
  const untilStart = daysBetween(today, start);
  const untilEnd = daysBetween(today, end);
  if (start === end) {
    if (untilStart >= 0) parts.push(t.relativeDays(untilStart));
  } else {
    parts.push(t.durationDays(daysBetween(start, end) + 1));
    if (untilStart > 0) parts.push(t.startsWhen(t.relativeDays(untilStart)));
    else if (untilEnd >= 0) parts.push(t.endsWhen(t.relativeDays(untilEnd)));
  }
  return parts.join(" · ");
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
