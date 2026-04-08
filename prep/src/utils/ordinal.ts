/**
 * Format a positive integer as its English ordinal string.
 *
 *   ordinal(1)   // "1st"
 *   ordinal(2)   // "2nd"
 *   ordinal(3)   // "3rd"
 *   ordinal(4)   // "4th"
 *   ordinal(11)  // "11th"   (teens always take "th")
 *   ordinal(21)  // "21st"
 *   ordinal(112) // "112th"
 *
 * Used by the breakdown UI to render character billing rank labels
 * (e.g. "1st Billing", "2nd Billing").
 */
export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
