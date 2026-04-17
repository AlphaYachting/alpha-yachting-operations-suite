# TeamOrder for External Workers/Partners — Read-Only Functional Audit
**Date:** April 17, 2026  
**Scope:** Analyze current TeamOrder logic for external workers/partners (NO CHANGES)  
**Purpose:** Map data flow and identify gaps for future AI-generated worker instruction document feature

---

## EXECUTIVE SUMMARY

**Current State:**
- TeamOrder is a standalone **budget and cost-policy management system** for external partner assignments tied to a single WorkOrder
- It functions as a **contract/authorization document** that specifies what an external partner can spend and under which conditions
- An external worker currently receives:
  - Budget limits (total approved, broken down by category: labor, travel, accommodation, per diem)
  - Cost coverage policies (which expenses are paid back, at what rates)
  - Budget approval thresholds (pre-approval needed over €500, etc.)
  - Task list (title + description only, sorted by sequence order)
  - Scheduled date, customer name, boat name, location access notes
  - Partner-specific notes (text field visible to external worker)
  - Safety notes from WorkOrder

**Critical Gaps for Future AI Briefing Feature:**
- TeamOrder does **NOT read** Job/Project description (only WorkOrder description)
- TeamOrder does **NOT have access to** customer-facing email communication
- TeamOrder does **NOT expose** Offer/proposal text or scope context
- TeamOrder does **NOT consolidate** internal notes with customer expectations
- No structured "briefing context object" exists — data is scattered across multiple entities
- External worker sees **task row data only** (title/description), not the operational "why"
- **No human review layer** before content is shared externally
- No translation/adaptation for external audience (e.g., German → English happens in code, not as UI step)

---

## FILES & MODULES REVIEWED

### Pages & Dialogs
- `pages/TeamOrderDetail` — Main TeamOrder edit/view page (1,916 lines)
- `pages/WorkOrderDetail` — Contains TeamOrder inline display + Partner Brief PDF generation (1,695 lines)

### Components
- `components/teamorder/TeamOrderForm` — Form for budget, cost policies, partner info (357 lines)
- `components/teamorder/TeamOrderCard` — Card display on WorkOrderDetail (102 lines)

### Entities (JSON Schemas)
- `entities/TeamOrder.json` — Complete schema with all fields
- `entities/WorkOrder.json` (from context) — Parent entity with task list + description
- `entities/Task.json` (from context) — Individual task with title, description, estimated_minutes
- `entities/Job.json` — Project/job with description, customer, boat, location
- `entities/Customer.json` (from context) — Customer info
- `entities/Boat.json` (from context) — Vessel details
- `entities/Location.json` (from context) — Work location with access notes
- `entities/Offer.json` — Not directly used by TeamOrder, but carries scope/budget context from lead stage

### Key Functions (in TeamOrderDetail)
- `getPartnerBriefPDFDocument()` (line 140-197 in TeamOrderDetail) — Assembles data for PDF export
- `getPartnerBriefPDFLineItems()` (line 199-216) — Formats tasks as line items for PDF table
- `loadData()` (line 46-109) — Loads all related entities on page init

---

## CURRENT FUNCTIONAL FLOW

### Entry Point & Trigger
1. **Where Created:**
   - `pages/WorkOrderDetail`, line 979-986: "Create Team Order" button (admin-only)
   - Opens `pages/TeamOrderDetail?workOrderId={id}` in create mode
   - OR existing TeamOrder accessed via `pages/TeamOrderDetail?id={teamOrderId}`

2. **Data Load Sequence (lines 46-109 in TeamOrderDetail):**
   - Load Technician list (for dropdown)
   - If editing existing: Load TeamOrder → WorkOrder → Task list → Job/Customer/Boat/Location
   - If creating new from WorkOrder: Load WorkOrder → Task list
   - Optional: Translate Job description to English via LLM (line 86-89)

