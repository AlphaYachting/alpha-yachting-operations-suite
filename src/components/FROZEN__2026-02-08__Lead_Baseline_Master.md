# FROZEN: Lead Baseline Master Reference
**Established:** 2026-02-08  
**Status:** REFERENCE SNAPSHOT — Official baseline for all future changes  
**Purpose:** Single source of truth for which files define the Lead module baseline

---

## Lead Module Files (Baseline Architecture)

### 1. **pages/Leads.jsx** (Lead List & Page Controller)
**Responsibility:** Loads lead data, manages page state (filters, search, form dialogs), renders lead list cards with aging indicators and creation date, handles lead CRUD operations.

**Key Behaviors:**
- Loads customers, locations, leads on mount
- Displays aging borders based on `getLeadAgingLevel()` function
- Shows creation date in Row 2 of each lead card
- Passes customers/locations/boats to LeadForm component
- Handles lead creation, update, deletion

---

### 2. **components/leads/LeadForm.jsx** (Form Component)
**Responsibility:** Renders form for creating new leads (prospect mode) or linking existing customers; manages form state for name fields, contact info, boat details, inquiry type; handles customer selection with autofill.

**Key Behaviors:**
- New Prospect mode: separate firstName/lastName fields
- Existing Customer mode: single name field + customer dropdown
- Auto-populates contact fields from selected customer
- Loads boats for selected customer
- Validates required fields before submission
- Returns combined name ("firstName lastName") on save for new prospects

---

### 3. **components/leads/LeadStatusChange.jsx** (Status Dropdown in List)
**Responsibility:** Renders status badge in lead list card and allows status updates via dropdown.

**Key Behaviors:**
- Shows current status as badge
- Triggers status change on selection
- Calls parent onStatusChange callback

---

### 4. **components/leads/LeadConversionDialog.jsx** (Lead → Customer Conversion)
**Responsibility:** Dialog for converting a lead into a customer; creates new customer record and optionally creates associated boat.

**Key Behaviors:**
- Extracts customer/boat data from lead
- Prompts user to confirm or edit before saving
- Calls API to create customer, updates lead with converted_customer_id

---

### 5. **components/leads/LeadTaskList.jsx** (Tasks in Lead Detail)
**Responsibility:** Displays and manages tasks associated with a lead (shown in lead detail dialog).

**Key Behaviors:**
- Fetches and displays lead tasks
- Provides option to generate tasks via AI
- Allows task status updates and deletion

---

## Lead Module Data Dependencies

### Data Loaded in pages/Leads.jsx:
- `base44.entities.Lead.list()` → stored in `leads` state
- `base44.entities.Location.list()` → stored in `locations` state
- `base44.entities.Customer.list()` → stored in `customers` state (after 2026-02-08 fix)

### Data Passed to LeadForm:
- `lead` (if editing)
- `locations`
- `customers`
- `boats` (currently empty array, can be populated from customer boats)

---

## Aging Indicator Implementation (Critical Path)

**File:** `pages/Leads.jsx`  
**Function:** `getLeadAgingLevel(lead)` (lines ~47–60)

```javascript
const getLeadAgingLevel = (lead) => {
  const movementTime = 
    lead.last_activity_at || 
    lead.status_updated_at || 
    lead.updated_date || 
    lead.created_date;
  
  if (!movementTime) return 'none';
  const ageDays = Math.floor((new Date() - new Date(movementTime)) / 86400000);
  if (ageDays > 5) return 'danger';
  if (ageDays > 3) return 'warn';
  return 'none';
};
```

**Output Mapping:**
- `'danger'` → `border-red-400 border-2`
- `'warn'` → `border-yellow-400 border-2`
- `'none'` → `hover:border-slate-300`

---

## Creation Date Display Implementation (Critical Path)

**File:** `pages/Leads.jsx`  
**Location:** Lead list card, Row 2 (contact info row)  
**Implementation:**
```javascript
{lead.created_date &&
  <div className="text-slate-500 text-xs ml-auto">
    Created {format(parseISO(lead.created_date), 'MMM d, yyyy')}
  </div>
}
```

**Format:** `"Created MMM d, yyyy"` (e.g., "Created Feb 8, 2026")

---

## Current Known Issues (As of 2026-02-08)

- [FIXED] Customer list was empty in LeadForm (customers not loaded in parent)
- [FIXED] Aging threshold was >2 days (now correctly >3 days)
- [VERIFIED] Created date displays correctly
- [VERIFIED] Aging borders display correctly (yellow >3, red >5)
- [VERIFIED] New Prospect mode has firstName/lastName separation
- [VERIFIED] Existing Customer mode has single name field

---

## Baseline Snapshot Date

**All changes after 2026-02-08 must validate against this baseline.**

### How to Use This Baseline:
1. When a new change is proposed, compare visuals against the baseline (aging borders, date display)
2. If regression detected, consult this file to determine which file/function controls that behavior
3. Fix applied with reference to specific function/line numbers from baseline
4. ROLLBACK files may be created, but must reference this master baseline, not older ROLLBACK snapshots

### Do NOT Use This File:
- ❌ Do NOT reference ROLLBACK files from commits before 2026-02-08 as a baseline
- ❌ Do NOT use partial snapshots from ROLLBACK files as truth
- ❌ Do NOT assume changes from prior weeks are stable; this baseline supersedes all

---

## Future Changes: Validation Checklist

Before applying any Lead-related change:
- [ ] Read FROZEN__2026-02-08__Lead_Visual_Contract.md
- [ ] Verify changes do not affect aging thresholds or date display
- [ ] Verify form state does not overwrite list state
- [ ] Create BEFORE snapshot of visuals
- [ ] Apply change
- [ ] Create AFTER snapshot of visuals
- [ ] Assert visuals unchanged
- [ ] Document in DIFF_NOTES with reference to this baseline

---

## Sign-Off

**Baseline Locked:** 2026-02-08  
**Master Reference:** This file  
**Previous ROLLBACK Files:** Archived for historical reference only; do NOT use as basis for new changes  
**Next Stabilization Review:** 2026-02-22