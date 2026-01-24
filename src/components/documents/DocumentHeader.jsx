import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function DocumentHeader({ 
  document, 
  onChange, 
  customers, 
  boats, 
  locations,
  isLocked 
}) {
  const selectedCustomer = customers.find(c => c.id === document.customer_id);
  const selectedBoat = boats.find(b => b.id === document.boat_id);
  const selectedLocation = locations.find(l => l.id === document.location_id);

  // Auto-fill customer data when customer changes
  React.useEffect(() => {
    if (selectedCustomer && !document.customer_name) {
      const name = selectedCustomer.company_name || 
        `${selectedCustomer.first_name || ''} ${selectedCustomer.last_name || ''}`.trim();
      const address = [
        selectedCustomer.billing_address,
        selectedCustomer.billing_postal_code,
        selectedCustomer.billing_city,
        selectedCustomer.billing_country
      ].filter(Boolean).join(', ');
      
      onChange({
        ...document,
        customer_name: name,
        customer_address: address,
        customer_vat: selectedCustomer.vat_number || '',
        language: selectedCustomer.preferred_language || 'German'
      });
    }
  }, [selectedCustomer]);

  // Auto-fill boat data
  React.useEffect(() => {
    if (selectedBoat && !document.boat_name) {
      onChange({
        ...document,
        boat_name: selectedBoat.vessel_name,
        boat_details: `${selectedBoat.manufacturer || ''} ${selectedBoat.model || ''} ${selectedBoat.year || ''}`.trim()
      });
    }
  }, [selectedBoat]);

  // Auto-fill location data
  React.useEffect(() => {
    if (selectedLocation && !document.location_name) {
      onChange({
        ...document,
        location_name: selectedLocation.name
      });
    }
  }, [selectedLocation]);

  const availableBoats = boats.filter(b => 
    !document.customer_id || b.customer_id === document.customer_id
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Document Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Customer Selection */}
          <div>
            <Label>Customer *</Label>
            <Select
              value={document.customer_id || ''}
              onValueChange={(value) => onChange({ ...document, customer_id: value, boat_id: '' })}
              disabled={isLocked}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select customer..." />
              </SelectTrigger>
              <SelectContent>
                {customers.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.company_name || `${c.first_name || ''} ${c.last_name || ''}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Boat Selection */}
          <div>
            <Label>Boat (Optional)</Label>
            <Select
              value={document.boat_id || ''}
              onValueChange={(value) => onChange({ ...document, boat_id: value })}
              disabled={isLocked || !document.customer_id}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select boat..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>None</SelectItem>
                {availableBoats.map(b => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.vessel_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Location Selection */}
          <div>
            <Label>Location (Optional)</Label>
            <Select
              value={document.location_id || ''}
              onValueChange={(value) => onChange({ ...document, location_id: value })}
              disabled={isLocked}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select location..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>None</SelectItem>
                {locations.map(l => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Language */}
          <div>
            <Label>Language</Label>
            <Select
              value={document.language || 'German'}
              onValueChange={(value) => onChange({ ...document, language: value })}
            >
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

          {/* Issue Date */}
          <div>
            <Label>{document.document_type === 'Offer' ? 'Offer Date' : 'Issue Date'}</Label>
            <Input
              type="date"
              value={document.issue_date || ''}
              onChange={(e) => onChange({ ...document, issue_date: e.target.value })}
              disabled={isLocked}
            />
          </div>

          {/* Due/Valid Until Date */}
          <div>
            <Label>
              {document.document_type === 'Offer' ? 'Valid Until' : 'Due Date'}
            </Label>
            <Input
              type="date"
              value={document.document_type === 'Offer' ? document.valid_until || '' : document.due_date || ''}
              onChange={(e) => onChange({ 
                ...document, 
                ...(document.document_type === 'Offer' 
                  ? { valid_until: e.target.value }
                  : { due_date: e.target.value }
                )
              })}
            />
          </div>

          {/* Currency */}
          <div>
            <Label>Currency</Label>
            <Select
              value={document.currency || 'EUR'}
              onValueChange={(value) => onChange({ ...document, currency: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EUR">EUR (€)</SelectItem>
                <SelectItem value="USD">USD ($)</SelectItem>
                <SelectItem value="GBP">GBP (£)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Payment Terms */}
          <div>
            <Label>Payment Terms</Label>
            <Input
              value={document.payment_terms || ''}
              onChange={(e) => onChange({ ...document, payment_terms: e.target.value })}
              placeholder="e.g. Net 14 days"
            />
          </div>
        </div>

        {/* Notes */}
        <div>
          <Label>Notes (shown on PDF)</Label>
          <Textarea
            value={document.public_notes || ''}
            onChange={(e) => onChange({ ...document, public_notes: e.target.value })}
            rows={3}
            placeholder="Additional notes for the customer..."
          />
        </div>

        {/* Internal Notes */}
        <div>
          <Label>Internal Notes (not shown on PDF)</Label>
          <Textarea
            value={document.internal_notes || ''}
            onChange={(e) => onChange({ ...document, internal_notes: e.target.value })}
            rows={2}
            placeholder="Internal notes for reference..."
          />
        </div>
      </CardContent>
    </Card>
  );
}