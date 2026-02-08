# BEFORE SNAPSHOT: components/pdf/pdfTemplateUtils (Final Font Fix)
Date: 2026-02-08
Purpose: Baseline before aligning Eigentumsvorbehalt font to match other sections

Current state:
- .ownership-title CSS at lines 445-450
- Uses font-size: 10pt, font-weight: bold, color: #7f1d1d
- All other section titles use same pattern
- No special font family override
- Issue: May render differently in jsPDF vs browser preview
- Need to ensure consistent rendering across all viewers