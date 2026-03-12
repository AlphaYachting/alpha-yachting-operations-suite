/**
 * Lead aging calculation utility
 * Canonical home for getLeadAgingLevel logic
 * Isolated from page/styling changes
 */

const CLOSED_STATUSES = ['Won', 'Converted', 'Rejected', 'Lost'];

export function getLeadAgingLevel(lead) {
  if (!lead) return 'none';

  // Closed/terminal leads never age
  if (CLOSED_STATUSES.includes(lead.status)) return 'none';

  // Priority order for determining when lead was last active
  const movementTime =
    lead.last_activity_at ||
    lead.last_contacted_at ||
    lead.status_updated_at ||
    lead.updated_date ||
    lead.created_date;

  if (!movementTime) return 'none';

  const ageDays = Math.floor(
    (new Date() - new Date(movementTime)) / 86400000
  );

  if (ageDays > 5) return 'danger';
  if (ageDays > 3) return 'warn';
  return 'none';
}