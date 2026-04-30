import type { TimesheetEntry } from '@/types';

// Aggregated approval state for a set of timesheet entries — used by
// the SummaryCard and the export pipeline to surface whether the
// week / period is ready to send to production.
export type ApprovalState = 'none' | 'approved' | 'partial' | 'pending';

export interface ApprovalSummary {
  state: ApprovalState;
  approvedCount: number;
  totalCount: number;
}

/**
 * Compute the rollup approval state for a list of entries.
 *
 *  - none      — the list is empty
 *  - approved  — every entry has status 'approved'
 *  - pending   — at least one is logged but none are approved
 *  - partial   — some are approved and some aren't
 */
export function summariseApproval(entries: TimesheetEntry[]): ApprovalSummary {
  if (entries.length === 0) {
    return { state: 'none', approvedCount: 0, totalCount: 0 };
  }
  const approvedCount = entries.filter((e) => e.status === 'approved').length;
  const totalCount = entries.length;
  if (approvedCount === 0) return { state: 'pending', approvedCount, totalCount };
  if (approvedCount === totalCount) return { state: 'approved', approvedCount, totalCount };
  return { state: 'partial', approvedCount, totalCount };
}

/**
 * Display label used for the approval pill / banner.
 */
export function approvalLabel(state: ApprovalState): string {
  switch (state) {
    case 'approved': return 'Approved by designer';
    case 'partial':  return 'Partially approved';
    case 'pending':  return 'Pending approval';
    case 'none':
    default:         return 'No entries';
  }
}
