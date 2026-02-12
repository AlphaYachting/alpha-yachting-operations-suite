import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useWizard } from './WizardContext';
import { SearchSelect } from './SearchSelect';
import { WizardAlert } from './WizardAlert';
import { base44 } from '@/api/base44Client';
import { Briefcase, AlertCircle } from 'lucide-react';

export function Step5bProjectSelection() {
  const { wizardData, updateWizardData, setStep } = useWizard();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');

  useEffect(() => {
    loadCustomerProjects();
  }, []);

  const loadCustomerProjects = async () => {
    try {
      setLoading(true);
      const customerId = wizardData.sourceData?.customer?.id;
      
      if (!customerId) {
        setAlertMessage('No customer selected');
        setAlertOpen(true);
        return;
      }

      const allProjects = await base44.entities.Job.filter({ customer_id: customerId });
      // Filter to active projects only
      const activeProjects = allProjects.filter(p => 
        p.status !== 'Cancelled' && p.status !== 'Invoiced'
      );
      setProjects(activeProjects);
    } catch (error) {
      console.error('Error loading projects:', error);
      setAlertMessage('Failed to load projects');
      setAlertOpen(true);
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    if (!wizardData.existingProjectId) {
      setAlertMessage('Please select a project');
      setAlertOpen(true);
      return;
    }
    setStep(6); // Go to details
  };

  const selectedProject = projects.find(p => p.id === wizardData.existingProjectId);

  return (
    <div className="space-y-6">
      <WizardAlert open={alertOpen} onOpenChange={setAlertOpen} message={alertMessage} />
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-indigo-600" />
            Select Existing Project
          </CardTitle>
          <p className="text-sm text-slate-500 mt-2">
            Choose which project this work order should belong to
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="text-center py-8 text-slate-500">Loading projects...</div>
          ) : projects.length === 0 ? (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-900">No Active Projects Found</p>
                  <p className="text-sm text-amber-700 mt-1">
                    This customer has no active projects. Please create a new project first or select a different intent.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div>
                <Label>Project *</Label>
                <SearchSelect
                  placeholder="Search projects..."
                  items={projects}
                  onSelect={(id) => updateWizardData('existingProjectId', id)}
                  displayFn={(item) => `${item.job_number || 'No Number'} - ${item.title}`}
                  searchFn={(item, query) => 
                    `${item.job_number} ${item.title} ${item.description || ''}`.toLowerCase().includes(query.toLowerCase())
                  }
                  isLoading={loading}
                  selectedValue={wizardData.existingProjectId}
                />
              </div>

              {selectedProject && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="font-medium text-blue-900 mb-2">Selected Project</p>
                  <div className="space-y-1 text-sm">
                    <p><span className="text-blue-700">Number:</span> {selectedProject.job_number || 'N/A'}</p>
                    <p><span className="text-blue-700">Title:</span> {selectedProject.title}</p>
                    <p><span className="text-blue-700">Status:</span> {selectedProject.status}</p>
                    {selectedProject.description && (
                      <p><span className="text-blue-700">Description:</span> {selectedProject.description}</p>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between gap-2">
        <Button variant="outline" onClick={() => setStep(5)}>
          ← Back
        </Button>
        <Button 
          onClick={handleNext} 
          className="bg-blue-600 hover:bg-blue-700"
          disabled={projects.length === 0}
        >
          Next →
        </Button>
      </div>
    </div>
  );
}