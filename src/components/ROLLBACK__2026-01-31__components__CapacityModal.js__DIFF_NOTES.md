# DIFF NOTES - CapacityModal Component
**Date:** 2026-01-31
**File:** components/dashboard/CapacityModal.js
**Purpose:** New component for displaying technician capacity details

## Component Overview

**Inputs:**
- `open` (boolean): Controls modal visibility
- `onOpenChange` (function): Callback to close modal

**Internal State:**
- `timeRange`: 'today' | 'week' | 'month' (filter selection)
- `capacityData`: Array of technician capacity objects
- `loading`: Boolean for loading state
- `error`: Error message string or null
- `showFullTable`: Boolean to show all rows vs limited view

## Data Source

**Planned Hours Priority:**
1. `WorkOrder.estimated_duration_hours` (preferred)
2. Calculate from `WorkOrder.scheduled_start_time` and `scheduled_end_time`
3. Default to 0 if neither available

**Query Strategy:**
- Load all technicians once
- Load work orders with limit 500, sort by `-scheduled_date`
- **Client-side filter** applied:
  - `scheduled_date` within selected range
  - `status` not 'Completed' or 'Cancelled'
  - Has `assigned_technicians` array

## Target Hours Constants

```javascript
const TARGET_HOURS = {
  today: 8,    // 1 working day
  week: 40,    // 5 working days
  month: 160   // 20 working days
};
```

**Not configurable** - hardcoded as per requirements.

## Utilization Calculation

```javascript
if (plannedHours === 0) → "Free" (grey badge)
else if (plannedHours < targetHours) → "Planned" (blue badge)
else (plannedHours >= targetHours) → "Full" (green badge)
```

## Table Display

**Columns:**
1. Technician name (+ inactive label if applicable)
2. Planned hours (sum, rounded to 1 decimal)
3. Utilization badge (Free/Planned/Full)
4. Work order count

**Sorting:**
- Active technicians first
- Then alphabetically by name

**Default View:**
- Shows first 10 rows
- Button: "Ganze Statistik anzeigen" reveals all

## Error Handling

**On Query Failure:**
- Display red alert box with error message
- "Retry" button to re-execute `loadCapacityData()`
- Modal remains functional, no crash

## No Schema Changes

This component only reads existing WorkOrder and Technician entities.
No new entities or fields created.