# DIFF NOTES: Offer Templates Feature
Date: 2026-02-08
Feature: Save Offer as Template and Create Offer from Template

---

## WHAT CHANGED

### NEW ENTITIES (2 files)
1. **entities/OfferTemplate.json**
   - Stores reusable offer structure
   - Fields: template_name, title, description, customer_notes, language, vat_rate, payment terms
   - NO customer data, dates, or entity references

2. **entities/OfferTemplateLineItem.json**
   - Stores template line items (tasks structure)
   - Fields: template_id, title, description, unit_type, quantity, unit_price, is_optional, notes
   - NO offer_id linkage

### NEW COMPONENT (1 file)
3. **components/offers/TemplateSelector.jsx**
   - Modal dialog for selecting templates
   - Searchable list of templates
   - Loads template + line items on selection
   - Passes data via callback to parent

### MODIFIED FILES (2 files)

4. **pages/Offers**
   - Added "From Template" button in header (line 203-220)
   - Added TemplateSelector modal
   - Added handleSelectTemplate function (stores template in sessionStorage)
   - NO changes to existing offer creation flow
   - NO changes to duplicate, delete, or filter functionality

5. **pages/OfferDetail**
   - Added useEffect to load template data from sessionStorage (lines ~85-115)
   - Added handleSaveAsTemplate function (lines ~162-200)
   - Added "Save as Template" button (conditional display)
   - NO changes to existing save/update logic
   - NO changes to PDF generation
   - NO changes to pricing calculations
   - NO changes to work order conversion

---

## WHY IT CHANGED

### Business Need
- Users frequently create similar offers (e.g., "Standard Service Package", "Engine Maintenance")
- Manual copy-paste was error-prone and time-consuming
- Templates enable consistent pricing and service descriptions

### Technical Approach
- Templates are SEPARATE entities from Offers (no coupling)
- Data transfer via sessionStorage (ephemeral, one-time use)
- Template application happens BEFORE offer creation (no post-creation logic)
- Templates are immutable references (no bidirectional linkage)

---

## WHAT DID NOT CHANGE

### Offer Module (UNTOUCHED)
✓ Offer creation flow - same as before
✓ Offer editing - same as before
✓ Offer save/update logic - same as before
✓ Offer pricing calculations - same as before
✓ Offer VAT calculations - same as before
✓ Offer PDF generation - same as before
✓ Offer status workflow - same as before
✓ Offer-to-WorkOrder conversion - same as before

### Related Modules (UNTOUCHED)
✓ Lead module - no changes
✓ Customer module - no changes
✓ Work Order module - no changes
✓ Job module - no changes
✓ Invoice module - no changes
✓ PDF templates - no changes

### UI/UX (MINIMAL CHANGES)
✓ Offer list layout - same (only added button)
✓ Offer detail layout - same (only added button)
✓ Existing buttons/actions - unchanged
✓ No styling refactors
✓ No component reorganization

---

## ARCHITECTURE NOTES

### Data Flow
```
1. SAVE AS TEMPLATE:
   Offer (existing) → User clicks "Save as Template" 
   → Creates OfferTemplate + OfferTemplateLineItems
   → Original offer unchanged

2. CREATE FROM TEMPLATE:
   User clicks "From Template" → TemplateSelector modal
   → User selects template → Data stored in sessionStorage
   → Navigate to OfferDetail → useEffect loads template data
   → Clear sessionStorage → User continues as normal offer creation
```

### Separation of Concerns
- Templates have NO reference to specific Offers
- Offers have NO reference to Templates
- Template application is ONE-TIME event at creation
- No template sync or update propagation

### Error Handling
- Missing template data → graceful fallback (normal offer creation)
- Template load failure → logged, no UI disruption
- Save template requires title → validation before save

---

## TESTING CHECKLIST

### Functional Tests
- [x] Create new offer normally (no template) → works as before
- [x] Edit existing offer → works as before
- [x] Save offer as template → template created with correct data
- [x] Create offer from template → prefills correctly
- [x] Edit offer created from template → behaves as normal offer
- [x] Template with no line items → saves and loads correctly
- [x] Template with optional items → preserves is_optional flag

### Regression Tests
- [x] Existing offers unchanged by template feature
- [x] PDF generation still works
- [x] Pricing calculations still work
- [x] Work order conversion still works
- [x] Lead-to-offer flow still works

### Edge Cases
- [x] Save template without title → validation error
- [x] Load template with missing sessionStorage → fallback to blank form
- [x] Navigate away during template load → sessionStorage cleared on next load

---

## FILES TOUCHED (5 total)

**NEW:**
1. entities/OfferTemplate.json
2. entities/OfferTemplateLineItem.json
3. components/offers/TemplateSelector.jsx

**MODIFIED:**
4. pages/Offers (added button + modal, ~20 lines)
5. pages/OfferDetail (added template load + save, ~70 lines)

**UNCHANGED:**
- All other components
- All other entities
- All other pages
- All backend functions
- All PDF logic
- All calculation logic

---

## ROLLBACK INSTRUCTIONS

If this feature needs to be reverted:

1. Restore from BEFORE snapshots:
   - components/ROLLBACK__2026-02-08__pages__OfferDetail__BEFORE.md
   - components/ROLLBACK__2026-02-08__pages__Offers__BEFORE.md

2. Delete new files:
   - entities/OfferTemplate.json
   - entities/OfferTemplateLineItem.json
   - components/offers/TemplateSelector.jsx

3. Database cleanup (if deployed):
   - Drop OfferTemplate records
   - Drop OfferTemplateLineItem records

---

## DEPLOYMENT NOTES

- No migration required (new entities)
- No breaking changes
- Feature is additive only
- Can be rolled out incrementally
- No user training required (self-explanatory UI)

---

END OF DIFF NOTES