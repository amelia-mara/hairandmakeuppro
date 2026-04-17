import { isOwnerTier } from './tierUtils';

/**
 * Feature flags for Prep Happy desktop.
 * Owner tier bypasses all flags.
 */
export const FEATURE_FLAGS = {
  // ── Live features ─────────────────────────────────────────
  scriptBreakdown:        true,
  lookbook:               true,
  bible:                  true,
  callSheets:             true,

  // ── Owner-only features ───────────────────────────────────
  // Set to false — only owner sees these
  characterDesign:        false,  // Character design page — not yet released
  budget:                 false,  // Budget page — not yet released
  timesheets:             false,  // Timesheet page — not yet released
  teamManagement:         false,  // Team management page — not yet released

  // ── Future features ───────────────────────────────────────
  // Add unreleased Prep features here as false
} as const;

export type FeatureFlag = keyof typeof FEATURE_FLAGS;

export const isFeatureEnabled = (
  flag: FeatureFlag,
  tier: string,
): boolean => {
  if (isOwnerTier(tier)) return true;
  return FEATURE_FLAGS[flag];
};
