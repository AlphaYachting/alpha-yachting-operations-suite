# AFTER SNAPSHOT v2 - WorkOrderDetail.js
## Date: 2026-02-01
## Fix: Restored Partner Brief dedicated data structure + explicit template selection

**Changes:**
1. Completely rebuilt `getPartnerBriefPDFDocument()` (lines 328-411):
   - Now returns structured sections matching reference PDF
   - Includes all required fields: work order info, customer & vessel, location & access, work description, budget breakdown, covered costs, approval requirements, assigned team
   - Uses semantic field names instead of generic "public_notes"
2. Modified `getPartnerBriefPDFLineItems()` to format tasks as checklist items with estimated time
3. Added `templateId="PartnerBrief"` prop to PDFExportButton call (line 727)

**File modified at lines: 328-431, 722-730**