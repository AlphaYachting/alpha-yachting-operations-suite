# BEFORE SNAPSHOT: pages/Leads.jsx (Existing Customer Fix)
**Date:** 2026-02-08  
**Issue:** Customers not loaded / not passed to LeadForm

## Problem Code
- **Line 73–75:** `Promise.all([Lead.list(), Location.list()])`
  - Missing `Customer.list()`
- **Line 78:** `setLocations(allLocations)` only
  - No `setCustomers()`
- **Line 307:** `<LeadForm lead={editingLead} locations={locations} ...>`
  - Missing `customers={customers}` prop
  - LeadForm receives `undefined` for customers

## Impact
- Existing customer selector shows empty list
- Customer search returns "No customers match"
- Form cannot autofill from existing customer