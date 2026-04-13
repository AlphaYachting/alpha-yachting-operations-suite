# DIFF NOTES - Partner Brief Dedicated Template Renderer (Option B)
## Date: 2026-02-01

---

## ROOT CAUSE SUMMARY

**Why Partner Brief rendered as Offer:**
- jsPDFGenerator.js had NO document_type branching logic
- ALL documents (Offer, Invoice, Partner Brief) used the same generic renderer
- Generic renderer displays line items table with pricing, totals, payment terms - not Partner Brief sections
- Structured Partner Brief data fields (work_order_number, vessel_name, covered_costs, etc.) were IGNORED

---

## FILES TOUCHED: 2

**Created:**
1. `components/pdf/PartnerBriefTemplate.js` - NEW dedicated renderer for Partner Brief

**Modified:**
2. `components/pdf/jsPDFGenerator.js` - Added routing to PartnerBriefTemplate

**Not Modified:**
- PDFExportButton.js (unchanged, already passes correct data + templateId)
- WorkOrderDetail.js (unchanged, already builds correct data structure)
- Offer/Invoice rendering logic (unchanged - still uses generic renderer)
- Backend functions (unchanged)
- Template entity/schema (unchanged)

---

## CONFIRMED PARTNER BRIEF TEMPLATE ID

**Exact templateId string used:** `"PartnerBrief"`

**Routing logic:**
- WorkOrderDetail.js passes `templateId="PartnerBrief"` to PDFExportButton
- PDFExportButton passes `document.document_type = 'PartnerBrief'` 
- jsPDFGenerator.js checks: `if (document.document_type === 'PartnerBrief')`
- Routes to generatePartnerBriefPDF() instead of generic renderer

---

## RENDERER ROUTING LOGIC

### jsPDFGenerator.js Changes (lines 2, 5-8):

**BEFORE:**
```javascript
import { jsPDF } from 'jspdf';

export async function generatePDFWithJsPDF(document, lineItems, template, payments = []) {
  const isInvoice = document.document_type === 'Invoice';
  // ... generic rendering for everything
}
```

**AFTER:**
```javascript
import { jsPDF } from 'jspdf';
import { generatePartnerBriefPDF } from './PartnerBriefTemplate';

export async function generatePDFWithJsPDF(document, lineItems, template, payments = []) {
  // Route to Partner Brief template if applicable
  if (document.document_type === 'PartnerBrief') {
    return await generatePartnerBriefPDF(document, lineItems, template);
  }
  
  const isInvoice = document.document_type === 'Invoice';
  // ... generic rendering for Offer/Invoice (unchanged)
}
```

**Routing rules:**
1. Check `document.document_type` at function entry
2. If `'PartnerBrief'` → call dedicated template, return immediately
3. Otherwise → fall through to existing Offer/Invoice logic (unchanged)
4. Zero impact on Offer/Invoice rendering

---

## PARTNERBRIEFTEMPLATE SECTIONS IMPLEMENTED

### Section Order (matching reference PDF):

1. **Header**
   - Company logo (left)
   - Company name + address (right)
   - "PARTNER BRIEFING" title (cyan, bold, 18pt)
   - "Generated: DD.MM.YYYY, HH:MM:SS" timestamp

2. **WORK ORDER INFORMATION** (cyan section header)
   - Work Order #
   - Title
   - Status
   - Scheduled Date

3. **CUSTOMER & VESSEL** (cyan section header)
   - Customer
   - Vessel
   - Type
   - Length

4. **LOCATION & ACCESS** (cyan section header)
   - Location
   - Address
   - Access Notes

5. **WORK DESCRIPTION** (cyan section header)
   - Multiline text block (work_description field)

6. **TASKS & CHECKLIST** (cyan section header + table)
   - Table: # | Task | Est. Time
   - Rows from lineItems array
   - Uses estimated_time field from each item

