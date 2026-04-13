# BEFORE SNAPSHOT: pages/WorkOrderDetail.jsx
## Date: 2026-02-01
## Purpose: Capture state before adding Partner Brief diagnostic mode

This is the Work Order Detail page that should generate Partner Brief PDFs but shows MISSING vessel and budget data.

**Expected PDF Generation Issue:**
- Vessel shows: "-"
- Type shows: "-"
- Length shows: "-"
- Budget shows: "€0.00"

**Need to identify:**
- Where is the Partner Brief generation triggered from this page?
- What data is passed to the generator?
- Why is vessel/budget data missing vs TeamOrderDetail page?

**Current State:** Need to examine WorkOrderDetail.jsx to find PDF generation entry point