# LeadForm.jsx - BEFORE Changes (2026-02-08)

## Current State
- Single "Name" field for new customers (line 19, 174-181)
- Customer dropdown does receive `customers` prop but parent doesn't pass it (line 15)
- No search functionality in customer dropdown
- Customer dropdown shows "No customers available" because prop is missing

## Key Lines
```jsx
// Line 15: expects customers prop
export default function LeadForm({ lead, locations, customers, boats, onSave, onCancel }) {

// Line 17-32: formData state - single "name" field
const [formData, setFormData] = useState({
  customer_id: lead?.customer_id || '',
  name: lead?.name || '',  // ← Single name field
  phone: lead?.phone || '',
  // ...
});

// Line 149-170: Existing customer select (no search)
{isExistingCustomer && (
  <div className="space-y-2">
    <Label>Select Customer *</Label>
    <Select value={formData.customer_id || ''} onValueChange={handleCustomerSelect}>
      <SelectTrigger>
        <SelectValue placeholder="Choose existing customer..." />
      </SelectTrigger>
      <SelectContent>
        {customers && customers.length > 0 ? (
          customers.map(c => (
            <SelectItem key={c.id} value={c.id}>
              {c.company_name || `${c.first_name || ''} ${c.last_name || ''}`.trim()} - {c.email}
            </SelectItem>
          ))
        ) : (
          <SelectItem value="no-customers" disabled>No customers available</SelectItem>
        )}
      </SelectContent>
    </Select>
  </div>
)}

// Line 172-181: Single Name field for new prospects
<div className="space-y-2">
  <Label>Name *</Label>
  <Input
    value={formData.name || ''}
    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
    placeholder="Contact person name"
    disabled={isExistingCustomer && formData.customer_id}
  />
</div>
```

## Issues to Fix
1. Parent (pages/Leads.js) doesn't load or pass customers/boats props
2. Single "name" field instead of firstName/lastName for new customers
3. No search in customer dropdown