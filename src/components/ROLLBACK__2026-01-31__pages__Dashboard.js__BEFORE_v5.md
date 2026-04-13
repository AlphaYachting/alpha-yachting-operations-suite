# ROLLBACK SNAPSHOT v5 - Dashboard.js BEFORE (Day Dispatch DnD)
**Date:** 2026-01-31
**File:** pages/Dashboard.js
**Purpose:** Backup before adding drag-drop Day Dispatch view

**Current State:**
- Dispatch modal uses DispatchTimeline for day view (view-only, no drag-drop)
- Lines 1250-1277: Day view shows read-only hour grid
- technicians loaded but no drag-drop interaction

**To revert:** Use this snapshot to restore read-only day view