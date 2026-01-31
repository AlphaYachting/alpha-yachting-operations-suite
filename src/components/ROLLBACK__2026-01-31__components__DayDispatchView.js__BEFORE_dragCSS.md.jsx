# ROLLBACK SNAPSHOT - DayDispatchView.js BEFORE Drag CSS Fix
**Date:** 2026-01-31
**File:** components/DayDispatchView.js
**Purpose:** Backup before fixing drag visual bug (card expansion to full width)

**Current Issue:**
- When dragging a card, it expands to full row width
- Cannot properly shift hours/times horizontally
- CSS conflict between DnD library positioning and custom styles

**To revert:** Use this snapshot to restore pre-dragCSS-fix state