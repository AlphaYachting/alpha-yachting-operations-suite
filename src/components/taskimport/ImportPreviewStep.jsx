import React, { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, AlertTriangle } from 'lucide-react';

export default function ImportPreviewStep({ data, mapping, config, onBack, onNext, isProcessing }) {
  const preview = useMemo(() => {
    if (!data || !mapping || !config) {
      return { jobs: [], issues: ['No data provided'] };
    }

    const issues = [];
    const jobsMap = {};
    const workOrdersMap = {};

    // Find service area column
    const serviceAreaEntry = Object.entries(mapping).find(([_, v]) => v === 'serviceArea' || v === 'service_category');
    const serviceAreaCol = serviceAreaEntry?.[0];
    const customerCol = Object.entries(mapping).find(([_, v]) => v === 'customerName')?.[0];
    const titleCol = Object.entries(mapping).find(([_, v]) => v === 'taskTitle')?.[0];

    console.log('[PREVIEW] Mapping analysis:', {
      serviceAreaCol,
      customerCol,
      titleCol,
      importMode: config.importMode,
      allMappings: Object.entries(mapping)
    });

    data.forEach((row, rowIdx) => {
      const customerName = row[customerCol];
      const taskTitle = row[titleCol];
      const serviceArea = serviceAreaCol ? row[serviceAreaCol] : 'Uncategorized';

      console.log(`[PREVIEW] Row ${rowIdx + 1}:`, {
        customerName,
        serviceArea,
        taskTitle,
        serviceAreaValue: row[serviceAreaCol],
        serviceAreaColName: serviceAreaCol
      });

      if (!customerName) {
        issues.push(`Row ${rowIdx + 1}: Missing customer name`);
        return;
      }

      if (!taskTitle) {
        issues.push(`Row ${rowIdx + 1}: Missing task title`);
        return;
      }

      let jobKey;
      if (config.importMode === 'work-orders-by-service-area') {
        jobKey = `${customerName}_${serviceArea || 'Uncategorized'}`;
      } else {
        jobKey = customerName;
      }

      if (!jobsMap[jobKey]) {
        jobsMap[jobKey] = {
          customerName,
          serviceArea: config.importMode === 'work-orders-by-service-area' ? (serviceArea || 'Uncategorized') : null,
          tasks: [],
          workOrders: new Set()
        };
      }

      jobsMap[jobKey].tasks.push({
        title: taskTitle,
        row: rowIdx + 2
      });

      // For service area mode, group work orders by service area too
      if (config.importMode === 'work-orders-by-service-area') {
        const woKey = `${customerName}_${serviceArea || 'Uncategorized'}`;
        jobsMap[jobKey].workOrders.add(woKey);
      }
    });

    const jobs = Object.entries(jobsMap).map(([key, job]) => ({
      key,
      ...job,
      workOrderCount: job.workOrders.size || 1
    }));

    return { jobs, issues };
  }, [data, mapping, config]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 6: Import Preview</CardTitle>
        <CardDescription>
          Review how your data will be imported before execution
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Import Mode Info */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="font-semibold text-blue-900 mb-2">Import Configuration:</div>
          <div className="text-sm text-blue-800 space-y-1">
            <div><strong>Mode:</strong> {config?.importMode === 'work-orders-by-service-area' ? 'Create Work Orders by Service Area' : 'Create Work Orders per Customer'}</div>
            <div><strong>Total Rows:</strong> {data?.length || 0}</div>
            <div><strong>Jobs to Create:</strong> {preview.jobs.length}</div>
          </div>
        </div>

        {/* Issues */}
        {preview.issues.length > 0 && (
          <Alert className="bg-red-50 border-red-200">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <AlertDescription className="text-red-800">
              <div className="font-semibold mb-2">Data Issues Found:</div>
              <ul className="space-y-1">
                {preview.issues.map((issue, idx) => (
                  <li key={idx} className="text-sm">• {issue}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Jobs Preview */}
        <div>
          <h3 className="font-semibold text-sm text-gray-900 mb-3">
            Jobs to be Created ({preview.jobs.length})
          </h3>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {preview.jobs.length === 0 ? (
              <p className="text-sm text-gray-500 italic">No jobs will be created</p>
            ) : (
              preview.jobs.map((job, idx) => (
                <div key={idx} className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-semibold text-gray-900">
                        {config.importMode === 'work-orders-by-service-area' 
                          ? `${job.serviceArea} - ${job.customerName}`
                          : job.customerName
                        }
                      </div>
                      {config.importMode === 'work-orders-by-service-area' && (
                        <div className="text-xs text-gray-500 mt-1">
                          Service Area: <Badge variant="outline">{job.serviceArea}</Badge>
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <Badge>{job.tasks.length} tasks</Badge>
                      {job.workOrderCount > 1 && (
                        <div className="text-xs text-gray-500 mt-1">{job.workOrderCount} work orders</div>
                      )}
                    </div>
                  </div>
                  
                  {/* Task Preview */}
                  <div className="mt-3 space-y-1 text-sm max-h-32 overflow-y-auto">
                    {job.tasks.slice(0, 5).map((task, taskIdx) => (
                      <div key={taskIdx} className="text-gray-600 text-xs flex justify-between">
                        <span>• {task.title}</span>
                        <span className="text-gray-400">Row {task.row}</span>
                      </div>
                    ))}
                    {job.tasks.length > 5 && (
                      <div className="text-gray-500 text-xs italic">
                        ...and {job.tasks.length - 5} more tasks
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Debug Info */}
        <details className="text-xs border border-gray-200 rounded p-2">
          <summary className="cursor-pointer font-semibold text-gray-600">Debug Info</summary>
          <div className="mt-2 p-2 bg-gray-50 rounded font-mono text-gray-700 whitespace-pre-wrap break-words overflow-auto max-h-48">
            {JSON.stringify(
              {
                importMode: config.importMode,
                jobsCount: preview.jobs.length,
                totalTasks: preview.jobs.reduce((sum, j) => sum + j.tasks.length, 0),
                jobs: preview.jobs.map(j => ({
                  key: j.key,
                  customer: j.customerName,
                  serviceArea: j.serviceArea,
                  taskCount: j.tasks.length
                }))
              },
              null,
              2
            )}
          </div>
        </details>

        <div className="flex justify-between mt-6">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Validation
          </Button>
          <Button 
            onClick={onNext} 
            disabled={preview.issues.length > 0 || preview.jobs.length === 0 || isProcessing}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Continue to Import
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}