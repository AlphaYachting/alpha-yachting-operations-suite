import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Phone, Users, UserPlus } from 'lucide-react';
import { useWizard } from './WizardContext';

export function Step1SourceSelection() {
  const { wizardData, updateWizardData, setStep } = useWizard();

  const handleNext = () => {
    if (!wizardData.source) {
      alert('Please select a source');
      return;
    }
    setStep(2);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Where is this case coming from?</CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup value={wizardData.source || ''} onValueChange={(value) => updateWizardData('source', value)}>
            <div className="space-y-4">
              <div className="flex items-center space-x-2 p-4 border rounded-lg hover:bg-slate-50 cursor-pointer">
                <RadioGroupItem value="lead" id="source-lead" />
                <Label htmlFor="source-lead" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2 mb-1">
                    <Phone className="h-4 w-4 text-purple-600" />
                    <span className="font-medium">From Existing Lead</span>
                  </div>
                  <p className="text-sm text-slate-500">Select an inbound lead and convert to customer/offer/job</p>
                </Label>
              </div>

              <div className="flex items-center space-x-2 p-4 border rounded-lg hover:bg-slate-50 cursor-pointer">
                <RadioGroupItem value="customer" id="source-customer" />
                <Label htmlFor="source-customer" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2 mb-1">
                    <Users className="h-4 w-4 text-blue-600" />
                    <span className="font-medium">From Existing Customer</span>
                  </div>
                  <p className="text-sm text-slate-500">Select a known customer and create offer/job/boat</p>
                </Label>
              </div>

              <div className="flex items-center space-x-2 p-4 border rounded-lg hover:bg-slate-50 cursor-pointer">
                <RadioGroupItem value="new" id="source-new" />
                <Label htmlFor="source-new" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2 mb-1">
                    <UserPlus className="h-4 w-4 text-green-600" />
                    <span className="font-medium">Create New Contact</span>
                  </div>
                  <p className="text-sm text-slate-500">Add a new customer and immediately create offer/job/boat</p>
                </Label>
              </div>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" disabled>
          ← Back
        </Button>
        <Button onClick={handleNext} className="bg-blue-600 hover:bg-blue-700">
          Next →
        </Button>
      </div>
    </div>
  );
}