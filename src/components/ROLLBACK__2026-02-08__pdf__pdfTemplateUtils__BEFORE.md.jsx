# BEFORE SNAPSHOT: components/pdf/pdfTemplateUtils (Safety Clause Integration)
Date: 2026-02-08
Purpose: Baseline before adding safety compliance clause rendering after Eigentumsvorbehalt

Current state:
- buildPDFHTML function generates full PDF HTML
- Eigentumsvorbehalt section at lines 645-651 (retention of title)
- No safety compliance clause rendering
- Need to add clause section after Eigentumsvorbehalt for offers