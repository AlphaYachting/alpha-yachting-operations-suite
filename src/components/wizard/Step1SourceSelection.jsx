import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Phone, Users, UserPlus, Calculator, MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useWizard } from './WizardContext';

export function Step1SourceSelection() {
  const { wizardData, updateWizardData, setStep } = useWizard();
  const navigate = useNavigate();

  const handleNext = () => {
    if (!wizardData.source) {
      alert('Please select a source');
      return;
    }
    // Price inquiry: skip all contact/vessel/location steps, go directly to configurator
    if (wizardData.source === 'price_inquiry_storage') {
      updateWizardData('intent', 'storage_transport');
      setStep(6);
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

              <button
                type="button"
                onClick={() => navigate('/RepairOrderChat')}
                className="w-full flex items-center space-x-2 p-4 border rounded-lg hover:bg-blue-50 border-blue-200 cursor-pointer text-left"
              >
                <MessageSquare className="h-4 w-4 text-blue-600 flex-shrink-0" />
                <div className="flex-1">
                  <div className="font-medium">Auftrags-Chat (KI)</div>
                  <p className="text-sm text-slate-500">Dokumente per KI auslesen, Reparaturauftrag zum Unterschreiben erstellen und Projekt anlegen</p>
                </div>
              </button>

              <div className="flex items-center space-x-2 p-4 border rounded-lg hover:bg-emerald-50 border-emerald-200 cursor-pointer">
                <RadioGroupItem value="price_inquiry_storage" id="source-price-inquiry" />
                <Label htmlFor="source-price-inquiry" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2 mb-1">
                    <Calculator className="h-4 w-4 text-emerald-600" />
                    <span className="font-medium">Price Inquiry – Dry Marina</span>
                  </div>
                  <p className="text-sm text-slate-500">Jump directly to the storage configurator – no customer required, just boat size & options</p>
                </Label>
              </div>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" disabled className="cursor-not-allowed">
          ← Back
        </Button>
        <Button onClick={handleNext} className="bg-blue-600 hover:bg-blue-700 cursor-pointer">
          Next →
        </Button>
      </div>
    </div>
  );
}