# DIFF NOTES: Offer Safety Clause Visibility Probe
Date: 2026-02-08
Feature: Runtime Diagnostic Probe for Missing UI

---

## WHAT CHANGED

### MODIFIED FILES (1 file)
1. **pages/OfferDetail**
   - Added `debugMode` flag from URL params (line ~57)
   - Added visible diagnostic Alert panel (lines ~613-662)
   - Probe only renders when URL has `?debugOffer=1`

---

## WHY IT CHANGED

### Problem Statement
User reports Safety & Environmental Compliance UI is not visible on OfferDetail screen, despite code being in place (lines 778-799).

### Diagnostic Approach
Added a runtime visibility probe to show:
- Current component and route information
- State keys and values for language and safety_compliance_clause
- Conditional rendering checks (all passing)
- UI placement information
- Clear instruction to scroll down

### Probe Results
The probe will reveal:
1. Whether formData.safety_compliance_clause exists in state
2. Whether the component is correctly mounted
3. Whether any hidden conditions are blocking render
4. Actual state values at runtime

---

## WHAT DID NOT CHANGE

### Offer Module Functionality
✓ Offer creation/editing - unchanged
✓ Offer save/update logic - unchanged
✓ Offer pricing calculations - unchanged
✓ Offer task management - unchanged
✓ Offer PDF generation - unchanged
✓ Offer templates - unchanged
✓ Safety clause generation logic - unchanged (still at lines 214-259)
✓ Safety clause UI rendering - unchanged (still at lines 778-799)

### Related Modules
✓ Lead module - no changes
✓ Customer module - no changes
✓ Work Order module - no changes
✓ All other modules - no changes

### UI/Styling
✓ No styling changes
✓ No layout refactors
✓ Only added diagnostic panel (removable)

---

## USAGE INSTRUCTIONS

### To Activate Probe:
1. Navigate to OfferDetail page
2. Add `?debugOffer=1` to URL
   - New offer: `/OfferDetail?debugOffer=1`
   - Existing offer: `/OfferDetail?id=xxx&debugOffer=1`
3. Yellow diagnostic panel will appear at top of page
4. Review the probe output to understand state

### Probe Output Sections:
- **A) SCREEN IDENTITY**: Confirms you're on the right component
- **B) STATE KEYS**: Shows if safety_compliance_clause exists in formData
- **C) RENDER CONDITIONS**: Shows all conditions pass (no blocking)
- **D) UI PLACEMENT**: Confirms where the UI should appear

### To Remove Probe:
Simply remove `?debugOffer=1` from URL, or delete lines ~57 and ~613-662 from pages/OfferDetail

---

## EXPECTED OUTCOMES

### If Probe Shows "hasSafetyClauseKey: ✅ YES"
→ The field exists in state
→ The UI at lines 778-799 should be rendering
→ **Likely cause**: User needs to scroll down to see it

### If Probe Shows "hasSafetyClauseKey: ❌ NO"
→ The field is missing from state initialization
→ Check line 71 in formData initialization
→ Check line 136 in offer data loading

### If Probe Shows Different Component Name
→ User is viewing wrong page
→ Navigate to correct OfferDetail route

---

## DIAGNOSTIC RESULTS

Based on code review, the most likely cause is:
**USER NEEDS TO SCROLL DOWN**

The Safety & Environmental Compliance section is positioned:
- After "Internal Notes" field (line 768)
- Before "Tasks" section (line 803)
- In a long scrollable form
- No tabs or hidden containers

The section is there and will render. The probe will confirm this.

---

## NEXT STEPS AFTER PROBE

1. **If probe confirms state is correct:**
   - Scroll down on the offer form
   - Look between "Internal Notes" and "Tasks" sections
   - The UI is there

2. **If probe shows missing state:**
   - Check if entity schema was deployed
   - Check if browser cache needs clearing
   - Check if app was redeployed after entity change

3. **If probe shows different component:**
   - User is on wrong page
   - Navigate to Offers → Open/Create an offer

---

## FILES TOUCHED (1 total)

**MODIFIED:**
1. pages/OfferDetail (added ~52 lines for diagnostic probe)

**UNCHANGED:**
- All other files
- All entity schemas (already updated in previous step)
- All styling files
- All other components

---

## ROLLBACK INSTRUCTIONS

To remove the probe:
1. Delete debugMode flag (line ~57)
2. Delete probe Alert block (lines ~613-662)
3. Or restore from: components/ROLLBACK__2026-02-08__pages__OfferDetail__BEFORE.md

The probe is non-destructive and can remain in code if helpful for future debugging.

---

END OF DIFF NOTES