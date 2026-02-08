# AFTER SNAPSHOT: components/pdf/pdfTemplateUtils (Font Fix)
Date: 2026-02-08
Purpose: After fixing Eigentumsvorbehalt heading corruption

Changes made:
- Removed emoji (⚠️) from Eigentumsvorbehalt title (line ~648)
- Title now renders as: "Retention of Title / Eigentumsvorbehalt"
- Uses standard font styling (same as other PDF text)
- Safety clause already correctly positioned after Eigentumsvorbehalt
- No other changes to PDF layout or logic