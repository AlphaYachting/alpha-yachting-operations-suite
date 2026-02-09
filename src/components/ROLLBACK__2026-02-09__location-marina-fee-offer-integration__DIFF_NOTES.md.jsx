# DIFF NOTES - Marina Fee Integration with Offer Creation

**Date:** 2026-02-09
**Operation:** Integrate Location marina fees into Offer creation flow
**Files Changed:** 2 (entities/Offer.json, pages/OfferDetail.jsx)
**Functional Changes:** YES (data model + UI for location selection + marina fee alerts)

## Summary
Added location selection to Offer with automatic marina fee detection and notification. When a Marina location with fees enabled is selected, an alert shows the fee structure. Foundation for future automatic fee calculation in offers.

## What Changed

### 1. entities/Offer.json
**Added 1 new field:**
- `location_id` (string) - Reference to Location where work will be performed

**What Did NOT Change:**
- All existing Offer fields remain unchanged
- Required fields still: customer_id, title
- No changes to status enums, defaults, or other properties

### 2. pages/OfferDetail.jsx

**A) Form State (line 64):**
- Added `location_id: ''` to formData initialization

**B) Data Loading (lines 116-120):**
- Added `locations` query to fetch active locations
- Query filters for `status: 'Active'` only

**C) Marina Fee Detection Logic (lines 536-538):**
- Added `selectedLocation` lookup by location_id
- Added `marinaFeesApply` computed flag (checks marina_fee_enabled && location_type === 'Marina')

**D) UI Changes (lines 842-884):**

**Original:**
```jsx
<div className="space-y-2">
  <Label>Related Job</Label>
  <Select value={formData.job_id}>
    ...
  </Select>
</div>
```

**New:**
```jsx
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  <div className="space-y-2">
    <Label>Related Job</Label>
    <Select value={formData.job_id}>
      ...
    </Select>
  </div>
  <div className="space-y-2">
    <Label>Work Location</Label>
    <Select value={formData.location_id}>
      {locations.map(l => (
        <SelectItem key={l.id} value={l.id}>
          {l.name} {l.marina_fee_enabled && '⚓'}
        </SelectItem>
      ))}
    </Select>
  </div>
</div>

{marinaFeesApply && (
  <Alert>Marina Fees Apply: [details]</Alert>
)}
```

**Visual Indicators:**
- Location dropdown shows ⚓ anchor icon next to locations with marina fees enabled
- Alert appears below when marina fees apply, showing:
  - Fee type and amount
  - Description/notes from location config

**Fee Display Examples:**
- `10% commission` (percent_commission)
- `50 EUR/day` (per_day)
- `30 EUR/person/day` (per_person_per_day)
- `100 EUR (fixed)` (fixed_amount)

## What This Enables (Current)
✅ Location selection in Offer
✅ Visual indicator (⚓) for locations with fees
✅ Alert notification when marina fees apply
✅ Fee structure details shown to user

## What This Does NOT Do (Future)
❌ No automatic fee calculation added to offer total
❌ No marina fee line item creation
❌ No PDF export integration for marina fees
❌ No commission percentage calculation on work order total
❌ No per-day/per-person calculation based on work duration/team size

## Integration Points for Future
1. **Automatic Fee Line Item Creation:**
   - When location with fees is selected
   - Create OfferTask with marina fee details
   - Calculate based on fee type (percent, per_day, etc.)

2. **PDF Export:**
   - Include marina fee line item in PDF
   - Show fee breakdown
   - Add to totals section

3. **Offer to WorkOrder Conversion:**
   - Pass location_id to WorkOrder
   - Calculate actual fees based on work duration/team
   - Track marina fees in work order costs

## Manual Test Checklist
✅ Create Marina Location → Enable fees → Set type=per_day, amount=50 EUR
✅ Create new Offer → Select that location → See ⚓ icon in dropdown
✅ Select Marina location with fees → Alert appears with fee details
✅ Select non-Marina location → No alert (even if fees configured)
✅ Select Marina without fees enabled → No alert
✅ Change location from Marina to non-Marina → Alert disappears
✅ Save Offer with location → location_id persists correctly
✅ Edit existing Offer → location_id loads and displays correctly
✅ PDF export still works (location not yet included in PDF)

## Schema Migration
**Fields added to Offer entity:**
- location_id (string, optional)

**Backwards compatible:**
- New field is optional (not required)
- Existing Offer records work without location_id
- No breaking changes

## Breaking Changes
**NONE** - Purely additive change

## Rollback Instructions
Restore from:
- `components/ROLLBACK__2026-02-09__entities__Offer__BEFORE.md`
- Remove location-related code from OfferDetail.jsx (lines 64, 116-120, 536-538, 842-884)