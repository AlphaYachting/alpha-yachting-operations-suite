# BEFORE SNAPSHOT: pages/TeamOrderDetail.jsx
## Date: 2026-02-01
## Purpose: Capture state before adding Partner Brief diagnostic mode

This is the Team Order Detail page that generates Partner Brief PDFs with CORRECT vessel and budget data.

**Current PDF Generation Path (from context-snapshot):**
- Preview Brief button → calls `base44.functions.invoke('generatePartnerBriefPDF', { workOrderId, teamOrderId, templateData })`
- Download Brief button → same function call
- Uses `generating` state and error handling
- Shows PDF in dialog with iframe preview

**Key Data Loading:**
- Loads TeamOrder by ID
- Loads WorkOrder by team order's work_order_id
- Loads related entities (jobs, customers, boats, locations, tasks, technicians)
- All data fully populated before PDF generation

**Current State:** Produces correct output with vessel "Atlanic 47 Daniela", type "Motorboat", length "14m", budget "€3500.00"