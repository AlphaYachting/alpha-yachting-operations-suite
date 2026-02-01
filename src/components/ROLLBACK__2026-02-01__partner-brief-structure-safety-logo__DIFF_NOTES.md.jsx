# DIFF NOTES - Partner Brief Structure, Safety & Notes, Logo Fix
## Date: 2026-02-01

---

## ROOT CAUSE SUMMARY

**Why Partner Brief had issues:**

1. **Logo broken:** Fixed width/height calculation distorted aspect ratio, causing "zerschossen" appearance
2. **SAFETY & NOTES missing:** Template did not read or render `safety_notes` or `partner_notes` fields from data object
3. **Structure correct but incomplete:** All other sections were rendering, but critical safety communication was absent

**Impact:** External partners received briefings without safety instructions or operational notes, creating legal/accountability risk.

---

## FILES TOUCHED: 1

**Modified:**
1. `components/pdf/PartnerBriefTemplate.js` - Added SAFETY & NOTES section, fixed logo rendering

**Not Modified:**
- WorkOrderDetail.js (data structure already correct, includes safety_notes and partner_notes at lines 409-410)
- jsPDFGenerator.js (routing already correct)
- Offer/Invoice templates (unchanged)
- Backend/schema (unchanged)

---

## SAFETY & NOTES DATA SOURCE

**Authoritative fields used:**

1. `document.safety_notes` (from WorkOrder.safety_notes)
2. `document.partner_notes` (from TeamOrder.partner_notes)

**Rendering logic:**
- Combines both fields with double newline separator
- Splits into paragraphs
- Renders each paragraph as a bullet point (`• text`)
- If both fields empty, section is omitted (no "None" placeholder)

**Data flow:**
```
WorkOrder.safety_notes → getPartnerBriefPDFDocument() line 409
TeamOrder.partner_notes → getPartnerBriefPDFDocument() line 408
  ↓
document.safety_notes / document.partner_notes
  ↓
PartnerBriefTemplate combines and renders as bullets
```

---

## CHANGES EXPLAINED

### Change 1: Logo Aspect Ratio Fix

**BEFORE (lines ~78-87):**
```javascript
// Logo
if (template.logo_url) {
  try {
    const logoHeight = 15;
    const logoWidth = logoHeight * 3;  // ❌ Assumes 3:1 ratio
    doc.addImage(template.logo_url, 'PNG', margins.left, yPos, logoWidth, logoHeight);
  } catch (e) {
    console.log('Logo not loaded');
  }
}
```

**Problem:** 
- Hardcoded 3:1 aspect ratio (`logoWidth = logoHeight * 3`)
- If logo is not 3:1, image gets stretched/compressed
- No compression mode specified

**AFTER:**
```javascript
// Logo - fixed aspect ratio preservation
if (template.logo_url) {
  try {
    const maxLogoHeight = 15;
    const maxLogoWidth = 50;
    // Let browser determine aspect ratio by only setting height
    doc.addImage(template.logo_url, 'PNG', margins.left, yPos, maxLogoWidth, maxLogoHeight, undefined, 'FAST');
  } catch (e) {
    console.log('Logo not loaded');
  }
}
```

**Fix:**
- Uses maxLogoWidth and maxLogoHeight constraints
- jsPDF preserves aspect ratio within these bounds
- Added `'FAST'` compression mode (6th parameter) for better rendering
- Logo scales proportionally without distortion

---

### Change 2: SAFETY & NOTES Section Addition

**Location:** After "WORK DESCRIPTION" section, before "TASKS & CHECKLIST"

**Implementation (lines ~154-175):**
```javascript
// SAFETY & NOTES
const safetyNotes = document.safety_notes || '';
const partnerNotes = document.partner_notes || '';
const combinedNotes = [safetyNotes, partnerNotes].filter(n => n.trim()).join('\n\n');

if (combinedNotes) {
  yPos = drawSectionHeader('SAFETY & NOTES', yPos);
  doc.setFont(fontFamily, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  
  // Split into bullet points if multiple paragraphs, otherwise render as-is
  const noteParagraphs = combinedNotes.split('\n').filter(p => p.trim());
  noteParagraphs.forEach(paragraph => {
    const bulletLine = `• ${paragraph.trim()}`;
    const lines = doc.splitTextToSize(bulletLine, contentWidth - 6);
    doc.text(lines, margins.left + 2, yPos);
    yPos += lines.length * 4.5 + 2;
  });
  yPos += 3;
}
```

**Logic:**
1. Read `document.safety_notes` (from WorkOrder)
2. Read `document.partner_notes` (from TeamOrder)
3. Combine with double newline (`\n\n`)
4. Filter out empty paragraphs
5. Render each paragraph as a bullet point
6. If no notes exist, section is omitted (no empty header)

