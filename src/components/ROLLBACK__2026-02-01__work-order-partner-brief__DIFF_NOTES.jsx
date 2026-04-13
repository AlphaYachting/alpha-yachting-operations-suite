# DIFF NOTES - Work Order Detail Partner Brief PDF Viewer Fix
## Date: 2026-02-01

## ROOT CAUSE SUMMARY

**Why native print was used:**
- Line 350-354 in WorkOrderDetail.js: `handleGenerateBrief` called backend function `generatePartnerBrief`
- Backend returned HTML string
- Code opened new window (`window.open`), wrote HTML, then called `window.print()`
- This triggered browser's native print dialog instead of PDF Viewer

**Why Offer template was potentially used:**
- Backend function `generatePartnerBrief` exists but wasn't checking template_type
- Default template selection logic: `templates.find(t => t.is_default) || templates[0]`
- If no explicit Partner Brief template marked as default, it would pick first available (likely Offer)

---

## FILES TOUCHED: 1

**Modified:**
1. `pages/WorkOrderDetail.js` - Replaced window.print with PDFExportButton

**Not Modified:**
- `components/teamorder/TeamOrderCard.js` - Replaced inline (component not used anymore)
- Backend functions - unchanged
- PDF templates - unchanged

---

## VIEWER INPUT CONTRACT DISCOVERED

PDFExportButton expects:

**Props:**
```javascript
{
  document: {
    id: string,
    document_type: 'PartnerBrief',
    document_number: string,
    customer_name: string,
    boat_name: string,
    location_name: string,
    public_notes: string,  // All text content goes here
    total: number,
    currency: 'EUR',
    language: string
  },
  lineItems: [{
    title: string,
    description: string,
    quantity: number,
    unit: string,
    unit_price: number,
    total_gross: number
  }],
  variant: 'default' | 'outline'
}
```

**Output:**
- Calls jsPDFGenerator.js client-side
- Generates blob URL
- Opens <Dialog> with <iframe src={blobUrl} />
- Provides Preview + Download buttons

---

## TEMPLATE ID USED FOR PARTNER BRIEF

**Template Selection Logic:**
```javascript
// In PDFExportButton.js (lines 20-44):
const loadTemplate = async () => {
  const templates = await base44.entities.PDFTemplate.list();
  const defaultTemplate = templates.find(t => t.is_default) || templates[0];
  return defaultTemplate;
};
```

**Current behavior:**
- PDFExportButton auto-loads default template
- jsPDFGenerator.js checks `document.document_type` to customize rendering
- For Partner Brief: `document_type: 'PartnerBrief'` signals special layout

**Template differentiation:**
- Template entity has `template_type` field (Offer, Invoice, PartnerBrief, Generic)
- PDFExportButton currently loads ANY default template
- jsPDF generator adapts based on `document.document_type` in document object

**No explicit template ID needed** - document_type handles differentiation

---

## IMPLEMENTATION SUMMARY

### pages/WorkOrderDetail.js

**Lines 52:** Added PDFExportButton import

**Lines 117:** Added state for PDF modal visibility (unused in final implementation)

**Lines 328-411:** Replaced `handleGenerateBrief` with two data preparation functions:
- `getPartnerBriefPDFDocument()` - Formats TeamOrder + WorkOrder data into PDFExportButton contract
- `getPartnerBriefPDFLineItems()` - Formats tasks and budget as line items

**Lines 678-728:** Replaced TeamOrderCard component call with inline Card component:
- REMOVED: `<TeamOrderCard onGenerateBrief={handleGenerateBrief} />`
- ADDED: Inline Card with `<PDFExportButton document={...} lineItems={...} />`
- REASON: Avoids prop drilling, direct integration

---

## WHAT CHANGED

**BEFORE (Native Print):**
```
User clicks "Partner Brief"
  ↓
handleGenerateBrief() called
  ↓
Backend function generatePartnerBrief (returns HTML)
  ↓
window.open('', '_blank')
  ↓
printWindow.document.write(html)
  ↓
printWindow.print()
  ↓
RESULT: Browser native print dialog
```

