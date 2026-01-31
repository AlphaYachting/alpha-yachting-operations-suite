# ROLLBACK SNAPSHOT - DragDropCalendar.js AFTER onClick Edit
**Date:** 2026-01-31
**File:** components/schedule/DragDropCalendar.js
**Purpose:** Final state after adding onClick edit and fixing drag/click separation

## Changes Made

### 1. Updated Click Handler Signature (Line 319)
**Before:** `handleWorkOrderClick(e, wo)`
**After:** `handleWorkOrderClick(e, wo, isDragging)`
Added `isDragging` parameter to prevent clicks during drag.

**Implementation:**
```javascript
const handleWorkOrderClick = (e, wo, isDragging) => {
  if (isDragging) return; // Block clicks while dragging
  e.preventDefault();
  e.stopPropagation();
  if (onWorkOrderEdit) {
    onWorkOrderEdit(wo);
  }
};
```

### 2. Fixed Drag Handle Isolation (Lines 540-542, 575-581)
**Before:** Both `draggableProps` and `dragHandleProps` on card wrapper
```javascript
<div {...provided.draggableProps} {...provided.dragHandleProps}>
```

**After:** Separated drag handle to icon only
```javascript
<div ref={provided.innerRef} {...provided.draggableProps}>
  <div className="flex items-center gap-1">
    <div 
      {...provided.dragHandleProps}
      className="cursor-move p-0.5 hover:bg-white/20 rounded"
      onClick={(e) => e.stopPropagation()}
    >
      <PriorityIcon className="h-2.5 w-2.5 flex-shrink-0" />
    </div>
```

### 3. Updated Cursor Styles (Line 546-548)
**Before:** Always `cursor-move`
**After:** Conditional cursor based on drag state
```javascript
className={`... ${
  dragSnapshot.isDragging ? 'cursor-grabbing' : 'cursor-pointer'
} ...`}
```

### 4. Updated Non-Draggable Continuation Cells (Line 420)
**Before:** `onClick={(e) => handleWorkOrderClick(e, wo)}`
**After:** `onClick={(e) => handleWorkOrderClick(e, wo, false)}`

## Result
✅ Drag handle isolated to priority icon only
✅ Clicking card body opens edit modal (no drag)
✅ Dragging icon moves card (no click)
✅ Proper cursor feedback (pointer vs grabbing)