/**
 * Project Access — per-member feature toggles for joined projects.
 *
 * When a user joins a project, the owner can toggle individual features
 * on or off for that specific person. This is entirely separate from
 * subscription tiers — tiers gate own-project features, toggles gate
 * joined-project features. Never mix the two.
 *
 * Components use getProjectAccess() to check what the current user can
 * do on the active project. Owner always has full access.
 */

export interface ProjectAccess {
  breakdown: boolean;
  script: boolean;
  lookbook: boolean;
  callsheets: boolean;
  chat: boolean;
  continuity: boolean;
  hours: boolean;
  receipts: boolean;
  budget: boolean;
  exportHours: boolean;
  exportInvoice: boolean;
  /** Always true for owner, always false for team members */
  projectSettings: boolean;
  /** Always true for owner, always false for team members */
  teamManagement: boolean;
}

/** The DB columns on project_members that store access toggles */
export interface AccessToggles {
  access_breakdown: boolean;
  access_script: boolean;
  access_lookbook: boolean;
  access_callsheets: boolean;
  access_chat: boolean;
  access_continuity: boolean;
  access_hours: boolean;
  access_receipts: boolean;
  access_budget: boolean;
  access_export_hours: boolean;
  access_export_invoice: boolean;
}

/** Default access for a newly invited member (budget off, everything else on) */
export const DEFAULT_ACCESS: AccessToggles = {
  access_breakdown: true,
  access_script: true,
  access_lookbook: true,
  access_callsheets: true,
  access_chat: true,
  access_continuity: true,
  access_hours: true,
  access_receipts: true,
  access_budget: false,
  access_export_hours: true,
  access_export_invoice: true,
};

const FULL_ACCESS: ProjectAccess = {
  breakdown: true,
  script: true,
  lookbook: true,
  callsheets: true,
  chat: true,
  continuity: true,
  hours: true,
  receipts: true,
  budget: true,
  exportHours: true,
  exportInvoice: true,
  projectSettings: true,
  teamManagement: true,
};

const NO_ACCESS: ProjectAccess = {
  breakdown: false,
  script: false,
  lookbook: false,
  callsheets: false,
  chat: false,
  continuity: false,
  hours: false,
  receipts: false,
  budget: false,
  exportHours: false,
  exportInvoice: false,
  projectSettings: false,
  teamManagement: false,
};

/**
 * Get the current user's access for the active project.
 *
 * @param memberRecord - The current user's project_members row (with access_* columns).
 *                       Pass null if the user has no membership record.
 * @param isOwner      - Whether the current user owns this project.
 */
export function getProjectAccess(
  memberRecord: Partial<AccessToggles> | null,
  isOwner: boolean,
): ProjectAccess {
  if (isOwner) return FULL_ACCESS;
  if (!memberRecord) return NO_ACCESS;

  return {
    breakdown:       memberRecord.access_breakdown ?? true,
    script:          memberRecord.access_script ?? true,
    lookbook:        memberRecord.access_lookbook ?? true,
    callsheets:      memberRecord.access_callsheets ?? true,
    chat:            memberRecord.access_chat ?? true,
    continuity:      memberRecord.access_continuity ?? true,
    hours:           memberRecord.access_hours ?? true,
    receipts:        memberRecord.access_receipts ?? true,
    budget:          memberRecord.access_budget ?? false,
    exportHours:     memberRecord.access_export_hours ?? true,
    exportInvoice:   memberRecord.access_export_invoice ?? true,
    projectSettings: false,
    teamManagement:  false,
  };
}

/** Human-readable labels for each toggle (used in the team management UI) */
export const ACCESS_TOGGLE_LABELS: Record<keyof AccessToggles, { name: string; description: string }> = {
  access_breakdown:      { name: 'Breakdown & Scenes',  description: 'View scene list and breakdown details' },
  access_script:         { name: 'Script Viewer',       description: 'View the uploaded script' },
  access_lookbook:       { name: 'Lookbook',            description: 'View character looks and assignments' },
  access_callsheets:     { name: 'Call Sheets',         description: 'View daily call sheets' },
  access_chat:           { name: 'Team Chat',           description: 'Access the project chat' },
  access_continuity:     { name: 'Continuity Capture',  description: 'Capture continuity photos and notes' },
  access_hours:          { name: 'Hours Logging',       description: 'Log daily working hours' },
  access_receipts:       { name: 'Receipt Scanning',    description: 'Scan and submit expense receipts' },
  access_budget:         { name: 'Budget',              description: 'View department budget and spending' },
  access_export_hours:   { name: 'Export Hours',        description: 'Export hours summary' },
  access_export_invoice: { name: 'Export Invoice',      description: 'Export signed invoice after approval' },
};