3. **Form Fields (TeamOrderForm.jsx):**
   - **Partner Assignment:** external_partner_id (from Technician list), partner_name, partner_contact, status
   - **Budget Framework:** approved_budget_total, labor_budget, travel_budget, accommodation_budget, per_diem_budget
   - **Cost Policies:** 5 toggles (accommodation_paid, meals_per_diem_paid, mileage_paid, travel_time_paid, other_reimbursables_allowed) + rate fields
   - **Approval Rules:** requires_preapproval_over (threshold), budget_exceed_requires_approval (boolean)
   - **Notes:** internal_notes (admin-only), partner_notes (visible to external worker)

4. **Save & PDF Export:**
   - `handleSave()` (line 111-138) → Updates TeamOrder + timestamps
   - `PDFExportButton` (line 250-257) → Triggers "Partner Brief" PDF generation
   - Partner Brief includes structured data from `getPartnerBriefPDFDocument()` + task list as line items

---

## CURRENT DATA AVAILABILITY MATRIX

| Data Source | Available to TeamOrder? | Where Loaded | Evidence | Notes |
|---|---|---|---|---|
| **Task title** | ✅ YES | loadData() → Task.filter() | TeamOrderDetail:99, LineItems:202-206 | Used in PDF line items |
| **Task description** | ✅ YES | loadData() → Task.filter() | TeamOrderDetail:99, LineItems:203-206 | Used in PDF line items |
| **Task status** | ✅ YES (partial) | loadData() → Task.filter() | LineItems:202, but status NOT mapped to PDF | Status loaded but NOT exported to briefing |
| **Task estimated_minutes** | ✅ YES | loadData() → Task.filter() | LineItems:205-208, displayed as "6h" format | Only duration shown, not sequence/dependency |
| **WorkOrder title** | ✅ YES | loadData() → WorkOrder.filter() | TeamOrderDetail:63, PDF:422 | Appears as "work_order_title" in brief |
| **WorkOrder description** | ✅ YES | loadData() → WorkOrder.filter() | TeamOrderDetail:63, PDF:439 | Key context for external worker |
| **WorkOrder status** | ✅ YES | loadData() → WorkOrder.filter() | TeamOrderDetail:63, PDF:423 | Exposure limited to PDF |
| **Job/Project title** | ✅ YES (implicit) | loadData() → Job.filter() | TeamOrderDetail:78 stored but not used in Team Order display | **NOT exposed to external worker** |
| **Job/Project description** | ❌ NO | Not loaded in TeamOrderDetail flow | Job loaded (line 78) but description field NOT accessed | **GAP: Missing project context** |
| **Customer name** | ✅ YES | loadData() → Customer.filter() | TeamOrderDetail:80, PDF:410-413 | Mapped to "customer_name" |
| **Customer email/contact** | ❌ NO | Not loaded | No email fields read from Customer entity | **GAP: No direct customer communication link** |
| **Boat/Asset name** | ✅ YES | loadData() → Boat.filter() | TeamOrderDetail:81, PDF:428 | vessel_name mapped to "boat_name" |
| **Boat/Asset details** | ✅ YES (partial) | loadData() → Boat.filter() | vessel_type, length_m, berth_number in PDF (430-431, 429) | Limited to type/length/berth |
| **Due date/schedule** | ✅ YES | loadData() → WorkOrder.filter() | scheduled_date field, PDF:424 | From WorkOrder, not calculated |
| **Priority** | ❌ NO | Not loaded | Job.priority exists but not accessed | **GAP: No priority signal to worker** |
| **Internal notes** | ✅ YES (form field) | Partner Notes field in TeamOrderForm | Line 346-351 | Stored in TeamOrder.partner_notes |
| **Customer-facing email text** | ❌ NO | No email entity accessed | Not in data load sequence | **GAP: No communication history access** |
| **Offer/scope text** | ❌ NO | Offer entity not accessed | Not loaded in TeamOrderDetail | **GAP: Proposal context missing** |
| **Attachments/documents** | ❌ NO | Not loaded | WorkOrderPhoto, Documents not accessed | **GAP: No supporting file context** |
| **Location access notes** | ✅ YES (partial) | loadData() → Location.filter() | location_access_notes in PDF:436 | Critical for field worker |
| **Safety notes** | ✅ YES | loadData() → WorkOrder.filter() | safety_notes field, PDF:484 | From WorkOrder, critical for briefing |
| **Change log** | ⚠️ PARTIAL | TeamOrder.change_log array | TeamOrderDetail sidebar (line 338-355) | Internal tracking, not external-facing |

