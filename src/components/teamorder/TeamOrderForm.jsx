import React, { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export default function TeamOrderForm({ teamOrder, setTeamOrder, technicians = [] }) {
  const updateField = (field, value) => {
    setTeamOrder(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-6">
      {/* Partner Assignment */}
      <Card>
        <CardHeader>
          <CardTitle>Partner Assignment</CardTitle>
          <CardDescription>Select external partner or enter details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>External Partner</Label>
            <Select 
              value={teamOrder.external_partner_id || ''} 
              onValueChange={(v) => updateField('external_partner_id', v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select partner" />
              </SelectTrigger>
              <SelectContent>
                {technicians.map(t => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.first_name} {t.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Partner Name</Label>
              <Input
                value={teamOrder.partner_name || ''}
                onChange={(e) => updateField('partner_name', e.target.value)}
                placeholder="Company name"
              />
            </div>
            <div className="space-y-2">
              <Label>Contact</Label>
              <Input
                value={teamOrder.partner_contact || ''}
                onChange={(e) => updateField('partner_contact', e.target.value)}
                placeholder="Email or phone"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={teamOrder.status || 'Draft'} onValueChange={(v) => updateField('status', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Draft">Draft</SelectItem>
                <SelectItem value="Sent">Sent</SelectItem>
                <SelectItem value="Accepted">Accepted</SelectItem>
                <SelectItem value="In Progress">In Progress</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
                <SelectItem value="Closed">Closed</SelectItem>
                <SelectItem value="Cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Budget Framework */}
      <Card>
        <CardHeader>
          <CardTitle>Budget Framework</CardTitle>
          <CardDescription>Define approved budget and breakdown</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Total Approved Budget (EUR)</Label>
            <Input
              type="number"
              value={teamOrder.approved_budget_total || ''}
              onChange={(e) => updateField('approved_budget_total', parseFloat(e.target.value) || 0)}
              placeholder="0.00"
            />
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Labor Budget</Label>
              <Input
                type="number"
                value={teamOrder.labor_budget || ''}
                onChange={(e) => updateField('labor_budget', parseFloat(e.target.value) || 0)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label>Travel Budget</Label>
              <Input
                type="number"
                value={teamOrder.travel_budget || ''}
                onChange={(e) => updateField('travel_budget', parseFloat(e.target.value) || 0)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label>Accommodation Budget</Label>
              <Input
                type="number"
                value={teamOrder.accommodation_budget || ''}
                onChange={(e) => updateField('accommodation_budget', parseFloat(e.target.value) || 0)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label>Per Diem Budget</Label>
              <Input
                type="number"
                value={teamOrder.per_diem_budget || ''}
                onChange={(e) => updateField('per_diem_budget', parseFloat(e.target.value) || 0)}
                placeholder="0.00"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cost Policies */}
      <Card>
        <CardHeader>
          <CardTitle>Cost Policies</CardTitle>
          <CardDescription>Define what costs are covered</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Accommodation */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="accommodation_paid"
                checked={teamOrder.accommodation_paid || false}
                onCheckedChange={(checked) => updateField('accommodation_paid', checked)}
              />
              <label htmlFor="accommodation_paid" className="font-medium">
                Accommodation Paid
              </label>
            </div>
            {teamOrder.accommodation_paid && (
              <div className="ml-6 space-y-3">
                <div className="space-y-2">
                  <Label>Max per Night (EUR)</Label>
                  <Input
                    type="number"
                    value={teamOrder.accommodation_max_per_night || ''}
                    onChange={(e) => updateField('accommodation_max_per_night', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Input
                    value={teamOrder.accommodation_notes || ''}
                    onChange={(e) => updateField('accommodation_notes', e.target.value)}
                    placeholder="e.g., Book via company portal"
                  />
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Per Diem */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="meals_per_diem_paid"
                checked={teamOrder.meals_per_diem_paid || false}
                onCheckedChange={(checked) => updateField('meals_per_diem_paid', checked)}
              />
              <label htmlFor="meals_per_diem_paid" className="font-medium">
                Meals / Per Diem Paid
              </label>
            </div>
            {teamOrder.meals_per_diem_paid && (
              <div className="ml-6 space-y-2">
                <Label>Rate per Day (EUR)</Label>
                <Input
                  type="number"
                  value={teamOrder.per_diem_rate_per_day || ''}
                  onChange={(e) => updateField('per_diem_rate_per_day', parseFloat(e.target.value) || 0)}
                />
              </div>
            )}
          </div>

          <Separator />

          {/* Mileage */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="mileage_paid"
                checked={teamOrder.mileage_paid || false}
                onCheckedChange={(checked) => updateField('mileage_paid', checked)}
              />
              <label htmlFor="mileage_paid" className="font-medium">
                Mileage Paid
              </label>
            </div>
            {teamOrder.mileage_paid && (
              <div className="ml-6 grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Rate per KM (EUR)</Label>
                  <Input
                    type="number"
                    value={teamOrder.mileage_rate_per_km || 0.35}
                    onChange={(e) => updateField('mileage_rate_per_km', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Total Cap (EUR)</Label>
                  <Input
                    type="number"
                    value={teamOrder.mileage_cap_total || ''}
                    onChange={(e) => updateField('mileage_cap_total', parseFloat(e.target.value) || 0)}
                    placeholder="Optional"
                  />
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Travel Time */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="travel_time_paid"
                checked={teamOrder.travel_time_paid || false}
                onCheckedChange={(checked) => updateField('travel_time_paid', checked)}
              />
              <label htmlFor="travel_time_paid" className="font-medium">
                Travel Time Paid
              </label>
            </div>
            {teamOrder.travel_time_paid && (
              <div className="ml-6 space-y-2">
                <Label>Rate per Hour (EUR)</Label>
                <Input
                  type="number"
                  value={teamOrder.travel_time_rate_per_hour || ''}
                  onChange={(e) => updateField('travel_time_rate_per_hour', parseFloat(e.target.value) || 0)}
                />
              </div>
            )}
          </div>

          <Separator />

          {/* Other Reimbursables */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="other_reimbursables_allowed"
                checked={teamOrder.other_reimbursables_allowed || false}
                onCheckedChange={(checked) => updateField('other_reimbursables_allowed', checked)}
              />
              <label htmlFor="other_reimbursables_allowed" className="font-medium">
                Other Reimbursables Allowed
              </label>
            </div>
            {teamOrder.other_reimbursables_allowed && (
              <div className="ml-6 space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={teamOrder.other_reimbursables_notes || ''}
                  onChange={(e) => updateField('other_reimbursables_notes', e.target.value)}
                  placeholder="Specify what other costs can be reimbursed"
                  rows={2}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Governance */}
      <Card>
        <CardHeader>
          <CardTitle>Approval Rules</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Requires Pre-approval Over (EUR)</Label>
            <Input
              type="number"
              value={teamOrder.requires_preapproval_over || 500}
              onChange={(e) => updateField('requires_preapproval_over', parseFloat(e.target.value) || 0)}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="budget_exceed_requires_approval"
              checked={teamOrder.budget_exceed_requires_approval !== false}
              onCheckedChange={(checked) => updateField('budget_exceed_requires_approval', checked)}
            />
            <label htmlFor="budget_exceed_requires_approval" className="text-sm">
              Budget exceed requires approval
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Internal Notes (Admin only)</Label>
            <Textarea
              value={teamOrder.internal_notes || ''}
              onChange={(e) => updateField('internal_notes', e.target.value)}
              placeholder="Internal notes for organizers"
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label>Partner Notes (Visible to partner)</Label>
            <Textarea
              value={teamOrder.partner_notes || ''}
              onChange={(e) => updateField('partner_notes', e.target.value)}
              placeholder="Instructions visible to external partner"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}