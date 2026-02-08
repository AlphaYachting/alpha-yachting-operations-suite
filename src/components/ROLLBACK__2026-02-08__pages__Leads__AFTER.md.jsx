# AFTER: pages/Leads.js

**Date:** 2026-02-08
**Status:** Updated (import only)

**Change Summary:**
- Line 22: Added import `import { getLeadAgingLevel } from '@/components/leads/leadAgingUtils';`
- Removed inline function definition (was ~10 lines after inquiryTypeColors)
- All JSX, styling, layout, state, handlers remain identical

**Verification:**
- No className changes
- No prop changes to LeadForm or other sub-components
- No rendering logic changes
- Function is now imported; runtime error prevented

**Test Results:**
- ✅ Lead list renders without ReferenceError
- ✅ Created date visible (original styling preserved)
- ✅ Aging borders still applied (logic transferred to utility)
- ✅ Form dialogs work (no state changes)