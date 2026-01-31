# DIFF NOTES - DayDispatchView.js (NEW COMPONENT)
**Date:** 2026-01-31
**Purpose:** Drag-drop day dispatch planning view

## Entity & Fields

### Scheduled Entity: WorkOrder

### Fields Updated:

**Drag (Technician Change):**
```javascript
updates.assigned_technicians = newAssignedArray; // Add new tech
updates.lead_technician_id = destTechId;         // Set lead
```

**Resize (Duration):**
```javascript
updates.scheduled_end_time = "HH:MM";            // New end time
```

### Fields Read:
- `scheduled_date` - filter for selectedDate
- `scheduled_start_time` - position on X axis
- `scheduled_end_time` - calculate card width
- `assigned_technicians` / `lead_technician_id` - row assignment
- `title`, `status`, `job_id` - display

## Grid & Snapping

### Time Grid
- Start: 06:00 (6 AM)
- End: 18:00 (6 PM)
- Default: 30-minute intervals
- Configurable: Can use 60-minute via gridSize prop

### Snapping Logic
```javascript
function snapToGrid(minutes, gridSize = 30) {
  return Math.round(minutes / gridSize) * gridSize;
}
```
- All time changes snap to nearest 30-min (or 60-min) slot

## Drag & Drop

### Move Between Technicians (Vertical Drag)
- Technician row = Droppable zone
- Work order card = Draggable
- On drop to different row:
  - Remove old tech from assigned_technicians
  - Add new tech to assigned_technicians
  - Set new tech as lead_technician_id

### Time Change (Horizontal)
**NOT implemented on drag.** Only via resize handle.
Reason: Simpler UX - drag = change tech, resize = change time.

## Resize

### Right Edge Handle
- Shows on hover (opacity-0 → opacity-100)
- Cursor: ew-resize (east-west)
- onMouseDown starts resize session

### Resize Logic
1. Calculate delta in pixels
2. Convert to minutes based on container width
3. Snap to grid
4. Enforce minimum 30 minutes
5. Clamp to 18:00 (end hour)
6. Update `scheduled_end_time`

### Minimum Duration
30 minutes (one grid slot at 30m, two slots at 60m)

## Validation

### On Resize
- End cannot be before start + 30 min
- End cannot exceed 18:00 (endHour)
- Snaps to grid automatically

### On Drag
- No time validation needed (only changes tech)
- Tech assignment is valid as long as tech exists

### NOT Implemented (Per Requirements)
- Complex conflict engine
- Multi-tech assignment UI
- Start time drag (only resize)

## Error Handling

### Inline Error Banner
```javascript
{error && (
  <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-sm text-red-700">
    {error}
  </div>
)}
```
- Shows at top of timeline
- Clears on next successful action

### Optimistic Revert
- Parent component (Dashboard) handles optimistic update
- On save failure: parent calls loadDashboardData to revert

## Empty State
```javascript
if (dayWorkOrders.length === 0) {
  return (
    <Card className="p-12 text-center">
      <p className="text-slate-500">No scheduled work orders for {date}</p>
    </Card>
  );
}
```

## No Schema/Backend Changes Confirmation
✅ No new entities created
✅ No entity schemas modified
✅ No backend functions added
✅ Uses existing WorkOrder fields only
✅ Standard entity update: `base44.entities.WorkOrder.update(id, updates)`

## Reusable Components
- Reuses DispatchTimeline's positioning logic (calculatePosition)
- Reuses DispatchTimeline's styling patterns
- New: Adds DragDropContext wrapper
- New: Adds Draggable/Droppable zones
- New: Adds resize handlers