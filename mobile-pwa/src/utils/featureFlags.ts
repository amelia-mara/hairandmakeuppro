import { isOwnerTier } from './tierUtils';

/**
 * Feature flags control visibility of features to regular users.
 * Owner tier bypasses all flags and always sees every feature.
 *
 * To release a feature to all users: change its value from false to true.
 * No other code changes needed.
 */
export const FEATURE_FLAGS = {
  // ── Live features ─────────────────────────────────────────
  // These are on for all users
  continuityCapture:    true,
  scriptBreakdown:      true,
  lookbook:             true,
  budget:               true,
  timesheets:           true,
  callSheets:           true,
  schedule:             true,
  teamChat:             true,
  hoursLogging:         true,
  receiptScanning:      true,

  // ── Owner-only features ───────────────────────────────────
  // Set to false — only owner sees these
  aiAssistantChat:      false,   // AI chat assistant — not yet released

  // ── Future features ───────────────────────────────────────
  // Add new unreleased features here as false
} as const;

export type FeatureFlag = keyof typeof FEATURE_FLAGS;

/**
 * Check if a feature is available to the current user.
 * Owner tier always returns true regardless of flag state.
 */
export const isFeatureEnabled = (
  flag: FeatureFlag,
  tier: string,
): boolean => {
  if (isOwnerTier(tier)) return true;
  return FEATURE_FLAGS[flag];
};
