# pages/Leads.js - BEFORE Aging Indicator (2026-02-08)

## Current State
- Lead cards displayed in list (line 192-294)
- No creation date displayed
- No aging visual indicators
- Standard border styling on all cards

## Key Structure
```jsx
// Line 192-294: Lead card rendering
filteredLeads.map((lead) =>
  <Card key={lead.id} className="hover:border-slate-300 transition-colors">
    <CardContent className="p-2.5 px-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0 space-y-1.5">
          {/* Row 1: Name, Priority, Inquiry Type */}
          {/* Row 2: Contact, Boat, Location */}
          {/* Row 3: Description Preview */}
        </div>
        {/* Actions */}
      </div>
    </CardContent>
  </Card>
)
```

## Available Timestamps in Lead Entity
From entity schema:
- created_date (built-in)
- updated_date (built-in)
- last_contacted_at
- converted_at

## What Will Change
- Display creation date
- Add aging logic based on last_contacted_at → updated_date → created_date
- Apply conditional border colors (yellow >3 days, red >7 days)