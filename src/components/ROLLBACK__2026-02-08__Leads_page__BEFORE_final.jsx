# BEFORE SNAPSHOT: pages/Leads.jsx (Final Stabilization)
**Date:** 2026-02-08  
**Status:** Pre-implementation for A–D requirements

## Current Aging Thresholds
- Line ~56: `if (ageDays > 2) return 'warn'` ← **NEEDS CHANGE TO >3**
- Line ~57: `if (ageDays > 5) return 'danger'` ← CORRECT

## Current Features Present
✅ Created date display (Row 2)
✅ Aging indicator (yellow/red border)
✅ Proper ternary JSX (parentheses)
✅ `getLeadAgingLevel()` helper defined

## Final Changes Required
1. Change aging threshold from >2 to >3 days (yellow)