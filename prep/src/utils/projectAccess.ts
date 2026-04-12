/**
 * Project Access — per-member feature toggles for Prep Happy.
 *
 * Same model as the mobile app. Project owners can toggle individual
 * features on/off per team member via the project_members table.
 * Owner always has full access.
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
  projectSettings: boolean;
  teamManagement: boolean;
}

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

export function getProjectAccess(
  memberRecord: Partial<AccessToggles> | null,
  isOwner: boolean,
): ProjectAccess {
  if (isOwner) {
    return {
      breakdown: true, script: true, lookbook: true, callsheets: true,
      chat: true, continuity: true, hours: true, receipts: true,
      budget: true, exportHours: true, exportInvoice: true,
      projectSettings: true, teamManagement: true,
    };
  }
  if (!memberRecord) {
    return {
      breakdown: false, script: false, lookbook: false, callsheets: false,
      chat: false, continuity: false, hours: false, receipts: false,
      budget: false, exportHours: false, exportInvoice: false,
      projectSettings: false, teamManagement: false,
    };
  }
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
