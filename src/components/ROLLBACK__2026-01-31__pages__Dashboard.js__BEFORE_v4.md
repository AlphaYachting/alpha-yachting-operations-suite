# ROLLBACK SNAPSHOT v4 - Dashboard.js BEFORE (Flicker Fix)
**Date:** 2026-01-31
**File:** pages/Dashboard.js
**Purpose:** Backup before fixing black background, flicker, and empty day view

**Current Issues:**
1. Modal backdrop uses bg-slate-900 (very dark, appears black)
2. Drag&drop triggers loadDashboardData() which remounts everything
3. Day view receives empty technicians array → shows nothing
4. No explicit height on day view container

**Current State (lines 1152-1281):**
- Modal backdrop: `bg-slate-900`
- onWorkOrderUpdate calls: `await loadDashboardData()` (full reload)
- DispatchTimeline receives: `technicians={[]}` (empty array)
- DragDropCalendar receives: `technicians={[]}` (empty array)
- No height constraints on content area

**To revert:** Copy this snapshot back to Dashboard.js or use v3_AFTER snapshot