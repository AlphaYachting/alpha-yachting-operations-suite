# DIFF NOTES - Dispatch DnD Fix
**Date:** 2026-01-31
**Purpose:** Fixed Day Dispatch drag & drop by rendering correct component

## Root Cause Analysis

### Original Issue
**Modal rendered DispatchTimeline for day mode, which is READ-ONLY:**
- DispatchTimeline (lines 1-355): No DragDropContext, no Droppable, no Draggable
- Work orders rendered as `<button>` elements with only click handlers
- No drag & drop functionality at all

**DayDispatchView was never used in the modal:**
- Has complete DnD implementation
- DragDropContext with onDragEnd handler
- Droppable zones for each technician
- Draggable cards for work orders

### Component Tree Analysis

**Before (Broken):**
```
DispatchFullscreenModal
├─ mode === 'calendar': DragDropCalendar (has DragDropContext)
└─ mode === 'day': DispatchTimeline (NO DnD)
```

**After (Fixed):**
```
DispatchFullscreenModal
├─ mode === 'calendar': DragDropCalendar (has DragDropContext)
└─ mode === 'day': DayDispatchView (has DragDropContext)
```

## DragDropContext Count

**Before:** 1 context (calendar only)
**After:** Still 1 context (calendar OR day, never both)

**Why no nested contexts:**
- Modal uses conditional rendering: `mode === 'calendar' ? <Calendar /> : <DayView />`
- Only one component mounted at a time
- When switching modes, previous component unmounts completely

## DnD Wiring Verification

### DayDispatchView has correct structure:

**DragDropContext (line 256):**
```jsx
<DragDropContext onDragEnd={handleDragEnd} onDragStart={handleDragStart}>
```

**Droppable (lines 317-318):**
```jsx
<Droppable key={technician.id} droppableId={technician.id} direction="horizontal">
  {(provided, snapshot) => (
    <div
      ref={provided.innerRef}
      {...provided.droppableProps}
      ...
    >
      {/* Work orders */}
      {provided.placeholder}
    </div>
  )}
</Droppable>
```

**Draggable (lines 349-351):**
```jsx
<Draggable key={wo.id} draggableId={wo.id} index={index}>
  {(provided, snapshot) => (
    <div
      ref={provided.innerRef}
      {...provided.draggableProps}
      ...
    >
      <div {...provided.dragHandleProps}>
        {/* Drag handle area */}
      </div>
    </div>
  )}
</Draggable>
```

✅ All required props applied correctly

## Scroll Container Status

**Current state:**
- Modal: `flex flex-col` (no overflow)
- Content: `flex-1 overflow-auto` (SINGLE scroll container)
- DayDispatchView inner: No overflow (default visible)

✅ Only ONE scroll parent: #dispatchScroll
✅ "unsupported nested scroll container" warning should not appear

## Changes Summary

### DispatchFullscreenModal.js
1. **Import change (line 8):** DispatchTimeline → DayDispatchView
2. **Component swap (lines 173-189):** Render DayDispatchView in day mode

### DayDispatchView.js
1. **Added onDragStart handler (lines 255-257):** Log draggableId
2. **Added onDragEnd log (line 123):** Log source/destination

## Manual Test Checklist

✅ **1. Open Day Dispatch:**
- Dashboard → Dispatch → Click any day
- DayDispatchView should render (not DispatchTimeline)

✅ **2. Drag starts:**
- Click and drag work order card
- Console shows: `[DnD] onDragStart: <work-order-id>`
- Card follows cursor

✅ **3. Drop works:**
- Drop on different technician row
- Console shows: `[DnD] onDragEnd: { draggableId, source, destination }`
- Card moves to new row

✅ **4. No warnings:**
- Console should NOT show "unsupported nested scroll container"
- No DnD-related errors

✅ **5. Mode switching:**
- Switch back to calendar → calendar works
- Switch to day again → DnD still works
- No state corruption