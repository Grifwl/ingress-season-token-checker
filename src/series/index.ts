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
