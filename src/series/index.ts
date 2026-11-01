import { todayIso } from "../engine/dates";
import { cygnus } from "./cygnus";
import type { SeriesConfig } from "./types";

/**
 * Registry of every supported series, newest first. Adding a series means
 * writing its config file and appending it here.
 */
export const allSeries: SeriesConfig[] = [cygnus];

/**
 * Look up a series by its URL slug.
 *
 * @param id - Slug such as "cygnus".
 * @returns The matching config, or `undefined` when there is none.
 */
export function findSeries(id: string): SeriesConfig | undefined {
  return allSeries.find((s) => s.id === id);
}

/**
 * Pick the series a "current season" link should open.
 *
 * That is the newest series that has already started, so a season stays
 * current until the next one begins, even if its config is added early.
 * When none has started yet, the one that starts soonest is used instead.
 *
 * @param today - Reference date as `YYYY-MM-DD`; defaults to today.
 * @returns The series to open.
 */
export function currentSeries(today: string = todayIso()): SeriesConfig {
  return allSeries.find((s) => s.startDate <= today) ?? allSeries[allSeries.length - 1]!;
}
