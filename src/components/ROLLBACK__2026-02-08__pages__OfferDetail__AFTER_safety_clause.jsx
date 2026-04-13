# AFTER SNAPSHOT: pages/OfferDetail (Safety Clause)
Date: 2026-02-08
Purpose: After adding Safety & Environmental Compliance clause

## Changes Made:
1. Added safety_compliance_clause to formData state initialization
2. Added safety_compliance_clause to offer data loading logic
3. Added handleGenerateSafetyClause function that:
   - Uses InvokeLLM to generate clause
   - Passes offer title, description, tasks as context
   - Respects language setting (DE/EN)
   - Generates 2-5 sentence professional clause
4. Added Safety & Environmental Compliance field in UI with "Generate Clause" button

## Key Implementation Details:
- Language detection: formData.language === 'German' → DE, else EN
- AI prompt is constrained to only generate the clause (no offer rewriting)
- Clause requirements: trained personnel, safety measures, environmental precautions, manufacturer guidelines
- No legal guarantees, no timelines
- User can manually edit generated clause