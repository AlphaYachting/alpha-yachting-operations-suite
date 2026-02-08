import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertCircle } from 'lucide-react';

export default function LeadForm({ lead, locations, customers, boats, onSave, onCancel }) {
  const [isExistingCustomer, setIsExistingCustomer] = useState(!!lead?.customer_id);
  const [formData, setFormData] = useState({
    customer_id: lead?.customer_id || '',
    name: lead?.name || '',
    firstName: lead?.firstName || '',
    lastName: lead?.lastName || '',
    phone: lead?.phone || '',
    email: lead?.email || '',
    boat_name: lead?.boat_name || '',
    boat_details: lead?.boat_details || '',
    location: lead?.location || '',
    location_id: lead?.location_id || '',
    contact_method: lead?.contact_method || 'Phone',
    inquiry_type: lead?.inquiry_type || 'Service Inquiry',
    notes: lead?.notes || '',
    description: lead?.description || '',
    priority: lead?.priority || 'Medium',
    status: lead?.status || 'Pending'
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [customerBoats, setCustomerBoats] = useState([]);
  const [useExistingBoat, setUseExistingBoat] = useState(false);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');

  // Load customer boats on initialization if editing a lead with customer_id
  React.useEffect(() => {
    if (lead?.customer_id && boats) {
      const custBoats = boats.filter(b => b.customer_id === lead.customer_id);
      setCustomerBoats(custBoats);
      if (custBoats.length > 0) {
        setUseExistingBoat(true);
      }
    }
  }, [lead?.customer_id, boats]);

  // Auto-fill contact details when existing customer is selected
  const handleCustomerSelect = (customerId) => {
    const customer = customers?.find(c => c.id === customerId);
    if (customer) {
      setFormData({
        ...formData,
        customer_id: customerId,
        name: customer.company_name || `${customer.first_name || ''} ${customer.last_name || ''}`.trim(),
        phone: customer.phone || '',
        email: customer.email || '',
        boat_name: '',
        boat_details: '',
        location: '',
        location_id: ''
      });
      
      // Load customer's boats
      const custBoats = boats?.filter(b => b.customer_id === customerId) || [];
      setCustomerBoats(custBoats);
      setUseExistingBoat(custBoats.length > 0);
    } else {
      setFormData({ ...formData, customer_id: '' });
      setCustomerBoats([]);
      setUseExistingBoat(false);
    }
  };

  // Auto-fill boat details when existing boat is selected
  const handleBoatSelect = (boatId) => {
    const boat = customerBoats.find(b => b.id === boatId);
    if (boat) {
      setFormData({
        ...formData,
        boat_name: boat.vessel_name || '',
        boat_details: [boat.manufacturer, boat.model, boat.year].filter(Boolean).join(' ') || '',
        location: boat.current_location_id ? locations?.find(l => l.id === boat.current_location_id)?.name || '' : '',
        location_id: boat.current_location_id || ''
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation for new prospects
    if (!isExistingCustomer) {
      if (!formData.firstName?.trim()) {
        setError('First name is required');
        return;
      }
      if (!formData.lastName?.trim()) {
        setError('Last name is required');
        return;
      }
      // Build full name from firstName + lastName for legacy compatibility
      formData.name = `${formData.firstName.trim()} ${formData.lastName.trim()}`;
    } else {
      // Existing customer validation
      if (!formData.name?.trim()) {
        setError('Name is required');
        return;
      }
    }

    if (!formData.phone?.trim()) {
      setError('Phone number is required');
      return;
    }

    try {
      setSaving(true);
      await onSave(formData);
    } catch (err) {
      console.error('Error saving lead:', err);
      setError(err?.message || 'Failed to save lead. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex gap-2">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Lead Type Toggle */}
      <div className="space-y-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
        <Label className="text-sm font-semibold">Lead Type</Label>
        <div className="flex gap-3">
          <Button
            type="button"
            variant={!isExistingCustomer ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setIsExistingCustomer(false);
              setFormData({ ...formData, customer_id: '' });
            }}
          >
            New Prospect
          </Button>
          <Button
            type="button"
            variant={isExistingCustomer ? 'default' : 'outline'}
            size="sm"
            onClick={() => setIsExistingCustomer(true)}
          >
            Existing Customer
          </Button>
        </div>
      </div>

      {/* Existing Customer Selection */}
      {isExistingCustomer && (
        <div className="space-y-2">
          <Label>Select Customer *</Label>
          <Select 
            value={formData.customer_id || ''} 
            onValueChange={handleCustomerSelect}
            onOpenChange={(open) => { if (!open) setCustomerSearchTerm(''); }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choose existing customer..." />
            </SelectTrigger>
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
              {(() => {
                const filtered = customers?.filter(c => {
                  if (!customerSearchTerm || customerSearchTerm.length < 3) return true;
                  const search = customerSearchTerm.toLowerCase();
                  const name = (c.company_name || `${c.first_name || ''} ${c.last_name || ''}`.trim()).toLowerCase();
                  const email = (c.email || '').toLowerCase();
                  const phone = (c.phone || '').toLowerCase();
                  return name.includes(search) || email.includes(search) || phone.includes(search);
                }) || [];
                
                return filtered.length > 0 ? (
                  filtered.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.company_name || `${c.first_name || ''} ${c.last_name || ''}`.trim()} - {c.email}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="no-match" disabled>
                    {customerSearchTerm.length >= 3 ? 'No customers match search' : 'No customers available'}
                  </SelectItem>
                );
              })()}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {!isExistingCustomer ? (
          <>
            <div className="space-y-2">
              <Label>First Name *</Label>
              <Input
                value={formData.firstName || ''}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                placeholder="First name"
              />
            </div>
            <div className="space-y-2">
              <Label>Last Name *</Label>
              <Input
                value={formData.lastName || ''}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                placeholder="Last name"
              />
            </div>
          </>
        ) : (
          <div className="space-y-2">
            <Label>Name *</Label>
            <Input
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Contact person name"
              disabled={isExistingCustomer && formData.customer_id}
            />
          </div>
        )}

        <div className="space-y-2">
          <Label>Phone *</Label>
          <Input
            value={formData.phone || ''}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="+43 123 456"
            disabled={isExistingCustomer && formData.customer_id}
          />
        </div>

        <div className="space-y-2">
          <Label>Email</Label>
          <Input
            type="email"
            value={formData.email || ''}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="name@example.com"
            disabled={isExistingCustomer && formData.customer_id}
          />
        </div>

        <div className="space-y-2">
          <Label>Contact Method</Label>
          <Select value={formData.contact_method} onValueChange={(v) => setFormData({ ...formData, contact_method: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Phone">Phone</SelectItem>
              <SelectItem value="Email">Email</SelectItem>
              <SelectItem value="Website">Website</SelectItem>
              <SelectItem value="Referral">Referral</SelectItem>
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isExistingCustomer && formData.customer_id && (
          <div className="space-y-2 md:col-span-2">
            <Label>Boat Selection</Label>
            <div className="flex gap-3 mb-2">
              {customerBoats.length > 0 && (
                <Button
                  type="button"
                  variant={useExistingBoat ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setUseExistingBoat(true)}
                >
                  Select Existing Boat
                </Button>
              )}
              <Button
                type="button"
                variant={!useExistingBoat ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setUseExistingBoat(false);
                  setFormData({
                    ...formData,
                    boat_name: '',
                    boat_details: '',
                    location: '',
                    location_id: ''
                  });
                }}
              >
                Enter New Boat
              </Button>
            </div>
            {useExistingBoat && customerBoats.length > 0 && (
              <Select onValueChange={handleBoatSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose boat..." />
                </SelectTrigger>
                <SelectContent>
                  {customerBoats.map(boat => (
                    <SelectItem key={boat.id} value={boat.id}>
                      {boat.vessel_name} {boat.model ? `- ${boat.model}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        <div className="space-y-2">
          <Label>Boat Name</Label>
          <Input
            value={formData.boat_name || ''}
            onChange={(e) => setFormData({ ...formData, boat_name: e.target.value })}
            placeholder="e.g., Blue Horizon"
            disabled={isExistingCustomer && formData.customer_id && useExistingBoat}
          />
        </div>

        <div className="space-y-2">
          <Label>Boat Details</Label>
          <Input
            value={formData.boat_details || ''}
            onChange={(e) => setFormData({ ...formData, boat_details: e.target.value })}
            placeholder="Type, length, engine..."
            disabled={isExistingCustomer && formData.customer_id && useExistingBoat}
          />
        </div>

        <div className="space-y-2">
          <Label>Location</Label>
          {locations?.length > 0 ? (
            <Select value={formData.location_id || ''} onValueChange={(v) => {
              const loc = locations.find(l => l.id === v);
              setFormData({ ...formData, location_id: v, location: loc?.name || '' });
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Select marina" />
              </SelectTrigger>
              <SelectContent>
                {locations.map(loc => (
                  <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              value={formData.location || ''}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="Marina or anchorage"
            />
          )}
        </div>

        <div className="space-y-2">
          <Label>Inquiry Type</Label>
          <Select value={formData.inquiry_type} onValueChange={(v) => setFormData({ ...formData, inquiry_type: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Service Inquiry">Service Inquiry</SelectItem>
              <SelectItem value="Parts Request">Parts Request</SelectItem>
              <SelectItem value="Maintenance">Maintenance</SelectItem>
              <SelectItem value="Emergency">Emergency</SelectItem>
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Priority</Label>
          <Select value={formData.priority} onValueChange={(v) => setFormData({ ...formData, priority: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Low">Low</SelectItem>
              <SelectItem value="Medium">Medium</SelectItem>
              <SelectItem value="High">High</SelectItem>
              <SelectItem value="Urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Pending">Pending</SelectItem>
              <SelectItem value="Contacted">Contacted</SelectItem>
              <SelectItem value="Converted">Converted</SelectItem>
              <SelectItem value="Rejected">Rejected</SelectItem>
              <SelectItem value="Lost">Lost</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Email / Transcript / Description</Label>
        <Textarea
          value={formData.description || ''}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Paste the customer email, phone transcript, or detailed inquiry here. This will be used to generate task checklist."
          rows={4}
        />
      </div>

      <div className="space-y-2">
        <Label>Additional Notes</Label>
        <Textarea
          value={formData.notes || ''}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Any other information..."
          rows={2}
        />
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={saving}>
          {saving ? 'Saving...' : lead ? 'Update Lead' : 'Create Lead'}
        </Button>
      </div>
    </form>
  );
}