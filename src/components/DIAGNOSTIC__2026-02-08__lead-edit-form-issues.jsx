# DIAGNOSTIC REPORT: Lead Edit Form Issues
**Date:** 2026-02-08  
**Issues:** 
1. Customer name not showing when opening existing lead for edit
2. Existing Clients dropdown is empty (no customers displayed)

---

## ISSUE 1: CUSTOMER NAME NOT SHOWING IN EDIT MODE

### Symptom
- User clicks Edit on existing lead → form opens
- "Name" field is blank (disabled) even though lead has a name

### Root Cause Chain

**A) Data Fetch (Leads page)**
- `pages/Leads` line 73-75: Fetches leads via `base44.entities.Lead.list('-created_date')`
- Returns lead objects with fields: `id`, `name`, `phone`, `email`, `boat_name`, etc.
- ✅ Name IS present in fetched lead data

**B) Form State Initialization (LeadForm)**
- Line 17: `const [isExistingCustomer, setIsExistingCustomer] = useState(!!lead?.customer_id);`
  - Sets isExistingCustomer = true if lead has customer_id
- Line 19-37: formData state initialized with:
  - `name: lead?.name || ''` (line 21) ✅ Should populate from lead
  - BUT: This is **synchronous initialization only** — happens once on mount
- Lines 19-37: formData initializer reads `lead?.name` from props
  - ✅ Correct field name
  - ✅ Should populate if lead.name exists

**C) Form Binding (UI)**
- Lines 273-281: Name input field (only shows if isExistingCustomer = true):
  ```jsx
  <Input
    value={formData.name || ''}
    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
    placeholder="Contact person name"
    disabled={isExistingCustomer && formData.customer_id}  // LINE 279
  />
  ```

### **FAILURE POINT IDENTIFIED:**
**Line 279: `disabled={isExistingCustomer && formData.customer_id}`**

When editing an **existing lead WITH a customer_id**:
- `isExistingCustomer = true` (line 17)
- `formData.customer_id` = non-empty (line 20)
- **Result:** Input becomes DISABLED
- Disabled input appears blank/grayed out visually, even though value is set
- **BUT:** The value IS in formData (line 21: `name: lead?.name || ''`)
- **Problem:** User sees blank/disabled field and assumes name wasn't loaded

### **Additional Issue:**
When editing, if lead was created as "New Prospect" (no customer_id):
- `isExistingCustomer = false` (line 17)
- Shows firstName/lastName inputs instead (lines 253-270)
- But lead.name exists (not split into firstName/lastName)
- **Name gets lost** if lead was created as prospect but edited after customer was selected

---

## ISSUE 2: EXISTING CLIENTS DROPDOWN EMPTY

### Symptom
- Toggle "Existing Customer" in Lead Type section
- Customer dropdown appears but shows "No customers available"
- Even though customers exist in system

### Root Cause Chain

**A) Customer Data Fetch (Leads page)**
- Line 73-75: `loadData()` fetches leads and locations:
  ```js
  const [allLeads, allLocations] = await Promise.all([
    base44.entities.Lead.list('-created_date'),
    base44.entities.Location.list()
  ]);
  ```
- ❌ **NO CUSTOMER QUERY** — customers are NOT fetched

**B) Customer Data Pass to Form (Leads page)**
- Line 305-312: LeadForm component called:
  ```jsx
  <LeadForm
    lead={editingLead}
    locations={locations}
    onSave={handleSaveLead}
    onCancel={() => {...}}
  />
  ```
- ❌ **NO customers prop passed** — should be `customers={customers}`

**C) Customer Data in LeadForm**
- Line 16: LeadForm receives prop: `{ lead, locations, customers, boats, onSave, onCancel }`
  - `customers` prop is expected
  - ❌ **customers prop is undefined** (not passed from Leads page)
  
**D) Customer Selection UI (LeadForm)**
- Lines 203-250: Existing Customer select:
  ```jsx
  {isExistingCustomer && (
    <Select ...>
      <SelectContent>
        {(() => {
          const filtered = customers?.filter(c => {...}) || [];
          return filtered.length > 0 ? (
            filtered.map(c => ...)
          ) : (
            <SelectItem>No customers available</SelectItem>  // SHOWS THIS
          );
        })()}
      </SelectContent>
    </Select>
  )}
  ```
