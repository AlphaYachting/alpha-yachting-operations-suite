import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useWizard } from './WizardContext';
import { SearchSelect } from './SearchSelect';
import { WizardAlert } from './WizardAlert';
import { base44 } from '@/api/base44Client';

export function Step3VesselSelection() {
  const { wizardData, updateWizardData, setStep } = useWizard();
  const [boats, setBoats] = useState([]);
  const [loadingBoats, setLoadingBoats] = useState(false);
  const [vesselTab, setVesselTab] = useState(wizardData.vessel?.existing ? 'existing' : 'new');
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');

  useEffect(() => {
    loadBoats();
  }, []);

  const loadBoats = async () => {
    try {
      const customerId = wizardData.sourceData?.customer?.id || 
                        wizardData.sourceData?.lead?.converted_customer_id;
      if (!customerId) return;

      setLoadingBoats(true);
      const data = await base44.entities.Boat.filter({ customer_id: customerId });
      setBoats(data);
      
      // Auto-select first boat if available and none selected yet
      if (data.length > 0 && !wizardData.vessel?.existing) {
        updateWizardData('vessel.existing', data[0].id);
        setVesselTab('existing');
      }
    } catch (error) {
      console.error('Error loading boats:', error);
    } finally {
      setLoadingBoats(false);
    }
  };

  const showAlert = (message) => {
    setAlertMessage(message);
    setAlertOpen(true);
  };

  const handleNext = () => {
    if (wizardData.intent === 'boat_only') {
      if (!wizardData.vessel?.new?.vessel_name) {
        showAlert('Boat name is required');
        return;
      }
    } else {
      if (!wizardData.vessel?.existing && !wizardData.vessel?.new?.vessel_name) {
        showAlert('Please select or create a vessel');
        return;
      }
    }
    setStep(4);
  };

  return (
    <div className="space-y-6">
      <WizardAlert open={alertOpen} onOpenChange={setAlertOpen} message={alertMessage} />
      <Card>
        <CardHeader>
          <CardTitle>Select or Create Vessel</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={vesselTab} onValueChange={setVesselTab}>
            <TabsList>
              {boats.length > 0 && <TabsTrigger value="existing">Existing Boats</TabsTrigger>}
              <TabsTrigger value="new">Create New Boat</TabsTrigger>
            </TabsList>

            {boats.length > 0 ? (
              <TabsContent value="existing" className="space-y-4">
                <SearchSelect
                  placeholder="Search boats..."
                  items={boats}
                  onSelect={(id) => {
                    updateWizardData('vessel.existing', id);
                    updateWizardData('vessel.new', null);
                  }}
                  displayFn={(item) => item.vessel_name}
                  searchFn={(item, query) => item.vessel_name?.toLowerCase().includes(query.toLowerCase())}
                  isLoading={loadingBoats}
                  selectedValue={wizardData.vessel?.existing}
                />
              </TabsContent>
            ) : !loadingBoats && (wizardData.sourceData?.customer || wizardData.sourceData?.lead?.converted_customer_id) ? (
              <TabsContent value="existing" className="space-y-4">
                <div className="p-4 bg-amber-50 border border-amber-200 rounded">
                  <p className="text-sm text-amber-800">
                    No boat assigned yet. Please create a new boat below.
                  </p>
                </div>
              </TabsContent>
            ) : null}

            <TabsContent value="new" className="space-y-4">
              <div>
                <Label>Vessel Name *</Label>
                <Input
                  value={wizardData.vessel?.new?.vessel_name || ''}
                  onChange={(e) => updateWizardData('vessel.new.vessel_name', e.target.value)}
                  placeholder="e.g., Serenity, Blue Moon"
                />
              </div>

              <div>
                <Label>Vessel Type</Label>
                <Select
                  value={wizardData.vessel?.new?.vessel_type || 'Sailboat'}
                  onValueChange={(value) => updateWizardData('vessel.new.vessel_type', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Sailboat">Sailboat</SelectItem>
                    <SelectItem value="Motorboat">Motorboat</SelectItem>
                    <SelectItem value="Yacht">Yacht</SelectItem>
                    <SelectItem value="Catamaran">Catamaran</SelectItem>
                    <SelectItem value="RIB">RIB</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Manufacturer</Label>
                <Input
                  value={wizardData.vessel?.new?.manufacturer || ''}
                  onChange={(e) => updateWizardData('vessel.new.manufacturer', e.target.value)}
                  placeholder="e.g., Jeanneau"
                />
              </div>

              <div>
                <Label>Model</Label>
                <Input
                  value={wizardData.vessel?.new?.model || ''}
                  onChange={(e) => updateWizardData('vessel.new.model', e.target.value)}
                  placeholder="e.g., Sun Odyssey 42"
                />
              </div>

              <div>
                <Label>Year</Label>
                <Input
                  type="number"
                  value={wizardData.vessel?.new?.year || ''}
                  onChange={(e) => updateWizardData('vessel.new.year', e.target.value ? parseInt(e.target.value) : null)}
                  placeholder="e.g., 2015"
                />
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <div className="flex justify-between gap-2">
        <Button variant="outline" onClick={() => setStep(2)}>
          ← Back
        </Button>
        <Button onClick={handleNext} className="bg-blue-600 hover:bg-blue-700">
          Next →
        </Button>
      </div>
    </div>
  );
}