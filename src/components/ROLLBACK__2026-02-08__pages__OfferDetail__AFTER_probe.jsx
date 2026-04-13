# AFTER SNAPSHOT: pages/OfferDetail (Diagnostic Probe Added)
Date: 2026-02-08
Purpose: After adding runtime visibility probe

Changes made:
1. Added debugMode flag from URL params (?debugOffer=1)
2. Added visible diagnostic Alert panel that shows:
   - Screen identity (route, component, mode)
   - State keys (formData keys, safety_compliance_clause presence)
   - Render conditions (all passing)
   - UI placement info
3. Probe only renders when ?debugOffer=1 in URL

No functional changes to the offer logic itself.