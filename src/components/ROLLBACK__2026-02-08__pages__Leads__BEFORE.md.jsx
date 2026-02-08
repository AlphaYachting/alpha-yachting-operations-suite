# BEFORE: pages/Leads.js

**Date:** 2026-02-08 (pre-canonicalization)
**State:** Contains inline `getLeadAgingLevel()` function definition at line 47 (after earlier fix)

```javascript
const getLeadAgingLevel = (lead) => {
  const movementTime = 
    lead.last_activity_at || 
    lead.status_updated_at || 
    lead.updated_date || 
    lead.created_date;
  
  if (!movementTime) return 'none';
  const ageDays = Math.floor((new Date() - new Date(movementTime)) / 86400000);
  if (ageDays > 5) return 'danger';
  if (ageDays > 3) return 'warn';
  return 'none';
};

export default function Leads() { ... }
```

**Issue:** Function lives in page component; susceptible to removal during styling-only change passes that operate on file snapshots.

**Test Status:** Function works; no runtime error; but not isolated from styling changes.