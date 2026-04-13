# BEFORE SNAPSHOT: components/leads/LeadForm.jsx (Existing Customer Fix)
**Date:** 2026-02-08  
**Issue:** Receives undefined `customers` prop

## Current State
- **Line 16:** `export default function LeadForm({ lead, locations, customers, boats, onSave, onCancel })`
  - Expects `customers` prop ✓
- **Line 255–276:** Customer selector uses `customers` prop
  - Filters: `customers?.filter(c => { ... })`
  - If `customers` is undefined → empty list ✗

## No Internal Changes Needed
- Form logic is correct
- Issue is data flow from parent (Leads page)