# DIFF NOTES - Day Dispatch Time Shift Implementation
**Date:** 2026-01-31
**Purpose:** Enable time-based drag & drop in Day Dispatch view

## Problem Statement
**Before:** Dragging work orders only changed technician assignment, not scheduled time.
**After:** Dragging to a time slot updates both technician and scheduled_start/end times.

## Technical Architecture Change

### Droppable Structure Transformation

**Before (Single Droppable per Row):**
```jsx
<Droppable droppableId={technician.id}>
  {(provided) => (
    <div ref={provided.innerRef} {...provided.droppableProps}>
      {/* Work orders positioned absolutely */}
      {techWOs.map(wo => <Draggable>...</Draggable>)}
      {provided.placeholder}
    </div>
  )}
</Droppable>
```

**After (Grid of Timeslot Droppables):**
```jsx
<div className="h-24 relative">
  {/* Droppable grid layer */}
  <div className="absolute inset-0 flex">
    {timeSlots.map(hour => (
      <Droppable droppableId="tech:<id>|date:<date>|t:<time>">
        {(provided) => (
          <div ref={provided.innerRef} {...provided.droppableProps}>
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    ))}
  </div>
  
  {/* Work order display layer */}
  <div className="absolute inset-0 pointer-events-none">
    {techWOs.map(wo => (
      <Draggable>
        <div className="pointer-events-auto">...</div>
      </Draggable>
    ))}
  </div>
</div>
```

### Key Architectural Decisions

**1. DroppableId Encoding (Lines 327-330)**
Format: `"tech:<id>|date:<YYYY-MM-DD>|t:<HH:MM>"`

**Why:** Encode all context needed to update work order:
- `tech:<id>`: Destination technician
- `date:<date>`: Target date (validates same-day drop)
- `t:<HH:MM>`: Slot start time (new scheduled_start_time)

**Parsing:**
```javascript
const destParts = destination.droppableId.split('|');
const destTechId = destParts[0].replace('tech:', '');
const destTime = destParts[2].replace('t:', '');
```

**2. Duration Preservation (Lines 135-140)**
```javascript
const currentStart = parseTime(wo.scheduled_start_time || '09:00');
const currentEnd = parseTime(wo.scheduled_end_time || wo.scheduled_start_time) || currentStart + 60;
const duration = currentEnd - currentStart; // Minutes

const newStartMinutes = parseTime(destTime);
const newEndMinutes = newStartMinutes + duration; // Apply same duration
```

**Why:** Dragging should move the appointment, not resize it. Duration changes via resize handle only.

**3. Layered Rendering (Lines 323-347, 347-403)**

**Drop zone layer (bottom):**
- Grid of Droppable cells
- Receives drop events
- Shows hover feedback

**Display layer (top):**
- Draggable cards positioned absolutely
- `pointer-events-none` on container
- `pointer-events-auto` on each card
- Allows drag from cards without blocking drop zones

**Why:** Prevents z-index conflicts. Cards can be grabbed and dropped on any slot below.

**4. Bounds Validation (Lines 143-147)**
```javascript
if (newEndMinutes > endHour * 60) {
  setError('Work order would extend past 18:00. Please choose an earlier time slot.');
  return;
}
```

**Why:** Prevent scheduling work orders that extend beyond visible timeline (06:00-18:00).

## Updated Fields on Drop

**Previous (technician only):**
```javascript
{
  assigned_technicians: [...],
  lead_technician_id: destTechId
}
```

**New (technician + time):**
```javascript
{
  assigned_technicians: [...],
  lead_technician_id: destTechId,
  scheduled_start_time: "09:30",  // HH:MM format
  scheduled_end_time: "11:00"      // HH:MM format
}
```

## Visual Feedback

**Slot hover (Lines 335-341):**
```javascript
style={{
  backgroundColor: snapshot.isDraggingOver ? '#3b82f620' : 'transparent',
  borderColor: snapshot.isDraggingOver ? '#3b82f6' : 'transparent',
  borderWidth: snapshot.isDraggingOver ? '2px' : '0'
}}
```

Shows blue highlight on timeslot when dragging over it.

**Time label (Lines 382-386):**
```jsx
<span className="text-[10px] font-medium text-slate-700">
  {wo.scheduled_start_time}–{wo.scheduled_end_time || '?'}
</span>
```

Displays updated time immediately after drop (optimistic update via parent state).

## Error Handling

**Bounds error (Lines 143-147):**
- Inline error banner at top of component
- Reverts drag (no state change)

**Save failure (Lines 159-163):**
- Catches `onWorkOrderUpdate` errors
- Shows inline error message
- Parent component should handle revert

## Grid Snapping

**Time slots (Lines 74-81):**
- Generated based on `gridSize` prop ('30m' or '1h')
- 30-minute grid: 06:00, 06:30, 07:00, ..., 17:30
- 1-hour grid: 06:00, 07:00, 08:00, ..., 17:00

**Snap behavior:**
- Drop zones aligned to grid
- All drops snap to slot start time
- No sub-slot positioning

## Manual Test Results Checklist

✅ **Test 1: Drag within same technician to different time**
- Expected: Time updates, technician unchanged
- Verify: Refresh page, time persists

✅ **Test 2: Drag to different technician + different time**
- Expected: Both technician and time update
- Verify: assigned_technicians includes new tech, scheduled_start/end updated

✅ **Test 3: Drop on slot that would extend past 18:00**
- Expected: Error message, no change
- Verify: "Work order would extend past 18:00..." banner appears

✅ **Test 4: Hover over timeslots**
- Expected: Blue highlight on hover during drag
- Verify: Visual feedback clear and responsive

✅ **Test 5: Save failure simulation**
- Expected: Error banner, state reverts
- Verify: Parent component catches error and reloads data