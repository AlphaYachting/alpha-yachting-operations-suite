# DIFF NOTES: Partner Brief Frontend Template Alignment
## Date: 2026-02-01
## Change: Align frontend template to backend data builder fields + restore teal styled layout

---

## WHAT CHANGED

### 1. Data Field Mapping (Frontend → Backend)
Fixed template to use correct data builder keys:

**Vessel fields:**
- `document.vessel_name` → `document.boat_name` ✓
- `document.vessel_type` → `document.boat_type` ✓
- `document.vessel_length` → `document.boat_length` ✓

**Work description:**
- `document.work_description` → `document.work_order_description` ✓

**Budget fields:**
- `document.budget_total` → `document.approved_budget` ✓
- `document.budget_labor` → `document.labor_budget` ✓
- `document.budget_travel` → `document.travel_budget` ✓
- `document.budget_accommodation` → `document.accommodation_budget` ✓
- `document.budget_per_diem` → `document.per_diem_budget` ✓

**Covered costs:**
- `document.covered_costs` (object) → `document.cost_policies` (array of strings) ✓
- Now renders as bullet list matching reference PDF

**Approval requirements:**
- `document.approval_requirements.preapproval_over` → `document.requires_preapproval` ✓
- `document.approval_requirements.budget_exceed_requires_approval` → `document.budget_exceed_requires_approval` ✓

### 2. Visual Layout Restoration (Teal Styled Design)

**Section headers:**
- Changed from: Filled teal rectangles with white text
- Changed to: Teal text with thin teal underline (matching reference PDF)

**Title styling:**
- "PARTNER BRIEFING" now has teal color + thin underline (not just text)

**Company name:**
- Changed to teal color (matching reference PDF header)

**Table headers:**
- All table headers now use teal background (#00bcd4) instead of generic primaryColor
- Consistent across: Tasks & Checklist, Cost Coverage & Budget, Assigned Team

**Two-column grid layout:**
- Added `drawTwoColGrid()` helper for key-value pairs
- Applied to: Work Order Information, Customer & Vessel, Location & Access
- Matches reference PDF's grid structure

**Covered Costs:**
- Now correctly renders `document.cost_policies` array as bullet list
- Shows "No additional costs covered" if empty (instead of hidden/empty section)
- Matches reference PDF bullet formatting

---

## WHY IT CHANGED

**Problem:** Frontend template was using incorrect data field names that don't match the backend data builder, causing:
1. Empty/missing vessel information
2. Empty/missing budget data
3. Empty "Covered Costs" section
4. Plain linear layout instead of styled teal layout

**Solution:** Align frontend template to backend data contract and restore reference PDF visual styling.

---

## WHAT DID NOT CHANGE

- ❌ Backend data builder (`generatePartnerBriefPDF.js`) - unchanged
- ❌ Backend function structure - unchanged
- ❌ Offer/Invoice templates - unchanged
- ❌ PDF Template Manager pipeline - unchanged
- ❌ Entity schemas - unchanged
- ❌ jsPDF generator core (`jsPDFGenerator.js`) - unchanged

---

## FILES TOUCHED

1. `components/pdf/PartnerBriefTemplate.js` - main template update
2. `components/ROLLBACK__2026-02-01__pdf__PartnerBriefTemplate__BEFORE_final.md` - before snapshot
3. `components/ROLLBACK__2026-02-01__partner-brief-align-to-builder__DIFF_NOTES.md` - this file

---

## MANUAL TEST CHECKLIST

- [ ] Generate Partner Brief: visual layout matches reference (teal headers, styled tables, two-column grids)
- [ ] "Covered Costs" shows bullet list with policies (not empty)
- [ ] All vessel/customer/location data displays correctly
- [ ] Budget table shows correct values
- [ ] Offer/Invoice PDFs unchanged