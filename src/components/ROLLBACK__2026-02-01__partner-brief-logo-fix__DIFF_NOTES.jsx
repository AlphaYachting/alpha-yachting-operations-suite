# DIFF NOTES: Partner Brief Logo Fix
## Date: 2026-02-01
## Change: Fix logo rendering with correct aspect ratio preservation

---

## WHAT CHANGED

### Logo Rendering Fix

**Before:**
```javascript
const maxLogoHeight = 15;
const maxLogoWidth = 50;
doc.addImage(template.logo_url, 'PNG', margins.left, yPos, maxLogoWidth, maxLogoHeight, undefined, 'FAST');
```

**After:**
```javascript
const logoWidth = 45; // Fixed width in mm
// By not specifying height, jsPDF will maintain aspect ratio
doc.addImage(template.logo_url, 'PNG', margins.left, yPos, logoWidth, 0, undefined, 'FAST');
```

**Key change:** Set height to `0` (or omit) to let jsPDF automatically calculate the correct height based on the image's intrinsic aspect ratio.

**Problem:** Setting both width (50mm) and height (15mm) forced a 3.33:1 aspect ratio, causing logo distortion if the actual logo had a different aspect ratio.

**Solution:** Set only width (45mm), let jsPDF preserve the original aspect ratio by auto-calculating height.

---

## WHY IT CHANGED

**Problem:** Logo appeared "zerschossen" (corrupted/distorted) in Partner Brief PDF because both dimensions were forced, stretching/squashing the image.

**Root cause:** jsPDF's `addImage()` with explicit width AND height will force those dimensions regardless of the image's actual proportions.

**Solution:** By setting height to 0, jsPDF uses the image's intrinsic aspect ratio to calculate the correct height for the specified width.

---

## WHAT DID NOT CHANGE

- ❌ All other PDF content and layout - unchanged
- ❌ Data fields and structure - unchanged
- ❌ Teal styling and section headers - unchanged
- ❌ Offer/Invoice templates - unchanged
- ❌ Backend data builder - unchanged
- ❌ Entity schemas - unchanged

---

## TECHNICAL DETAILS

**Logo source type:** URL (from template.logo_url)
**addImage format:** PNG
**Sizing method:** Width-constrained with aspect ratio preservation (45mm width, height auto-calculated)

**Files touched:** 1
1. `components/pdf/PartnerBriefTemplate.js` - logo rendering fix

---

## MANUAL TEST CHECKLIST

- [ ] Generate Partner Brief: logo renders correctly (not stretched, not compressed, maintains proportions)
- [ ] Confirm logo is clear and not pixelated
- [ ] Confirm all other Partner Brief content unchanged
- [ ] Confirm Offer/Invoice PDFs unchanged