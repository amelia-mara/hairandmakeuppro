/**
 * Tier Utility Functions
 *
 * Centralised tier checks for Prep Happy. Components and stores
 * use ONLY these functions — never check user.tier directly.
 */

export type UserTier = 'daily' | 'artist' | 'supervisor' | 'designer';

/** Can the user access Prep Happy desktop? */
export const canAccessPrep = (tier: string): boolean =>
  tier === 'designer';

/** Can the user create their own projects? */
export const canCreateProjects = (tier: string): boolean =>
  ['artist', 'supervisor', 'designer'].includes(tier);

/** Can the user invite team members to their own projects? */
export const canInviteTeam = (tier: string): boolean =>
  ['supervisor', 'designer'].includes(tier);

/** Can the user approve timesheets and countersign invoices? */
export const canApproveTimesheets = (tier: string): boolean =>
  tier === 'designer';
