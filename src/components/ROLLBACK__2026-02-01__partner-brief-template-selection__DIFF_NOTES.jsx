# DIFF NOTES - Partner Brief Template Selection + Dedicated Structure Restoration
## Date: 2026-02-01

---

## ROOT CAUSE SUMMARY

**Why template selection was missing:**
- PDFExportButton (unified print function) only accepted `document` and `lineItems` props
- `loadTemplate()` function always loaded first default template, no way to specify which template
- No mechanism to select Partner Brief template vs Offer template

**Why Partner Brief used Offer structure:**
- Previous fix (work-order-partner-brief) used minimal/generic document structure
- All content was dumped into single `public_notes` field as concatenated string
- No semantic field structure matching Partner Brief requirements
- jsPDFGenerator couldn't differentiate sections properly

---

## FILES TOUCHED: 2

**Modified:**
1. `components/pdf/PDFExportButton.js` - Added templateId prop and selection logic
2. `pages/WorkOrderDetail.js` - Restored Partner Brief structure + passed templateId

**Not Modified:**
- jsPDFGenerator.js (unchanged, already handles document_type)
- PDFTemplate entity (unchanged)
- Offer print functions (unchanged)
- Backend functions (unchanged)

---

## TEMPLATE ID USED FOR PARTNER BRIEF

**Exact templateId string:** `"PartnerBrief"`

**Selection mechanism:**
```javascript
// In PDFExportButton.js (lines 20-32):
const loadTemplate = async () => {
  const templates = await base44.entities.PDFTemplate.list();
  
  // If specific templateId provided, use that
  let selectedTemplate = null;
  if (templateId) {
    selectedTemplate = templates.find(t => 
      t.id === templateId || t.template_name === templateId
    );
  }
  
  // Otherwise use default template
  const defaultTemplate = selectedTemplate || 
    templates.find(t => t.is_default) || 
    templates[0];
  
  return defaultTemplate;
};
```

**Matching logic:**
- Searches by `id` field first
- Falls back to `template_name` field
- If no match or no templateId, uses default behavior (backward compatible)

---

## FINAL PARTNER BRIEF DATA OBJECT SHAPE

**Field names (matching reference PDF structure):**

```javascript
{
  // Header
  document_type: 'PartnerBrief',
  document_title: 'PARTNER BRIEFING',
  
  // Work Order Information
  work_order_number: string,
  work_order_title: string,
  work_order_status: string,
  scheduled_date: string,
  
  // Customer & Vessel
  customer_name: string,
  vessel_name: string,
  vessel_type: string,
  vessel_length: string,
  
  // Location & Access
  location_name: string,
  location_address: string,
  location_access_notes: string,
  
  // Work Description
  work_description: string,
  
  // Cost Coverage & Budget
  budget_total: number,
  budget_labor: number,
  budget_travel: number,
  budget_accommodation: number,
  budget_per_diem: number,
  
  // Covered Costs (structured object)
  covered_costs: {
    accommodation: { enabled: bool, max_per_night: number },
    per_diem: { enabled: bool, rate_per_day: number },
    mileage: { enabled: bool, rate_per_km: number, cap_total: number },
    travel_time: { enabled: bool, rate_per_hour: number }
  },
  
  // Approval Requirements
  approval_requirements: {
    preapproval_over: number,
    budget_exceed_requires_approval: bool
  },
  
  // Assigned Team (array)
  assigned_team: [
    { name: string, phone: string }
  ],
  
  // Additional notes
  partner_notes: string,
  safety_notes: string,
  
  // System fields
  id: string,
  document_number: string,
  issue_date: string,
  currency: 'EUR',
  language: string
}
```

**Line items structure (Tasks & Checklist):**
```javascript
[
  {
    sort_order: number,
    title: string,
    description: string,
    estimated_time: string (e.g. "2h"),
    quantity: 1,
    unit: 'Task'
    // pricing fields zeroed for checklist
  }
]
```

---

## IMPLEMENTATION SUMMARY

### components/pdf/PDFExportButton.js

**Line 13:** Added `templateId = null` prop to function signature
- Optional, defaults to null for backward compatibility
- Type: string (can be template ID or template name)

**Lines 20-32:** Modified `loadTemplate()` function
- Added template search by ID or name if templateId provided
- Preserves existing default template logic as fallback
- No breaking changes to existing callers

---

### pages/WorkOrderDetail.js

**Lines 328-411:** Complete rebuild of `getPartnerBriefPDFDocument()`

**BEFORE (wrong):**
```javascript
return {
  document_type: 'PartnerBrief',
  customer_name: string,
  boat_name: string,
  public_notes: "giant concatenated string with all content",
  total: number
}
```

**AFTER (correct):**
```javascript
return {
  document_type: 'PartnerBrief',
  // 10+ semantic sections with structured data
  work_order_number: ...,
  customer_name: ...,
  vessel_name: ...,
  location_name: ...,
  work_description: ...,
  budget_total: ...,
  covered_costs: { accommodation: {...}, per_diem: {...} },
  approval_requirements: {...},
  assigned_team: [{...}],
  ...
}
```

**Lines 413-431:** Modified `getPartnerBriefPDFLineItems()`
- Returns tasks as checklist items with estimated_time field
- No pricing calculations (unit_price = 0)
- Removed budget line item (now in structured budget section)

**Line 727:** Added `templateId="PartnerBrief"` prop
- Explicitly selects Partner Brief template
- Prevents fallback to Offer template

---