---

## EXTERNAL WORKER REALITY CHECK

### What an External Worker Currently Receives (Actual Behavior)

**Method 1: Via Partner Brief PDF (only output path for external worker)**
1. Work order number, title, scheduled date, status
2. Customer name, boat name (type, length, berth), location name + access notes
3. Task checklist: 
   - Title
   - Description (if provided)
   - Estimated time in hours format
   - **Missing:** why this task matters, sequence/dependencies, customer expectations, prerequisite conditions
4. Location address (if provided)
5. Budget summary:
   - Total approved budget (€)
   - Budget breakdown by category
   - Cost coverage policies (what's paid back, at what rates)
   - Pre-approval thresholds
6. Assigned team list (name, role, phone)
7. Partner-specific notes (free text from admin)
8. Safety notes from work order
9. **No context on:**
   - Why the customer requested this work
   - What problem is being solved
   - Email communication history with customer
   - Offer/proposal that was approved
   - Internal notes about challenges, special conditions
   - Project-level description or scope

**Method 2: Via TeamOrder Form (admin view only)**
- Form is **not shared with external worker** — it's an internal management tool
- No external-facing UI exists for partner to view/accept terms before work

**Current External Worker Experience:**
- Receives PDF file (Partner Brief) via email or download link
- PDF is **read-only, one-direction communication**
- No acknowledgment/signature mechanism
- No way to ask clarifying questions
- No way to report blockers before arriving on-site
- Budget rules are clear, but work scope context is incomplete

---

## EXISTING REUSABLE LOGIC

### Already Implemented Transformation/Formatting Logic

1. **Budget Aggregation** (TeamOrderForm.jsx, getPartnerBriefPDFDocument line 140-197)
   - Summaries approved_budget_total into structured cost breakdown
   - Calculates covered costs object with conditional policies
   - Maps cost policy toggles → readable policy summaries
   - **Reusable for:** Future briefing can expand this structured budget summary

2. **Task Formatting to Briefing Format** (getPartnerBriefPDFLineItems line 199-216)
   - Converts Task array → line item objects for PDF table
   - Transforms estimated_minutes → "6h" readable format
   - Adds sort_order + unit + pricing fields (zeroed for tasks)
   - **Reusable for:** Framework for task presentation in briefing

3. **Data Consolidation into Document Object** (getPartnerBriefPDFDocument line 140-197)
   - Creates single document object from multiple entities
   - Maps field names to external-friendly labels
   - Handles missing data gracefully (defaults to 'Unknown')
   - **Reusable for:** Context aggregation pattern for AI briefing input

4. **Job Description Translation** (loadData line 86-89)
   - LLM-based German → English translation
   - Silent fallback to original if translation fails
   - **Reusable for:** Language adaptation for external worker (e.g., translate safety notes, customer context)

5. **Partner Notes Management**
   - Separate "partner_notes" field from "internal_notes"
   - **Reusable for:** Pattern for splitting internal vs. external content

---

## GAPS BLOCKING THE NEXT STEP

### Architectural Gaps

1. **Missing Job Description Access**
   - Job entity is loaded in TeamOrderDetail (line 78)
   - **Job.description field exists but is NEVER read**
   - Impact: External worker has no project-level context ("Why is this work happening?")
   - Required for: AI to understand operational intent

2. **No Access to Customer Communication History**
   - No email entity linked to TeamOrder flow
   - No message/note history from lead stage
   - Impact: External worker doesn't know customer expectations from prior communication
   - Required for: AI to surface recent customer concerns, expectations

3. **No Offer/Proposal Context**
   - Offer entity (which carries scope + budget + customer_notes) is not accessed
   - OfferTask details not available
   - Impact: External worker doesn't see approved scope that was billed
   - Required for: AI to explain deliverables in customer terms

4. **No Structured "Briefing Context Object"**
   - Data is scattered: Team Order fields + WorkOrder fields + Task array + Job fields
   - **No unified data structure** prepared for AI ingestion
   - `getPartnerBriefPDFDocument()` partially does this (for PDF only)
   - Impact: Future AI function must re-implement data consolidation
   - Required for: Clean data hand-off to AI instruction generator

5. **No Pre-Briefing Review/Approval Layer**
   - Partner Brief PDF is generated directly from form data
   - No "review this before sharing with partner" step
   - No flag system for red-flag conditions (e.g., "customer is difficult", "incomplete scope")
   - Impact: Risk of sending incomplete/inaccurate briefing externally
   - Required for: Safe external content generation

6. **Task Sequence/Dependencies Not Modeled**
   - Task.sequence_order exists (sorting index)
   - **No task_stream awareness in Partner Brief** (ORGANIZATION vs EXECUTION split exists in WorkOrder but not exposed)
   - No prerequisite/blocking task links
   - Impact: External worker doesn't know task sequence or when each task becomes "ready"
   - Required for: AI to explain "do this first, then..." flow

7. **No Structured "What's Changed" Tracking**
   - TeamOrder.change_log exists (internal tracking)
   - **Not surfaced to external worker**
   - If WorkOrder is modified after brief created, external worker doesn't know
   - Impact: Briefing becomes outdated without notification
   - Required for: Versioning strategy for AI-generated briefings

8. **Language Adaptation Only Happens Server-Side**
   - Job description translation happens in loadData (automatic LLM call)
   - No UI step to confirm translation quality
   - No multi-language template for briefing sections
   - Impact: External briefing language quality not validated
   - Required for: Controlled external communication tone

9. **No Customer Notes → Partner Mapping**
   - Customer-visible notes exist (Offer.customer_notes, Job.customer_notes)
   - **These are not read or exposed to Partner Brief**
   - Internal notes exist but are marked "admin only"
   - Impact: External worker doesn't know what customer expects to see in final result
   - Required for: AI to include customer expectations in briefing

---

## SAFE EXTENSION PATH (Architecture Level Only)

### Minimum Context Object for AI Briefing Generator

**Proposed structure (NOT implementation code):**

```
BriefingContext = {
  // Execution anchor (required)
  work_order: { 
    id, number, title, description, status, scheduled_date, 
    safety_notes, internal_notes (NOT for external)
  },
  
  // Project anchor (NEW)
  job: {
    id, title, description, priority, job_type, service_category, 
    status, customer_po_number
  },
  
  // Customer context (NEW)
  customer: {
    name, contact_email, customer_type, preferred_language,
    billing_address (IF relevant), notes (customer-visible only)
  },
  
  // Asset context (partial)
  boat: { vessel_name, vessel_type, length_m, known_issues },
  location: { name, address, access_notes },
  
  // Task list (existing, with enhancement)
  tasks: [
    { title, description, estimated_minutes, sequence_order, 
      task_stream (ORGANIZATION vs EXECUTION), status }
  ],
  
  // Budget & Policy (existing)
  team_order: {
    approved_budget_total, labor_budget, travel_budget, 
    accommodation_paid (boolean), accommodation_max_per_night,
    mileage_paid, mileage_rate_per_km, per_diem_paid,
    per_diem_rate_per_day, requires_preapproval_over,
    partner_notes (instructions visible to partner)
  },
  
  // Scope context (NEW)
  offer: {  // OPTIONAL: only if offer exists
    title, description, scope, customer_notes (what customer expects),
    vat_rate, total_amount (approved budget reference)
  },
  
  // Communication history (NEW)
  recent_communication: [  // OPTIONAL: structured excerpts
    { type: 'email', subject, sender_role, key_points }
  ],
  
  // Metadata
  language_preference: 'German' | 'English' | ...,
  external_worker: { name, role, contact },
  generated_at: timestamp
}
```

### Assembly Location
- **Create a new backend function:** `generateWorkerBriefingContext(teamOrderId)`
- **Input:** TeamOrder ID
- **Output:** BriefingContext object (JSON)
- **Executed by:** New "Generate Worker Briefing" workflow (step after TeamOrder save)

### Review/Approval Workflow (UI Layer)
1. Admin clicks "Generate Briefing" button in TeamOrderDetail
2. System shows **preview of generated briefing** (HTML or PDF)
3. Admin can:
   - ✅ Accept & send (triggers PDF export or share link)
   - 🔄 Edit before sending (tweaks to partner_notes, flags)
   - ❌ Reject & revise (back to TeamOrder form)
4. On accept: Store briefing version + timestamp + approval user

### Data Freshness Strategy
- Link briefing to "last synced WorkOrder version"
- If WorkOrder description changes → flag briefing as "stale"
- Display warning to admin: "Work order was updated — re-generate briefing?"

### External Document Strategy
- **Option A (Recommended):** Briefing remains **standalone PDF/web view**, not directly editable by external worker
- **Option B (Future):** Add read-only web UI for partner (with signature confirmation)
- Do **NOT** create bi-directional communication channel (job done elsewhere)

---

## RISK NOTES (If Feature Added Carelessly)

### High-Risk Scenarios

1. **Wrong Instructions from Incomplete Data**
   - If Job description is stale, external worker gets outdated context
   - If offer scope changed but briefing not regenerated, worker may do extra/wrong work
   - **Mitigation:** Version tracking + "generated at X, based on WorkOrder version Y" stamp

2. **Exposing Internal-Only Notes Externally**
   - Internal notes field exists separately, but future AI must carefully distinguish
   - Risk: "Customer is difficult, requires patience" accidentally sent to customer
   - **Mitigation:** Explicit filtering rules in context generator (mark fields as internal_only)

3. **Mixing Customer Language with Internal Language**
   - "Customer-facing email" vs "internal comment" context may get blended
   - Risk: Tone mismatch ("we're struggling to find the part" sounds unprofessional when sent to customer)
   - **Mitigation:** Separate source lanes for customer vs internal content in briefing template

4. **Conflicting Task vs Email Context**
   - Task list may say "Paint the hull"
   - Email history may say "Actually customer wants bare fiberglass, no paint"
   - Risk: External worker follows task list, not email
   - **Mitigation:** Surface latest customer communication changes in briefing with timestamp

5. **No Human Approval Before Sharing**
   - If briefing is auto-generated and auto-sent, errors become customer-visible
   - Risk: AI-generated wording has grammatical errors or misses key details
   - **Mitigation:** Mandatory preview + admin approval step before any external sharing

6. **False Confidence from AI Wording**
   - AI-generated briefing may sound authoritative even if source data is incomplete
   - External worker trusts briefing more than WorkOrder task list
   - Risk: Worker doesn't double-check edge cases, gets surprised on-site
   - **Mitigation:** Briefing includes "based on data as of [date]" + flags for unconfirmed info

7. **Language Translation Quality**
   - Auto-translated Job descriptions may lose technical nuance
   - Risk: External worker misunderstands German technical terms translated to English
   - **Mitigation:** Human review of critical translations, or fallback to original language

8. **Scope Creep in Briefing Generation**
   - Temptation to auto-generate customer communication, pricing, terms
   - Risk: Legal/compliance issues if AI writes binding terms or customer-facing pricing
   - **Mitigation:** Scope = briefing only, never contract terms or external pricing

---

## CONCLUSION

**Current State is Fit For:**
- Budget authorization & cost policy management ✅
- Technician/partner assignment tracking ✅
- Basic work order context (tasks, location, customer) ✅

**Current State is NOT Fit For:**
- Comprehensive worker instruction generation ❌
- Customer expectation communication ❌
- Project-level scope awareness ❌
- Versioning & change tracking for external content ❌
- Structured AI input (scattered data, no unified context object) ❌

**Next Safe Step:**
1. **Design** a `BriefingContext` data object that consolidates Job + WorkOrder + Task + TeamOrder + (optional) Offer
2. **Build** a backend function `generateWorkerBriefingContext()` that safely assembles this object
3. **Add** a UI workflow in TeamOrderDetail: "Generate & Review Briefing" button
4. **Implement** a preview + approval step before any briefing is shared
5. **Only after** this foundation is in place: Design AI instruction generator that takes BriefingContext as input

This keeps the future feature isolated, reviewable, and side-effect-free.

---

**Audit Status:** ✅ COMPLETE (Read-Only, No Code Changes Made)