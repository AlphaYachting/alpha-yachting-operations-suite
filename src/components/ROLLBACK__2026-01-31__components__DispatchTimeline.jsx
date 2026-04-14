# ROLLBACK SNAPSHOT - DispatchTimeline.js BEFORE DnD Fix
**Date:** 2026-01-31
**File:** components/schedule/DispatchTimeline.js
**Purpose:** Backup before fixing DnD wiring

**Current Issue:**
- Used in Day Dispatch mode instead of DayDispatchView
- May have incorrect DnD wiring or nested context

**To revert:** Use this snapshot to restore pre-DnD-fix state