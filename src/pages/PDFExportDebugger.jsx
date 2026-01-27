/**
 * PDF Export Debugger — Isolated Testing & Troubleshooting
 * Admin-only page for testing PDF generation with various configurations
 */

import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Download, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { generateHighQualityPDF } from '@/components/pdf/PDFExportEngine';
import PDFDocumentTemplate from '@/components/pdf/PDFDocumentTemplate';
import { TestInvoices, TestOffers } from '@/components/pdf/PDFTestFixtures';

export default function PDFExportDebugger() {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState([]);
  const [selectedTest, setSelectedTest] = useState('small');
  const [templateOverrides, setTemplateOverrides] = useState({
    enableLetterhead: true,
    enableWatermark: false,
    dpi: 300
  });

  const runTest = async (testKey) => {
    setRunning(true);
    const testData = TestInvoices[testKey];
    
    try {
      // Load template
      const templates = await base44.entities.PDFTemplate.list();
      const template = templates.find(t => t.is_default) || templates[0];

      if (!template) {
        throw new Error('No PDF template found');
      }

      // Override template settings for test
      const testTemplate = {
        ...template,
        letterhead_enabled: templateOverrides.enableLetterhead,
        watermark_enabled: templateOverrides.enableWatermark
      };

      // Create container
      const container = document.createElement('div');
      const root = (await import('react-dom/client')).createRoot(container);

      root.render(
        <PDFDocumentTemplate
          document={testData.data.document}
          lineItems={testData.data.lineItems}
          template={testTemplate}
          isPdfExport={true}
        />
      );

      await new Promise(resolve => setTimeout(resolve, 1500));

      // Generate PDF
      const result = await generateHighQualityPDF({
        containerElement: container,
        templateData: testTemplate,
        documentData: testData.data.document,
        fileName: `${testKey}-${Date.now()}.pdf`
      });

      const testResult = {
        timestamp: new Date().toISOString(),
        testKey,
        testName: testData.name,
        success: true,
        pageCount: result.pageCount,
        diagnostics: result.diagnostics,
        itemCount: testData.data.lineItems.length
      };

      setResults(prev => [testResult, ...prev]);
      root.unmount();

    } catch (error) {
      const testResult = {
        timestamp: new Date().toISOString(),
        testKey,
        testName: testData.name,
        success: false,
        error: error.message
      };
      setResults(prev => [testResult, ...prev]);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">PDF Export Debugger</h1>
        <p className="text-slate-500 mt-1">Test PDF generation with various configurations</p>
      </div>

      {/* Test Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Test Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium">Test Case</label>
              <select
                value={selectedTest}
                onChange={(e) => setSelectedTest(e.target.value)}
                className="w-full mt-2 px-3 py-2 border rounded text-sm"
              >
                <option value="small">Small (10 items, 1 page)</option>
                <option value="large">Large (120 items, 4–6 pages)</option>
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={templateOverrides.enableLetterhead}
                  onChange={(e) => setTemplateOverrides({ ...templateOverrides, enableLetterhead: e.target.checked })}
                />
                <span className="text-sm font-medium">Letterhead</span>
              </label>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={templateOverrides.enableWatermark}
                  onChange={(e) => setTemplateOverrides({ ...templateOverrides, enableWatermark: e.target.checked })}
                />
                <span className="text-sm font-medium">Watermark</span>
              </label>
            </div>
            <div>
              <Button
                onClick={() => runTest(selectedTest)}
                disabled={running}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {running ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Generate & Download
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Test Results */}
      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Test Results ({results.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {results.map((result, idx) => (
              <div key={idx} className="p-4 border rounded-lg space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-slate-900">{result.testName}</p>
                    <p className="text-xs text-slate-500">
                      {new Date(result.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                  <Badge className={result.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                    {result.success ? (
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                    ) : (
                      <AlertCircle className="h-3 w-3 mr-1" />
                    )}
                    {result.success ? 'Pass' : 'Fail'}
                  </Badge>
                </div>

                {result.success && (
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="bg-slate-50 p-2 rounded">
                      <p className="text-xs text-slate-600">Pages</p>
                      <p className="font-semibold text-slate-900">{result.pageCount}</p>
                    </div>
                    <div className="bg-slate-50 p-2 rounded">
                      <p className="text-xs text-slate-600">Items</p>
                      <p className="font-semibold text-slate-900">{result.itemCount}</p>
                    </div>
                    <div className="bg-slate-50 p-2 rounded">
                      <p className="text-xs text-slate-600">Status</p>
                      <p className="font-semibold text-green-600">OK</p>
                    </div>
                  </div>
                )}

                {!result.success && (
                  <div className="bg-red-50 p-2 rounded text-sm text-red-700">
                    {result.error}
                  </div>
                )}

                {result.diagnostics && (
                  <details className="text-xs">
                    <summary className="cursor-pointer font-mono text-slate-600">View Logs ({result.diagnostics.length})</summary>
                    <div className="mt-2 p-2 bg-slate-100 rounded max-h-40 overflow-y-auto font-mono">
                      {result.diagnostics.map((log, i) => (
                        <div key={i} className="text-slate-700 break-all">
                          {log.timestamp.split('T')[1]?.substring(0, 8)} | {log.message}
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}