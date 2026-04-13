# BEFORE SNAPSHOT: pages/Leads.jsx (Triple Fix: Date, Aging, Status)
**Date:** 2026-02-08  
**Issue:** Creation date not visible, aging borders missing, status change misaligned

## Current State
- `getLeadAgingLevel()` function: MISSING
- Created date render: MISSING from Row 2
- Aging border classes: NOT APPLIED to Card
- Customer state: MISSING
- LeadStatusChange position: Row 1 (should move to actions row)
- LeadForm props: missing customers and boats

## Affected Lines
- Line 48–52: State definitions (missing customers state)
- Line 73–75: loadData Promise.all (missing Customer.list())
- Line 192: Card className (no aging border logic)
- Line 197–210: Row 1 (LeadStatusChange positioned here; should move)
- Line 212–238: Row 2 (missing created date display)
- Line 307: LeadForm props (missing customers, boats)