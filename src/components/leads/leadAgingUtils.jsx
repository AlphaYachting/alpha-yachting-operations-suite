/**
 * Lead aging calculation utility
 * Canonical home for getLeadAgingLevel logic
 * Isolated from page/styling changes
 */

export function getLeadAgingLevel(lead) {
  if (!lead) return 'none';

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