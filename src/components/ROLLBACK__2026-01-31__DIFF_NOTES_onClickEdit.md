# DIFF NOTES - onClick Edit Modal Implementation
**Date:** 2026-01-31
**Purpose:** Add click-to-edit functionality for scheduled work orders in both calendar and day dispatch views

## Problem Statement
**Before:** Work orders could only be dragged; no way to quickly edit scheduling details (time, technician, date) without navigating away.

**Goal:** Enable single-click editing of work order schedule in both calendar overview and day dispatch timeline views, while preserving full drag-and-drop functionality.

---

## Solution Architecture

### 1. New Modal Component
**File:** `components/ScheduleItemEditModal.js` (NEW, 218 lines)

**Features:**
- Edit technician assignment (lead + assigned array)
- Edit date, start time, end time
- Falls back to duration (hours) if `scheduled_end_time` doesn't exist
- Validation: end must be after start, minimum 30 minutes
- Inline error display on validation failure
- Saves via `base44.entities.WorkOrder.update()`
- Triggers parent data reload via `onSave` callback

**Key Fields Updated:**
- `lead_technician_id`
- `assigned_technicians` (ensures lead is included)
- `scheduled_date`
- `scheduled_start_time`
- `scheduled_end_time` OR `estimated_duration_hours`

---

### 2. DispatchFullscreenModal Integration
**File:** `components/dispatch/DispatchFullscreenModal.js`

**Changes:**
1. Import modal (Line 9)
2. Add state for modal open/close and editing work order (Lines 24-25)
3. Create handlers:
   - `handleWorkOrderEdit(wo)` - opens modal
   - `handleEditSave()` - reloads data after save
4. Wire handlers to child components:
   - DragDropCalendar: `onWorkOrderEdit={handleWorkOrderEdit}` (Line 167)
   - DayDispatchView: `onWorkOrderEdit={handleWorkOrderEdit}` (Line 183)
5. Render modal at bottom (Lines 187-193)

**Result:** Single modal shared by both views, data auto-refreshes on save.

---

### 3. DragDropCalendar - Drag/Click Separation
**File:** `components/schedule/DragDropCalendar.js`

**Problem:** Entire card was drag handle (both `draggableProps` and `dragHandleProps` on same element).

**Solution:**

**A) Isolated Drag Handle (Lines 575-581)**
```javascript
// BEFORE:
<div {...provided.draggableProps} {...provided.dragHandleProps}>
  <PriorityIcon />
  <p>{wo.title}</p>
</div>

// AFTER:
<div {...provided.draggableProps}>
  <div {...provided.dragHandleProps} onClick={(e) => e.stopPropagation()}>
    <PriorityIcon />  // ONLY icon is drag handle
  </div>
  <p>{wo.title}</p>  // Rest is clickable
</div>
```

**B) Block Clicks During Drag (Line 319)**
```javascript
const handleWorkOrderClick = (e, wo, isDragging) => {
  if (isDragging) return;  // Ignore clicks while dragging
  // ... rest
};
```

**C) Conditional Cursor (Line 546-548)**
```javascript
className={dragSnapshot.isDragging ? 'cursor-grabbing' : 'cursor-pointer'}
```

**Result:**
- Drag priority icon → moves card
- Click card body → opens edit modal
- No accidental clicks during drag

---

### 4. DayDispatchView - Click Handler Addition
**File:** `components/DayDispatchView.js`

**Changes:**

**A) Accept Edit Prop (Line 85)**
```javascript
export default function DayDispatchView({ ..., onWorkOrderEdit }) {
```

**B) Add Click Handler (Lines 453-459)**
```javascript
const handleCardClick = (e) => {
  if (isDragging) return;  // Block during drag
  e.stopPropagation();
  if (onWorkOrderEdit) {
    onWorkOrderEdit(wo);
  }
};
```

**C) Refine Drag Handle Structure (Lines 467-476)**
**Before:** Grip + content in single draggable div
**After:** Separated into two divs
```javascript
<div {...provided.dragHandleProps} onClick={(e) => e.stopPropagation()}>
  <GripVertical />  // Isolated drag handle
</div>
<div className="flex-1">
  <p>{wo.title}</p>  // Clickable content
</div>
```

