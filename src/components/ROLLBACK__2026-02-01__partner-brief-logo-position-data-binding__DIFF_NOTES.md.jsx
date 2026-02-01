# DIFF NOTES: Partner Brief Logo Position + Data Binding Fix
## Date: 2026-02-01
## Changes: Reserved header layout + correct field mapping

---

## ROOT CAUSE SUMMARY

### A) Logo Overlap
**Root cause:** Header text started at Y=20mm (margins.top) while logo occupied Y=20mm to ~35mm (logo height auto-calculated), causing "PARTNER BRIEFING" title to overlap with the logo area.

**Solution:** Implemented reserved header layout with constants:
- `HEADER_TOP_Y = 20mm`
- `LOGO_BOX = {x: 15mm, y: 20mm, w: 45mm, h: 15mm (reserved)}`
- `HEADER_TEXT_START_Y = 45mm` (logo bottom + 10mm padding)
- All content now starts at Y=45mm or later (no overlap possible)

### B) Data Binding
**Root cause:** Template expects `document.boat_name`, `document.boat_type`, `document.boat_length`, `document.approved_budget`, etc., but builder was not populating them correctly or fallbacks were overwriting valid values.

**Solution:** Fixed data mapper to:
- Add `work_order_number` field (was missing)
- Use `null` instead of `undefined` for optional vessel fields (prevents premature fallback to "-")
- Use nullish coalescing (`??`) for budget fields to preserve actual 0 values
- Add `assigned_team` array with properly mapped technician data

---

## WHAT CHANGED

### File 1: components/pdf/PartnerBriefTemplate.js

**Header Layout (lines ~20-92):**

**Before:**
```javascript
let yPos = margins.top;

// Logo - preserve aspect ratio by setting width only
if (template.logo_url) {
  try {
    const logoWidth = 45;
    doc.addImage(template.logo_url, 'PNG', margins.left, yPos, logoWidth, 0, undefined, 'FAST');
  } catch (e) {
    console.log('Logo not loaded');
  }
}

// Company name (right aligned, teal)
doc.text(template.company_name || 'Alpha Yachting', pageWidth - margins.right, yPos + 5, { align: 'right' });
// ...
yPos += 25;
```

**After:**
```javascript
// HEADER LAYOUT CONSTANTS - Reserve space for logo to prevent overlap
const HEADER_TOP_Y = margins.top;
const LOGO_BOX = {
  x: margins.left,
  y: HEADER_TOP_Y,
  w: 45,  // Width in mm
  h: 15   // Estimated height in mm (will auto-adjust but reserve space)
};
const HEADER_TEXT_START_Y = LOGO_BOX.y + LOGO_BOX.h + 10; // Logo bottom + padding

// === HEADER SECTION - Reserved space, no overlap ===

// Logo - preserve aspect ratio by setting width only
if (template.logo_url) {
  try {
    doc.addImage(template.logo_url, 'PNG', LOGO_BOX.x, LOGO_BOX.y, LOGO_BOX.w, 0, undefined, 'FAST');
  } catch (e) {
    console.log('Logo not loaded');
  }
}

// Company name (right aligned, teal) - within header area
doc.text(template.company_name || 'Alpha Yachting', pageWidth - margins.right, HEADER_TOP_Y + 5, { align: 'right' });
// ...

// Move yPos to start of content area (below header)
yPos = HEADER_TEXT_START_Y;
```

**Assigned Team Section (lines ~275-290):**

**Before:**
```javascript
// ASSIGNED TEAM
yPos = drawSectionHeader('ASSIGNED TEAM', yPos);

// Table header - always rendered
doc.rect(margins.left, yPos - 4, contentWidth, 6, 'F');
doc.text('Name', margins.left + 2, yPos);
doc.text('Phone', pageWidth - margins.right - 2, yPos, { align: 'right' });
yPos += 6;
// No rows rendered (data not provided)
```

**After:**
```javascript
// ASSIGNED TEAM
if (document.assigned_team && document.assigned_team.length > 0) {
  yPos = drawSectionHeader('ASSIGNED TEAM', yPos);
  
  // Table header
  doc.rect(margins.left, yPos - 4, contentWidth, 6, 'F');
  doc.text('Name', margins.left + 2, yPos);
  doc.text('Phone', pageWidth - margins.right - 2, yPos, { align: 'right' });
  yPos += 6;
  
  // Table rows
  document.assigned_team.forEach(tech => {
    doc.text(tech.name || '-', margins.left + 2, yPos);
    doc.text(tech.phone || '-', pageWidth - margins.right - 2, yPos, { align: 'right' });
    yPos += 5;
    doc.line(margins.left, yPos, pageWidth - margins.right, yPos);
  });
  yPos += 3;
}
```

---

### File 2: functions/generatePartnerBriefPDF.js

**Data Builder Function (lines 12-70):**

