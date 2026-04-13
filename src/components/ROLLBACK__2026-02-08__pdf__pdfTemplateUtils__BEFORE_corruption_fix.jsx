# BEFORE SNAPSHOT: components/pdf/pdfTemplateUtils (Corruption Fix)
Date: 2026-02-08
Purpose: Baseline before removing corrupted characters from Eigentumsvorbehalt title

Current state:
- Line 678: <div class="ownership-title">& þ Retention of Title / Eigentumsvorbehalt</div>
- Corrupted prefix "& þ" appears before the actual title
- Should be plain text: "Retention of Title / Eigentumsvorbehalt"
- Need to remove the special characters that cause corruption in PDF