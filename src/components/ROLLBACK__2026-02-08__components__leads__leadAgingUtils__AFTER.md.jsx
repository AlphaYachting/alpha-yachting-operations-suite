# AFTER: components/leads/leadAgingUtils.js

**Date:** 2026-02-08
**Status:** NEW FILE (canonical utility)

```javascript
export function getLeadAgingLevel(lead) {
  if (!lead) return 'none';

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
```

**Changes:**
- Extracted from pages/Leads.js
- Added null-check for `lead` object
- Standardized timestamp priority chain
- Isolated from styling/layout changes
- Versioning: This file is immutable; future styling changes cannot accidentally delete it

**Why This Location:**
- `components/leads/` is the canonical home for Lead-specific utilities
- Separated from page logic layer
- Can be snapshot-locked independently