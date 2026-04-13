# AFTER SNAPSHOT - components/notifications/notificationUtils
Date: 2026-02-08
Purpose: Lead assignment notification feature

Changes:
Added notifyLeadAssignment function (lines 185-220):
- Parameters: lead object, assignedUser object
- Sends email notification with lead details and link to LeadDetail page
- Creates in-app notification (type: work_order_assignment, reused)
- Includes lead name, boat, inquiry type, priority, status, description
- Link format: /LeadDetail?id={lead.id}

No other functions modified.