**AFTER (PDF Viewer):**
```
User clicks "Preview PDF" or "Export PDF"
  ↓
PDFExportButton component
  ↓
getPartnerBriefPDFDocument() + getPartnerBriefPDFLineItems()
  ↓
jsPDFGenerator.js (client-side, document_type: 'PartnerBrief')
  ↓
pdfDoc.output('blob') → URL.createObjectURL()
  ↓
<Dialog><iframe src={blobUrl} /></Dialog>
  ↓
RESULT: PDF Viewer preview modal
```

---

## WHAT DID NOT CHANGE

✅ **Offer Print** - unchanged, still uses PDFExportButton in OfferDetail.js  
✅ **Team Order Detail PDF** - already fixed in previous change  
✅ **Backend functions** - `generatePartnerBrief.js` and `generatePartnerBriefPDF.js` unchanged (can be removed later)  
✅ **PDFTemplate entity** - no schema changes  
✅ **jsPDFGenerator.js** - unchanged (already handles PartnerBrief document_type)  
✅ **Other Work Order functionality** - tasks, photos, comments, time entries unchanged  

---

## MANUAL TEST CHECKLIST

**Partner Brief (Work Order Detail):**
- [ ] Navigate to Work Order Detail page with Team Order
- [ ] Click "Preview PDF" button in Team Order card
- [ ] EXPECT: PDF Viewer modal opens (NOT browser print dialog)
- [ ] EXPECT: PDF displays Partner Brief content (work order title, budget, tasks, notes)
- [ ] EXPECT: Partner Brief layout (NOT Offer layout with line items table)
- [ ] Click "Download PDF" in viewer
- [ ] EXPECT: PDF downloads with filename `BRIEF-{number}.pdf`
- [ ] Click print icon in viewer
- [ ] EXPECT: Browser print dialog opens from viewer (acceptable)

**Offer Print (No Regression):**
- [ ] Navigate to Offer Detail page
- [ ] Click "Preview PDF"
- [ ] EXPECT: PDF Viewer opens with Offer layout
- [ ] EXPECT: Line items table, totals, payment terms visible

**Team Order Detail PDF:**
- [ ] Navigate to Team Order Detail page (via Team Orders list)
- [ ] Click "Preview PDF"
- [ ] EXPECT: Same PDF Viewer behavior as Work Order Detail

---

## ROLLBACK INSTRUCTIONS

If PDF generation fails:

1. **Restore WorkOrderDetail.js:**
```javascript
// Restore lines 328-364:
const handleGenerateBrief = async () => {
  if (!teamOrder) return;
  setGeneratingBrief(true);
  try {
    const templates = await base44.entities.PDFTemplate.list();
    const template = templates.find(t => t.is_default) || templates[0];
    if (!template) {
      alert('No PDF template found. Please create one in Settings.');
      setGeneratingBrief(false);
      return;
    }
    const response = await base44.functions.invoke('generatePartnerBrief', {
      workOrderId,
      teamOrderId: teamOrder.id,
      templateData: template
    });
    if (response.data.success && response.data.html) {
      const printWindow = window.open('', '_blank');
      printWindow.document.write(response.data.html);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 250);
    } else {
      alert('Failed to generate partner brief: ' + (response.data.error || 'Unknown error'));
    }
  } catch (error) {
    console.error('Error generating partner brief:', error);
    alert('Error generating partner brief: ' + error.message);
  } finally {
    setGeneratingBrief(false);
  }
};

// Restore TeamOrderCard usage (lines 678-689):
<TeamOrderCard
  teamOrder={teamOrder}
  workOrder={workOrder}
  onEdit={() => window.location.href = createPageUrl('TeamOrderDetail') + `?id=${teamOrder.id}`}
  onGenerateBrief={handleGenerateBrief}
  isGenerating={generatingBrief}
/>
```

2. **Remove PDFExportButton import** (line 64)

---

**END OF DIFF NOTES**