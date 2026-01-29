import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

const DEFAULT_RETENTION_TEXT = `Retention of Title (Eigentumsvorbehalt):
All delivered goods and services remain the sole property of Alpha Yachting until full payment has been received. The customer has no right to sell, pledge, or otherwise dispose of the goods until ownership has been transferred.`;

export default function PaymentTermsSection({ formData, updateField, totalAmount }) {
  const [downpaymentAmount, setDownpaymentAmount] = useState(0);

  // Calculate downpayment amount when percentage or total changes
  useEffect(() => {
    if (formData.payment_terms_type === 'Downpayment' && formData.downpayment_percent) {
      const amount = (totalAmount * formData.downpayment_percent) / 100;
      setDownpaymentAmount(amount);
      updateField('downpayment_amount', amount);
    } else {
      setDownpaymentAmount(0);
      updateField('downpayment_amount', 0);
    }
  }, [formData.downpayment_percent, totalAmount, formData.payment_terms_type]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment Terms & Legal</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Payment Type Selection */}
        <div className="space-y-2">
          <Label>Payment Method</Label>
          <Select 
            value={formData.payment_terms_type || 'Full'} 
            onValueChange={(v) => updateField('payment_terms_type', v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Full">Full Payment</SelectItem>
              <SelectItem value="Downpayment">Downpayment</SelectItem>
              <SelectItem value="Installments">Installments</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Downpayment Section */}
        {formData.payment_terms_type === 'Downpayment' && (
          <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Downpayment %</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.downpayment_percent || ''}
                  onChange={(e) => updateField('downpayment_percent', parseFloat(e.target.value) || 0)}
                  placeholder="e.g., 50"
                />
              </div>
              <div className="space-y-2">
                <Label>Downpayment Amount</Label>
                <div className="px-3 py-2 bg-white border border-slate-200 rounded-md">
                  <span className="font-semibold">€{downpaymentAmount.toFixed(2)}</span>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Payment Schedule Description</Label>
              <Textarea
                value={formData.payment_schedule || ''}
                onChange={(e) => updateField('payment_schedule', e.target.value)}
                placeholder="e.g., 50% downpayment upon order, 50% upon completion"
                rows={2}
              />
            </div>
          </div>
        )}

        {/* Installments Section */}
        {formData.payment_terms_type === 'Installments' && (
          <div className="space-y-4 p-4 bg-green-50 rounded-lg border border-green-200">
            <Label>Payment Schedule Description</Label>
            <Textarea
              value={formData.payment_schedule || ''}
              onChange={(e) => updateField('payment_schedule', e.target.value)}
              placeholder="e.g., 33% upon order, 33% at 50% completion, 34% upon final delivery"
              rows={3}
            />
          </div>
        )}

        {/* Retention of Title */}
        <div className="border-t pt-6 space-y-4">
          <div className="flex items-center justify-between">
            <Label className="font-semibold">Include Retention of Title Clause</Label>
            <Switch
              checked={formData.retention_of_title_enabled !== false}
              onCheckedChange={(checked) => updateField('retention_of_title_enabled', checked)}
            />
          </div>

          {formData.retention_of_title_enabled !== false && (
            <div className="space-y-2">
              <Label>Legal Text (Retention of Title)</Label>
              <Textarea
                value={formData.retention_of_title_text || DEFAULT_RETENTION_TEXT}
                onChange={(e) => updateField('retention_of_title_text', e.target.value)}
                placeholder="Enter legal text..."
                rows={4}
                className="font-mono text-xs"
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}