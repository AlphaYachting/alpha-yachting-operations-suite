# AFTER SNAPSHOT: components/pdf/pdfTemplateUtils (Readability Fix)
Date: 2026-02-08
Purpose: After fixing EURO spacing and ensuring consistent font declarations

Changes made:
1. EURO spacing (line 6):
   - Changed: const currency = document.currency === 'EUR' ? '€' : document.currency;
   - To: const currency = document.currency === 'EUR' ? '€ ' : document.currency + ' ';
   - Added space after currency symbol for better readability

2. Font consistency for .payment-terms-title (lines ~416-422):
   - Added font-family: ${fontFamily}, sans-serif
   - Added letter-spacing: normal
   - Now matches .ownership-title and .safety-title

3. Font consistency for .safety-title (lines ~469-476):
   - Added font-family: ${fontFamily}, sans-serif
   - Added letter-spacing: normal
   - Now matches .ownership-title and .payment-terms-title

All three section titles now have identical font settings.