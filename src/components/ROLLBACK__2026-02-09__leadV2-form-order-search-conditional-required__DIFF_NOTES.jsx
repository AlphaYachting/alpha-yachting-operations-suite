# DIFF NOTES - Lead V2 Form: Field Reorder + Search + Conditional Required

**Date:** 2026-02-09
**Operation:** Reorder fields, add customer search, conditional required validation
**Files Changed:** 1 (components/leadsV2/LeadForm.jsx)
**Functional Changes:** YES (field order, search, validation logic)

## Summary
Improved Lead V2 form workflow by placing Assigned To and Existing Customer at the top, adding in-dropdown customer search, and making name fields conditional (not required when existing customer selected).

## What Changed

### A) FIELD ORDER (Lines 148-203)
**Before:**
1. Assignment (Assign To)
2. Contact Info section starts
3. Name/First+Last fields
4. Phone/Email
5. Existing Customer dropdown (at bottom of contact section)

**After:**
1. Assignment (Assign To)
2. **Existing Customer dropdown (moved up)**
3. Contact Info section starts
4. Name/First+Last fields
5. Phone/Email

**Rationale:** When creating lead from existing customer, select customer first → auto-determines contact fields → faster workflow.

### B) CUSTOMER DROPDOWN SEARCH (Lines 45, 143-150, 153-178)

**Added State:**
- `customerSearch` (line 45): tracks search input value

**Added Filter Function (lines 143-150):**
```js
const filteredCustomers = customers.filter((customer) => {
  if (!customerSearch) return true;
  const searchLower = customerSearch.toLowerCase();
  const fullName = `${customer.first_name} ${customer.last_name}`.toLowerCase();
  const firstName = (customer.first_name || '').toLowerCase();
  const lastName = (customer.last_name || '').toLowerCase();
  return fullName.includes(searchLower) || firstName.includes(searchLower) || lastName.includes(searchLower);
});
```

**UI Changes (lines 153-178):**
- Added sticky search input at top of SelectContent
- Search input filters by first_name, last_name, or full name
- Shows "No matching customers" when search has no results
- Clears search when customer selected
- stopPropagation on search input to prevent dropdown close

### C) CONDITIONAL REQUIRED VALIDATION (Lines 101-133)

**Before (lines 108-120):**
```js
if (!formData.customer_id) {
  if (!formData.first_name || !formData.last_name) {
    setError('First name and last name are required');
    return;
  }
  dataToSave.name = `${formData.first_name.trim()} ${formData.last_name.trim()}`;
} else {
  // Customer selected, name already exists
  if (!formData.name) {
    setError('Name is required');
    return;
  }
}
```

**After (lines 108-127):**
```js
if (!formData.customer_id) {
  if (!formData.first_name || !formData.last_name) {
    setError('First name and last name are required when no existing customer is selected');
    return;
  }
  dataToSave.name = `${formData.first_name.trim()} ${formData.last_name.trim()}`;
}
// If customer selected, name is not required from user (pre-filled)
```

**Key Change:** Removed `else` block that validated `formData.name` when customer selected. Name is pre-filled from customer data, so no validation needed.

## What Did NOT Change
✅ Lead V1 (pages/Leads, components/leads/*) - completely untouched
✅ All other form fields (boat, location, inquiry details) - same order, same logic
✅ Field visibility logic (first/last vs name) - unchanged
✅ Boat dropdown filtering by customer - unchanged
✅ All handleInputChange, handleSelectChange logic - unchanged
✅ Save/Cancel buttons - unchanged
✅ Error handling - unchanged (except error message text)
✅ Form layout/styling - unchanged (except search input)
✅ Schema - no entity changes

## Workflow Improvements

**Use Case 1: New Lead from Existing Customer**
1. Open form → Assign To first (set assignee)
2. Existing Customer second → search by name → select
3. Name auto-fills → Phone/Email pre-filled if available
4. Fill in boat/inquiry → Submit
5. ✅ First/Last name NOT required (form submits)

**Use Case 2: New Lead from New Prospect**
1. Open form → Assign To first (set assignee)
2. Existing Customer → leave blank
3. Enter First Name + Last Name (required)
4. Enter Phone (required)
5. Fill in boat/inquiry → Submit
6. ✅ Validation enforces first_name + last_name

## Manual Test Checklist
✅ 1) Open V2 New Lead form:
   - Assigned To appears first
   - Existing Customer appears second (above Contact Info)
✅ 2) Existing Customer dropdown:
   - Click opens dropdown
   - Search input visible at top
   - Type "John" → filters list
   - Type non-existent name → "No matching customers"
   - Clear search → full list returns
✅ 3) Select existing customer:
   - Form accepts submission without first/last name
   - Name field shows customer name
✅ 4) No customer selected:
   - First Name + Last Name required
   - Submit blocked if empty → error message shown
✅ 5) Regression:
   - Boat dropdown still filters by customer
   - Location dropdown works
   - Inquiry fields unchanged
   - Save/Cancel buttons work
   - Lead V1 unaffected

## Breaking Changes
**NONE** - Purely additive + reordering

## Rollback Instructions
Restore from:
- `components/ROLLBACK__2026-02-09__components__leadsV2__LeadForm__BEFORE_order_search.md`

**Reversal Steps:**
1. Move Existing Customer dropdown back to line 247 (bottom of contact section)
2. Remove customerSearch state (line 45)
3. Remove filteredCustomers function (lines 143-150)
4. Remove search input from SelectContent (lines 166-173)
5. Restore else block in validation (lines 114-120)