import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useWizard } from './WizardContext';
import { SearchSelect } from './SearchSelect';
import { base44 } from '@/api/base44Client';

export function Step4LocationSelection() {
  const { wizardData, updateWizardData, setStep } = useWizard();
  const [locations, setLocations] = useState([]);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [locationTab, setLocationTab] = useState(
    wizardData.location?.existing ? 'existing' : wizardData.location?.new ? 'new' : 'unknown'
  );

  useEffect(() => {
    loadLocations();
  }, []);

  const loadLocations = async () => {
    try {
      setLoadingLocations(true);
      const data = await base44.entities.Location.list('-created_date', 100);
      setLocations(data);
    } catch (error) {
      console.error('Error loading locations:', error);
    } finally {
      setLoadingLocations(false);
    }
  };

  const handleNext = () => {
    setStep(5);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Select or Create Location</CardTitle>
          <p className="text-sm text-slate-500 mt-2">Location is optional and can be set to "Unknown" to continue</p>
        </CardHeader>
        <CardContent>
          <Tabs value={locationTab} onValueChange={setLocationTab}>
            <TabsList>
              {locations.length > 0 && <TabsTrigger value="existing">Existing Locations</TabsTrigger>}
              <TabsTrigger value="new">Create New Location</TabsTrigger>
              <TabsTrigger value="unknown">Unknown Location</TabsTrigger>
            </TabsList>

            {locations.length > 0 && (
              <TabsContent value="existing" className="space-y-4">
                <SearchSelect
                  placeholder="Search locations..."
                  items={locations}
                  onSelect={(id) => {
                    updateWizardData('location.existing', id);
                    updateWizardData('location.new', null);
                  }}
                  displayFn={(item) => item.name}
                  searchFn={(item, query) => item.name?.toLowerCase().includes(query.toLowerCase())}
                  isLoading={loadingLocations}
                  selectedValue={wizardData.location?.existing}
                />
              </TabsContent>
            )}

            <TabsContent value="new" className="space-y-4">
              <div>
                <Label>Location Name *</Label>
                <Input
                  value={wizardData.location?.new?.name || ''}
                  onChange={(e) => updateWizardData('location.new.name', e.target.value)}
                  placeholder="e.g., Porto Rovinj Marina"
                />
              </div>

              <div>
                <Label>Location Type</Label>
                <Select
                  value={wizardData.location?.new?.location_type || 'Marina'}
                  onValueChange={(value) => updateWizardData('location.new.location_type', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Marina">Marina</SelectItem>
                    <SelectItem value="Dry Marina">Dry Marina</SelectItem>
                    <SelectItem value="Anchorage">Anchorage</SelectItem>
                    <SelectItem value="Yard">Yard</SelectItem>
                    <SelectItem value="Alpha Base">Alpha Base</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Region</Label>
                <Select
                  value={wizardData.location?.new?.region || 'Istria'}
                  onValueChange={(value) => updateWizardData('location.new.region', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Istria">Istria</SelectItem>
                    <SelectItem value="Slovenia">Slovenia</SelectItem>
                    <SelectItem value="North Italy">North Italy</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Address</Label>
                <Input
                  value={wizardData.location?.new?.address || ''}
                  onChange={(e) => updateWizardData('location.new.address', e.target.value)}
                  placeholder="Street address"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>City</Label>
                  <Input
                    value={wizardData.location?.new?.city || ''}
                    onChange={(e) => updateWizardData('location.new.city', e.target.value)}
                    placeholder="City"
                  />
                </div>
                <div>
                  <Label>Country</Label>
                  <Input
                    value={wizardData.location?.new?.country || ''}
                    onChange={(e) => updateWizardData('location.new.country', e.target.value)}
                    placeholder="Country"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="unknown" className="space-y-4">
              <div className="p-4 bg-slate-50 rounded border">
                <p className="text-sm text-slate-600">
                  Location will be marked as "Unknown / To Be Determined" and can be updated later when scheduling work.
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <div className="flex justify-between gap-2">
        <Button variant="outline" onClick={() => setStep(3)}>
          ← Back
        </Button>
        <Button onClick={handleNext} className="bg-blue-600 hover:bg-blue-700">
          Next →
        </Button>
      </div>
    </div>
  );
}