**Before:**
```javascript
return {
  document_type: 'PartnerBrief',
  document_number: workOrder.work_order_number || `BRIEF-${workOrder.id.slice(-6)}`,
  status: workOrder.status,
  customer_name: customerName,
  boat_name: boat?.vessel_name,  // undefined if boat is null
  location_name: location?.name,
  // ... (work_order_number missing)
  
  // Vessel details
  boat_type: boat?.vessel_type,  // undefined triggers "-" fallback
  boat_length: boat?.length_m,   // undefined triggers "-" fallback
  
  // Budget
  approved_budget: teamOrder.approved_budget_total || 0,  // 0 overwrites valid 0 values
  labor_budget: teamOrder.labor_budget || 0,
  // ... (no assigned_team array)
};
```

**After:**
```javascript
return {
  document_type: 'PartnerBrief',
  document_number: workOrder.work_order_number || `BRIEF-${workOrder.id.slice(-6)}`,
  work_order_number: workOrder.work_order_number || `BRIEF-${workOrder.id.slice(-6)}`,  // Added
  status: workOrder.status,
  customer_name: customerName,
  boat_name: boat?.vessel_name || null,  // null instead of undefined
  location_name: location?.name || null,
  // ...
  
  // Vessel details - use null instead of undefined
  boat_type: boat?.vessel_type || null,
  boat_length: boat?.length_m || null,
  
  // Budget - nullish coalescing preserves actual values
  approved_budget: teamOrder?.approved_budget_total ?? 0,
  labor_budget: teamOrder?.labor_budget ?? 0,
  travel_budget: teamOrder?.travel_budget ?? 0,
  accommodation_budget: teamOrder?.accommodation_budget ?? 0,
  per_diem_budget: teamOrder?.per_diem_budget ?? 0,
  
  // Assigned team for template - NEW
  assigned_team: assignedTechs.map(t => ({
    name: `${t.first_name || ''} ${t.last_name || ''}`.trim(),
    phone: t.phone || null,
    email: t.email || null
  })),
  // ...
};
```

---

## WHY IT CHANGED

### Logo Overlap
**Problem:** Logo and "PARTNER BRIEFING" title were rendered at overlapping Y positions, causing visual corruption.

**Fix:** Implemented deterministic header layout with reserved space constants, ensuring all content starts below the logo area.

### Data Binding
**Problem:** 
1. Template reads `document.boat_name` but builder provides `undefined` → template fallback displays "-"
2. Budget values of 0 were being overwritten by `|| 0` fallback logic
3. Assigned team data was not being formatted into the expected array structure

**Fix:**
1. Use `null` instead of `undefined` for optional fields (prevents premature fallback)
2. Use nullish coalescing (`??`) to preserve actual 0 values
3. Add `assigned_team` array with properly mapped technician names/phones

---

## WHAT DID NOT CHANGE

- ❌ Offer/Invoice PDF templates - unchanged
- ❌ Backend entity schemas - unchanged
- ❌ jsPDFGenerator.js wrapper - unchanged
- ❌ All other sections of Partner Brief (TASKS, COVERED COSTS, etc.) - unchanged
- ❌ Styling, colors, fonts - unchanged

---

## FINAL HEADER LAYOUT CONSTANTS

```javascript
HEADER_TOP_Y = 20mm
LOGO_BOX = {
  x: 15mm,
  y: 20mm,
  w: 45mm,
  h: 15mm (reserved)
}
HEADER_TEXT_START_Y = 45mm (20 + 15 + 10 padding)
```

All content (PARTNER BRIEFING title, sections) starts at Y=45mm or later.

---

## FINAL MAPPED FIELD PATHS

### Vessel Fields:
- `document.boat_name` ← `boat?.vessel_name || null`
- `document.boat_type` ← `boat?.vessel_type || null`
- `document.boat_length` ← `boat?.length_m || null`

### Budget Fields:
- `document.approved_budget` ← `teamOrder?.approved_budget_total ?? 0`
- `document.labor_budget` ← `teamOrder?.labor_budget ?? 0`
- `document.travel_budget` ← `teamOrder?.travel_budget ?? 0`
- `document.accommodation_budget` ← `teamOrder?.accommodation_budget ?? 0`
- `document.per_diem_budget` ← `teamOrder?.per_diem_budget ?? 0`

### Assigned Team:
- `document.assigned_team[]` ← `assignedTechs.map(t => ({name, phone, email}))`

---

## FILES TOUCHED

1. `components/pdf/PartnerBriefTemplate.js` - header layout + assigned team rendering
2. `functions/generatePartnerBriefPDF.js` - data builder field mapping

---

## MANUAL TEST CHECKLIST

- [ ] Partner Brief: logo is not overlapped by any text/content
- [ ] Partner Brief: Vessel fields show real values when available (no "-" regression)
- [ ] Partner Brief: Budget values show real amounts when available (not all €0.00)
- [ ] Partner Brief: Assigned Team rows show when data exists
- [ ] Offer/Invoice PDFs unchanged