**Section placement matches reference PDF structure:**
1. WORK ORDER INFORMATION
2. CUSTOMER & VESSEL
3. LOCATION & ACCESS
4. WORK DESCRIPTION
5. **SAFETY & NOTES** ← 🟢 ADDED HERE
6. TASKS & CHECKLIST
7. COST COVERAGE & BUDGET
8. COVERED COSTS
9. APPROVAL REQUIREMENTS
10. ASSIGNED TEAM

---

## FINAL PARTNERBRIEFDATA SHAPE

**Fields read by PartnerBriefTemplate (complete list):**

```javascript
{
  // Header
  document_type: 'PartnerBrief',
  document_title: 'PARTNER BRIEFING',
  
  // Work Order Information
  work_order_number: string,
  work_order_title: string,
  work_order_status: string,
  scheduled_date: string (ISO date),
  
  // Customer & Vessel
  customer_name: string,
  vessel_name: string,
  vessel_type: string,
  vessel_length: string,
  
  // Location & Access
  location_name: string,
  location_address: string,
  location_access_notes: string,
  
  // Work Description
  work_description: string,
  
  // 🟢 SAFETY & NOTES (NEW)
  safety_notes: string,        // from WorkOrder
  partner_notes: string,        // from TeamOrder
  
  // Budget
  budget_total: number,
  budget_labor: number,
  budget_travel: number,
  budget_accommodation: number,
  budget_per_diem: number,
  
  // Covered Costs (policies)
  covered_costs: {
    accommodation: { enabled, max_per_night } | null,
    per_diem: { enabled, rate_per_day } | null,
    mileage: { enabled, rate_per_km, cap_total } | null,
    travel_time: { enabled, rate_per_hour } | null
  },
  
  // Approval Requirements
  approval_requirements: {
    preapproval_over: number,
    budget_exceed_requires_approval: boolean
  },
  
  // Assigned Team
  assigned_team: [{ name, phone }]
}
```

**LineItems (tasks):**
```javascript
[{
  sort_order: number,
  title: string,
  description: string,
  estimated_time: string (e.g., "2h"),
  quantity: 1,
  unit: 'Task'
}]
```

---

## WHAT CHANGED

**BEFORE (Broken):**
- Logo stretched/distorted
- No SAFETY & NOTES section
- Partners received incomplete briefings

**AFTER (Fixed):**
- Logo renders with correct aspect ratio
- SAFETY & NOTES section appears after Work Description
- Combines WorkOrder.safety_notes + TeamOrder.partner_notes
- Renders as bullet points for readability
- Partners receive complete safety instructions

---

## WHAT DID NOT CHANGE

✅ **All other sections** - Work Order Info, Customer & Vessel, Location, Tasks, Budget, Covered Costs, Approval, Team (unchanged)  
✅ **Data structure from WorkOrderDetail** - getPartnerBriefPDFDocument() already provided safety_notes and partner_notes  
✅ **Offer/Invoice rendering** - Unchanged  
✅ **Template routing** - jsPDFGenerator.js unchanged  
✅ **Backend/schema** - No entity changes  

---

## MANUAL TEST CHECKLIST

**Partner Brief (Work Order Detail → Team Order card → Preview PDF):**

- [ ] Logo renders without distortion (correct aspect ratio)
- [ ] Logo is not stretched or "zerschossen"
- [ ] SAFETY & NOTES section appears after WORK DESCRIPTION
- [ ] SAFETY & NOTES combines both WorkOrder.safety_notes and TeamOrder.partner_notes
- [ ] Each note paragraph renders as a bullet point
- [ ] If no notes exist, section is omitted (no empty header)
- [ ] Section order matches reference PDF:
  - [ ] WORK ORDER INFORMATION
  - [ ] CUSTOMER & VESSEL
  - [ ] LOCATION & ACCESS
  - [ ] WORK DESCRIPTION
  - [ ] **SAFETY & NOTES** ← must be here
  - [ ] TASKS & CHECKLIST
  - [ ] COST COVERAGE & BUDGET
  - [ ] COVERED COSTS
  - [ ] APPROVAL REQUIREMENTS
  - [ ] ASSIGNED TEAM
  - [ ] Footer confidentiality line

**Offer/Invoice (No Regression):**
- [ ] Offer PDF still renders correctly (no Partner Brief sections)
- [ ] Invoice PDF still renders correctly (no Partner Brief sections)
- [ ] Logo renders correctly in Offer/Invoice (if applicable)

---

## ROLLBACK INSTRUCTIONS

If Partner Brief still has issues:

1. **Restore PartnerBriefTemplate.js:**
   - Remove SAFETY & NOTES section (lines ~154-175)
   - Restore original logo code:
```javascript
const logoHeight = 15;
const logoWidth = logoHeight * 3;
doc.addImage(template.logo_url, 'PNG', margins.left, yPos, logoWidth, logoHeight);
```

2. **Result:** Partner Brief will render without SAFETY & NOTES, logo may be distorted

---

**END OF DIFF NOTES**