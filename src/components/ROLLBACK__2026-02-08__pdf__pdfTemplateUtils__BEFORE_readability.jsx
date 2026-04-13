# BEFORE SNAPSHOT: components/pdf/pdfTemplateUtils (Readability Fix)
Date: 2026-02-08
Purpose: Baseline before fixing EURO spacing and ensuring consistent font declarations

Current state:
- EURO symbol concatenated directly: "${currency}${amount}" (no space)
- Found at lines: 583, 585, 595, 600, 605, 610, 614, 619, 624, 629, 634, 638
- Eigentumsvorbehalt title at line 672: "Retention of Title / Eigentumsvorbehalt"
- .ownership-title CSS has font-family but .payment-terms-title and .safety-title don't
- Need consistent font declarations across all section titles
- Safety clause correctly positioned after Eigentumsvorbehalt (lines 678-683)