import { STATUS_LABELS } from '../../../domain/chapters.mjs';

// Status keys: draft | submitted | needs_revision | approved | rejected | none.
// `label` overrides the default text (e.g. "Open" for the chapter being viewed).
export function StatusBadge({ status = 'none', label, className = '' }) {
  return (
    <span className={`status-pill status-${status} ${className}`}>
      {label || STATUS_LABELS[status] || status.replaceAll('_', ' ')}
    </span>
  );
}

// Queue/summary state for one research row from workflow_progress.
export function researchState(row) {
  if (row.status === 'approved') return 'approved';
  if (row.status === 'rejected') return 'rejected';
  if (Number(row.awaiting_count) > 0) return 'submitted';
  if (Number(row.revision_count) > 0) return 'needs_revision';
  return 'draft';
}
