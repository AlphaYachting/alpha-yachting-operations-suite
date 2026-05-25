import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useWizard } from './WizardContext';
import { SearchSelect } from './SearchSelect';
import { WizardAlert } from './WizardAlert';
import { base44 } from '@/api/base44Client';

export function Step2ContactInfo() {
  const { wizardData, updateWizardData, setStep } = useWizard();
  const [leads, setLeads] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      if (wizardData.source === 'lead') {
        setLoadingLeads(true);
        const data = await base44.entities.Lead.list('-created_date', 100);
        setLeads(data);
      } else if (wizardData.source === 'customer') {
        setLoadingCustomers(true);
        const data = await base44.entities.Customer.list('-created_date', 100);
        setCustomers(data);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoadingLeads(false);
      setLoadingCustomers(false);
    }
  };

  const validateEmail = async (email) => {
    if (!email) return;
    try {
      const existing = await base44.entities.Customer.filter({ email });
      setEmailError(existing.length > 0 ? 'Email already registered' : '');
    } catch (error) {
      console.error('Email validation error:', error);
    }
  };

  const showAlert = (message) => {
    setAlertMessage(message);
    setAlertOpen(true);
  };

  const handleStorageShortcut = () => {
    if (!wizardData.sourceId) {
      showAlert('Please select a lead or customer first');
      return;
    }
    updateWizardData('intent', 'storage_transport');
    setStep(6);
  };

  const handleNext = async () => {
    if (wizardData.source === 'lead' && !wizardData.sourceId) {
      showAlert('Please select a lead');
      return;
    }
    if (wizardData.source === 'customer' && !wizardData.sourceId) {
      showAlert('Please select a customer');
      return;
    }
    if (wizardData.source === 'new') {
      const { first_name, last_name, email, phone } = wizardData.sourceData.newContact;
      if (!first_name || !last_name || !email || !phone) {
        showAlert('All fields are required');
        return;
      }
      if (emailError) {
        showAlert(emailError);
        return;
      }
      // Create customer immediately and store in wizard context
      setIsSaving(true);
      try {
        const newCustomer = await base44.entities.Customer.create({
          first_name,
          last_name,
          email,
          phone,
          status: 'Active',
          preferred_language: 'German'
        });
        updateWizardData('sourceId', newCustomer.id);
        updateWizardData('sourceData.customer', newCustomer);
        updateWizardData('source', 'customer');
      } catch (err) {
        showAlert(err.message || 'Failed to create customer. Please try again.');
        setIsSaving(false);
        return;
      }
      setIsSaving(false);
    }
    setStep(3);
  };

  if (wizardData.source === 'lead') {
    return (
      <div className="space-y-6">
        <WizardAlert open={alertOpen} onOpenChange={setAlertOpen} message={alertMessage} />
        <Card>
          <CardHeader>
            <CardTitle>Select Lead</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <SearchSelect
              placeholder="Search leads by name or phone..."
              items={leads}
              onSelect={(id) => {
                updateWizardData('sourceId', id);
                const lead = leads.find(l => l.id === id);
                updateWizardData('sourceData.lead', lead);
              }}
              displayFn={(item) => `${item.name} (${item.phone})`}
              searchFn={(item, query) =>
                item.name?.toLowerCase().includes(query.toLowerCase()) ||
                item.phone?.includes(query)
              }
              isLoading={loadingLeads}
              selectedValue={wizardData.sourceId}
            />

            {wizardData.sourceData.lead && (
              <div className="p-4 bg-slate-50 rounded border">
                <p className="text-sm font-medium">Lead Details</p>
                <p className="text-sm text-slate-600 mt-2">{wizardData.sourceData.lead.name}</p>
                <p className="text-sm text-slate-600">{wizardData.sourceData.lead.phone}</p>
                {wizardData.sourceData.lead.email && (
                  <p className="text-sm text-slate-600">{wizardData.sourceData.lead.email}</p>
                )}
                {wizardData.sourceData.lead.boat_name && (
                  <p className="text-sm text-slate-600 mt-2">Boat: {wizardData.sourceData.lead.boat_name}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {wizardData.sourceId && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-emerald-800">🏗️ Trockenmarina-Angebot erstellen?</p>
              <p className="text-xs text-emerald-600">Direkt zum Konfigurator — ohne Boot & Standort</p>
            </div>
            <Button onClick={handleStorageShortcut} className="bg-emerald-600 hover:bg-emerald-700 text-sm shrink-0 ml-3">
              Storage Offer →
            </Button>
          </div>
        )}

        <div className="flex justify-between gap-2">
          <Button variant="outline" onClick={() => setStep(1)}>
            ← Back
          </Button>
          <Button onClick={handleNext} className="bg-blue-600 hover:bg-blue-700">
            Weiter (andere Angebote) →
          </Button>
        </div>
      </div>
    );
  }

  if (wizardData.source === 'customer') {
    return (
      <div className="space-y-6">
        <WizardAlert open={alertOpen} onOpenChange={setAlertOpen} message={alertMessage} />
        <Card>
          <CardHeader>
            <CardTitle>Select Customer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <SearchSelect
              placeholder="Search customers by name or email..."
              items={customers}
              onSelect={(id) => {
                updateWizardData('sourceId', id);
                const customer = customers.find(c => c.id === id);
                updateWizardData('sourceData.customer', customer);
              }}
              displayFn={(item) => `${item.company_name || `${item.first_name} ${item.last_name}`} (${item.email})`}
              searchFn={(item, query) => {
                const name = item.company_name || `${item.first_name} ${item.last_name}`;
                return name.toLowerCase().includes(query.toLowerCase()) ||
                       item.email?.toLowerCase().includes(query.toLowerCase());
              }}
              isLoading={loadingCustomers}
              selectedValue={wizardData.sourceId}
            />

            {wizardData.sourceData.customer && (
              <div className="p-4 bg-slate-50 rounded border">
                <p className="text-sm font-medium">Customer Details</p>
                <p className="text-sm text-slate-600 mt-2">
                  {wizardData.sourceData.customer.company_name || 
                   `${wizardData.sourceData.customer.first_name} ${wizardData.sourceData.customer.last_name}`}
                </p>
                <p className="text-sm text-slate-600">{wizardData.sourceData.customer.email}</p>
                {wizardData.sourceData.customer.phone && (
                  <p className="text-sm text-slate-600">{wizardData.sourceData.customer.phone}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {wizardData.sourceId && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-emerald-800">🏗️ Trockenmarina-Angebot erstellen?</p>
              <p className="text-xs text-emerald-600">Direkt zum Konfigurator — ohne Boot & Standort</p>
            </div>
            <Button onClick={handleStorageShortcut} className="bg-emerald-600 hover:bg-emerald-700 text-sm shrink-0 ml-3">
              Storage Offer →
            </Button>
          </div>
        )}

        <div className="flex justify-between gap-2">
          <Button variant="outline" onClick={() => setStep(1)}>
            ← Back
          </Button>
          <Button onClick={handleNext} className="bg-blue-600 hover:bg-blue-700">
            Weiter (andere Angebote) →
          </Button>
        </div>
      </div>
    );
  }

  // source === 'new'
  return (
    <div className="space-y-6">
      <WizardAlert open={alertOpen} onOpenChange={setAlertOpen} message={alertMessage} />
      <Card>
        <CardHeader>
          <CardTitle>Add New Contact</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>First Name *</Label>
            <Input
              value={wizardData.sourceData.newContact.first_name}
              onChange={(e) => updateWizardData('sourceData.newContact.first_name', e.target.value)}
              placeholder="John"
            />
          </div>

          <div>
            <Label>Last Name *</Label>
            <Input
              value={wizardData.sourceData.newContact.last_name}
              onChange={(e) => updateWizardData('sourceData.newContact.last_name', e.target.value)}
              placeholder="Doe"
            />
          </div>

          <div>
            <Label>Email *</Label>
            <Input
              value={wizardData.sourceData.newContact.email}
              onChange={(e) => {
                updateWizardData('sourceData.newContact.email', e.target.value);
                validateEmail(e.target.value);
              }}
              type="email"
              placeholder="john@example.com"
              className={emailError ? 'border-red-500' : ''}
            />
            {emailError && <p className="text-sm text-red-600 mt-1">{emailError}</p>}
          </div>

          <div>
            <Label>Phone *</Label>
            <Input
              value={wizardData.sourceData.newContact.phone}
              onChange={(e) => updateWizardData('sourceData.newContact.phone', e.target.value)}
              placeholder="+1234567890"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between gap-2">
        <Button variant="outline" onClick={() => setStep(1)}>
          ← Back
        </Button>
        <Button onClick={handleNext} disabled={isSaving} className="bg-blue-600 hover:bg-blue-700">
          {isSaving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</> : 'Next →'}
        </Button>
      </div>
    </div>
  );
}