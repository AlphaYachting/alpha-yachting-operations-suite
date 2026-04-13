# PARTNER BRIEF DIAGNOSTIC REPORT
## Date: 2026-02-01
## Issue: WorkOrderDetail generates Partner Brief with missing vessel/budget data

---

## CONFIRMED CALL STACKS

### TEAM-ORDER PATH (✅ WORKS - Document 2)
```
TeamOrderDetail.jsx (line 110-182)
  → base44.functions.invoke('generatePartnerBriefPDF', {workOrderId, teamOrderId, templateData})
    → functions/generatePartnerBriefPDF.js
      → Fetches ALL entities fresh from database
      → Uses jsPDF.text() directly
      → Output: Simple PDF with correct data
```

**Data Flow:**
- workOrderId: passed explicitly
- teamOrderId: passed explicitly  
- Backend loads: WorkOrder, TeamOrder, Jobs, Customers, Boats, Locations, Tasks, Technicians
- Finds relations: `boat = boats.find(b => b.id === job?.boat_id)`
- **Result:** ✅ Vessel "Atlanic 47 Daniela", Budget "€3500.00"

---

### WORK-ORDER PATH (❌ BROKEN - Document 1)
```
WorkOrderDetail.jsx (lines 330-420, 807-812)
  → getPartnerBriefPDFDocument() - builds document object from page state
    → <PDFExportButton document={...} lineItems={...} templateId="PartnerBrief">
      → components/pdf/PDFExportButton.jsx
        → generatePDFWithJsPDF(documentData, lineItems, templateData)
          → components/pdf/jsPDFGenerator.js
            → Uses styled/templated PDF generation
            → Output: Styled PDF with MISSING data
```

**Data Flow:**
- WorkOrderDetail loads: workOrder, job, customer, boat, location, teamOrder (in page state)
- `getPartnerBriefPDFDocument()` builds document object from these state variables
- Document object passed to PDFExportButton
- **CRITICAL:** PDFExportButton expects document structure, but...
- **Result:** ❌ Vessel "-", Budget "€0.00"

---

## ROOT CAUSE ANALYSIS

**PRIMARY ISSUE:** Field name mismatch between document builder and PDF generator

### WorkOrderDetail.jsx (lines 330-420) builds document with:
```javascript
{
  // Vessel fields
  vessel_name: boat?.vessel_name || 'Unknown',
  vessel_type: boat?.vessel_type || 'Unknown',
  vessel_length: boat?.length_m ? `${boat.length_m}m` : 'Unknown',
  
  // Budget fields  
  budget_total: teamOrder.approved_budget_total || 0,
  budget_labor: teamOrder.labor_budget || 0,
  budget_travel: teamOrder.travel_budget || 0,
  budget_accommodation: teamOrder.accommodation_budget || 0,
  budget_per_diem: teamOrder.per_diem_budget || 0,
}
```

### BUT jsPDFGenerator.js (PartnerBrief template) expects DIFFERENT keys:
```javascript
{
  // Expected fields (from observation of HTML output in error):
  boat_name: ...,        // NOT vessel_name
  boat_type: ...,        // NOT vessel_type
  boat_length: ...,      // NOT vessel_length
  
  approved_budget: ...,  // NOT budget_total
  labor_budget: ...,     // ✅ matches
  travel_budget: ...,    // ✅ matches
}
```

**Secondary Issues:**
1. Document type mismatch: `document_type: 'PartnerBrief'` but template might expect different identifier
2. Budget defaults: `|| 0` causes `€0.00` display instead of showing missing data flag
3. Vessel defaults: `|| 'Unknown'` becomes `'-'` in template rendering

---

## EVIDENCE

**Document 1 (Work-Order Path - BROKEN):**
- Vessel: "-" (should be "Atlanic 47 Daniela")
- Type: "-" (should be "Motorboat")
- Length: "-" (should be "14m")
- Budget: "€0.00" (should be "€3500.00")

**Document 2 (Team-Order Path - WORKS):**
- Vessel: "Atlanic 47 Daniela" ✅
- Type: "Motorboat" ✅
- Length: "14m" ✅
- Budget: "€3500.00" ✅

---

## MINIMAL FIX RECOMMENDATION

**Option 1: Fix Field Names in WorkOrderDetail.jsx (RECOMMENDED)**
Change getPartnerBriefPDFDocument() to use keys that match jsPDFGenerator expectations:

```javascript
// BEFORE (lines 354-357):
vessel_name: boat?.vessel_name || 'Unknown',
vessel_type: boat?.vessel_type || 'Unknown',
vessel_length: boat?.length_m ? `${boat.length_m}m` : 'Unknown',

// AFTER:
boat_name: boat?.vessel_name || null,
boat_type: boat?.vessel_type || null,
boat_length: boat?.length_m || null,
```

```javascript
// BEFORE (lines 368-372):
budget_total: teamOrder.approved_budget_total || 0,
budget_labor: teamOrder.labor_budget || 0,
budget_travel: teamOrder.travel_budget || 0,
budget_accommodation: teamOrder.accommodation_budget || 0,
budget_per_diem: teamOrder.per_diem_budget || 0,

// AFTER:
approved_budget: teamOrder.approved_budget_total || 0,
labor_budget: teamOrder.labor_budget || 0,
travel_budget: teamOrder.travel_budget || 0,
accommodation_budget: teamOrder.accommodation_budget || 0,
per_diem_budget: teamOrder.per_diem_budget || 0,
```

**Why this is minimal:**
- Changes ONLY 8 key names in ONE function
- No template changes needed
- No backend changes needed
- Aligns with existing jsPDFGenerator expectations

**Alternative Option 2: Fix jsPDFGenerator to accept both key formats**
- More complex: requires conditional logic for field mapping
- Affects template rendering code
- Not recommended (more files touched)

---

## VERIFICATION PLAN

After applying fix:
1. Test Work-Order Partner Brief generation
2. Verify vessel shows "Atlanic 47 Daniela"
3. Verify budget shows "€3500.00"
4. Confirm styled PDF matches Document 2 data accuracy

---

## FILES TO MODIFY (NEXT RUN)

1. **pages/WorkOrderDetail.jsx**
   - Function: `getPartnerBriefPDFDocument()` (lines 330-420)
   - Changes: 8 field name corrections
   - Estimated lines: ~15 changes

**Total scope:** 1 file, 1 function, 8 field renames