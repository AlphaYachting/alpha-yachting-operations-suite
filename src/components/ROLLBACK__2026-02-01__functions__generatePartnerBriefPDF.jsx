# BEFORE SNAPSHOT: functions/generatePartnerBriefPDF.js
## Date: 2026-02-01
## Purpose: Capture state before adding diagnostic mode

This is the backend PDF generation function that currently returns simple text-based PDF.

**Current Implementation:**
- Uses jsPDF directly with `doc.text()` methods
- Receives: `workOrderId`, `teamOrderId`, `templateData`
- Fetches entities using `base44.asServiceRole.entities`
- Loads: WorkOrder, TeamOrder, Jobs, Customers, Boats, Locations, Tasks, Technicians
- Finds related records using `.find()` on arrays

**Key Logic:**
```javascript
const boat = boats.find(b => b.id === job?.boat_id);
const teamOrder = await base44.asServiceRole.entities.TeamOrder.get(teamOrderId);
```

**Output:** PDF base64 with vessel and budget data

**Current State:** This function WORKS and produces correct output (vessel "Atlanic 47 Daniela", budget "€3500.00")