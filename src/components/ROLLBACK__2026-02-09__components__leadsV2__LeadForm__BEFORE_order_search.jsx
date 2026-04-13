# ROLLBACK SNAPSHOT - components/leadsV2/LeadForm.jsx BEFORE

Date: 2026-02-09
Purpose: Reorder fields, add customer search, conditional required

Current structure (lines 148-270):
1. Assignment (Assign To) - lines 148-166
2. Contact Info section - lines 168-271
   - Name or First/Last fields (conditional) - lines 172-215
   - Phone/Email - lines 217-245
   - Existing Customer dropdown - lines 247-270

Key logic:
- Lines 108-120: Validation requires first_name + last_name if no customer_id
- Lines 172-215: Conditional rendering based on customer_id
- Lines 251-269: Simple Select with no search capability