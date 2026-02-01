import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, CheckCircle2, XCircle, AlertTriangle, Upload } from 'lucide-react';

export default function ValidationStep({ results, onExecute, onBack, isProcessing, dryRunMode, fieldMapping, parsedData }) {
  const [showDiagnostics, setShowDiagnostics] = React.useState(false);
  
  // Find Service Area column from mapping
  const serviceAreaEntry = Object.entries(fieldMapping || {}).find(([_, v]) => v === 'serviceArea');
  const serviceAreaCol = serviceAreaEntry?.[0];
  const uniqueServiceAreas = serviceAreaCol 
    ? [...new Set((parsedData || []).map(row => row[serviceAreaCol]).filter(Boolean))]
    : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 5: Validation Results</CardTitle>
        <CardDescription>
          {results.valid ? 
            'All validation checks passed! Ready to import.' :
            'Validation found issues that must be fixed before import.'
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Stats */}
         <div className="grid grid-cols-2 gap-4">
           <div className="p-4 bg-blue-50 rounded-lg">
             <div className="text-2xl font-bold text-blue-900">{results.workOrderCount}</div>
             <div className="text-sm text-blue-700">Work Orders to be created</div>
           </div>
          <div className="p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-900">{results.taskCount}</div>
            <div className="text-sm text-green-700">Tasks to be created</div>
          </div>
        </div>

        {/* Validation Status */}
        {results.valid ? (
          <Alert className="bg-green-50 border-green-200">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <AlertDescription className="text-green-800">
              <strong>Validation Passed</strong> - No blocking errors found
            </AlertDescription>
          </Alert>
        ) : (
          <Alert className="bg-red-50 border-red-200">
            <XCircle className="w-4 h-4 text-red-600" />
            <AlertDescription className="text-red-800">
              <strong>Validation Failed</strong> - {results.errors.length} error(s) must be fixed
            </AlertDescription>
          </Alert>
        )}

        {/* Errors */}
        {results.errors.length > 0 && (
          <div>
            <h3 className="font-semibold text-sm text-red-900 mb-3 flex items-center gap-2">
              <XCircle className="w-4 h-4" />
              Errors ({results.errors.length})
            </h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {results.errors.map((error, idx) => (
                <div key={idx} className="p-3 bg-red-50 border border-red-200 rounded text-sm">
                  <div className="flex items-start gap-2">
                    <Badge variant="destructive" className="text-xs">Row {error.row}</Badge>
                    <div>
                      <div className="font-medium text-red-900">{error.field}</div>
                      <div className="text-red-700">{error.message}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Warnings */}
        {results.warnings.length > 0 && (
          <div>
            <h3 className="font-semibold text-sm text-amber-900 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Warnings ({results.warnings.length})
            </h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {results.warnings.slice(0, 20).map((warning, idx) => (
                <div key={idx} className="p-3 bg-amber-50 border border-amber-200 rounded text-sm">
                  <div className="flex items-start gap-2">
                    <Badge className="text-xs bg-amber-500">Row {warning.row}</Badge>
                    <div>
                      <div className="font-medium text-amber-900">{warning.field}</div>
                      <div className="text-amber-700">{warning.message}</div>
                    </div>
                  </div>
                </div>
              ))}
              {results.warnings.length > 20 && (
                <p className="text-xs text-amber-600 text-center">
                  ...and {results.warnings.length - 20} more warnings
                </p>
              )}
            </div>
          </div>
        )}

        {/* Service Area Groups Preview - SHOW ALL */}
        <div className="border rounded-lg p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold text-sm text-gray-900">
              Service Areas Detected ({Object.keys((results?.serviceAreaGroups) || {}).length})
            </h3>
            <button 
              onClick={() => setShowDiagnostics(!showDiagnostics)}
              className="text-xs text-blue-600 hover:text-blue-700 underline"
            >
              {showDiagnostics ? 'Hide' : 'Show'} diagnostics
            </button>
          </div>

          {showDiagnostics && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
              <div><strong>Service Area column mapped:</strong> {serviceAreaCol || 'NOT MAPPED'}</div>
              <div><strong>Unique values in Excel:</strong> {uniqueServiceAreas.length}</div>
              <div className="mt-2">
                {uniqueServiceAreas.map((area, i) => (
                  <div key={i} className="text-blue-700">• {area}</div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {Object.entries((results?.serviceAreaGroups) || {}).length === 0 ? (
              <p className="text-sm text-gray-500 italic">No service areas detected</p>
            ) : (
              Object.entries((results?.serviceAreaGroups) || {}).map(([serviceArea, group], idx) => (
                <div 
                  key={idx} 
                  className={`p-3 rounded text-sm border ${
                    serviceArea === 'Uncategorized' 
                      ? 'bg-red-50 border-red-200' 
                      : 'bg-green-50 border-green-200'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div className="font-medium text-gray-900">
                      {serviceArea === 'Uncategorized' ? '⚠️ ' : '✓ '}
                      {serviceArea || 'Uncategorized'}
                    </div>
                    <Badge variant={serviceArea === 'Uncategorized' ? 'destructive' : 'default'}>
                      {group?.rows?.length || 0} tasks
                    </Badge>
                  </div>
                  {serviceArea === 'Uncategorized' && (
                    <p className="text-xs text-red-600 mt-1">Service area not mapped - these tasks will be skipped</p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex justify-between mt-6">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Config
          </Button>
          <div className="flex flex-col items-end gap-2">
            {dryRunMode && (
              <p className="text-xs text-amber-600 font-medium">
                ⚠️ Dry Run Mode enabled - disable in Step 4 to import
              </p>
            )}
            <Button 
              onClick={onExecute} 
              disabled={!results.valid || isProcessing}
              className="bg-green-600 hover:bg-green-700"
            >
              {isProcessing ? 'Importing...' : dryRunMode ? 'Import (Dry Run Enabled)' : 'Execute Import'}
              <Upload className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}