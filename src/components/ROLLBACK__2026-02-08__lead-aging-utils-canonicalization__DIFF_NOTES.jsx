# DIFF NOTES: Lead Aging Utility Canonicalization

**Date:** 2026-02-08
**Scope:** MICRO-CHANGE (2 files touched)
**Risk Level:** MINIMAL

---

## What Changed

1. **Created:** `components/leads/leadAgingUtils.js`
   - Extracted `getLeadAgingLevel()` function from pages/Leads.js
   - Added null-check for `lead` parameter
   - Canonical home for aging logic (immutable, versioned separately)

2. **Updated:** `pages/Leads.js`
   - Added import: `import { getLeadAgingLevel } from '@/components/leads/leadAgingUtils';`
   - Removed inline function definition (moved to utility)
   - All other code unchanged

---

## Why This Change

**Problem:** 
- `getLeadAgingLevel()` was defined locally in pages/Leads.js
- During styling-only change passes (snapshot-based), the function definition was lost
- Caused ReferenceError at runtime when component attempted to call undefined function
- Regression loop: fix aging logic → apply styling snapshot → function disappears → ReferenceError

**Solution:**
- Extract function to isolated utility file
- Utility file has independent versioning (not overwritten by styling snapshots)
- Page imports the function; if utility exists, function exists
- Breaks the coupling between styling changes and function definitions

---

## What Did NOT Change

✅ **NO styling changes** — all className values identical
✅ **NO layout changes** — all JSX structure preserved
✅ **NO state changes** — useState, useEffect logic unchanged
✅ **NO prop changes** — LeadForm, dialogs receive identical props
✅ **NO logic changes in page** — only added import + removed duplicate definition
✅ **NO customer list logic** — loadData(), handlers unchanged
✅ **NO form state logic** — handleSaveLead, handleDeleteLead unchanged

---

## Impact on Regression Prevention

| Scenario | Before | After |
|----------|--------|-------|
| Styling-only snapshot applied | Function lost; ReferenceError | Function still imported; no error |
| Styling revert needed | Entire page reverted; all fixes lost | Only styling reverted; function safe |
| New lead form used | Works (if function present) | Works (function always present) |
| Lead list rendering | Fragile (depends on file state) | Stable (depends on utility existence) |

---

## Future-Proofing

- **Styling changes:** Can now modify pages/Leads.js freely without touching leadAgingUtils.js
- **Utility changes:** Updating aging logic only requires touching leadAgingUtils.js (isolated)
- **Snapshot recovery:** If pages/Leads.js is reverted, import still references external utility
- **Versioning:** leadAgingUtils.js is now a versioned artifact; can be snapshot-locked

---

## Testing Completed

✅ Lead list loads without runtime errors
✅ Created date display works (styling intact)
✅ Aging indicator logic executes (function imported correctly)
✅ Lead form opens (no state/prop changes)
✅ Conversion dialog works (no changes to conversion logic)

---

## Files Changed

- ✅ **NEW:** components/leads/leadAgingUtils.js
- ✅ **MODIFIED:** pages/Leads.js (import + definition removal)
- ❌ **NOT TOUCHED:** LeadForm, LeadStatusChange, LeadConversionDialog, any other components
- ❌ **NOT TOUCHED:** styling, layout, customer loading logic