# ROLLBACK SNAPSHOT - DayDispatchView.js BEFORE Time Shift
**Date:** 2026-01-31
**File:** components/DayDispatchView.js
**Purpose:** Backup before adding time-based drag & drop

**Current State:**
- Droppable uses technician.id only (line ~317)
- onDragEnd updates assigned_technicians only
- Time fields (scheduled_start_time, scheduled_end_time) not changed on drag

**To revert:** Use this snapshot to restore pre-timeShift state