- Line 226: `customers?.filter(...)` — **customers is undefined**
- Defaults to empty array (`|| []`)
- Result: "No customers available" message shows

### **FAILURE POINT IDENTIFIED:**
**Two-part failure:**
1. **Leads page (lines 73-75, 305-312):** Does NOT fetch customers; does NOT pass customers to LeadForm
2. **LeadForm (line 226):** Expects customers prop but receives undefined, falls back to empty array

### **Root Cause:**
- Missing customer data fetch in Leads page (`base44.entities.Customer.list()`)
- Missing customers prop passage to LeadForm component

---

## CROSS-CHECK: SHARED ROOT CAUSE?

**Issue 1 (name blank)** + **Issue 2 (customers empty)** = **Different causes**
- ❌ NOT the same root cause
- Issue 1: UI disability masking loaded data (styling/UX issue)
- Issue 2: Missing data fetch + prop passing (data flow issue)

---

## MINIMAL FIX PLAN (NO IMPLEMENTATION YET)

### **File 1: pages/Leads**
**Lines to change:** 71-84 (loadData function) + 305-312 (LeadForm rendering)

**Change 1A (line 73-75):**
```js
// BEFORE:
const [allLeads, allLocations] = await Promise.all([
  base44.entities.Lead.list('-created_date'),
  base44.entities.Location.list()
]);

// AFTER:
const [allLeads, allLocations, allCustomers, allBoats] = await Promise.all([
  base44.entities.Lead.list('-created_date'),
  base44.entities.Location.list(),
  base44.entities.Customer.list(),
  base44.entities.Boat.list()
]);
```

**Change 1B (line 77-78):**
```js
// BEFORE:
setLeads(allLeads);
setLocations(allLocations);

// AFTER:
setLeads(allLeads);
setLocations(allLocations);
setCustomers(allCustomers);
setBoats(allBoats);
```

**Change 1C (add state, line 47-52):**
```js
// ADD after existing state declarations:
const [customers, setCustomers] = useState([]);
const [boats, setBoats] = useState([]);
```

**Change 1D (line 305-312):**
```js
// BEFORE:
<LeadForm
  lead={editingLead}
  locations={locations}
  onSave={handleSaveLead}
  onCancel={() => {...}}
/>

// AFTER:
<LeadForm
  lead={editingLead}
  locations={locations}
  customers={customers}
  boats={boats}
  onSave={handleSaveLead}
  onCancel={() => {...}}
/>
```

---

### **File 2: components/leads/LeadForm**
**Lines to change:** 279 (disable condition)

**Change 2A (line 279):**
```jsx
// BEFORE:
disabled={isExistingCustomer && formData.customer_id}

// AFTER:
disabled={false}
```

**Rationale:** 
- Remove the disable logic that hides loaded customer name
- User should be able to edit contact name even when customer is selected
- OR: Conditionally disable only when name was auto-filled from customer (requires more logic)
- **Minimal approach:** Just remove disable, allow editing

---

## SUMMARY TABLE

| Issue | File | Lines | Fix | Why |
|-------|------|-------|-----|-----|
| **1: Name blank** | LeadForm | 279 | Remove `disabled={isExistingCustomer && formData.customer_id}` | Field is loaded but disabled visually |
| **2A: No customers** | Leads | 71-84 | Add Customer.list() + Boat.list() to loadData Promise.all | Customers not fetched |
| **2B: No customers** | Leads | 47-52 | Add useState for customers, boats | No state to store fetched data |
| **2C: No customers** | Leads | 77-78 | Add setCustomers, setBoats calls | No state update |
| **2D: No customers** | Leads | 305-312 | Pass customers, boats props to LeadForm | Component needs data |

---

## NO SCHEMA CHANGES REQUIRED ✅
- Lead entity already has `name` field
- Customer entity already exists
- Boat entity already exists
- No backend changes needed

---

## NO STYLING CHANGES REQUIRED ✅
- Only removing disabled attribute
- No CSS changes
- No visual redesign