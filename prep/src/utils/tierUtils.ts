/**
 * Tier Utility Functions
 *
 * Centralised tier checks for Prep Happy. Components and stores
 * use ONLY these functions — never check user.tier directly.
 */

export type UserTier = 'daily' | 'artist' | 'supervisor' | 'designer' | 'owner';

/** Can the user access Prep Happy desktop? */
export const canAccessPrep = (tier: string): boolean =>
  ['designer', 'owner'].includes(tier);

/** Can the user create their own projects? */
export const canCreateProjects = (tier: string): boolean =>
  ['artist', 'supervisor', 'designer', 'owner'].includes(tier);

/** Can the user invite team members to their own projects? */
export const canInviteTeam = (tier: string): boolean =>
  ['supervisor', 'designer', 'owner'].includes(tier);

/** Can the user approve timesheets and countersign invoices? */
export const canApproveTimesheets = (tier: string): boolean =>
  ['designer', 'owner'].includes(tier);

/** Is this the platform owner account? */
export const isOwnerTier = (tier: string): boolean =>
  tier === 'owner';
