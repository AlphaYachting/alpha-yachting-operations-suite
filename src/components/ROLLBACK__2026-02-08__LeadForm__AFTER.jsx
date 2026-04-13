# LeadForm.jsx - AFTER Changes (2026-02-08)

## Changes Made

### 1. Split Name Fields for New Prospects
- Added `firstName` and `lastName` to formData state
- New prospects now see "First Name" and "Last Name" fields instead of single "Name"
- On submit, firstName + lastName are combined into `name` for backward compatibility
- Existing customer path keeps single "Name" field (disabled when customer selected)

### 2. Customer Dropdown Search
- Added `customerSearchTerm` state for search input
- Added search input inside SelectContent (sticky at top)
- Search filters by: customer name, email, phone (substring match)
- Shows all customers by default
- Applies filter when search term length >= 3
- Search input has stopPropagation to prevent dropdown close
- Search term resets when dropdown closes

### 3. Fixed Customer List Loading
- Parent (Leads.js) now loads customers and boats
- Props correctly passed to LeadForm component
- Dropdown now displays actual customer list

## Key Code Changes

```jsx
// formData now includes firstName/lastName
const [formData, setFormData] = useState({
  customer_id: lead?.customer_id || '',
  name: lead?.name || '',
  firstName: lead?.firstName || '',  // NEW
  lastName: lead?.lastName || '',    // NEW
  // ...
});

// New search state
const [customerSearchTerm, setCustomerSearchTerm] = useState('');

// Enhanced validation in handleSubmit
if (!isExistingCustomer) {
  if (!formData.firstName?.trim()) {
    setError('First name is required');
    return;
  }
  if (!formData.lastName?.trim()) {
    setError('Last name is required');
    return;
  }
  formData.name = `${formData.firstName.trim()} ${formData.lastName.trim()}`;
}

// Customer dropdown with search
<SelectContent>
  <div className="px-2 py-2 border-b sticky top-0 bg-white z-10">
    <Input
      placeholder="Search customers..."
      value={customerSearchTerm}
      onChange={(e) => setCustomerSearchTerm(e.target.value)}
      className="h-8"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    />
  </div>
  {/* Filtered customer list */}
</SelectContent>

// Conditional name fields
{!isExistingCustomer ? (
  <>
    <div className="space-y-2">
      <Label>First Name *</Label>
      <Input value={formData.firstName || ''} ... />
    </div>
    <div className="space-y-2">
      <Label>Last Name *</Label>
      <Input value={formData.lastName || ''} ... />
    </div>
  </>
) : (
  <div className="space-y-2">
    <Label>Name *</Label>
    <Input value={formData.name || ''} ... disabled={...} />
  </div>
)}
``