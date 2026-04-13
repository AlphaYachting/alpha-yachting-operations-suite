# PARTNER BRIEF GENERATION CALL STACKS
## Date: 2026-02-01

## TEAM-ORDER PRINT CALL STACK (Produces CORRECT PDF - Document 2)

1. **Entry Point:** `pages/TeamOrderDetail.jsx` lines 110-182
   - Preview Brief button (line 140)
   - Download Brief button (line 164)

2. **Handler:** onClick → `base44.functions.invoke('generatePartnerBriefPDF', { workOrderId, teamOrderId, templateData })`
   - workOrderId: from teamOrder.work_order_id
   - teamOrderId: from URL param `?id={teamOrderId}`
   - templateData: PDFTemplate entity loaded from database

3. **Backend Function:** `functions/generatePartnerBriefPDF.js`
   - Fetches all entities using service role
   - Finds relations: job → customer, boat, location
   - Generates PDF using jsPDF.text() directly

4. **Output:** Simple PDF with text-based layout
   - ✅ Vessel: "Atlanic 47 Daniela"
   - ✅ Type: "Motorboat"  
   - ✅ Length: "14m"
   - ✅ Budget: "€3500.00"

---

## WORK-ORDER PRINT CALL STACK (Produces WRONG PDF - Document 1)

1. **Entry Point:** `pages/WorkOrderDetail.jsx` lines 807-812
   - Team Order card section (when teamOrder exists)
   - PDFExportButton component

2. **Data Builder:** `getPartnerBriefPDFDocument()` lines 330-420
   - **Key Observation:** Builds document from local state variables
   - Relies on `customer`, `boat`, `location`, `teamOrder` already loaded
   - Returns structured document object (NOT sent to backend!)

3. **Component:** `<PDFExportButton>` component (components/pdf/PDFExportButton.jsx)
   - Receives: `document`, `lineItems`, `templateId="PartnerBrief"`
   - **UNKNOWN PATH:** Need to read this component to see what it does

4. **Backend/Generator:** UNKNOWN - likely different from generatePartnerBriefPDF

5. **Output:** Styled PDF with templated layout
   - ❌ Vessel: "-"
   - ❌ Type: "-"  
   - ❌ Length: "-"
   - ❌ Budget: "€0.00"

---

## HYPOTHESIS

The PDFExportButton component likely:
- Uses a different PDF generator (maybe `generatePDFWithJsPDF` or template-based)
- Receives document object but mapping is broken
- Budget fields mismatch (expects different key names)
- Vessel fields not properly mapped from document object

**Next Step:** Read PDFExportButton.jsx to confirm generation path