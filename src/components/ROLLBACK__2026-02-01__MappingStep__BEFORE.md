# BEFORE SNAPSHOT: MappingStep.jsx

Date: 2026-02-01
Issue: Auto-mapping logic missing entirely. Component only shows manual selection with 0 auto-suggestions.

```jsx
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react';

const TARGET_FIELDS = [
  { value: 'projectName', label: 'Project Name', required: false },
  { value: 'customerType', label: 'Customer Type', required: false },
  { value: 'customerName', label: 'Customer Name', required: true },
  { value: 'boatModel', label: 'Boat Type / Yacht Model', required: false },
  { value: 'boatLength', label: 'Boat Length (m)', required: false },
  { value: 'locationMarina', label: 'Location / Marina', required: false },
  { value: 'serviceArea', label: 'Service Area', required: false },
  { value: 'module', label: 'Subproject / Module', required: false },
  { value: 'taskId', label: 'Task ID', required: false },
  { value: 'taskTitle', label: 'Task Title', required: true },
  { value: 'taskDescription', label: 'Task Description', required: false },
  { value: 'category', label: 'Category', required: false },
  { value: 'requiredQualification', label: 'Required Qualification', required: false },
  { value: 'estimatedHours', label: 'Time Required (hrs)', required: false },
  { value: 'materialRequired', label: 'Material Required', required: false },
  { value: 'materialDescription', label: 'Material Description', required: false },
  { value: 'dependencies', label: 'Dependencies', required: false },
  { value: 'priority', label: 'Priority', required: false },
  { value: 'workLocation', label: 'Work Location', required: false },
  { value: 'riskNotes', label: 'Risk / Special Notes', required: false },
  { value: 'acceptanceRequired', label: 'Acceptance Required', required: false },
  { value: 'acceptanceBy', label: 'Acceptance By', required: false },
  { value: 'billingType', label: 'Billing Type', required: false },
  { value: 'assumptionUncertainty', label: 'Assumption / Uncertainty', required: false },
  { value: 'assignedPerson', label: 'Assigned Person', required: false },
  { value: 'dueDate', label: 'Due Date', required: false }
];

export default function MappingStep({ headers = [], mapping = {}, onMappingChange, onNext, onBack }) {
  const handleMappingChange = (header, targetField) => {
    const newMapping = { ...mapping };
    Object.keys(newMapping).forEach(key => {
      if (newMapping[key] === targetField) delete newMapping[key];
    });
    if (targetField) {
      newMapping[header] = targetField;
    }
    onMappingChange(newMapping);
  };

  const getMappedCount = () => {
    return Object.values(mapping || {}).filter(Boolean).length;
  };

  const getRequiredMapped = () => {
    const required = TARGET_FIELDS.filter(f => f.required).map(f => f.value);
    const mapped = Object.values(mapping || {});
    return required.filter(r => mapped.includes(r)).length;
  };

  const requiredFields = TARGET_FIELDS.filter(f => f.required);
  const allRequiredMapped = getRequiredMapped() === requiredFields.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 3: Map Columns</CardTitle>
        <CardDescription>
          Map your Excel columns to system fields. {getMappedCount()} of {headers.length} columns mapped.
          {!allRequiredMapped && (
            <span className="text-red-600 font-medium ml-2">
              ⚠ Required fields not all mapped
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {(headers || []).map((header, idx) => (
            <div key={idx} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <div className="font-medium text-sm">{header}</div>
              </div>
              <div className="flex-1">
                <Select
                  value={mapping[header] || ''}
                  onValueChange={(value) => handleMappingChange(header, value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select target field..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>-- Do not import --</SelectItem>
                    {TARGET_FIELDS.map(field => (
                      <SelectItem key={field.value} value={field.value}>
                        {field.label} {field.required && <span className="text-red-600">*</span>}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {mapping[header] && (
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 p-4 bg-amber-50 rounded-lg">
          <h4 className="font-semibold text-sm text-amber-900 mb-2">Required Fields:</h4>
          <div className="text-xs text-amber-800 space-y-1">
            {requiredFields.map(field => {
              const isMapped = Object.values(mapping).includes(field.value);
              return (
                <div key={field.value} className="flex items-center gap-2">
                  {isMapped ? (
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-amber-600" />
                  )}
                  {field.label}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex justify-between mt-6">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <Button onClick={onNext} disabled={!allRequiredMapped}>
            Next: Configure Import
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

**ISSUE IDENTIFIED:** No auto-mapping logic. Manual selection only.