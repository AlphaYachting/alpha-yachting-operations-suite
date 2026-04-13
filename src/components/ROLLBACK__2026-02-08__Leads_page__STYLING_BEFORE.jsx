# BEFORE SNAPSHOT: pages/Leads.jsx (Styling)
**Date:** 2026-02-08  
**Type:** Style-only review (no logic or JSX structure changes)

## Current Styling State

### Header Section
- Title only (no subtitle)
- className: `"space-y-6"` container
- h1: `"text-2xl font-bold text-slate-900"`

### Stats Cards
- Grid: `"grid grid-cols-1 md:grid-cols-4 gap-3"`
- CardContent: `"p-3"`
- Status label: `"text-xs text-slate-500 mb-0.5"`
- Count: `"text-xl font-bold text-slate-900"`

### Lead Cards
- Card: `"hover:border-slate-300 transition-colors"`
- CardContent: `"p-2.5 px-3"` (minimal padding)
- Container: `"flex items-start justify-between gap-3"`
- Row 1: Name + badges, `"flex items-center gap-2"`
- Row 2: Contact info, `"flex items-center gap-4 text-xs text-slate-600"` (flex-wrap)
- Row 3: Description, `"bg-slate-50 px-2 py-1"`
- Actions: `"flex items-center gap-1 flex-shrink-0"` (tight spacing)

## Visible Issues
- Excessive gap-3 between contact items (should be bullet-separated)
- Low padding on lead cards (feels cramped)
- Contact info row wraps; no bullet separator styling
- Description box styling is dated (needs lighter bg, better padding)
- Actions row has minimal gap (should be gap-2 for clarity)