# BEFORE SNAPSHOT: functions/generateOfferPDF
Date: 2026-02-08
Purpose: Backend PDF generator baseline before applying all readability fixes

Current issues:
1. Line 6: const currency = document.currency === 'EUR' ? '€' : document.currency; (NO SPACE)
2. Missing proper sections: Payment Terms, Eigentumsvorbehalt, Safety Clause
3. Old simplified template - not aligned with frontend pdfTemplateUtils
4. This is the ACTUAL generator used for PDF export

Note: This backend function has its own embedded buildPDFHTML that differs from components/pdf/pdfTemplateUtils