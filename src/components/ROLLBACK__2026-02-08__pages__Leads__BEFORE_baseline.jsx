# BEFORE: pages/Leads.js (Baseline Restore Point)

**Date:** 2026-02-08
**State:** 4 simultaneous regressions
- Customers not loaded; LeadForm receives undefined
- getLeadAgingLevel imported but never called; no aging borders
- Created date field exists but not rendered
- LeadStatusChange in Row 1 (name area), not in quick-actions

**loadData() (lines 71-84):**
- Fetches: Lead, Location ONLY
- Missing: Customer.list()
- setCustomers() call absent

**LeadForm Props (lines 305-312):**
- Passes: lead, locations, onSave, onCancel
- Missing: customers={customers}

**Lead Card Map (lines 191-297):**
- Line 192: Card className static (no aging border)
- Line 204: LeadStatusChange in Row 1 (inline with name/badges)
- No created_date display anywhere
- No agingLevel computation

**Function Usage:**
- getLeadAgingLevel imported (line 22) ✅
- Never called ❌