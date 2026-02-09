# ROLLBACK SNAPSHOT - pages/BoatDetail.jsx AFTER

Date: 2026-02-09
Purpose: Added Active Projects section for navigation convenience

Changes:
- Added Active Projects card at top of Overview tab
- Lists all jobs NOT in Completed/Invoiced/Cancelled status
- Each project is clickable, navigates to JobDetail page
- Shows project title, status badge, scheduled date
- Empty state: "No active projects."

Location: Lines 242-276 (inserted before Primary Image card)