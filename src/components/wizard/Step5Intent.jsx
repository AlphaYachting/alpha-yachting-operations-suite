import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { FileText, Briefcase, Compass, Ship, Anchor } from 'lucide-react';
import { useWizard } from './WizardContext';
import { WizardAlert } from './WizardAlert';

export function Step5Intent() {
  const { wizardData, updateWizardData, setStep } = useWizard();
  const [alertOpen, setAlertOpen] = React.useState(false);
  const [alertMessage, setAlertMessage] = React.useState('');

  const isExistingCustomer = wizardData.source === 'customer';

  const intents = [
    {
      value: 'offer',
      label: 'Create Offer',
      description: 'Generate a price quote/proposal',
      icon: FileText,
      color: 'text-blue-600'
    },
    {
      value: 'job',
      label: 'Create Project',
      description: 'Create a full project with work orders',
      icon: Briefcase,
      color: 'text-green-600'
    },
    {
      value: 'offer+job',
      label: 'Offer + Project',
      description: 'Create offer first, then convert to project',
      icon: Briefcase,
      color: 'text-purple-600'
    },
    {
      value: 'workorder_for_existing_project',
      label: 'Workorder for Existing Project',
      description: 'Add a work order to an existing project',
      icon: Briefcase,
      color: 'text-indigo-600',
      requiresExistingCustomer: true
    },
    {
      value: 'inspection',
      label: 'Initial Inspection',
      description: 'Schedule an inspection work order',
      icon: Compass,
      color: 'text-orange-600'
    },
    {
      value: 'boat_only',
      label: 'Register Boat Only',
      description: 'Just add a new boat to customer',
      icon: Ship,
      color: 'text-cyan-600'
    },
    {
      value: 'storage_transport',
      label: 'Storage & Transport Offer',
      description: 'Generate a calculated offer using the pricing engine (storage, transport, modules)',
      icon: Anchor,
      color: 'text-emerald-600'
    }
  ];

  const handleNext = () => {
    if (!wizardData.intent) {
      setAlertMessage('Please select an intent');
      setAlertOpen(true);
      return;
    }
    // Skip to appropriate next step based on intent
    if (wizardData.intent === 'boat_only') {
      setStep(10); // Go straight to review
    } else if (wizardData.intent === 'workorder_for_existing_project') {
      setStep(5.5); // Go to project selection
    } else if (wizardData.intent === 'storage_transport') {
      setStep(6); // Go to Storage & Transport Flow (rendered inside step 6)
    } else {
      setStep(6); // Go to details
    }
  };

  return (
    <div className="space-y-6">
      <WizardAlert open={alertOpen} onOpenChange={setAlertOpen} message={alertMessage} />
      <Card>
        <CardHeader>
          <CardTitle>What would you like to create?</CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup value={wizardData.intent || ''} onValueChange={(value) => updateWizardData('intent', value)}>
            <div className="space-y-3">
              {intents.map((intent) => {
                const Icon = intent.icon;
                const isDisabled = intent.requiresExistingCustomer && !isExistingCustomer;
                return (
                  <div key={intent.value} className={`flex items-center space-x-2 p-4 border rounded-lg ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-50 cursor-pointer'}`}>
                    <RadioGroupItem value={intent.value} id={`intent-${intent.value}`} disabled={isDisabled} />
                    <Label htmlFor={`intent-${intent.value}`} className={`flex-1 ${isDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className={`h-4 w-4 ${intent.color}`} />
                        <span className="font-medium">{intent.label}</span>
                      </div>
                      <p className="text-sm text-slate-500">
                        {intent.description}
                        {isDisabled && ' (Select existing customer first)'}
                      </p>
                    </Label>
                  </div>
                );
              })}
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      <div className="flex justify-between gap-2">
        <Button variant="outline" onClick={() => setStep(4)}>
          ← Back
        </Button>
        <Button onClick={handleNext} className="bg-blue-600 hover:bg-blue-700">
          Next →
        </Button>
      </div>
    </div>
  );
}