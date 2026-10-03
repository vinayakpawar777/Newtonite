import type { WorkItemStatus } from '../db/schema';

/**
 * State machine for work item status transitions.
 * 
 * Valid transitions:
 *   open → in_progress, closed
 *   in_progress → under_review, blocked, open
 *   under_review → resolved, in_progress
 *   blocked → in_progress, open
 *   resolved → closed, in_progress
 *   closed → open (reopen — requires manager+)
 */
const VALID_TRANSITIONS: Record<WorkItemStatus, WorkItemStatus[]> = {
  open: ['in_progress', 'closed'],
  in_progress: ['under_review', 'blocked', 'open'],
  under_review: ['resolved', 'in_progress'],
  blocked: ['in_progress', 'open'],
  resolved: ['closed', 'in_progress'],
  closed: ['open'],
};

/** Transitions that require manager or admin role */
const MANAGER_REQUIRED_TRANSITIONS: Array<{ from: WorkItemStatus; to: WorkItemStatus }> = [
  { from: 'open', to: 'closed' },      // closing directly from open
  { from: 'resolved', to: 'closed' },   // closing
  { from: 'closed', to: 'open' },       // reopening
];

export function isValidTransition(from: WorkItemStatus, to: WorkItemStatus): boolean {
  const allowed = VALID_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

export function requiresManagerRole(from: WorkItemStatus, to: WorkItemStatus): boolean {
  return MANAGER_REQUIRED_TRANSITIONS.some(
    (t) => t.from === from && t.to === to
  );
}

export function getValidTransitions(from: WorkItemStatus): WorkItemStatus[] {
  return VALID_TRANSITIONS[from] || [];
}

export function getStatusLabel(status: WorkItemStatus): string {
  const labels: Record<WorkItemStatus, string> = {
    open: 'Open',
    in_progress: 'In Progress',
    under_review: 'Under Review',
    blocked: 'Blocked',
    resolved: 'Resolved',
    closed: 'Closed',
  };
  return labels[status] || status;
}
