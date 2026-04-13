# DIFF NOTES - Location Marina Fee Rules Configuration

**Date:** 2026-02-09
**Operation:** Add marina fee configuration storage and UI
**Files Changed:** 2 (entities/Location.json, components/locations/LocationForm.jsx)
**Functional Changes:** YES (data model + UI for marina fee rules)

## Summary
Added marina fee/working permit configuration to Location entity with 5 new fields. Added collapsible UI section in LocationForm to edit these values. This run is STORAGE ONLY - no integration with Offer creation or PDF export yet.

## What Changed

### 1. entities/Location.json
**Added 5 new fields:**
- `marina_fee_enabled` (boolean, default false) - Master toggle
- `marina_fee_type` (string enum) - Calculation method: per_day, per_person_per_day, percent_commission, fixed_amount
- `marina_fee_amount` (number) - Fee amount (percentage for commission, monetary for others)
- `marina_fee_currency` (string, default "EUR") - Currency for monetary fees
- `marina_fee_description` (string) - Additional notes/details

**What Did NOT Change:**
- All existing Location fields remain unchanged
- No changes to required fields (still name, location_type)
- No changes to enums or defaults of existing fields

### 2. components/locations/LocationForm.jsx
**Lines Changed:**

**A) Form State (lines 16-31):**
- Added 5 marina fee fields to formData initialization
- Default values: enabled=false, type='per_day', amount=null, currency='EUR', description=''

**B) Marina Fees UI Section (lines 203-268, inserted before Actions):**
- New collapsible section with toggle header
- Label: "Marina Fees / Working Permit"
- Fields only visible when enabled=true
- Layout:
  - Row 1: Fee Type selector
  - Row 2: Amount input + dynamic currency selector (EUR/USD/GBP) OR % symbol
  - Row 3: Description textarea
- Currency selector hidden when type=percent_commission (shows % instead)
- Amount placeholder adapts to fee type

**What Did NOT Change:**
- All existing form sections (Basic Info, Address, Contact, etc.)
- Partner Marina toggle
- Actions section (Cancel/Save buttons)
- Form submission logic
- Form layout/styling

## Fee Type Options
- **per_day**: Daily rate (e.g., 50 EUR/day)
- **per_person_per_day**: Per technician per day (e.g., 30 EUR/person/day)
- **percent_commission**: Percentage of work order total (e.g., 10%)
- **fixed_amount**: One-time flat fee (e.g., 100 EUR)

## Storage Strategy
**Structured storage** via 5 new entity fields (approved by user)
- No metadata/json field used
- Clean typed fields for easy querying and future integration
- Existing access_notes field remains separate (no data mixing)

## What This Enables (Future)
- Offer creation can read location marina fees
- PDF export can include marina fee line items
- Automatic fee calculation based on work order details
- BUT: No integration implemented in this run (storage only)

## What Did NOT Change
✅ No changes to Offer entity
✅ No changes to Offer creation logic
✅ No changes to Offer PDF export
✅ No changes to Job/WorkOrder entities
✅ No changes to Location list display (pages/Locations.jsx)
✅ No changes to any other Location functionality

## Manual Test Checklist
✅ Create new Marina Location → set enabled=true, type=per_day, amount=50, currency=EUR, description="Test" → Save
✅ Reopen same Location → all values persist and display correctly
✅ Toggle enabled=false → fee fields collapse
✅ Toggle enabled=true → fee fields expand again
✅ Change fee type to percent_commission → currency selector becomes % symbol
✅ Change fee type back to per_day → currency selector reappears
✅ Edit Location without touching marina fees → existing values unchanged
✅ Non-Marina Location (e.g., Yard) → marina fee section still available (not restricted)
✅ No changes observed in Offer creation flow
✅ No changes observed in Offer PDF generation

## Schema Migration
**Fields added to Location entity:**
- marina_fee_enabled
- marina_fee_type
- marina_fee_amount
- marina_fee_currency
- marina_fee_description

**Backwards compatible:**
- All new fields have defaults
- Existing Location records will get default values (enabled=false)
- No breaking changes

## Breaking Changes
**NONE** - Purely additive change

## Rollback Instructions
Restore from:
- `components/ROLLBACK__2026-02-09__entities__Location__BEFORE.md`
- `components/ROLLBACK__2026-02-09__components__locations__LocationForm__BEFORE.md