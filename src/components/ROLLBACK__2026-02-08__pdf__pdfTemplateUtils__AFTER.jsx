# AFTER SNAPSHOT: components/pdf/pdfTemplateUtils (Safety Clause Integration)
Date: 2026-02-08
Purpose: After adding safety compliance clause rendering in PDF

Changes made:
1. Added CSS styles for .safety-compliance, .safety-title, .safety-text (lines ~457-474)
2. Added Safety & Environmental Compliance section after Eigentumsvorbehalt (lines ~653-659)
3. Section only renders for offers (not invoices) when safety_compliance_clause exists
4. Title shows in German or English based on document.language
5. Clause text rendered as-is from document.safety_compliance_clause