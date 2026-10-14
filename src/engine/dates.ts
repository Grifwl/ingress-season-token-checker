/**
 * Calendar-date helpers working on ISO `YYYY-MM-DD` strings.
 *
 * Dates are handled as plain calendar days (no time of day, no time zone) so
 * that day counts never shift by one around daylight-saving changes. ISO
 * strings also compare correctly with `<` and `>`.
 */

const MS_PER_DAY = 86_400_000;

/**
 * Convert an ISO date into a day index (days since the Unix epoch).
 *
 * @param iso - Date as `YYYY-MM-DD`.
 * @returns Integer day number.
 */
export function dayNumber(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.round(Date.UTC(y!, m! - 1, d!) / MS_PER_DAY);
}

/**
 * Number of days from `from` to `to` (negative if `to` is earlier).
 *
 * @param from - Start date.
 * @param to - End date.
 * @returns `to - from` in days.
 */
export function daysBetween(from: string, to: string): number {
  return dayNumber(to) - dayNumber(from);
}

/**
 * Today's date in the browser's local time zone, which matches the agent's
 * daily bounty reset better than UTC does.
 *
 * @returns Today as `YYYY-MM-DD`.
 */
export function todayIso(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * Check whether a string is a valid ISO calendar date.
 *
 * @param value - Candidate string.
 * @returns `true` when it is a real `YYYY-MM-DD` date.
 */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d!));
  return date.getUTCMonth() === m! - 1 && date.getUTCDate() === d;
}
