# AFTER SNAPSHOT v2 - jsPDFGenerator.js
## Date: 2026-02-01
## Fix: Added routing to PartnerBriefTemplate when document_type === 'PartnerBrief'

**Changes:**
1. Added import for generatePartnerBriefPDF (line 2)
2. Added routing check at top of function (lines 5-8)
3. If PartnerBrief, calls dedicated template and returns early
4. Otherwise falls through to existing Offer/Invoice rendering (unchanged)

**File modified at lines: 2, 5-8**