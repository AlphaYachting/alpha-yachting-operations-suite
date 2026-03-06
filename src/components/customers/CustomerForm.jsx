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

export default function CustomerForm({ customer, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    company_name: customer?.company_name || '',
    first_name: customer?.first_name || '',
    last_name: customer?.last_name || '',
    email: customer?.email || '',
    phone: customer?.phone || '',
    phone_secondary: customer?.phone_secondary || '',
    preferred_language: customer?.preferred_language || 'German',
    customer_type: customer?.customer_type || 'Private',
    billing_address: customer?.billing_address || '',
    billing_city: customer?.billing_city || '',
    billing_postal_code: customer?.billing_postal_code || '',
    billing_country: customer?.billing_country || '',
    vat_number: customer?.vat_number || '',
    payment_terms: customer?.payment_terms || 'Net 14',
    notes: customer?.notes || '',
    status: customer?.status || 'Active'
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await onSave(formData);
    setSaving(false);
  };

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Customer Type */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Customer Type</Label>
          <Select value={formData.customer_type} onValueChange={(v) => updateField('customer_type', v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Private">Private</SelectItem>
              <SelectItem value="Business">Business</SelectItem>
              <SelectItem value="Charter Company">Charter Company</SelectItem>
              <SelectItem value="Marina Partner">Marina Partner</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={formData.status} onValueChange={(v) => updateField('status', v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Inactive">Inactive</SelectItem>
              <SelectItem value="VIP">VIP</SelectItem>
              <SelectItem value="Blocked">Blocked</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Company Name (if business) */}
      {formData.customer_type !== 'Private' && (
        <div className="space-y-2">
          <Label>Company Name</Label>
          <Input
            value={formData.company_name || ''}
            onChange={(e) => updateField('company_name', e.target.value)}
            placeholder="Company name"
          />
        </div>
      )}

      {/* Name */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>First Name</Label>
          <Input
            value={formData.first_name || ''}
            onChange={(e) => updateField('first_name', e.target.value)}
            placeholder="First name"
          />
        </div>
        <div className="space-y-2">
          <Label>Last Name *</Label>
          <Input
            value={formData.last_name || ''}
            onChange={(e) => updateField('last_name', e.target.value)}
            placeholder="Last name"
            required
          />
        </div>
      </div>

      {/* Contact */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Email *</Label>
          <Input
            type="email"
            value={formData.email || ''}
            onChange={(e) => updateField('email', e.target.value)}
            placeholder="email@example.com"
            required
          />
        </div>
        <div className="space-y-2">
          <Label>Phone</Label>
          <Input
            value={formData.phone || ''}
            onChange={(e) => updateField('phone', e.target.value)}
            placeholder="+43 ..."
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Secondary Phone</Label>
          <Input
            value={formData.phone_secondary || ''}
            onChange={(e) => updateField('phone_secondary', e.target.value)}
            placeholder="Secondary phone"
          />
        </div>
        <div className="space-y-2">
          <Label>Preferred Language</Label>
          <Select value={formData.preferred_language} onValueChange={(v) => updateField('preferred_language', v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="German">German</SelectItem>
              <SelectItem value="English">English</SelectItem>
              <SelectItem value="Italian">Italian</SelectItem>
              <SelectItem value="Slovenian">Slovenian</SelectItem>
              <SelectItem value="Croatian">Croatian</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Billing Address */}
      <div className="space-y-4">
        <h3 className="font-medium text-slate-900">Billing Address</h3>
        <div className="space-y-2">
          <Label>Street Address</Label>
          <Input
            value={formData.billing_address || ''}
            onChange={(e) => updateField('billing_address', e.target.value)}
            placeholder="Street address"
          />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Postal Code</Label>
            <Input
              value={formData.billing_postal_code || ''}
              onChange={(e) => updateField('billing_postal_code', e.target.value)}
              placeholder="12345"
            />
          </div>
          <div className="space-y-2">
            <Label>City</Label>
            <Input
              value={formData.billing_city || ''}
              onChange={(e) => updateField('billing_city', e.target.value)}
              placeholder="City"
            />
          </div>
          <div className="space-y-2">
            <Label>Country</Label>
            <Input
              value={formData.billing_country || ''}
              onChange={(e) => updateField('billing_country', e.target.value)}
              placeholder="Country"
            />
          </div>
        </div>
      </div>

      {/* Business Details */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>VAT Number</Label>
          <Input
            value={formData.vat_number || ''}
            onChange={(e) => updateField('vat_number', e.target.value)}
            placeholder="VAT number"
          />
        </div>
        <div className="space-y-2">
          <Label>Payment Terms</Label>
          <Select value={formData.payment_terms} onValueChange={(v) => updateField('payment_terms', v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Immediate">Immediate</SelectItem>
              <SelectItem value="Net 14">Net 14</SelectItem>
              <SelectItem value="Net 30">Net 30</SelectItem>
              <SelectItem value="Prepaid">Prepaid</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label>Internal Notes</Label>
        <Textarea
          value={formData.notes || ''}
          onChange={(e) => updateField('notes', e.target.value)}
          placeholder="Access rules, preferences, special instructions..."
          rows={3}
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700">
          {saving ? 'Saving...' : (customer ? 'Update Customer' : 'Create Customer')}
        </Button>
      </div>
    </form>
  );
}