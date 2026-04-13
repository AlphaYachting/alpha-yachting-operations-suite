# DIFF NOTES - Lead Edit Prefill Name via Quick Menu
Date: 2026-02-08

## WHAT CHANGED

### LeadForm Component (components/leads/LeadForm)
- **Added:** New useEffect hook (lines 64-85) that watches lead.id
- **Effect behavior:**
  - When lead object is passed to form (edit mode), immediately updates all formData fields
  - Splits full `lead.name` into firstName/lastName if those fields are empty
  - Uses explicit firstName/lastName from lead if available
  - Keeps all 16 form fields in sync with lead data

**Code change:**
```jsx
React.useEffect(() => {
  if (lead) {
    const [firstName, lastName] = (lead.name || '').split(' ').length > 1 
      ? (lead.name || '').split(' ', 2)
      : [lead.firstName || '', lead.lastName || ''];
    
    setFormData({
      customer_id: lead.customer_id || '',
      name: lead.name || '',
      firstName: lead.firstName || firstName || '',
      lastName: lead.lastName || lastName || '',
      // ... rest of fields
    });
  }
}, [lead?.id]);
```

## WHY IT CHANGED

**Root Cause:** Form state initialized only on component mount
- Old behavior: `formData` set once with lead values (if available)
- If lead prop arrives after mount (async dialog open), formData stays empty
- Result: User opens edit dialog → form appears blank → name not visible

**Fix Logic:** React effect watches for lead changes
- When edit dialog opens and lead prop is set → effect fires
- formData is updated with all lead fields
- Now the loaded lead name appears immediately in the form
- Works for both create (lead=null/undefined) and edit (lead=object)

## WHAT DID NOT CHANGE

### Unchanged Lead Features:
- ✅ Create new lead behavior (lead=null → empty form)
- ✅ Lead type toggle (New Prospect / Existing Customer)
- ✅ Customer selection dropdown and auto-fill
- ✅ Boat selection and auto-fill logic
- ✅ Form validation (firstName/lastName vs name)
- ✅ Submit handler and save logic
- ✅ Assignee selection
- ✅ All other form fields

### Unchanged UI:
- ✅ No styling changes
- ✅ No layout changes
- ✅ No form field modifications
- ✅ No label/placeholder changes

### Unchanged Data Flow:
- ✅ pages/Leads still passes lead object to LeadForm
- ✅ handleSaveLead still receives formData
- ✅ Lead.update() call unchanged
- ✅ Customer list and boats props still work

## MANUAL TEST CHECKLIST
- [ ] Open Lead list page
- [ ] Click Edit button on any existing lead
- [ ] Verify form opens with all fields populated
- [ ] Verify customer name appears in the Name field
- [ ] Edit the name and save → persists correctly
- [ ] Create new lead → form starts empty (unchanged)
- [ ] Toggle between "New Prospect" and "Existing Customer" → works
- [ ] Select from Existing Clients dropdown → auto-fills correctly
- [ ] No console errors
- [ ] No regression in other lead pages (LeadDetail, etc.)

## IMPACT SUMMARY
- **Scope:** 1 file modified (LeadForm component)
- **Lines changed:** +22 lines (new useEffect)
- **Breaking changes:** None
- **Performance impact:** Minimal (effect only runs when lead.id changes)
- **Backward compatibility:** Full (create/edit both work)