## WHAT CHANGED

**BEFORE (Template Selection):**
```
User clicks "Preview PDF"
  ↓
PDFExportButton → loadTemplate()
  ↓
Load first default template (could be Offer)
  ↓
Generate PDF with wrong template
```

**AFTER (Template Selection):**
```
User clicks "Preview PDF"
  ↓
PDFExportButton(templateId="PartnerBrief")
  ↓
loadTemplate() searches for PartnerBrief template
  ↓
Generate PDF with correct template
```

**BEFORE (Data Structure):**
```
document = {
  public_notes: "Work Order: ...\n\nCustomer: ...\n\nCovered Costs: ..."
}
```

**AFTER (Data Structure):**
```
document = {
  work_order_number: "WO281015",
  customer_name: "Manfred Petauschnig",
  vessel_name: "UN",
  location_name: "Novigrad Marina",
  work_description: "Unterwasserschiff...",
  covered_costs: {
    accommodation: { enabled: true, max_per_night: 46 },
    per_diem: { enabled: true, rate_per_day: 10 }
  },
  assigned_team: [{ name: "Tomaz B", phone: "-" }]
}
```

---

## WHAT DID NOT CHANGE

✅ **Offer Print** - unchanged, still works without templateId (uses default)  
✅ **Team Order Detail PDF** - unchanged (already had Partner Brief structure)  
✅ **jsPDFGenerator.js** - unchanged (already handles document_type switching)  
✅ **PDFTemplate entity** - unchanged (no schema modifications)  
✅ **Backend functions** - unchanged  
✅ **Other PDFExportButton callers** - backward compatible (templateId optional)  

---

## REFERENCE PDF COMPLIANCE

**Sections from reference PDF → Implementation mapping:**

| PDF Section | Implementation Field |
|------------|---------------------|
| PARTNER BRIEFING header | `document_title: 'PARTNER BRIEFING'` |
| Generated timestamp | Auto-added by generator |
| Work Order # | `work_order_number` |
| Title | `work_order_title` |
| Status | `work_order_status` |
| Scheduled Date | `scheduled_date` |
| Customer | `customer_name` |
| Vessel | `vessel_name` |
| Type | `vessel_type` |
| Length | `vessel_length` |
| Location | `location_name` |
| Address | `location_address` |
| Access Notes | `location_access_notes` |
| Work Description | `work_description` |
| Tasks & Checklist table | `lineItems` array |
| Budget table | `budget_*` fields |
| Covered Costs bullets | `covered_costs` object |
| Approval Requirements | `approval_requirements` object |
| Assigned Team table | `assigned_team` array |

**All required sections present:** ✅

---

## MANUAL TEST CHECKLIST

**Partner Brief (Work Order Detail):**
- [ ] Navigate to Work Order Detail page with Team Order
- [ ] Click "Preview PDF" button in Team Order card
- [ ] EXPECT: PDF Viewer modal opens
- [ ] EXPECT: PDF title shows "PARTNER BRIEFING" (not Offer)
- [ ] EXPECT: Work Order Information section with WO#, Title, Status, Scheduled Date
- [ ] EXPECT: Customer & Vessel section with all fields
- [ ] EXPECT: Location & Access section with address and access notes
- [ ] EXPECT: Work Description section with description text
- [ ] EXPECT: Tasks & Checklist table with task titles and estimated times
- [ ] EXPECT: Cost Coverage & Budget table with Total, Labor, Travel, Accommodation, Per Diem
- [ ] EXPECT: Covered Costs section with bullet points (accommodation rate, per diem, mileage, travel time)
- [ ] EXPECT: Approval Requirements section with pre-approval threshold
- [ ] EXPECT: Assigned Team table with technician names and phones
- [ ] EXPECT: Footer with confidentiality note
- [ ] EXPECT: NO Offer-style line items table with pricing/totals
- [ ] Click "Download PDF"
- [ ] EXPECT: PDF downloads with correct structure

**Offer Print (No Regression):**
- [ ] Navigate to Offer Detail page
- [ ] Click "Preview PDF"
- [ ] EXPECT: PDF shows Offer structure (NOT Partner Brief)
- [ ] EXPECT: Line items table with pricing visible
- [ ] EXPECT: Payment terms section visible

**Team Order Detail PDF:**
- [ ] Navigate to Team Order Detail page
- [ ] Click "Preview PDF"
- [ ] EXPECT: Same Partner Brief structure as Work Order Detail

---

## ROLLBACK INSTRUCTIONS

If template selection breaks:

1. **Restore PDFExportButton.js:**
```javascript
// Line 13: Remove templateId prop
export default function PDFExportButton({ document: documentData, lineItems, payments = [], variant = "outline" }) {

// Lines 20-24: Restore original loadTemplate
const loadTemplate = async () => {
  try {
    const templates = await base44.entities.PDFTemplate.list();
    const defaultTemplate = templates.find(t => t.is_default) || templates[0];
    // ... rest unchanged
  }
};
```

2. **Restore WorkOrderDetail.js getPartnerBriefPDFDocument():**
```javascript
// Use previous version from BEFORE_v2 snapshot (lines 328-411)
// Restore simple structure with public_notes field
```

3. **Remove templateId prop from PDFExportButton call:**
```javascript
// Line 727: Remove templateId
<PDFExportButton 
  document={getPartnerBriefPDFDocument()}
  lineItems={getPartnerBriefPDFLineItems()}
  variant="default"
/>
```

---

**END OF DIFF NOTES**