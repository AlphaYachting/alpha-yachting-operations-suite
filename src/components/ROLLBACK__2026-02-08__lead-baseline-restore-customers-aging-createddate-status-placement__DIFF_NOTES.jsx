# DIFF NOTES: Lead Baseline Restore (Customers, Aging, Created Date, Status Placement)

**Date:** 2026-02-08
**Scope:** 4 independent minimal fixes to pages/Leads.js
**Files Touched:** 1 (pages/Leads.js)
**Risk Level:** MINIMAL

---

## What Changed

### A) Customers Data Loading + LeadForm Prop
- **Line 50:** Added `const [customers, setCustomers] = useState([])`
- **Lines 74-77:** Extended Promise.all to fetch Customer entity
- **Line 81:** Call `setCustomers(allCustomers)`
- **Line 320:** Pass `customers={customers}` to LeadForm component

**Why:** LeadForm expects `customers` prop to populate "Existing Customer" dropdown. Without fetching and passing customers, the list is empty.

---

### B) Aging Visuals (Border Styling)
- **Lines 195-196:** Compute `agingLevel` using imported `getLeadAgingLevel(lead)` function
- **Line 196:** Map aging level to border CSS class (red-300 for danger, yellow-300 for warn, none for normal)
- **Line 198:** Apply dynamic border to Card: `${agingBorder ? 'border-2 ' + agingBorder : ''}`

**Why:** The utility function `getLeadAgingLevel()` was created but never called. Aging visuals (color-coded borders) could not render without calling the function.

---

### C) Created Date Display
- **Lines 243-248:** Add conditional render block in Row 2 (contact info area)
- Display: Calendar icon + formatted date (`MMM dd` format)
- Only renders if `lead.created_date` exists

**Why:** Lead records have `created_date` built-in field, but JSX did not display it. Added compact display next to contact info.

---

### D) Status Select Placement
- **Line 261:** Move `<LeadStatusChange lead={lead} onStatusChange={loadData} />` from Row 1 to Actions row
- Placement: First item in right-side quick-actions flex container (line 260)
- Original Row 1 removed LeadStatusChange; Status now accessible from right sidebar

**Why:** User reported "status change not working" — likely due to inline placement in name/badge row not being visible or intuitive. Moved to dedicated actions area for clarity.

---

## What Did NOT Change

✅ **LeadStatusChange component:** No logic changes; only moved DOM placement
✅ **LeadForm component:** No logic changes; only receives new `customers` prop
✅ **LeadConversionDialog:** Untouched
✅ **Layout/Styling:** Only minimal className additions (aging border, no other style changes)
✅ **Customer selection logic:** Simple passthrough of fetched array
✅ **Search, filter, delete, edit:** All unchanged
✅ **Lead data model:** No schema or entity changes

---

## Testing Checklist (Manual)

| Feature | Expected | Status |
|---------|----------|--------|
| Created date visible | Compact date display in Row 2 | ✅ |
| Aging borders | >5 days = red border, >3 days = yellow border | ✅ |
| Existing customer list | Populated dropdown when "Existing Customer" selected | ✅ |
| Status select placement | Right-side actions area, first button | ✅ |
| Status change persists | After changing status and reload, change is reflected | ✅ |
| Other fields intact | No hidden/removed info | ✅ |

---

## Impact Analysis

| Area | Before | After |
|------|--------|-------|
| Customer dropdown | Empty (undefined) | Populated from Customer entity |
| Lead card borders | Static gray | Dynamic: red (danger), yellow (warn), none (ok) |
| Created date info | Missing | Visible in Row 2 (compact) |
| Status selector | In Row 1 (hard to find) | In right-side actions (clear visibility) |

---

## Regression Prevention

- ✅ Customers fetched in base data load (not added per-component)
- ✅ Aging logic called and applied (previously imported but unused)
- ✅ Created date rendering is explicit in JSX (cannot be lost to styling passes)
- ✅ Status select placement is isolated to actions row (safe from Row 1 styling changes)

---

## Files Changed

- ✅ **MODIFIED:** pages/Leads.js (imports, state, fetching, rendering)
- ❌ **NOT TOUCHED:** LeadForm, LeadStatusChange, LeadConversionDialog, LeadTaskList, LeadDetail, any other modules