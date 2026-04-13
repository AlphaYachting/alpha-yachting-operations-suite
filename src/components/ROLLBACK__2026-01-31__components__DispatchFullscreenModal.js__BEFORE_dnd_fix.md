# ROLLBACK SNAPSHOT - DispatchFullscreenModal.js BEFORE DnD Fix
**Date:** 2026-01-31
**File:** components/dispatch/DispatchFullscreenModal.js
**Purpose:** Backup before fixing nested DragDropContext

**Current Issue:**
- Day Dispatch renders DispatchTimeline (not DayDispatchView)
- Both Calendar and Timeline likely have their own DragDropContext
- Potential nested contexts when switching modes

**To revert:** Use this snapshot to restore pre-DnD-fix state