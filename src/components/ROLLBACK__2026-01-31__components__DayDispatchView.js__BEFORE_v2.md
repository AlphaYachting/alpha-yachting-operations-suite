# ROLLBACK SNAPSHOT v2 - DayDispatchView.js BEFORE (DnD Fix)
**Date:** 2026-01-31
**File:** components/DayDispatchView.js
**Purpose:** Backup before fixing drag & drop interaction

**Current Issues:**
- Drag does not start or does nothing
- Need to verify DnD setup matches existing working implementation

**Current State:**
- Uses @hello-pangea/dnd library
- Has DragDropContext, Droppable, Draggable
- Resize handler exists but may have pointer-event conflicts

**To revert:** Use this snapshot to restore non-working DnD state