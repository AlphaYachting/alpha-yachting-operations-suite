# ROLLBACK SNAPSHOT - DragDropCalendar.js BEFORE onClick Edit
**Date:** 2026-01-31
**File:** components/schedule/DragDropCalendar.js
**Purpose:** Backup before adding onClick edit modal for calendar items

**Current State:**
- Lines 319-325: `handleWorkOrderClick` exists but only calls `onWorkOrderEdit` prop (not fully implemented)
- Lines 540-541: Full card has both `draggableProps` and `dragHandleProps` - entire card is drag handle
- Lines 546: Click handler present but doesn't open modal, only calls external prop

**Drag Handle Issue:**
- Entire card is draggable, causing click/drag conflict

**To revert:** Use this snapshot to restore pre-onClickEdit state