import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, ArrowRight } from 'lucide-react';

export default function ConfigStep({ config, onConfigChange, onNext, onBack, isProcessing }) {
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

        {/* Due Date Configuration */}
        <div className="border rounded-lg p-4 space-y-4">
          <Label>Due Date Assignment</Label>
          
          <Select
            value={config.dueDateMode}
            onValueChange={(value) => updateConfig('dueDateMode', value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="single">Single Default Date</SelectItem>
              <SelectItem value="priority-based">Priority-Based Offsets</SelectItem>
              <SelectItem value="column">From Excel Column (if exists)</SelectItem>
            </SelectContent>
          </Select>

          {config.dueDateMode === 'single' && (
            <div>
              <Label className="text-sm">Default Due Date</Label>
              <Input
                type="date"
                value={config.baseDueDate || ''}
                onChange={(e) => updateConfig('baseDueDate', e.target.value)}
                className="mt-2"
              />
            </div>
          )}

          {config.dueDateMode === 'priority-based' && (
            <div className="space-y-3">
              <div>
                <Label className="text-sm">Base Due Date</Label>
                <Input
                  type="date"
                  value={config.baseDueDate || ''}
                  onChange={(e) => updateConfig('baseDueDate', e.target.value)}
                  className="mt-2"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">High Priority</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      type="number"
                      value={config.priorityOffsets.High}
                      onChange={(e) => updateConfig('priorityOffsets', {
                        ...config.priorityOffsets,
                        High: parseInt(e.target.value)
                      })}
                      className="w-20"
                    />
                    <span className="text-xs text-gray-500">days</span>
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Medium Priority</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      type="number"
                      value={config.priorityOffsets.Medium}
                      onChange={(e) => updateConfig('priorityOffsets', {
                        ...config.priorityOffsets,
                        Medium: parseInt(e.target.value)
                      })}
                      className="w-20"
                    />
                    <span className="text-xs text-gray-500">days</span>
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Low Priority</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      type="number"
                      value={config.priorityOffsets.Low}
                      onChange={(e) => updateConfig('priorityOffsets', {
                        ...config.priorityOffsets,
                        Low: parseInt(e.target.value)
                      })}
                      className="w-20"
                    />
                    <span className="text-xs text-gray-500">days</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {config.dueDateMode === 'column' && (
            <p className="text-xs text-gray-600">
              System will read due dates from the "Due Date" column in your Excel file
            </p>
          )}
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