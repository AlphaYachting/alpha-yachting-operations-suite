import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, CheckCircle2, XCircle, AlertTriangle, Download } from 'lucide-react';
import { toast } from 'sonner';

export default function InventoryImport() {
  const [file, setFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [confirming, setConfirming] = useState(false);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setTestResult(null);
    }
  };

  const handleTestImport = async () => {
    if (!file) {
      toast.error('Please select a file');
      return;
    }

    setImporting(true);
    setTestResult(null);
    
    try {
      // Upload file
      toast.info('Datei wird hochgeladen...');
      console.log('[UI] Uploading file...');
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      console.log('[UI] File uploaded:', file_url);

      // Run test import
      toast.info('Datei wird analysiert...');
      console.log('[UI] Calling import function...');
      const result = await base44.functions.invoke('importInventoryItems', { file_url });
      console.log('[UI] Import result:', result);
      
      if (result?.data) {
        console.log('[UI] Setting test result:', result.data);
        setTestResult(result.data);
        toast.success(`Analyse abgeschlossen: ${result.data.summary.importedCount} gültig, ${result.data.summary.rejectedCount} abgelehnt`);
      } else {
        console.error('[UI] No data in result:', result);
        toast.error('Import fehlgeschlagen: Keine Daten zurückgegeben');
      }
    } catch (error) {
      console.error('[UI] Import error:', error);
      console.error('[UI] Error details:', {
        message: error.message,
        response: error.response,
        data: error.response?.data
      });
      toast.error(error?.response?.data?.error || error.message || 'Import fehlgeschlagen');
    } finally {
      setImporting(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!testResult || testResult.importedRows.length === 0) {
      toast.error('No rows to import');
      return;
    }

    setConfirming(true);
    try {
      // Create all items
      await base44.entities.InventoryItem.bulkCreate(testResult.importedRows);
      
      toast.success(`Successfully imported ${testResult.importedRows.length} items`);
      setTestResult(null);
      setFile(null);
    } catch (error) {
      console.error('Import error:', error);
      toast.error(error.message || 'Import failed');
    } finally {
      setConfirming(false);
    }
  };

  const downloadRejectedReport = () => {
    if (!testResult || testResult.rejectedRows.length === 0) return;

    const csv = [
      'Row Index,SKU,Reasons',
      ...testResult.rejectedRows.map(r => `${r.rowIndex},"${r.sku}","${r.reasons}"`)
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rejected_rows.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Import Inventory Items</h1>
        <p className="text-slate-600 mt-2">
          Import items from Excel file with strict validation
        </p>
      </div>

      {/* Expected Format */}
      <Card>
        <CardHeader>
          <CardTitle>Expected Excel Format</CardTitle>
          <CardDescription>
            Your Excel file must have these exact column names:
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="font-medium mb-2">Required Columns:</div>
              <ul className="space-y-1 text-slate-600">
                <li>• SKU</li>
                <li>• Item name (EN)</li>
                <li>• Group</li>
                <li>• Unit (as in source)</li>
                <li>• Stock</li>
                <li>• Unit cost (purchase)</li>
                <li>• Sales price (MPC)</li>
              </ul>
            </div>
            <div>
              <div className="font-medium mb-2">Supported Units:</div>
              <ul className="space-y-1 text-slate-600 text-xs">
                <li>kom, kom., kom/p, kom¸. → Piece</li>
                <li>par, par. → Pair</li>
                <li>lit. → Liter</li>
                <li>met., m/nam → Meter</li>
                <li>set → Set</li>
                <li>pak. → Box</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* File Upload */}
      <Card>
        <CardHeader>
          <CardTitle>Upload Excel File</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="flex-1 text-sm"
            />
            <Button
              onClick={handleTestImport}
              disabled={!file || importing}
              className="gap-2"
            >
              {importing ? (
                <>
                  <span className="animate-spin mr-2">⏳</span>
                  Processing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Test Import
                </>
              )}
            </Button>
          </div>
          {file && (
            <p className="text-sm text-slate-600">
              Selected: {file.name}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Test Results */}
      {testResult && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-slate-900">
                    {testResult.summary.totalRows}
                  </div>
                  <div className="text-sm text-slate-600 mt-1">Total Rows</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">
                    {testResult.summary.importedCount}
                  </div>
                  <div className="text-sm text-slate-600 mt-1">Ready to Import</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-red-600">
                    {testResult.summary.rejectedCount}
                  </div>
                  <div className="text-sm text-slate-600 mt-1">Rejected</div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Rejected Rows */}
          {testResult.rejectedRows.length > 0 && (
            <Card className="border-red-200 bg-red-50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-5 w-5 text-red-600" />
                    <CardTitle className="text-red-900">
                      Rejected Rows ({testResult.rejectedRows.length})
                    </CardTitle>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={downloadRejectedReport}
                    className="gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Download Report
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-white sticky top-0">
                      <tr className="border-b">
                        <th className="text-left py-2 px-3">Row</th>
                        <th className="text-left py-2 px-3">SKU</th>
                        <th className="text-left py-2 px-3">Reasons</th>
                      </tr>
                    </thead>
                    <tbody>
                      {testResult.rejectedRows.map((row, idx) => (
                        <tr key={idx} className="border-b border-red-100">
                          <td className="py-2 px-3">{row.rowIndex}</td>
                          <td className="py-2 px-3 font-mono text-xs">{row.sku}</td>
                          <td className="py-2 px-3 text-red-700">{row.reasons}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Success Message & Confirm */}
          {testResult.summary.importedCount > 0 && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                <div className="flex items-center justify-between">
                  <span>
                    {testResult.summary.importedCount} items passed validation and are ready to import.
                  </span>
                  <Button
                    onClick={handleConfirmImport}
                    disabled={confirming}
                    className="gap-2 bg-green-600 hover:bg-green-700"
                  >
                    {confirming ? 'Importing...' : 'Confirm Import'}
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {testResult.summary.importedCount === 0 && testResult.summary.rejectedCount > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                All rows were rejected. Please fix the issues and try again.
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}
    </div>
  );
}