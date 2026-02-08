# DIFF NOTES - Lead Assignment Notification Feature
Date: 2026-02-08

## WHAT CHANGED

### 1. Lead Entity Schema (entities/Lead.json)
- **Added field**: `assigned_to_user_id` (string, optional)
- **Purpose**: Track which internal user is responsible for following up on the lead
- **No other fields modified**

### 2. LeadDetail Page (pages/LeadDetail)
- **Added UI**: Assignee selector dropdown at top of Lead Details card
- **Added state**: allUsers, assignedUser, savingAssignment
- **Added function**: handleAssignmentChange() - saves assignment and triggers notification
- **Added function**: loadAllUsers() - fetches all users for dropdown
- **Modified function**: loadLeadDetails() - now fetches assigned user if present
- **Notification trigger**: Only fires when assigned_to_user_id changes from previous value to new non-null user
- **No notification**: When simply re-saving with same assignee or when unassigning

### 3. Notification Utils (components/notifications/notificationUtils)
- **Added function**: notifyLeadAssignment()
- **Sends email**: With lead details (name, boat, inquiry type, priority, status, description) and link to LeadDetail
- **Creates in-app notification**: Reuses existing Notification entity (type: work_order_assignment)
- **No other notification functions modified**

## WHY IT CHANGED

- **User request**: Enable lead assignment with automatic notification to assignee
- **Business need**: Track ownership of customer inquiries and alert responsible person
- **Integration**: Reused existing notification infrastructure (no new system built)

## WHAT DID NOT CHANGE

### Modules NOT Touched:
- Work Orders
- Tasks  
- Projects
- Offers
- Importer
- Any other lead-related pages (Leads list, LeadForm, LeadConversionDialog, LeadTaskList)

### Infrastructure NOT Added:
- No new notification system
- No new notification types in entity schema
- No styling files modified
- No layout changes

### UI Pattern:
- Minimal insertion only
- No redesign of LeadDetail layout
- Reused existing Select component pattern
- Positioned at top of Lead Details card with visual separator

## FILE COUNT
Total files modified: 3
1. entities/Lead.json (schema change)
2. pages/LeadDetail (UI + assignment logic)
3. components/notifications/notificationUtils (notification function)

## MANUAL TEST CHECKLIST
- [ ] Open a lead in LeadDetail page
- [ ] Verify "Assigned To" dropdown appears in Lead Details section
- [ ] Assign lead to another user
- [ ] Confirm assignee name and email displayed
- [ ] Confirm the assigned user receives email notification
- [ ] Check notification includes link to lead (opens LeadDetail?id=X)
- [ ] Re-save lead without changing assignee → no new notification sent
- [ ] Unassign lead (set to "Unassigned") → no notification sent
- [ ] Verify no regressions in lead list, lead save, lead tasks