7. **COST COVERAGE & BUDGET** (cyan section header + table)
   - Table: Budget Category | Amount
   - Rows: Total Approved Budget, Labor, Travel, Accommodation, Per Diem
   - Values from budget_* fields

8. **COVERED COSTS** (cyan section header + bullets)
   - Bullet points from covered_costs object:
     - Accommodation per night (if enabled)
     - Per Diem per day (if enabled)
     - Mileage rate + cap (if enabled)
     - Travel Time rate (if enabled)

9. **APPROVAL REQUIREMENTS** (cyan section header + bullets)
   - Pre-approval threshold
   - Budget overage policy

10. **ASSIGNED TEAM** (cyan section header + table)
    - Table: Name | Phone
    - Rows from assigned_team array

11. **Footer**
    - "Company Name | This briefing is confidential and intended for the assigned partner."
    - Centered, gray, small font

---

## DATA FIELD MAPPING

### PartnerBriefTemplate reads these fields from `document` object:

**Header/Company:**
- `template.logo_url`
- `template.company_name`
- `template.company_address`
- `template.primary_color`

**Work Order Information:**
- `document.work_order_number`
- `document.work_order_title`
- `document.work_order_status`
- `document.scheduled_date`

**Customer & Vessel:**
- `document.customer_name`
- `document.vessel_name`
- `document.vessel_type`
- `document.vessel_length`

**Location & Access:**
- `document.location_name`
- `document.location_address`
- `document.location_access_notes`

**Work Description:**
- `document.work_description`

**Tasks (from lineItems array):**
- `lineItems[].title`
- `lineItems[].estimated_time`

**Budget:**
- `document.budget_total`
- `document.budget_labor`
- `document.budget_travel`
- `document.budget_accommodation`
- `document.budget_per_diem`

**Covered Costs (object):**
- `document.covered_costs.accommodation.enabled`
- `document.covered_costs.accommodation.max_per_night`
- `document.covered_costs.per_diem.enabled`
- `document.covered_costs.per_diem.rate_per_day`
- `document.covered_costs.mileage.enabled`
- `document.covered_costs.mileage.rate_per_km`
- `document.covered_costs.mileage.cap_total`
- `document.covered_costs.travel_time.enabled`
- `document.covered_costs.travel_time.rate_per_hour`

**Approval Requirements:**
- `document.approval_requirements.preapproval_over`
- `document.approval_requirements.budget_exceed_requires_approval`

**Assigned Team (array):**
- `document.assigned_team[].name`
- `document.assigned_team[].phone`

**All fields match WorkOrderDetail.js getPartnerBriefPDFDocument() output** ✅

---

## WHAT CHANGED

**BEFORE (Wrong):**
```
Work Order Detail → Partner Brief button
  ↓
PDFExportButton (templateId="PartnerBrief")
  ↓
jsPDFGenerator.js (generic renderer)
  ↓
Renders as Offer:
  - Line items table with pricing
  - Subtotal/Total/VAT
  - Payment terms
  - Ignores work_order_number, vessel_name, covered_costs, etc.
```

**AFTER (Correct):**
```
Work Order Detail → Partner Brief button
  ↓
PDFExportButton (templateId="PartnerBrief", document_type="PartnerBrief")
  ↓
jsPDFGenerator.js → checks document_type
  ↓
Routes to PartnerBriefTemplate.js
  ↓
Renders Partner Brief sections:
  - Work Order Information
  - Customer & Vessel
  - Location & Access
  - Work Description
  - Tasks checklist
  - Budget breakdown
  - Covered costs bullets
  - Approval requirements
  - Assigned team
```

---

## WHAT DID NOT CHANGE

✅ **Offer/Invoice rendering** - Unchanged, still uses generic renderer  
✅ **PDFExportButton.js** - Unchanged, already passes correct props  
✅ **WorkOrderDetail.js** - Unchanged, already builds correct data  
✅ **Template entity/schema** - Unchanged  
✅ **Backend functions** - Unchanged  
✅ **Other print buttons** - Unchanged (Team Order Detail uses same data structure)  

