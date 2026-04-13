# BEFORE SNAPSHOT: functions/generateOfferPDF (Template Sync)
Date: 2026-02-08
Purpose: Backend template baseline before syncing with frontend pdfTemplateUtils

Current state:
- Lines 4-164: OLD simplified template
- Missing: Payment Terms box, Eigentumsvorbehalt section, Safety Clause
- Different CSS structure than frontend
- Line 6 now has space after € but rest of template is outdated
- Backend template is completely out of sync with components/pdf/pdfTemplateUtils

This explains why PDFs still show issues - the backend uses a different template!