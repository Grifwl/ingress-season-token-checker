/**
 * Per-browser persistence of the agent's answers.
 *
 * Storage may be unavailable (private browsing, blocked site data), so every
 * access is wrapped and failures simply mean the page starts from defaults.
 */

const PREFIX = "season-token-checker:";

/**
 * Read the saved answers of a series.
 *
 * @param seriesId - Series slug.
 * @returns The parsed value, or `undefined` when missing or unreadable.
 */
export function loadState(seriesId: string): unknown {
  try {
    const raw = localStorage.getItem(PREFIX + seriesId);
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Save the answers of a series.
 *
 * @param seriesId - Series slug.
 * @param state - Value to persist.
 */
export function saveState(seriesId: string, state: unknown): void {
  try {
    localStorage.setItem(PREFIX + seriesId, JSON.stringify(state));
  } catch {
    // Ignored: the page keeps working, answers just are not remembered.
  }
}
