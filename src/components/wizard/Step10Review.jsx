import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertCircle } from 'lucide-react';
import { useWizard } from './WizardContext';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';

export function Step10Review() {
  const { wizardData, setStep } = useWizard();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleCreate = async () => {
    setIsSubmitting(true);
    setError('');

    try {
      const response = await base44.functions.invoke('caseWizardAdapter', wizardData);

      if (response.data?.success) {
        // Redirect to appropriate detail page
        setTimeout(() => {
          navigate(response.data.redirectTo);
        }, 500);
      } else {
        setError(response.data?.error || 'Failed to create case');
      }
    } catch (err) {
      console.error('Wizard submission error:', err);
      const errorMsg = err.response?.data?.error || err.message || 'Unknown error occurred';
      setError(`Error: ${errorMsg} (Status: ${err.response?.status || 'N/A'})`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getSummaryText = () => {
    const parts = [];

    if (wizardData.source === 'lead') {
      parts.push(`From Lead: ${wizardData.sourceData.lead?.name}`);
    } else if (wizardData.source === 'customer') {
      parts.push(`Customer: ${wizardData.sourceData.customer?.company_name || `${wizardData.sourceData.customer?.first_name} ${wizardData.sourceData.customer?.last_name}`}`);
    } else if (wizardData.source === 'new') {
      parts.push(`New Contact: ${wizardData.sourceData.newContact.first_name} ${wizardData.sourceData.newContact.last_name}`);
    }

    if (wizardData.vessel?.existing) {
      parts.push('Existing Boat');
    } else if (wizardData.vessel?.new) {
      parts.push(`New Boat: ${wizardData.vessel.new.vessel_name}`);
    }

    parts.push(`Intent: ${wizardData.intent}`);

    return parts.join(' • ');
  };

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Review & Create</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* SOURCE */}
          <div className="border-b pb-4">
            <p className="text-sm font-medium mb-2">Source</p>
            <div className="flex gap-2 flex-wrap">
              <Badge variant="outline">{wizardData.source === 'lead' ? 'Lead' : wizardData.source === 'customer' ? 'Customer' : 'New Contact'}</Badge>
              {wizardData.source === 'lead' && wizardData.sourceData.lead && (
                <span className="text-sm text-slate-600">{wizardData.sourceData.lead.name}</span>
              )}
              {wizardData.source === 'customer' && wizardData.sourceData.customer && (
                <span className="text-sm text-slate-600">
                  {wizardData.sourceData.customer.company_name || `${wizardData.sourceData.customer.first_name} ${wizardData.sourceData.customer.last_name}`}
                </span>
              )}
              {wizardData.source === 'new' && (
                <span className="text-sm text-slate-600">
                  {wizardData.sourceData.newContact.first_name} {wizardData.sourceData.newContact.last_name}
                </span>
              )}
            </div>
          </div>

          {/* VESSEL */}
          {wizardData.intent !== 'boat_only' && (
            <div className="border-b pb-4">
              <p className="text-sm font-medium mb-2">Vessel</p>
              {wizardData.vessel?.new ? (
                <span className="text-sm text-slate-600">{wizardData.vessel.new.vessel_name} (New)</span>
              ) : (
                <span className="text-sm text-slate-600">Selected Boat</span>
              )}
            </div>
          )}

          {/* LOCATION */}
          {!wizardData.location?.new && !wizardData.location?.existing && (
            <div className="border-b pb-4">
              <p className="text-sm font-medium mb-2">Location</p>
              <span className="text-sm text-slate-600">To Be Determined</span>
            </div>
          )}

          {/* INTENT */}
          <div className="border-b pb-4">
            <p className="text-sm font-medium mb-2">Intent</p>
            <Badge>{wizardData.intent}</Badge>
          </div>

          {/* OFFER DETAILS */}
          {wizardData.intent && wizardData.intent.includes('offer') && wizardData.intent !== 'storage_transport' && (
            <div className="border-b pb-4">
              <p className="text-sm font-medium mb-2">Offer</p>
              <div className="text-sm text-slate-600 space-y-1">
                <p>Title: {wizardData.offer.title || '(empty)'}</p>
                <p>Language: {wizardData.offer.language}</p>
                <p>Line Items: {wizardData.offer.lineItems.length}</p>
              </div>
            </div>
          )}

          {/* JOB DETAILS */}
          {wizardData.intent.includes('job') && (
            <div className="border-b pb-4">
              <p className="text-sm font-medium mb-2">Project</p>
              <div className="text-sm text-slate-600 space-y-1">
                <p>Title: {wizardData.job.title || '(empty)'}</p>
                <p>Type: {wizardData.job.jobType}</p>
                <p>Category: {wizardData.job.serviceCategory}</p>
              </div>
            </div>
          )}

          {/* WORK ORDER DETAILS */}
          {(wizardData.intent === 'inspection' || (wizardData.intent.includes('job') && wizardData.workOrder?.createFirst)) && (
            <div className="border-b pb-4">
              <p className="text-sm font-medium mb-2">Work Order</p>
              <div className="text-sm text-slate-600 space-y-1">
                <p>Title: {wizardData.intent === 'inspection' ? 'Initial Inspection' : wizardData.workOrder.title || '(from job)'}</p>
                {wizardData.workOrder?.scheduled_date && (
                  <p>Scheduled: {new Date(wizardData.workOrder.scheduled_date).toLocaleDateString()}</p>
                )}
                <p>Technicians: {wizardData.technicians.length}</p>
              </div>
            </div>
          )}

          {/* EXTERNAL PARTNER */}
          {wizardData.externalPartner?.enabled && (
            <div className="pb-4">
              <p className="text-sm font-medium mb-2">External Partner</p>
              <div className="text-sm text-slate-600 space-y-1">
                <p>Partner: {wizardData.externalPartner.partner_name || wizardData.externalPartner.partner_id || '(to be assigned)'}</p>
                <p>Budget: €{wizardData.externalPartner.budget?.total || 0}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between gap-2">
        <Button variant="outline" onClick={() => setStep(9)}>
          ← Back
        </Button>
        <Button
          onClick={handleCreate}
          disabled={isSubmitting}
          className="bg-green-600 hover:bg-green-700"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating...
            </>
          ) : (
            'Create Case'
          )}
        </Button>
      </div>
    </div>
  );
}