import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useWizard } from './WizardContext';
import { WizardAlert } from './WizardAlert';

export function Step6Details() {
  const { wizardData, updateWizardData, setStep } = useWizard();
  const [alertOpen, setAlertOpen] = React.useState(false);
  const [alertMessage, setAlertMessage] = React.useState('');

  const handleNext = () => {
    if (wizardData.intent && wizardData.intent.includes('offer') && !wizardData.offer.title) {
      setAlertMessage('Offer title is required');
      setAlertOpen(true);
      return;
    }
    if (wizardData.intent && wizardData.intent.includes('job') && !wizardData.job.title) {
      setAlertMessage('Project title is required');
      setAlertOpen(true);
      return;
    }
    if (wizardData.intent === 'workorder_for_existing_project' && !wizardData.workOrder?.title) {
      setAlertMessage('Work order title is required');
      setAlertOpen(true);
      return;
    }

    // If offer path and no line items, skip to technician step
    if (wizardData.intent && wizardData.intent.includes('offer') && !wizardData.intent.includes('job')) {
      setStep(8); // Skip line items for offer-only
    } else if (wizardData.intent && wizardData.intent.includes('offer')) {
      setStep(7); // Go to line items for offer+job
    } else {
      setStep(8); // Go to technicians for job-only, inspection, or workorder_for_existing_project
    }
  };

  return (
    <div className="space-y-6">
      <WizardAlert open={alertOpen} onOpenChange={setAlertOpen} message={alertMessage} />
      {/* OFFER DETAILS */}
      {wizardData.intent.includes('offer') && (
        <Card>
          <CardHeader>
            <CardTitle>Offer Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Offer Title *</Label>
              <Input
                value={wizardData.offer.title}
                onChange={(e) => updateWizardData('offer.title', e.target.value)}
                placeholder="e.g., Engine Overhaul Quote"
              />
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={wizardData.offer.description}
                onChange={(e) => updateWizardData('offer.description', e.target.value)}
                placeholder="Additional details about the offer"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Language</Label>
                <Select
                  value={wizardData.offer.language}
                  onValueChange={(value) => updateWizardData('offer.language', value)}
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

              <div>
                <Label>VAT Rate (%)</Label>
                <Input
                  type="number"
                  value={wizardData.offer.vat_rate || 0}
                  onChange={(e) => updateWizardData('offer.vat_rate', parseFloat(e.target.value) || 0)}
                  placeholder="0"
                />
              </div>
            </div>

            <div>
              <Label>Valid Until</Label>
              <Input
                type="date"
                value={wizardData.offer.validUntil || ''}
                onChange={(e) => updateWizardData('offer.validUntil', e.target.value)}
              />
            </div>

            <div>
              <Label>Payment Terms Type</Label>
              <Select
                value={wizardData.offer.paymentTermsType}
                onValueChange={(value) => updateWizardData('offer.paymentTermsType', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Full">Full Payment</SelectItem>
                  <SelectItem value="Downpayment">Downpayment Required</SelectItem>
                  <SelectItem value="Installments">Installments</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {wizardData.offer.paymentTermsType !== 'Full' && (
              <div>
                <Label>Downpayment (%)</Label>
                <Input
                  type="number"
                  value={wizardData.offer.downpaymentPercent || 0}
                  onChange={(e) => updateWizardData('offer.downpaymentPercent', parseFloat(e.target.value) || 0)}
                  min="0"
                  max="100"
                  placeholder="50"
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* JOB DETAILS */}
      {wizardData.intent.includes('job') && (
        <Card>
          <CardHeader>
            <CardTitle>Project Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Project Title *</Label>
              <Input
                value={wizardData.job.title}
                onChange={(e) => updateWizardData('job.title', e.target.value)}
                placeholder="e.g., Full Engine Service"
              />
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={wizardData.job.description}
                onChange={(e) => updateWizardData('job.description', e.target.value)}
                placeholder="Detailed problem description or request"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Job Type</Label>
                <Select
                  value={wizardData.job.jobType}
                  onValueChange={(value) => updateWizardData('job.jobType', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Mobile Service">Mobile Service</SelectItem>
                    <SelectItem value="Dry Marina Work">Dry Marina Work</SelectItem>
                    <SelectItem value="Drive-In Express">Drive-In Express</SelectItem>
                    <SelectItem value="Scheduled Maintenance">Scheduled Maintenance</SelectItem>
                    <SelectItem value="Emergency">Emergency</SelectItem>
                    <SelectItem value="Refit Project">Refit Project</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Service Category</Label>
                <Select
                  value={wizardData.job.serviceCategory}
                  onValueChange={(value) => updateWizardData('job.serviceCategory', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="General Service">General Service</SelectItem>
                    <SelectItem value="Mechanical">Mechanical</SelectItem>
                    <SelectItem value="Electrical">Electrical</SelectItem>
                    <SelectItem value="Electronics">Electronics</SelectItem>
                    <SelectItem value="GRP/Bodywork">GRP/Bodywork</SelectItem>
                    <SelectItem value="Sealing">Sealing</SelectItem>
                    <SelectItem value="HVAC">HVAC</SelectItem>
                    <SelectItem value="Rigging">Rigging</SelectItem>
                    <SelectItem value="Plumbing">Plumbing</SelectItem>
                    <SelectItem value="Installation">Installation</SelectItem>
                    <SelectItem value="Diagnostics">Diagnostics</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Priority</Label>
                <Select
                  value={wizardData.job.priority}
                  onValueChange={(value) => updateWizardData('job.priority', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Low">Low</SelectItem>
                    <SelectItem value="Normal">Normal</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                    <SelectItem value="Urgent">Urgent</SelectItem>
                    <SelectItem value="Express">Express</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Target Completion Date</Label>
                <Input
                  type="date"
                  value={wizardData.job.targetDate || ''}
                  onChange={(e) => updateWizardData('job.targetDate', e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* INSPECTION SETUP */}
      {wizardData.intent === 'inspection' && (
        <Card>
          <CardHeader>
            <CardTitle>Initial Inspection Setup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-blue-50 rounded border border-blue-200">
              <p className="text-sm text-blue-900">
                Work order will be titled "Initial Inspection". You'll assign technicians and optional tasks in the next steps.
              </p>
            </div>

            <div>
              <Label>Scheduled Date (Optional)</Label>
              <Input
                type="date"
                value={wizardData.workOrder?.scheduled_date || ''}
                onChange={(e) => updateWizardData('workOrder.scheduled_date', e.target.value)}
              />
            </div>

            <div>
              <Label>Estimated Duration (Hours)</Label>
              <Input
                type="number"
                value={wizardData.workOrder?.estimated_duration_hours || ''}
                onChange={(e) => updateWizardData('workOrder.estimated_duration_hours', e.target.value ? parseFloat(e.target.value) : null)}
                placeholder="e.g., 2"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* WORKORDER FOR EXISTING PROJECT SETUP */}
      {wizardData.intent === 'workorder_for_existing_project' && (
        <Card>
          <CardHeader>
            <CardTitle>Work Order Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Work Order Title *</Label>
              <Input
                value={wizardData.workOrder?.title || ''}
                onChange={(e) => updateWizardData('workOrder.title', e.target.value)}
                placeholder="e.g., Engine Service"
              />
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={wizardData.workOrder?.description || ''}
                onChange={(e) => updateWizardData('workOrder.description', e.target.value)}
                placeholder="Work order details"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Scheduled Date</Label>
                <Input
                  type="date"
                  value={wizardData.workOrder?.scheduled_date || ''}
                  onChange={(e) => updateWizardData('workOrder.scheduled_date', e.target.value)}
                />
              </div>

              <div>
                <Label>Estimated Duration (Hours)</Label>
                <Input
                  type="number"
                  value={wizardData.workOrder?.estimated_duration_hours || ''}
                  onChange={(e) => updateWizardData('workOrder.estimated_duration_hours', e.target.value ? parseFloat(e.target.value) : null)}
                  placeholder="e.g., 4"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between gap-2">
        <Button variant="outline" onClick={() => setStep(5)}>
          ← Back
        </Button>
        <Button onClick={handleNext} className="bg-blue-600 hover:bg-blue-700">
          Next →
        </Button>
      </div>
    </div>
  );
}