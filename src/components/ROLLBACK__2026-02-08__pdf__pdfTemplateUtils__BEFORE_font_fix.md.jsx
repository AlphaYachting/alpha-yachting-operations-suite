# BEFORE SNAPSHOT: components/pdf/pdfTemplateUtils (Font Fix)
Date: 2026-02-08
Purpose: Baseline before fixing Eigentumsvorbehalt heading corruption

Current state:
- Eigentumsvorbehalt title at line ~648: "⚠️ Retention of Title / Eigentumsvorbehalt"
- Emoji symbol (⚠️) causing font corruption in PDF export
- Safety clause already positioned after Eigentumsvorbehalt (lines ~653-659)
- Need to remove emoji and render with standard font