import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, ArrowRight } from 'lucide-react';

export default function ConfigStep({ config, onConfigChange, onNext, onBack, isProcessing }) {
  const [existingJobs, setExistingJobs] = React.useState([]);

  React.useEffect(() => {
    const loadJobs = async () => {
      const { base44 } = await import('@/api/base44Client');
      const jobs = await base44.entities.Job.list();
      setExistingJobs(jobs);
    };
    loadJobs();
  }, []);

  // Add WorkOrder Date field if not in config
  React.useEffect(() => {
    if (!config.workOrderDateMode) {
      onConfigChange({
        ...config,
        workOrderDateMode: 'column', // 'column', 'single', or 'priority-based'
        workOrderBaseDate: null
      });
    }
  }, []);

  const updateConfig = (key, value) => {
    onConfigChange({ ...config, [key]: value });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 4: Configure Import Settings</CardTitle>
        <CardDescription>
          Set default values and import behavior
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Import Mode */}
        <div className="border rounded-lg p-4 space-y-4 bg-blue-50">
          <Label className="text-base font-semibold">Import Mode</Label>
          
          <Select
            value={config.importMode}
            onValueChange={(value) => updateConfig('importMode', value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="grouped-jobs">Create Jobs + Tasks (grouped by project/boat)</SelectItem>
              <SelectItem value="single-job">Attach all Tasks to One Main Job</SelectItem>
            </SelectContent>
          </Select>

          {config.importMode === 'single-job' && (
            <div className="space-y-4 mt-4">
              <div>
                <Label>Parent Job</Label>
                <Select
                  value={config.parentJobId || 'new'}
                  onValueChange={(value) => updateConfig('parentJobId', value === 'new' ? null : value)}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">➕ Create New Job</SelectItem>
                    {existingJobs.map(job => (
                      <SelectItem key={job.id} value={job.id}>
                        {job.title} ({job.job_number || job.id.slice(0, 8)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {!config.parentJobId && (
                <div>
                  <Label>New Job Title</Label>
                  <Input
                    value={config.newJobTitle}
                    onChange={(e) => updateConfig('newJobTitle', e.target.value)}
                    className="mt-2"
                    placeholder="e.g., Winter Service"
                  />
                  <p className="text-xs text-gray-600 mt-1">
                    All imported rows will become tasks under this main job
                  </p>
                </div>
              )}
            </div>
          )}

          <p className="text-xs text-gray-600">
            {config.importMode === 'single-job' 
              ? '📌 All Excel rows will be imported as Tasks under one main Job. Customer/Boat info stored in task details.'
              : '📌 Creates separate Jobs grouped by Project/Customer/Boat/Location/Service/Module.'}
          </p>
        </div>

        {/* Job Status */}
        <div>
          <Label>Default Job Status</Label>
          <Input
            value={config.jobStatus}
            onChange={(e) => updateConfig('jobStatus', e.target.value)}
            className="mt-2"
            placeholder="e.g., Imported – Review Required"
          />
          <p className="text-xs text-gray-500 mt-1">
            Jobs will be created with this status for review before scheduling
          </p>
        </div>

        {/* Task Status */}
        <div>
          <Label>Default Task Status</Label>
          <Input
            value={config.taskStatus}
            onChange={(e) => updateConfig('taskStatus', e.target.value)}
            className="mt-2"
            placeholder="e.g., Draft"
          />
          <p className="text-xs text-gray-500 mt-1">
            Work orders will be created with this status
          </p>
        </div>

        {/* Work Order Scheduled Date */}
        <div className="border rounded-lg p-4 space-y-3">
          <Label>Work Order Scheduled Date</Label>
          <p className="text-xs text-gray-600">
            Set the scheduled date for all created work orders
          </p>
          <Input
            type="date"
            value={config.workOrderScheduledDate || ''}
            onChange={(e) => updateConfig('workOrderScheduledDate', e.target.value)}
            required
          />
        </div>

        {/* Dry Run Mode */}
        <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
          <div>
            <Label>Dry Run Mode</Label>
            <p className="text-xs text-gray-600 mt-1">
              Validate without creating records (recommended for first import)
            </p>
          </div>
          <Switch
            checked={config.dryRunOnly}
            onCheckedChange={(checked) => updateConfig('dryRunOnly', checked)}
          />
        </div>

        <div className="flex justify-between mt-6">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <Button onClick={onNext} disabled={isProcessing}>
            {isProcessing ? 'Validating...' : 'Next: Validate'}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}