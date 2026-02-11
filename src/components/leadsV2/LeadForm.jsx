import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function LeadForm({
  lead,
  customers,
  locations,
  users,
  boats,
  onSave,
  onCancel,
}) {
  const [formData, setFormData] = useState({
    name: '',
    first_name: '',
    last_name: '',
    phone: '',
    email: '',
    boat_name: '',
    boat_details: '',
    location: '',
    location_id: '',
    contact_method: 'Phone',
    inquiry_type: 'Service Inquiry',
    priority: 'Medium',
    notes: '',
    description: '',
    customer_id: '',
    assigned_to_user_id: '',
    boat_id: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [customerBoats, setCustomerBoats] = useState([]);
  const [customerSearch, setCustomerSearch] = useState('');

  useEffect(() => {
    if (lead) {
      setFormData({
        id: lead.id,
        name: lead.name || '',
        first_name: '',
        last_name: '',
        phone: lead.phone || '',
        email: lead.email || '',
        boat_name: lead.boat_name || '',
        boat_details: lead.boat_details || '',
        location: lead.location || '',
        location_id: lead.location_id || '',
        contact_method: lead.contact_method || 'Phone',
        inquiry_type: lead.inquiry_type || 'Service Inquiry',
        priority: lead.priority || 'Medium',
        notes: lead.notes || '',
        description: lead.description || '',
        customer_id: lead.customer_id || '',
        assigned_to_user_id: lead.assigned_to_user_id || '',
        boat_id: '',
      });
    }
  }, [lead]);

  useEffect(() => {
    if (formData.customer_id && boats) {
      const filtered = boats.filter(b => b.customer_id === formData.customer_id);
      setCustomerBoats(filtered);
    } else {
      setCustomerBoats([]);
    }
  }, [formData.customer_id, boats]);

  // Auto-fill customer data when existing customer is selected
  useEffect(() => {
    if (formData.customer_id && customers) {
      const selectedCustomer = customers.find(c => c.id === formData.customer_id);
      if (selectedCustomer) {
        setFormData(prev => ({
          ...prev,
          name: `${selectedCustomer.first_name || ''} ${selectedCustomer.last_name || ''}`.trim(),
          phone: selectedCustomer.phone || prev.phone,
          email: selectedCustomer.email || prev.email,
        }));
      }
    }
  }, [formData.customer_id, customers]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name, value) => {
    if (name === 'customer_id') {
      // Clear customer fields when deselecting
      if (!value) {
        setFormData((prev) => ({ 
          ...prev, 
          customer_id: '',
          name: '',
          first_name: '',
          last_name: '',
          phone: '',
          email: '',
        }));
        return;
      }
    }
    
    if (name === 'boat_id' && value) {
      const selectedBoat = boats.find(b => b.id === value);
      if (selectedBoat) {
        setFormData((prev) => ({ 
          ...prev, 
          [name]: value,
          boat_name: selectedBoat.vessel_name,
          boat_details: `${selectedBoat.vessel_type || ''} ${selectedBoat.manufacturer || ''} ${selectedBoat.model || ''}`.trim()
        }));
        return;
      }
    }
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const dataToSave = { ...formData };

    // If no customer selected, combine first_name + last_name into name
    if (!formData.customer_id) {
      if (!formData.first_name || !formData.last_name) {
        setError('First name and last name are required when no existing customer is selected');
        return;
      }
      dataToSave.name = `${formData.first_name.trim()} ${formData.last_name.trim()}`;
      
      if (!formData.phone) {
        setError('Phone number is required');
        return;
      }
    }
    // If customer selected, name/phone are pre-filled and not required from user

    try {
      setIsSubmitting(true);
      await onSave(dataToSave);
    } catch (err) {
      setError(err.message || 'Error saving lead');
      console.error('Error saving lead:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getCustomerLabel = (customer) => {
    const name = `${customer.first_name || ''} ${customer.last_name || ''}`.trim();
    const contact = customer.email || customer.phone || '';
    return contact ? `${name} — ${contact}` : name;
  };

  const filteredCustomers = customers.filter((customer) => {
    if (!customerSearch) return true;
    const searchLower = customerSearch.toLowerCase();
    const fullName = `${customer.first_name || ''} ${customer.last_name || ''}`.toLowerCase();
    const firstName = (customer.first_name || '').toLowerCase();
    const lastName = (customer.last_name || '').toLowerCase();
    return fullName.includes(searchLower) || firstName.includes(searchLower) || lastName.includes(searchLower);
  });

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">{error}</div>}

      {/* Assignment */}
      <div>
        <Label htmlFor="assigned_to_user_id" className="text-xs">
          Assign To
        </Label>
        <Select value={formData.assigned_to_user_id} onValueChange={(value) => handleSelectChange('assigned_to_user_id', value)}>
          <SelectTrigger className="text-sm">
            <SelectValue placeholder="Assign to team member" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={null}>Unassigned</SelectItem>
            {users && users.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                {user.full_name || user.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Existing Customer */}
      <div>
        <Label htmlFor="customer_id" className="text-xs">
          Existing Customer (Optional)
        </Label>
        <Select 
          value={formData.customer_id} 
          onValueChange={(value) => {
            handleSelectChange('customer_id', value);
            setCustomerSearch('');
          }}
        >
          <SelectTrigger className="text-sm">
            <SelectValue placeholder="Select a customer" />
          </SelectTrigger>
          <SelectContent>
            <div className="px-2 py-1.5 sticky top-0 bg-white border-b">
              <Input
                placeholder="Search by name..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                className="h-8 text-sm"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              />
            </div>
            <SelectItem value={null}>No Customer</SelectItem>
            {filteredCustomers.length > 0 ? (
              filteredCustomers.map((customer) => (
                <SelectItem key={customer.id} value={customer.id}>
                  {getCustomerLabel(customer)}
                </SelectItem>
              ))
            ) : (
              <SelectItem disabled value="no-matches">
                No matching customers
              </SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Contact Info */}
      <div className="space-y-3">
        <h3 className="font-semibold text-sm text-slate-900">Contact Information</h3>

        {formData.customer_id ? (
          <div>
            <Label htmlFor="name" className="text-xs">
              Name
            </Label>
            <Input
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="Contact person name"
              className="text-sm bg-slate-50"
              disabled
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="first_name" className="text-xs">
                First Name *
              </Label>
              <Input
                id="first_name"
                name="first_name"
                value={formData.first_name}
                onChange={handleInputChange}
                placeholder="First name"
                className="text-sm"
              />
            </div>
            <div>
              <Label htmlFor="last_name" className="text-xs">
                Last Name *
              </Label>
              <Input
                id="last_name"
                name="last_name"
                value={formData.last_name}
                onChange={handleInputChange}
                placeholder="Last name"
                className="text-sm"
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="phone" className="text-xs">
              Phone *
            </Label>
            <Input
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleInputChange}
              placeholder="Phone number"
              className={formData.customer_id ? "text-sm bg-slate-50" : "text-sm"}
              disabled={formData.customer_id}
            />
          </div>
          <div>
            <Label htmlFor="email" className="text-xs">
              Email
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="Email address"
              className={formData.customer_id ? "text-sm bg-slate-50" : "text-sm"}
              disabled={formData.customer_id}
            />
          </div>
        </div>
      </div>

      {/* Boat Info */}
      <div className="space-y-3">
        <h3 className="font-semibold text-sm text-slate-900">Boat Information</h3>

        {formData.customer_id && customerBoats.length > 0 && (
          <div>
            <Label htmlFor="boat_id" className="text-xs">
              Select Customer's Boat (Optional)
            </Label>
            <Select value={formData.boat_id} onValueChange={(value) => handleSelectChange('boat_id', value)}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Select a boat" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>None</SelectItem>
                {customerBoats.map((boat) => (
                  <SelectItem key={boat.id} value={boat.id}>
                    {boat.vessel_name} ({boat.vessel_type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div>
          <Label htmlFor="boat_name" className="text-xs">
            Boat Name
          </Label>
          <Input
            id="boat_name"
            name="boat_name"
            value={formData.boat_name}
            onChange={handleInputChange}
            placeholder="Vessel name"
            className="text-sm"
          />
        </div>

        <div>
          <Label htmlFor="boat_details" className="text-xs">
            Boat Details
          </Label>
          <Input
            id="boat_details"
            name="boat_details"
            value={formData.boat_details}
            onChange={handleInputChange}
            placeholder="Type, length, engine, etc."
            className="text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="location" className="text-xs">
              Location
            </Label>
            <Input
              id="location"
              name="location"
              value={formData.location}
              onChange={handleInputChange}
              placeholder="Marina or anchorage"
              className="text-sm"
            />
          </div>
          <div>
            <Label htmlFor="location_id" className="text-xs">
              Location (Reference)
            </Label>
            <Select value={formData.location_id} onValueChange={(value) => handleSelectChange('location_id', value)}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Select location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>None</SelectItem>
                {locations.map((loc) => (
                  <SelectItem key={loc.id} value={loc.id}>
                    {loc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Inquiry Details */}
      <div className="space-y-3">
        <h3 className="font-semibold text-sm text-slate-900">Inquiry Details</h3>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label htmlFor="contact_method" className="text-xs">
              Contact Method
            </Label>
            <Select value={formData.contact_method} onValueChange={(value) => handleSelectChange('contact_method', value)}>
              <SelectTrigger className="text-sm">
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

          <div>
            <Label htmlFor="inquiry_type" className="text-xs">
              Inquiry Type
            </Label>
            <Select value={formData.inquiry_type} onValueChange={(value) => handleSelectChange('inquiry_type', value)}>
              <SelectTrigger className="text-sm">
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

          <div>
            <Label htmlFor="priority" className="text-xs">
              Priority
            </Label>
            <Select value={formData.priority} onValueChange={(value) => handleSelectChange('priority', value)}>
              <SelectTrigger className="text-sm">
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
        </div>

        <div>
          <Label htmlFor="description" className="text-xs">
            Description / Inquiry Notes
          </Label>
          <Textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            placeholder="Full inquiry details, transcript, or requirements"
            className="text-sm h-24"
          />
        </div>

        <div>
          <Label htmlFor="notes" className="text-xs">
            Internal Notes
          </Label>
          <Textarea
            id="notes"
            name="notes"
            value={formData.notes}
            onChange={handleInputChange}
            placeholder="Internal notes or requirements"
            className="text-sm h-16"
          />
        </div>
      </div>

      {/* Buttons */}
      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : lead ? 'Update Lead' : 'Create Lead'}
        </Button>
      </div>
    </form>
  );
}