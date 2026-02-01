import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function ImportStep({ parsedData = [], fieldMapping = {}, config = {}, onComplete, onBack }) {
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState(null);
  const [error, setError] = useState(null);

  const handleImport = async () => {
    if (!parsedData || parsedData.length === 0) {
      setError('No data to import');
      return;
    }

    setIsImporting(true);
    setError(null);

    try {
      // Call the import function
      const response = await base44.functions.invoke('importTasks', {
        data: parsedData,
        mapping: fieldMapping,
        config: config
      });

      setImportStatus({
        success: true,
        message: 'Import completed successfully',
        results: response.data
      });

      onComplete(response.data);
    } catch (err) {
      setError(err.message || 'Import failed');
      setImportStatus({
        success: false,
        message: err.message || 'Import failed',
        error: err
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 6: Execute Import</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="bg-blue-50 p-4 rounded-lg">
          <h4 className="font-semibold text-blue-900 mb-2">Ready to import</h4>
          <div className="text-sm text-blue-800 space-y-1">
            <div>📋 Rows to import: <strong>{parsedData?.length || 0}</strong></div>
            <div>🗂️ Fields mapped: <strong>{Object.keys(fieldMapping || {}).length}</strong></div>
            <div>⚙️ Import mode: <strong>{config?.importMode || 'grouped-jobs'}</strong></div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 p-4 rounded-lg border border-red-200">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-semibold text-red-900">Import Error</h4>
                <p className="text-sm text-red-800 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {importStatus?.success && (
          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-semibold text-green-900">Import Successful</h4>
                <p className="text-sm text-green-800 mt-1">
                  {importStatus.message}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-between">
          <Button variant="outline" onClick={onBack} disabled={isImporting}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <Button onClick={handleImport} disabled={isImporting || !parsedData?.length}>
            {isImporting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Execute Import
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}