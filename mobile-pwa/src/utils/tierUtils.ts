/**
 * Tier Utility Functions
 *
 * Centralised tier checks for the mobile app. Components and stores
 * use ONLY these functions — never check user.tier directly.
 *
 * All gates apply to OWN projects only. On joined projects, tier is
 * irrelevant — do not use these functions for joined-project access.
 */

export type UserTier = 'daily' | 'artist' | 'supervisor' | 'designer' | 'owner';

/** Can the user create their own projects? */
export const canCreateProjects = (tier: string): boolean =>
  ['artist', 'supervisor', 'designer', 'owner'].includes(tier);

/** Has Artist reached their one-project limit? */
export const hasReachedProjectLimit = (
  tier: string,
  ownedProjectCount: number,
): boolean => tier === 'artist' && ownedProjectCount >= 1;

/** Can the user invite team members to their own projects? */
export const canInviteTeam = (tier: string): boolean =>
  ['supervisor', 'designer', 'owner'].includes(tier);

/** Can the user access budget on their own projects? */
export const canAccessBudget = (tier: string): boolean =>
  ['supervisor', 'designer', 'owner'].includes(tier);

/** Can the user access project settings on their own projects? */
export const canAccessProjectSettings = (tier: string): boolean =>
  ['supervisor', 'designer', 'owner'].includes(tier);

/** Can the user access Prep Happy desktop? */
export const canAccessPrep = (tier: string): boolean =>
  ['designer', 'owner'].includes(tier);

/** Can the user approve timesheets and countersign invoices? */
export const canApproveTimesheets = (tier: string): boolean =>
  ['designer', 'owner'].includes(tier);

/** Is this the platform owner account? */
export const isOwnerTier = (tier: string): boolean =>
  tier === 'owner';
