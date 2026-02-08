# Leads.js (page) - BEFORE Changes (2026-02-08)

## Current State
- `loadData()` only fetches leads and locations (line 71-84)
- Does NOT fetch customers or boats
- LeadForm component called without customers/boats props (line 305-312)

## Key Lines
```jsx
// Line 71-84: loadData - missing customers and boats
const loadData = async () => {
  try {
    const [allLeads, allLocations] = await Promise.all([
    base44.entities.Lead.list('-created_date'),
    base44.entities.Location.list()]
    );
    setLeads(allLeads);
    setLocations(allLocations);
    // ← Missing: customers and boats
  } catch (error) {
    console.error('Error loading data:', error);
  } finally {
    setLoading(false);
  }
};

// Line 305-312: LeadForm called without customers/boats
<LeadForm
  lead={editingLead}
  locations={locations}
  onSave={handleSaveLead}
  onCancel={() => {
    setShowForm(false);
    setEditingLead(null);
  }}
  // ← Missing: customers={customers} boats={boats}
/>
```

## Issue
LeadForm expects `customers` and `boats` props but they're never loaded or passed.