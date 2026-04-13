# DIFF NOTES - Boat Detail Active Projects Section

**Date:** 2026-02-09
**Operation:** Add Active Projects list to Boat Detail Overview tab
**Files Changed:** 1 (pages/BoatDetail.jsx)
**Functional Changes:** YES (added navigation section only)

## Summary
Added "Active Projects" section at the top of the Boat Detail Overview tab. Lists active jobs (not Completed/Invoiced/Cancelled) linked to the boat, each clickable to navigate to JobDetail. Empty state shows "No active projects."

## What Changed

### pages/BoatDetail.jsx
**Location:** Lines 242-276 (inserted before Primary Image card in Overview tab)

**Added:**
- New Card component titled "Active Projects" with Briefcase icon
- Filters existing `jobs` array to exclude statuses: 'Completed', 'Invoiced', 'Cancelled'
- Maps filtered jobs to clickable links
- Each link shows:
  - Job title (font-medium)
  - Status badge
  - Requested date (if available) with Calendar icon
- Empty state: "No active projects." when no active jobs exist
- Clicking a project navigates to: `JobDetail?id={job.id}`

**What Did NOT Change:**
- No changes to data fetching (jobs already loaded in line 69)
- No changes to Job entity schema
- No changes to other tabs (Documents, Images, Service History)
- No changes to boat information cards
- No changes to image upload/management
- No changes to any other boat detail functionality

## Entity Used
**Job entity** with fields:
- `boat_id` (linkage field - already exists)
- `status` (filtered against: 'Completed', 'Invoiced', 'Cancelled')
- `title` (displayed)
- `requested_date` (displayed if available)
- `id` (navigation parameter)

## Status Filter Logic
**Active = NOT in:**
- 'Completed'
- 'Invoiced'
- 'Cancelled'

**Active includes:**
- 'New'
- 'Quoted'
- 'Approved'
- 'Scheduled'
- 'In Progress'
- 'Waiting for Parts'
- 'On Hold'

## Layout Impact
- Active Projects card inserted at position 1 in Overview tab
- Primary Image card moved down (now position 2)
- All other cards maintain original order
- No responsive layout changes

## Manual Test Checklist
✅ Open boat with active projects → list appears with clickable items
✅ Clicking project navigates to correct JobDetail page
✅ Open boat with no active projects → "No active projects." text shown
✅ Open boat with only completed/cancelled jobs → empty state shown
✅ Projects show correct status badges
✅ Projects show scheduled date when available
✅ No changes to Documents/Images/History tabs
✅ No changes to boat information cards
✅ No changes to image management

## Schema Changes
**NONE** - All used fields already exist in Job entity

## Breaking Changes
**NONE** - Purely additive change

## Rollback Instructions
Restore from: `components/ROLLBACK__2026-02-09__pages__BoatDetail__BEFORE.md