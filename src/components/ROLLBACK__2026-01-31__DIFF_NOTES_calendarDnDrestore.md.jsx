# DIFF NOTES - Calendar Drag-and-Drop Restore
## Date: 2026-01-31

## What Broke Calendar Dragging?
**Root Cause:** `dragHandleProps` was applied only to a tiny priority icon wrapper (lines 584-590), limiting dragging to a ~10px clickable area.

Previous code:
```jsx
<div {...provided.dragHandleProps} className="cursor-move p-0.5">
  <PriorityIcon className="h-2.5 w-2.5" />
</div>
```

This meant users could ONLY drag by clicking precisely on the small icon.

## How Full-Surface Dragging Was Restored

**Fix Applied:**
1. Moved `{...provided.dragHandleProps}` to outer wrapper (line 541)
2. Entire event card (lines 545-608) now receives drag functionality
3. Removed drag handle isolation from icon
4. Changed default cursor to `cursor-move` to indicate draggability

**After Fix:**
```jsx
<div
  ref={provided.innerRef}
  {...provided.draggableProps}
  {...provided.dragHandleProps}  // ✅ NOW ON FULL WRAPPER
>
```

## Click vs Drag Handling
- `onClick` handler at line 546 includes `dragSnapshot.isDragging` check
- If user is dragging, click handler returns early
- This prevents opening edit modal during drag operations

## Day Dispatch Rules - UNCHANGED
- Day Dispatch view (`DayDispatchView.js`) is separate component
- Uses different DnD context for time-grid dragging
- Only calendar view was modified
- No conflicts: modal properly unmounts inactive view

## Files Modified
1. `components/schedule/DragDropCalendar.jsx` - Lines 541, 548, 584-590 (removed)

## Revert Instructions
To revert this change:
```bash
# Restore BEFORE snapshot to current file
cp components/ROLLBACK__2026-01-31__components__DragDropCalendar.js__BEFORE_calendarDnDrestore.md components/schedule/DragDropCalendar.jsx
```

## Manual Test Results
✅ Calendar view: Full event card draggable to any day cell
✅ Drag persists date change correctly
✅ Click-to-edit still works when not dragging
✅ Day Dispatch: Unaffected, time-grid drag works as before
✅ No DnD context conflicts between views