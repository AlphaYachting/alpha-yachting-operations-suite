import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertCircle, Loader2 } from 'lucide-react';

export default function LeadConversionDialog({ lead, open, onOpenChange, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    first_name: lead?.name?.split(' ')[0] || '',
    last_name: lead?.name?.split(' ').slice(1).join(' ') || '',
    email: lead?.email || '',
    phone: lead?.phone || '',
    vessel_name: lead?.boat_name || '',
    vessel_type: 'Sailboat',
    location_id: lead?.location_id || ''
  });

  const handleConvert = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await base44.functions.invoke('convertLeadToCustomer', {
        leadId: lead.id,
        customerData: {
          first_name: formData.first_name,
          last_name: formData.last_name,
          email: formData.email,
          phone: formData.phone
        },
        boatData: {
          vessel_name: formData.vessel_name,
          vessel_type: formData.vessel_type,
          location_id: formData.location_id
        }
      });

      if (response.data?.success) {
        onOpenChange(false);
        onSuccess();
      } else {
        setError(response.data?.error || 'Conversion failed');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Convert Lead to Customer</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex gap-2">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-sm">First Name</Label>
              <Input
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Last Name</Label>
              <Input
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                disabled={loading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm">Email</Label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm">Boat Name</Label>
            <Input
              value={formData.vessel_name}
              onChange={(e) => setFormData({ ...formData, vessel_name: e.target.value })}
              disabled={loading}
            />
          </div>

          <p className="text-sm text-slate-500 bg-blue-50 p-3 rounded-lg">
            This will create a new customer and boat record from this lead. The lead will be marked as converted.
          </p>
        </div>

        <div className="flex gap-3 justify-end pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleConvert} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Convert to Customer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}