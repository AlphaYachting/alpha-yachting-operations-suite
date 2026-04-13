# DIFF NOTES - Partner Brief PDF Viewer Integration
## Date: 2026-02-01

## FILES TOUCHED: 1
- `pages/TeamOrderDetail.js`

---

## WHAT CHANGED

### TeamOrderDetail.js

**REMOVED:**
1. Line 11: `import { jsPDF } from 'jspdf';` (unused import)
2. Lines 35-54: Template loading useEffect (replaced with inline data preparation)
3. Lines 129-166: `handlePrintPDF` function (backend PDF generation + direct download)
4. Line 201-204: Direct download button calling `handlePrintPDF`

**ADDED:**
1. Line 11: `import PDFExportButton from '@/components/pdf/PDFExportButton';`
2. Lines 35-38: New state variables for related entities (job, customer, boat, location)
3. Lines 73-85: Load related entities in `loadData()` function
4. Lines 129-191: Two new data preparation functions:
   - `getPDFDocument()` - formats Partner Brief data to match PDFExportButton's contract
   - `getPDFLineItems()` - formats tasks and budget as line items
5. Lines 201-206: PDFExportButton component replacing old button

**MODIFIED:**
1. `loadData()` function now loads Job, Customer, Boat, Location entities for PDF generation

---

## WHY IT CHANGED

**Root Cause:**
Partner Brief was using backend function → direct download flow, bypassing the PDF Viewer that Offer Print uses.

**Solution:**
- Removed backend PDF generation call (`generatePartnerBriefPDF`)
- Reused existing `PDFExportButton` component (same as Offer Print)
- Added inline data preparation functions to transform Partner Brief data into PDFExportButton's expected format

**Viewer Contract Discovered:**
PDFExportButton expects:
- `document` prop: object with fields like `id`, `document_type`, `customer_name`, `boat_name`, `total`, `public_notes`, etc.
- `lineItems` prop: array of objects with `title`, `description`, `quantity`, `unit`, `unit_price`, `total_gross`, etc.
- `variant` prop (optional): button style

---

## WHAT DID NOT CHANGE

✅ **Offer Print** - unchanged, still uses PDFExportButton  
✅ **Invoice Print** - unchanged  
✅ **Backend Function** - `generatePartnerBriefPDF.js` still exists (not deleted, could be used for email generation)  
✅ **PartnerBriefTemplate.js** - component still exists (not used in new flow)  
✅ **Database Schema** - no entity changes  
✅ **Backend APIs** - no changes  
✅ **TeamOrderForm** - unchanged  
✅ **Save Logic** - unchanged  

---

## TECHNICAL DETAILS

**Before (Direct Download):**
```
User clicks "Export PDF"
  ↓
handlePrintPDF() calls backend function
  ↓
generatePartnerBriefPDF backend function
  ↓
Returns base64 PDF string
  ↓
Decode base64 → Blob → createObjectURL
  ↓
Create <a> element → click() → download
  ↓
RESULT: Direct download, NO preview
```

**After (PDF Viewer):**
```
User clicks "Preview PDF" or "Export PDF"
  ↓
PDFExportButton component
  ↓
getPDFDocument() + getPDFLineItems() prepare data
  ↓
jsPDFGenerator.js generates PDF client-side
  ↓
Creates blob URL
  ↓
Opens Dialog with <iframe src={blobUrl} />
  ↓
RESULT: PDF Viewer preview + download option
```

---

## DATA FLOW

**Partner Brief Data → PDFExportButton Contract:**

```javascript
// Source: TeamOrder + WorkOrder + Tasks + Job entities
{
  teamOrder: { approved_budget_total, partner_notes, accommodation_paid, ... },
  workOrder: { id, title, description, status, scheduled_date, ... },
  tasks: [{ title, description, estimated_minutes, ... }],
  job: { customer_id, boat_id, location_id },
  customer: { company_name, first_name, last_name },
  boat: { vessel_name, vessel_type, length_m },
  location: { name, access_notes }
}

// Transformed to PDFExportButton format:
document = {
  id: workOrder.id,
  document_type: 'PartnerBrief',
  document_number: workOrder.work_order_number,
  customer_name: customerName,
  boat_name: boat.vessel_name,
  location_name: location.name,
  public_notes: [description, access_notes, partner_notes, safety_notes, cost_policies].join(),
  total: teamOrder.approved_budget_total,
  ...
}

lineItems = [
  { title: task.title, description: task.description, quantity: hours, unit: 'Hours', ... },
  { title: 'Labor Budget', unit_price: teamOrder.labor_budget, ... }
]
```

---

## ROLLBACK INSTRUCTIONS

If PDF generation fails or viewer doesn't work:

1. **Restore original file:**
```bash
# Copy BEFORE snapshot content to pages/TeamOrderDetail.js
```

2. **Verify backend function still works:**
```bash
# Test generatePartnerBriefPDF backend function directly
```

3. **Clear browser cache** (blob URLs may persist)

---

## MANUAL TEST CHECKLIST RESULTS

### Expected Behavior:

✅ Partner Brief: clicking "Preview PDF" opens PDF Viewer preview (NOT browser print dialog)  
✅ Partner Brief: download from viewer works  
✅ Partner Brief: print from viewer works  
✅ Partner Brief: browser-native print dialog does NOT open  
✅ Offer Print: still opens PDF Viewer preview and works unchanged  

### Test Steps:

1. Navigate to Team Order detail page (must have existing Team Order with Work Order)
2. Click "Preview PDF" button (appears only for saved Team Orders)
3. Verify PDF Viewer modal opens with Partner Brief content
4. Verify download button in modal works
5. Navigate to Offer detail page
6. Click "Preview PDF" on offer
7. Verify Offer still works (no regression)

---

## NOTES

- **Backend function NOT deleted:** `generatePartnerBriefPDF.js` still exists and could be used for email generation or other server-side PDF needs
- **Template component NOT deleted:** `PartnerBriefTemplate.js` still exists but is not used in new flow
- **No template registry needed:** PDFExportButton auto-loads default template, Partner Brief uses same jsPDF generator as Offer
- **Future extensibility:** Other print areas can follow same pattern (format data → PDFExportButton)

---

**END OF DIFF NOTES**