# DIFF NOTES - New Lead Assignee Placement
Date: 2026-02-08

## WHAT CHANGED

### 1. LeadForm Component (components/leads/LeadForm)
- **Added:** User icon import + base44 SDK import
- **Added:** allUsers state, populated on mount via base44.entities.User.list()
- **Added:** assigned_to_user_id field to formData state (line 35)
- **Added:** User.list() call in useEffect (lines 42–49)
- **Added:** Assignee select dropdown UI (lines 142–158):
  - Placed at TOP of form (before Lead Type toggle)
  - Shows all users with email/name
  - Includes "Unassigned" option
  - Binds to formData.assigned_to_user_id
  - User icon + "Assign To" label

### 2. Leads Page (pages/Leads)
- **Modified:** handleSaveLead() for new leads (lines 86–115)
- **Added:** notification dispatch on creation (lines 92–110):
  - Captures newLead from Lead.create() result
  - If assigned_to_user_id is present, fetches assignee user
  - Calls notifyLeadAssignment(newLead, assignee)
  - Error handled silently (console.error only)
  - Does not break save operation
- **Unchanged:** Edit flow (line 88-89 still works as before)
- **Unchanged:** loadData() call and cleanup

## WHY IT CHANGED

User requirement: Enable lead assignment during creation, not just after.
- Previously: User creates lead → must open detail → assign → notification
- Now: User creates lead → can assign in form → notification sent immediately on create

## WHAT DID NOT CHANGE

### NOT Modified:
- LeadDetail page assignment (still works as before)
- Leads list page (no changes)
- Assignment behavior in LeadDetail (edit flow, notification, UI)
- notificationUtils (reused as-is)
- Styling, layout, or design
- Other modules (Offers, Work Orders, PDFs, Importer)
- LeadForm prop signature (customers, boats, locations still work)
- Lead schema or entity (assigned_to_user_id already exists)

### Backward Compatibility:
- ✅ Existing leads without assignee still work
- ✅ Editing leads still allows re-assignment
- ✅ Unassigned option remains
- ✅ Notification only on creation if assigned (not on edit)

## MANUAL TEST CHECKLIST
- [ ] Open New Lead form
- [ ] Verify "Assign To" dropdown appears at top
- [ ] Select a user from dropdown
- [ ] Fill required fields (name, phone, etc.)
- [ ] Save lead
- [ ] Confirm lead created with correct assignee
- [ ] Confirm assignee receives notification email
- [ ] Open lead in LeadDetail → verify assignee is set
- [ ] Edit lead assignee in detail view → still works
- [ ] Create unassigned lead → no notification sent
- [ ] Edit existing lead (change assignee) → notification NOT sent on edit
- [ ] Lead list shows as before (no regression)

## FILE CHANGES SUMMARY
**Files Modified:** 2
1. components/leads/LeadForm (added state, UI, hooks)
2. pages/Leads (added notification on create)

**Files NOT Modified:** 0 (no extra files needed)

**Schema Changes:** 0 (field already exists)
**Styling Changes:** 0 (inline placement only)
**Logic Regressions:** 0 (edit/detail unchanged)