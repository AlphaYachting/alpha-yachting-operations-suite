# ROLLBACK SNAPSHOT - entities/Location.json AFTER

Date: 2026-02-09
Purpose: Added marina fee configuration fields

Changes:
- Added marina_fee_enabled (boolean, default false)
- Added marina_fee_type (enum: per_day, per_person_per_day, percent_commission, fixed_amount)
- Added marina_fee_amount (number)
- Added marina_fee_currency (string, default "EUR")
- Added marina_fee_description (string)

No changes to existing fields.