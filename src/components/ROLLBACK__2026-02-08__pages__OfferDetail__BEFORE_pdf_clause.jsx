# BEFORE SNAPSHOT: pages/OfferDetail (PDF Clause Integration)
Date: 2026-02-08
Purpose: Baseline before adding safety_compliance_clause to PDF document data

Current state:
- getPDFDocument() function at lines 439-480
- Returns document object with language field (line 478)
- Does NOT include safety_compliance_clause in PDF data
- Need to add it for PDF template rendering