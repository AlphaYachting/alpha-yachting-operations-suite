import React from 'react';
import { WizardProvider, useWizard } from '@/components/wizard/WizardContext';
import { Step1SourceSelection } from '@/components/wizard/Step1SourceSelection';
import { Step2ContactInfo } from '@/components/wizard/Step2ContactInfo';
import { Step3VesselSelection } from '@/components/wizard/Step3VesselSelection';
import { Step4LocationSelection } from '@/components/wizard/Step4LocationSelection';
import { Step5Intent } from '@/components/wizard/Step5Intent';
import { Step5bProjectSelection } from '@/components/wizard/Step5bProjectSelection';
import { Step6Details } from '@/components/wizard/Step6Details';
import { Step7AddLineItems } from '@/components/wizard/Step7AddLineItems';
import { Step8TechnicianAssignment } from '@/components/wizard/Step8TechnicianAssignment';
import { Step9ExternalPartner } from '@/components/wizard/Step9ExternalPartner';
import { Step10Review } from '@/components/wizard/Step10Review';
import { StorageTransportFlow } from '@/components/wizard/StorageTransportFlow';
import { StorageContractFlow } from '@/components/wizard/StorageContractFlow';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Briefcase } from 'lucide-react';

function WizardContent() {
  const { wizardData } = useWizard();

  const getStepName = (step) => {
  const names = {
    1: 'Source',
    2: 'Contact',
    3: 'Vessel',
    4: 'Location',
    5: 'Intent',
    5.5: 'Project',
    6: wizardData.intent === 'storage_transport' ? 'Storage & Transport' : wizardData.intent === 'storage_contract' ? 'Storage Contract' : 'Details',
    7: 'Line Items',
    8: 'Technicians',
    9: 'Partner',
    10: 'Review'
  };
  return names[step] || 'Step';
  };

  const isStepVisible = (step) => {
    // Price inquiry: only steps 1 and 6 (StorageTransportFlow) are visible
    if (wizardData.source === 'price_inquiry_storage') {
      if (step === 1 || step === 6) return true;
      return false;
    }

    // Steps 2-4 not needed for storage_transport intent
    if (wizardData.intent === 'storage_transport' && (step === 2 || step === 3 || step === 4)) return false;

    // Always show steps 1-5
    if (step <= 5) return true;

    // Step 5.5: Project selection (only for workorder_for_existing_project)
    if (step === 5.5) return wizardData.intent === 'workorder_for_existing_project';

    // Step 6-7: Offer or Job details (NOT shown for storage_transport or storage_contract — they have their own embedded flows)
    if (step === 6) return wizardData.intent !== 'storage_transport' && wizardData.intent !== 'storage_contract';
    if (step === 7) return wizardData.intent && wizardData.intent.includes('offer') && wizardData.intent !== 'storage_transport' && wizardData.intent !== 'storage_contract';

    // Steps 8-9 not used for storage_transport or storage_contract
    if (step === 8) return wizardData.intent !== 'storage_transport' && wizardData.intent !== 'storage_contract' && (wizardData.intent === 'inspection' || wizardData.intent === 'workorder_for_existing_project' || (wizardData.intent && wizardData.intent.includes('job') && wizardData.workOrder?.createFirst !== false));
    if (step === 9) return wizardData.intent !== 'storage_transport' && wizardData.intent !== 'storage_contract' && (wizardData.intent === 'inspection' || wizardData.intent === 'workorder_for_existing_project' || (wizardData.intent && wizardData.intent.includes('job')));

    // Step 10: Always review
    if (step === 10) return true;

    return false;
  };

  const visibleSteps = [1, 2, 3, 4, 5, 5.5, 6, 7, 8, 9, 10].filter(isStepVisible);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 bg-blue-100 rounded-lg">
          <Briefcase className="h-6 w-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">New Case Wizard</h1>
          <p className="text-slate-500 text-sm mt-1">Create lead, offer, project, or work order</p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {visibleSteps.map((step, idx) => (
          <div key={step} className="flex items-center gap-2">
            <div
              className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                step === wizardData.currentStep
                  ? 'bg-blue-600 text-white'
                  : step < wizardData.currentStep
                  ? 'bg-green-600 text-white'
                  : 'bg-slate-200 text-slate-600'
              }`}
            >
              {step < wizardData.currentStep ? '✓' : step}
            </div>
            <span className="text-xs font-medium text-slate-600 whitespace-nowrap">{getStepName(step)}</span>
            {idx < visibleSteps.length - 1 && <div className="h-0.5 w-4 bg-slate-200" />}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <Card>
        <CardHeader>
          <CardTitle>Step {wizardData.currentStep}: {getStepName(wizardData.currentStep)}</CardTitle>
        </CardHeader>
        <CardContent>
          {wizardData.currentStep === 1 && <Step1SourceSelection />}
          {wizardData.currentStep === 2 && <Step2ContactInfo />}
          {wizardData.currentStep === 3 && <Step3VesselSelection />}
          {wizardData.currentStep === 4 && <Step4LocationSelection />}
          {wizardData.currentStep === 5 && <Step5Intent />}
          {wizardData.currentStep === 5.5 && <Step5bProjectSelection />}
          {wizardData.currentStep === 6 && wizardData.intent === 'storage_transport' && <StorageTransportFlow />}
          {wizardData.currentStep === 6 && wizardData.intent === 'storage_contract' && <StorageContractFlow />}
          {wizardData.currentStep === 6 && wizardData.intent !== 'storage_transport' && wizardData.intent !== 'storage_contract' && <Step6Details />}
          {wizardData.currentStep === 7 && <Step7AddLineItems />}
          {wizardData.currentStep === 8 && <Step8TechnicianAssignment />}
          {wizardData.currentStep === 9 && <Step9ExternalPartner />}
          {wizardData.currentStep === 10 && <Step10Review />}
        </CardContent>
      </Card>
    </div>
  );
}

export default function NewCaseWizard() {
  return (
    <WizardProvider>
      <WizardContent />
    </WizardProvider>
  );
}