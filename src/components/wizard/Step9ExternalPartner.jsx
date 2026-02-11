import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useWizard } from './WizardContext';
import { SearchSelect } from './SearchSelect';
import { base44 } from '@/api/base44Client';

export function Step9ExternalPartner() {
  const { wizardData, updateWizardData, setStep } = useWizard();
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadTechnicians();
  }, []);

  const loadTechnicians = async () => {
    try {
      setLoading(true);
      const data = await base44.entities.Technician.list('-created_date', 100);
      setTechnicians(data.filter(t => t.is_external === true));
    } catch (error) {
      console.error('Error loading partners:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    setStep(10);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>External Partner (Optional)</CardTitle>
          <p className="text-sm text-slate-500 mt-2">Engage an external contractor for this work order</p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded border">
            <Switch
              checked={wizardData.externalPartner.enabled}
              onCheckedChange={(checked) => updateWizardData('externalPartner.enabled', checked)}
              id="partner-toggle"
            />
            <Label htmlFor="partner-toggle" className="cursor-pointer">
              Engage External Partner
            </Label>
          </div>

          {wizardData.externalPartner.enabled && (
            <>
              <div>
                <Label>Partner Selection</Label>
                <p className="text-sm text-slate-500 mb-3">Search for existing external partner or create new</p>
                <SearchSelect
                  placeholder="Search external partners..."
                  items={technicians}
                  onSelect={(id) => updateWizardData('externalPartner.partner_id', id)}
                  displayFn={(item) => `${item.first_name} ${item.last_name}`}
                  searchFn={(item, query) =>
                    `${item.first_name} ${item.last_name}`.toLowerCase().includes(query.toLowerCase())
                  }
                  isLoading={loading}
                  selectedValue={wizardData.externalPartner.partner_id}
                />
              </div>

              {!wizardData.externalPartner.partner_id && (
                <>
                  <div>
                    <Label>Partner Company Name</Label>
                    <Input
                      value={wizardData.externalPartner.partner_name}
                      onChange={(e) => updateWizardData('externalPartner.partner_name', e.target.value)}
                      placeholder="e.g., Local Repair Services"
                    />
                  </div>

                  <div>
                    <Label>Partner Contact</Label>
                    <Input
                      value={wizardData.externalPartner.partner_contact}
                      onChange={(e) => updateWizardData('externalPartner.partner_contact', e.target.value)}
                      placeholder="Email or phone"
                    />
                  </div>
                </>
              )}

              <div className="border-t pt-6">
                <p className="font-medium text-slate-900 mb-4">Budget Allocation (EUR)</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Total Budget</Label>
                    <Input
                      type="number"
                      value={wizardData.externalPartner.budget?.total || 0}
                      onChange={(e) => updateWizardData('externalPartner.budget.total', parseFloat(e.target.value) || 0)}
                      min="0"
                      placeholder="0"
                    />
                  </div>

                  <div>
                    <Label>Labor</Label>
                    <Input
                      type="number"
                      value={wizardData.externalPartner.budget?.labor || 0}
                      onChange={(e) => updateWizardData('externalPartner.budget.labor', parseFloat(e.target.value) || 0)}
                      min="0"
                      placeholder="0"
                    />
                  </div>

                  <div>
                    <Label>Travel</Label>
                    <Input
                      type="number"
                      value={wizardData.externalPartner.budget?.travel || 0}
                      onChange={(e) => updateWizardData('externalPartner.budget.travel', parseFloat(e.target.value) || 0)}
                      min="0"
                      placeholder="0"
                    />
                  </div>

                  <div>
                    <Label>Accommodation</Label>
                    <Input
                      type="number"
                      value={wizardData.externalPartner.budget?.accommodation || 0}
                      onChange={(e) => updateWizardData('externalPartner.budget.accommodation', parseFloat(e.target.value) || 0)}
                      min="0"
                      placeholder="0"
                    />
                  </div>

                  <div>
                    <Label>Per Diem</Label>
                    <Input
                      type="number"
                      value={wizardData.externalPartner.budget?.per_diem || 0}
                      onChange={(e) => updateWizardData('externalPartner.budget.per_diem', parseFloat(e.target.value) || 0)}
                      min="0"
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between gap-2">
        <Button variant="outline" onClick={() => setStep(8)}>
          ← Back
        </Button>
        <Button onClick={handleNext} className="bg-blue-600 hover:bg-blue-700">
          Next →
        </Button>
      </div>
    </div>
  );
}