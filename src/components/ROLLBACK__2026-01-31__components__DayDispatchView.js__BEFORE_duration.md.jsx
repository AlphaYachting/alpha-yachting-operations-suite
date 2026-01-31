# ROLLBACK SNAPSHOT - DayDispatchView.js BEFORE Duration Fix
**Date:** 2026-01-31
**File:** components/DayDispatchView.js
**Purpose:** Backup before fixing blocked time duration display and persistence

**Current Issue:**
- Cards may not span correct duration (multi-slot blocks not visible)
- Resize handler exists but may not handle all field combinations
- Drag handler may not preserve duration correctly

**To revert:** Use this snapshot to restore pre-duration-fix state