---

## REFERENCE PDF COMPLIANCE

**All required sections present:** ✅

| Reference PDF Section | Implementation | Status |
|----------------------|----------------|--------|
| PARTNER BRIEFING header | Line 97-100 | ✅ |
| Generated timestamp | Line 103-113 | ✅ |
| WORK ORDER INFORMATION | Line 116-121 | ✅ |
| CUSTOMER & VESSEL | Line 124-129 | ✅ |
| LOCATION & ACCESS | Line 132-137 | ✅ |
| WORK DESCRIPTION | Line 140-149 | ✅ |
| TASKS & CHECKLIST table | Line 152-177 | ✅ |
| COST COVERAGE & BUDGET table | Line 180-207 | ✅ |
| COVERED COSTS bullets | Line 210-232 | ✅ |
| APPROVAL REQUIREMENTS | Line 235-247 | ✅ |
| ASSIGNED TEAM table | Line 250-269 | ✅ |
| Footer confidentiality | Line 272-281 | ✅ |

---

## MANUAL TEST CHECKLIST

**Partner Brief (Work Order Detail):**
- [ ] Click "Preview PDF" in Team Order card
- [ ] EXPECT: PDF Viewer opens (no browser print dialog)
- [ ] EXPECT: Title shows "PARTNER BRIEFING" (NOT "OFFER" or "INVOICE")
- [ ] EXPECT: Generated timestamp below title
- [ ] EXPECT: WORK ORDER INFORMATION section with 4 fields
- [ ] EXPECT: CUSTOMER & VESSEL section with 4 fields
- [ ] EXPECT: LOCATION & ACCESS section with 3 fields
- [ ] EXPECT: WORK DESCRIPTION multiline text
- [ ] EXPECT: TASKS & CHECKLIST table with task names and estimated times
- [ ] EXPECT: COST COVERAGE & BUDGET table with 5 rows
- [ ] EXPECT: COVERED COSTS bullet list (rates/caps)
- [ ] EXPECT: APPROVAL REQUIREMENTS bullets
- [ ] EXPECT: ASSIGNED TEAM table with names and phones
- [ ] EXPECT: Footer confidentiality text
- [ ] EXPECT: NO Offer-style pricing table
- [ ] EXPECT: NO subtotal/VAT/total section
- [ ] EXPECT: NO payment terms section
- [ ] Click "Download PDF"
- [ ] EXPECT: PDF downloads correctly

**Offer Print (No Regression):**
- [ ] Navigate to Offer Detail page
- [ ] Click "Preview PDF"
- [ ] EXPECT: Title shows "OFFER" (NOT "PARTNER BRIEFING")
- [ ] EXPECT: Line items table with pricing
- [ ] EXPECT: Subtotal, VAT, Total sections
- [ ] EXPECT: Payment terms section (if applicable)
- [ ] EXPECT: NO Partner Brief sections

---

## ROLLBACK INSTRUCTIONS

If Partner Brief rendering fails:

1. **Delete PartnerBriefTemplate.js:**
```bash
rm components/pdf/PartnerBriefTemplate.js
```

2. **Restore jsPDFGenerator.js:**
```javascript
// Line 1-2: Remove import
import { jsPDF } from 'jspdf';
// Remove: import { generatePartnerBriefPDF } from './PartnerBriefTemplate';

// Line 4-6: Remove routing
export async function generatePDFWithJsPDF(document, lineItems, template, payments = []) {
  // Remove these lines:
  // if (document.document_type === 'PartnerBrief') {
  //   return await generatePartnerBriefPDF(document, lineItems, template);
  // }
  
  const isInvoice = document.document_type === 'Invoice';
  // ... rest unchanged
}
```

3. **Result:** Partner Brief will render as Offer again (previous broken behavior)

---

**END OF DIFF NOTES**