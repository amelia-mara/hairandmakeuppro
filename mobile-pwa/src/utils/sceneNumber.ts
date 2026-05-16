// Shared helper for splitting a combined scene reference like "176A"
// into the scene_number / number_suffix pair stored on the `scenes`
// table. The schedule parser writes references as a single string
// ("4A", "176B"), while the scenes table stores number and suffix in
// separate columns. NULL-safe matching for `number_suffix` is the
// caller's responsibility — Postgres treats `column = NULL` as never
// true, so callers must branch on suffix == null and use `.is()` for
// the null case and `.eq()` for the suffixed case.
//
// This file is duplicated byte-for-byte in `mobile-pwa/src/utils/` as
// per the storyDayDetection.ts convention. Keep both copies in sync.

export interface ParsedSceneRef {
  number: string;
  suffix: string | null;
}

/**
 * Parse a combined scene reference into its number and suffix parts.
 *
 *   "4"     -> { number: "4",   suffix: null }
 *   "176A"  -> { number: "176", suffix: "A"  }
 *   "12AA"  -> { number: "12",  suffix: "AA" }
 *
 * Whitespace and case are normalised. Anything that doesn't match the
 * `<digits><optional-letters>` shape returns the raw trimmed string
 * with suffix=null so the caller can still attempt a number-only
 * match without losing data.
 */
export function parseSceneRef(raw: string | null | undefined): ParsedSceneRef {
  const trimmed = (raw ?? '').trim().toUpperCase();
  const m = trimmed.match(/^(\d+)([A-Z]+)?$/);
  if (!m) return { number: trimmed, suffix: null };
  return { number: m[1], suffix: m[2] ?? null };
}
