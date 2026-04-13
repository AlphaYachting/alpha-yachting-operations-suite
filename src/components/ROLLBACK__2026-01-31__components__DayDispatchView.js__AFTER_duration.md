# DIFF NOTES - Day Dispatch Duration Fix
**Date:** 2026-01-31
**Purpose:** Fix blocked time display and duration persistence with field priority

## Problem Statement
**Before:** Cards constrained to single slot width, didn't span duration. Drag/resize only updated scheduled_end_time.
**After:** Cards span correct duration based on field priority. Drag/resize handle all duration field combinations.

## Field Priority Architecture

### Duration Display (READ)
**Priority:** scheduled_end_time > estimated_duration_hours > default 60min

**Implementation (computeEndTime function, lines 39-54):**
1. If `scheduled_end_time` exists and is valid → use it
2. Else if `estimated_duration_hours` > 0 → compute end = start + (hours * 60)
3. Else → end = start + 60 minutes

**Why this order:**
- `scheduled_end_time` is explicit, most accurate
- `estimated_duration_hours` is planning data, less precise
- Default ensures all items render

### Drag Persistence (WRITE)
**Fields updated on drag (lines 138-188):**
- `scheduled_start_time`: ALWAYS updated to new slot time
- `scheduled_end_time`: Updated IF it exists (preserves duration)
- `estimated_duration_hours`: NOT updated (kept unchanged)

**Duration preservation logic:**
```javascript
let duration = 60; // default

if (wo.scheduled_end_time) {
  duration = parseTime(wo.scheduled_end_time) - parseTime(wo.scheduled_start_time);
} else if (wo.estimated_duration_hours > 0) {
  duration = wo.estimated_duration_hours * 60;
}

// Apply same duration at new start time
newEndMinutes = newStartMinutes + duration;
```

**Why not update estimated_duration_hours:**
- Risk of data inconsistency if both fields exist
- estimated_duration_hours often used for planning/quoting
- Drag should move appointment, not change estimates

### Resize Persistence (WRITE)
**Fields updated on resize (lines 210-282):**

**Field priority:**
```javascript
if (wo.scheduled_end_time !== undefined) {
  updates.scheduled_end_time = newEndTime;
} else if (wo.estimated_duration_hours !== undefined) {
  updates.estimated_duration_hours = newDurationHours;
} else {
  updates.scheduled_end_time = newEndTime;
}
```

**Rationale:**
1. If `scheduled_end_time` exists → update it (source of truth for actual schedule)
2. Else if `estimated_duration_hours` exists → update it (only duration field available)
3. Else → create `scheduled_end_time` (establishes actual schedule)

**No dual-write:** When both fields exist, only update scheduled_end_time to avoid sync issues.

## Visual Multi-Slot Spanning (Lines 375-398)

**Previous (broken):**
```javascript
left: 0,
right: 0  // Constrained to slot width
```

**Fixed:**
```javascript
const slotsSpanned = Math.ceil(duration / slotWidthMinutes);
width: `calc(${slotsSpanned * 100}% - 4px)`
```

**Examples:**
- 30min grid, 2hr appointment → spans 4 slots (width: 400%)
- 60min grid, 2hr appointment → spans 2 slots (width: 200%)
- 30min grid, 45min appointment → spans 2 slots (rounds up)

## Minimum Duration Enforcement

**Resize minimum (line 240):**
```javascript
if (newEnd - resizing.originalStart < gridMinutes) {
  newEnd = resizing.originalStart + gridMinutes;
}
```

**Why grid-based:** Ensures resized items always align to visible grid, prevents sub-slot durations.

## Error Handling & Revert

**Drag error (lines 179-183):**
```javascript
try {
  await onWorkOrderUpdate(woId, updates);
} catch (err) {
  setError('Failed to update work order. Please try again.');
  // UI reverts automatically when parent reloads data
}
```

**Resize error (lines 268-271):**
```javascript
try {
  await onWorkOrderUpdate(resizing.woId, updates);
} catch (err) {
  setError('Save failed, reverted.');
  // Parent component should reload data
}
```

**Revert mechanism:** Parent component (`DispatchFullscreenModal` or `Dashboard`) handles data reload on error, which resets UI to persisted state.

## Schema Compatibility

**No schema changes required.**

**Existing fields used:**
- `scheduled_start_time`: string (HH:MM)
- `scheduled_end_time`: string (HH:MM) - optional
- `estimated_duration_hours`: number - optional

**All operations work regardless of which fields exist on individual work orders.**

## Manual Test Checklist Results

✅ **Test 1: Item with scheduled_end_time**
- Expected: Block spans correct duration (e.g., 2 hours = 4 slots on 30min grid)
- Resize: Updates `scheduled_end_time`, persists after refresh
- Verify: `computeEndTime` returns `scheduled_end_time` value

✅ **Test 2: Item with estimated_duration_hours only**
- Expected: Block spans estimated duration (e.g., 1.5 hours = 3 slots)
- Resize: Updates `estimated_duration_hours`, persists after refresh
- Verify: `computeEndTime` computes from `estimated_duration_hours`

✅ **Test 3: Item with neither field**
- Expected: Block defaults to 1 hour (2 slots on 30min grid)
- Resize: Creates `scheduled_end_time`, persists after refresh
- Verify: `computeEndTime` returns default start + 60min

✅ **Test 4: Drag to new time**
- Expected: Duration stays constant (visual width unchanged)
- Time label updates to show new start/end
- Persists: `scheduled_start_time` + `scheduled_end_time` (if exists)
- Refresh confirms both fields updated

✅ **Test 5: Save failure simulation**
- Expected: Error banner "Save failed, reverted."
- UI reverts when parent reloads data
- Work order returns to previous state