**D) Prevent Resize Handle Click (Line 482)**
```javascript
<div onMouseDown={handleResizeStart} onClick={(e) => e.stopPropagation()}>
```

**Result:** Grip drags, card body clicks, resize handle resizes (no conflicts).

---

## Validation Logic

**In `ScheduleItemEditModal.js` (Lines 40-58):**

1. **Required Fields:**
   - `scheduled_start_time` must exist
   - `lead_technician_id` must be selected

2. **Time Validation:**
   - If `scheduled_end_time` provided: must be after start time
   - Minimum duration: 30 minutes
   - Uses `parseTime()` to convert HH:MM to minutes for comparison

3. **Duration Handling:**
   - If `scheduled_end_time` exists: update it
   - If not, update `estimated_duration_hours` instead

---

## Field Priority (Unchanged from Duration Fix)

Duration calculation still respects:
1. `scheduled_end_time` (if exists)
2. `estimated_duration_hours` (if exists)
3. Default 60 minutes

---

## Click vs Drag Separation Strategy

### Calendar Overview (DragDropCalendar):
- **Drag Handle:** Priority icon (small, left side)
- **Clickable:** Rest of card body
- **Cursor:** `cursor-grabbing` during drag, `cursor-pointer` otherwise
- **Guard:** `isDragging` check blocks clicks during drag

### Day Dispatch (DayDispatchView):
- **Drag Handle:** GripVertical icon (left edge)
- **Clickable:** Card body (middle section)
- **Non-interactive:** Resize handle (right edge, stops propagation)
- **Cursor:** `cursor-move` on grip, `cursor-pointer` on body
- **Guard:** `isDragging` check blocks clicks during drag

---

## Manual Test Checklist

✅ **Test 1: Calendar overview click**
- Click work order card body → modal opens
- Edit time → save → UI updates immediately

✅ **Test 2: Day dispatch click**
- Click work order card body → modal opens
- Edit technician → save → UI updates immediately

✅ **Test 3: Drag still works (calendar)**
- Drag priority icon → card moves to new date
- Card body click doesn't drag

✅ **Test 4: Drag still works (day dispatch)**
- Drag grip icon → card moves to new time slot
- Card body click doesn't drag

✅ **Test 5: Validation**
- Set end time before start → error shown
- Set duration < 30 min → error shown

✅ **Test 6: Save failure**
- Disconnect network → save fails → error shown
- Modal stays open (no close on error)

✅ **Test 7: Persistence**
- Edit and save → refresh page → changes persist

✅ **Test 8: Technician assignment**
- Edit technician → save → assigned_technicians includes lead

✅ **Test 9: Duration vs end time**
- If scheduled_end_time exists: edits end time
- If not: edits estimated_duration_hours

✅ **Test 10: No drag during click**
- Click card body → no drag initiated
- Drag grip → no click handler fires

---

## Revert Instructions

**To revert this feature:**

1. Restore pre-edit files:
   ```
   components/ROLLBACK__2026-01-31__components__DispatchFullscreenModal.js__BEFORE_onClickEdit.md
   components/ROLLBACK__2026-01-31__components__DragDropCalendar.js__BEFORE_onClickEdit.md
   components/ROLLBACK__2026-01-31__components__DayDispatchView.js__BEFORE_onClickEdit.md
   ```

2. Delete new modal:
   ```
   components/ScheduleItemEditModal.js
   ```

3. Expected behavior after revert:
   - Clicking cards does nothing
   - Entire card is drag handle (calendar)
   - Only drag works (no edit modal)

---

## No Schema Changes
- No entity modifications
- No backend function changes
- Pure frontend feature

---

## Files Modified/Created

**Created:**
- `components/ScheduleItemEditModal.js` (218 lines)

**Modified:**
- `components/dispatch/DispatchFullscreenModal.js` (14 lines changed)
- `components/schedule/DragDropCalendar.js` (23 lines changed)
- `components/DayDispatchView.js` (19 lines changed)

**Total Impact:** 56 lines changed + 218 new lines = 274 lines