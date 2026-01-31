# ROLLBACK SNAPSHOT - DayDispatchView.js BEFORE Scroll Fix
**Date:** 2026-01-31
**File:** components/DayDispatchView.js
**Purpose:** Backup before removing nested scroll to fix DnD

**Current Issue:**
- @hello-pangea/dnd warning: "unsupported nested scroll container"
- Drag does not start
- overflow-x-auto was removed but still not working

**To revert:** Use this snapshot to restore pre-scroll-fix state