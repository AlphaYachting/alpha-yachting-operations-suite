# pages/Leads.js - AFTER Aging Indicator (2026-02-08)

## Changes Made

### 1. Added Aging Logic Function (line ~112-122)
```jsx
const getLeadAgingLevel = (lead) => {
  const movementTimestamp = lead.last_contacted_at || lead.updated_date || lead.created_date;
  if (!movementTimestamp) return 'none';
  
  const now = new Date();
  const lastActivity = new Date(movementTimestamp);
  const ageDays = Math.floor((now - lastActivity) / (1000 * 60 * 60 * 24));
  
  if (ageDays > 7) return 'danger';
  if (ageDays > 3) return 'warn';
  return 'none';
};
```

**Priority for "last activity":**
1. last_contacted_at (most recent interaction)
2. updated_date (any field change)
3. created_date (fallback)

### 2. Applied Conditional Border Classes (line ~191-197)
```jsx
filteredLeads.map((lead) => {
  const agingLevel = getLeadAgingLevel(lead);
  const borderClass = agingLevel === 'danger' ? 'border-red-400 border-2' : 
                      agingLevel === 'warn' ? 'border-yellow-400 border-2' : 
                      'hover:border-slate-300';
  
  return (
    <Card key={lead.id} className={`${borderClass} transition-colors`}>
```

**Border rules:**
- ageDays > 7: red border (border-red-400 border-2)
- ageDays > 3: yellow border (border-yellow-400 border-2)
- else: normal border (hover:border-slate-300)

### 3. Display Creation Date (line ~213-218)
```jsx
{lead.created_date &&
  <div className="flex items-center gap-1">
    <span className="text-xs text-slate-500">
      {format(parseISO(lead.created_date), 'MMM d, yyyy')}
    </span>
  </div>
}
```

Added as first item in Row 2 (before phone/email/boat/location)
Format: "Jan 15, 2026"

## What Did NOT Change
- No database schema modifications
- No styling files touched (globals.css, etc.)
- No backend functions
- No other UI elements
- No lead statuses or business logic
- Only touched 1 file: pages/Leads.js