/**
 * Safe JSON parsing utilities that prevent crashes from corrupt or invalid data.
 */

/**
 * Safely parse a JSON string, returning a fallback value on failure.
 * Use this instead of bare JSON.parse() for data from external sources
 * (localStorage, IndexedDB, API responses, user uploads).
 */
export function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    console.error('[safeJsonParse] Failed to parse:', value.slice(0, 200));
    return fallback;
  }
}
