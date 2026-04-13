# BEFORE SNAPSHOT: components/pdf/jsPDFGenerator
Date: 2026-02-08
Purpose: Frontend PDF generator baseline before syncing Offer terms sections

Current issues:
1. Missing Safety & Environmental Compliance clause rendering
2. Eigentumsvorbehalt heading may have corrupted symbols
3. Missing Marina working fees notice
4. Frontend jsPDF generator out of sync with backend template

Note: This is the ACTUAL PDF generator used by UI (not backend Puppeteer)
Export path: OfferDetail → PDFExportButton → generatePDFWithJsPDF → THIS FILE