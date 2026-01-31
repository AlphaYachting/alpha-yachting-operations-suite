# DIFF NOTES - DispatchFullscreenModal Component
**Date:** 2026-01-31
**File:** components/dispatch/DispatchFullscreenModal.js
**Purpose:** New fullscreen modal for calendar + day dispatch views

## Component Overview

**Props:**
- `open` (boolean): Controls modal visibility
- `onClose` (function): Callback to close modal

**Internal State:**
- `mode`: 'calendar' | 'day' (view mode switcher)
- `currentWeekStart`: Date for calendar week navigation
- `selectedDate`: Date selected for day view
- `gridSize`: '30m' | '1h' (time slot granularity)
- All entity data arrays (same as Schedule page)

## Two Modes

### A) Calendar Mode (Default)
**Renders:** DragDropCalendar component
**Features:**
- Shows week view (35 days)
- Drag-drop work orders between days
- Click day → switch to Day mode

**Navigation:**
- Previous/Next week buttons
- "Today" button

### B) Day Dispatch Mode
**Renders:** DispatchTimeline component
**Features:**
- Shows hour grid (06:00-18:00 by default)
- Technicians as rows
- Work orders positioned by time slot
- "Back to Calendar" button returns to calendar mode

**Customization:**
- Grid size selector (30m/1h intervals)

## Day Click Handler

```javascript
const handleDayClick = (date) => {
  setSelectedDate(date);
  setMode('day');
};
```

**Passed to DragDropCalendar as `onDayClick` prop**

## Embedded Components

**1. DragDropCalendar (calendar mode):**
- Full calendar grid with drag-drop
- `onDayClick` prop connects day selection
- `onWorkOrderUpdate` saves moves
- `onWorkOrderEdit` set to empty function (no edit in modal)

**2. DispatchTimeline (day mode):**
- Hour-by-hour timeline
- Technician rows
- Work orders positioned by scheduled_start_time
- `onWorkOrderClick` set to empty function (no navigation)
- `onWorkOrderUpdate` prop passed for future drag-drop

**Note:** DispatchTimeline does NOT currently support drag-drop. It's view-only.

## Data Loading

**On modal open (`useEffect` on `open` prop):**
```javascript
base44.entities.WorkOrder.list('-scheduled_date')
base44.entities.Job.list()
base44.entities.Technician.list()
base44.entities.Customer.list()
base44.entities.Boat.list()
base44.entities.Location.list()
base44.entities.InventoryReservation.list()
```

**Same queries as Schedule page** - full dataset loaded

## Fullscreen Overlay

**Implementation:**
```javascript
<div className="fixed inset-0 bg-slate-900 z-50 overflow-auto">
```

- `z-50` ensures it appears above sidebar
- `fixed inset-0` covers entire viewport
- No sidebar/layout visible when modal open

## Close Behavior

**Close button (X):** Calls `onClose()` prop
**Result:** Dashboard sets `showDispatchModal` to false
**No side effects:** No route change, no data persistence needed

## Known Limitations

1. **DispatchTimeline has no drag-drop:** View-only in day mode
2. **No data optimization:** Loads all entities (same as Schedule page)
3. **No real-time updates:** Manual refresh only
4. **No conflict resolution UI:** Shows conflicts but no resolution workflow

## Future Enhancement Paths

If drag-drop needed in day mode:
1. Wrap DispatchTimeline content in DragDropContext
2. Make technician rows droppable
3. Make work order cards draggable
4. Implement `onDragEnd` handler to update:
   - `assigned_technicians` (if dropped on different row)
   - `scheduled_start_time` / `scheduled_end_time` (if dropped at different time)