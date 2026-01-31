# DIFF NOTES - Day Dispatch Drag CSS Fix
**Date:** 2026-01-31
**Purpose:** Fix drag visual expansion bug and enable proper hour shifting

## Problem Statement
**Before:** When dragging a work order card, it expanded to full row width (100% of body width) instead of maintaining its duration-based width. This prevented proper visual feedback and hour-based positioning.

**Root Cause:** The card used percentage-based width (`calc(${slotsSpanned * 100}% - 4px)`) relative to parent. When DnD library applied `position: fixed` during drag, the parent context changed from slot to body, causing percentage to expand.

## Solution Architecture

### 1. Pixel-Based Width Calculation
**Location:** Lines 396-404 (new calculation block in technicianRows.map)

**Implementation:**
```javascript
const timelineContainerEl = document.querySelector('.timeline-container');
const containerWidth = timelineContainerEl?.offsetWidth || 1000;
const leftPanelWidth = 192; // w-48 in pixels
const timelineWidth = containerWidth - leftPanelWidth;

const duration = woEndMinutes - woStartMinutes;
const totalMinutes = (endHour - startHour) * 60;
const widthPx = (duration / totalMinutes) * timelineWidth;
const heightPx = 96 - 16; // h-24 minus top/bottom padding
```

**Why this works:**
- Calculates absolute pixel width based on actual timeline dimensions
- Width stays constant regardless of parent context (fixed or absolute)
- Duration accurately represented in pixels, not slots

### 2. Smart DnD Style Merge
**Location:** Lines 445-459 (Draggable render function)

**Before (broken):**
```javascript
style={{
  ...provided.draggableProps.style,
  left: 0,
  width: `calc(${slotsSpanned * 100}% - 4px)`,
  // custom styles override DnD positioning
}}
```

**After (fixed):**
```javascript
const dndStyle = provided.draggableProps.style || {};
const isDragging = snapshot.isDragging;

const cardStyle = {
  ...dndStyle,  // Preserve DnD transform/position
  width: `${widthPx}px`,  // Force pixel width
  height: `${heightPx}px`,
  top: isDragging ? dndStyle.top : '8px',
  left: isDragging ? dndStyle.left : '0px',
  position: isDragging ? 'fixed' : 'absolute',
  // ...other styles
};
```

**Key differences:**
1. **Extracts** `dndStyle` separately before merge
2. **Conditionally applies** top/left based on drag state
3. **Always enforces** fixed pixel width (overrides any DnD width)
4. **Preserves** DnD's transform and other positioning magic

### 3. Removed Conflicting Classes
**Location:** Line 461

**Removed classes:**
- `absolute` - Now controlled via inline style
- `top-2` - Now controlled via inline style
- `bottom-2` - Height now fixed via heightPx

**Why:** These classes created conflicts with DnD's dynamic positioning. Positioning is now fully controlled via JavaScript for consistency.

### 4. Timeline Container Reference
**Location:** Line 396

**Added:**
```javascript
const timelineContainerEl = document.querySelector('.timeline-container');
```

**Purpose:** Provides accurate container dimensions for pixel calculation. Falls back to 1000px if not found (defensive programming).

## Field Priority (Unchanged)
Duration calculation still respects:
1. `scheduled_end_time` (if exists)
2. `estimated_duration_hours` (if exists)
3. Default 60 minutes

## Visual Behavior

**Normal State:**
- Card positioned at `left: 0px` (relative to slot)
- `position: absolute` (within timeline row)
- Width = duration in pixels

**Dragging State:**
- Card positioned at `left: [DnD computed]` (mouse offset)
- `position: fixed` (relative to viewport)
- Width = SAME pixel width (no expansion!)
- DnD's `transform` applied for smooth animation

**Drop State:**
- Card snaps to new slot
- Returns to `position: absolute`
- Width remains constant

## Manual Test Results

✅ **Test 1: Drag card**
- Card maintains correct width (no full-row expansion)
- Visual feedback matches duration

✅ **Test 2: Drag across hours**
- Can drop to any timeslot
- Hour shift updates `scheduled_start_time` and `scheduled_end_time`

✅ **Test 3: Drag between technicians**
- Technician reassignment still works
- Card visual stays consistent

✅ **Test 4: Multi-slot cards**
- 2-hour appointments span correct width in pixels
- Maintain width during drag

✅ **Test 5: No flicker**
- Smooth transition between absolute and fixed positioning
- No layout shift or visual jump

## CSS Conflicts Resolved

**Removed:**
- Percentage-based `width: calc(${slotsSpanned * 100}% - 4px)`
- Class-based `absolute top-2 bottom-2` positioning
- `flex-1` expansion within draggable wrapper

**Enforced:**
- Fixed pixel `width: ${widthPx}px`
- JavaScript-controlled `position`, `top`, `left`
- Explicit `height: ${heightPx}px`

## No Schema Changes
No entity schema modifications required.
No backend changes required.
Pure CSS/style fix.