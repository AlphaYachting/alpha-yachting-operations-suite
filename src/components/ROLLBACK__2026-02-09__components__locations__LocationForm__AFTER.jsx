# ROLLBACK SNAPSHOT - components/locations/LocationForm.jsx AFTER

Date: 2026-02-09
Purpose: Added Marina Fees / Working Permit UI section

Changes:
- Added 5 marina fee fields to formData initialization
- Added new collapsible section "Marina Fees / Working Permit" before Actions
- Toggle to enable/disable marina fees
- Fee Type selector (per_day, per_person_per_day, percent_commission, fixed_amount)
- Amount input with dynamic currency selector (or % symbol for commission)
- Description/notes textarea
- Section only expands when enabled

Location: Lines 203-268 (inserted before Actions section)