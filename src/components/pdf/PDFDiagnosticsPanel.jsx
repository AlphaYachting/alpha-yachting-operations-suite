import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckCircle2, Copy, Download, Loader2 } from 'lucide-react';
import { PDFExportDiagnostics, generateHighQualityPDF } from './PDFExportEngine';
import PDFDocumentTemplate from './PDFDocumentTemplate';

export default function PDFDiagnosticsPanel({ adminOnly = true }) {
  const [running, setRunning] = useState(false);
  const [diagnostics, setDiagnostics] = useState(null);
  const [testData, setTestData] = useState({
    invoiceSize: 'small', // small: 10 items, large: 120 items
    withLetterhead: true,
    enableWatermark: false
  });

  const generateTestInvoice = async () => {
    setRunning(true);
    try {
      // Load default template
      const templates = await base44.entities.PDFTemplate.list();
      const template = templates.find(t => t.is_default) || templates[0];
      
      if (!template) {
        throw new Error('No PDF template found');
      }

      // Create test document
      const itemCount = testData.invoiceSize === 'small' ? 10 : 120;
      const lineItems = Array.from({ length: itemCount }, (_, i) => ({
        title: `Service Item ${i + 1}`,
        description: `This is a test service item for diagnostic purposes`,
        quantity: 1,
        unit: 'hrs',
        unit_price: 100 + (i % 50),
        tax_rate: 20,
        total_net: 100 + (i % 50),
        total_tax: (100 + (i % 50)) * 0.2,
        total_gross: (100 + (i % 50)) * 1.2
      }));

      const documentData = {
        document_type: 'Invoice',
        document_number: `TEST-${Date.now()}`,
        status: 'Draft',
        customer_name: 'Test Customer',
        customer_address: 'Test Address, Test City',
        issue_date: new Date().toISOString().split('T')[0],
        due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        subtotal: lineItems.reduce((sum, item) => sum + item.total_net, 0),
        tax_total: lineItems.reduce((sum, item) => sum + item.total_tax, 0),
        total: lineItems.reduce((sum, item) => sum + item.total_gross, 0),
        paid_amount: 0,
        currency: 'EUR'
      };

      // Update template for test
      const testTemplate = {
        ...template,
        letterhead_enabled: testData.withLetterhead,
        watermark_enabled: testData.enableWatermark
      };

      // Create container
      const container = document.createElement('div');
      container.id = 'pdf-export-container';
      const root = (await import('react-dom/client')).createRoot(container);

      root.render(
        <PDFDocumentTemplate
          document={documentData}
          lineItems={lineItems}
          template={testTemplate}
          isPdfExport={true}
        />
      );

      await new Promise(resolve => setTimeout(resolve, 1000));

      // Generate PDF
      const result = await generateHighQualityPDF({
        containerElement: container,
        templateData: testTemplate,
        documentData: documentData,
        fileName: `test-invoice-${testData.invoiceSize}-${Date.now()}.pdf`
      });

      setDiagnostics(result);
      root.unmount();

    } catch (error) {
      setDiagnostics({
        success: false,
        error: error.message,
        diagnostics: PDFExportDiagnostics.getLogs()
      });
    } finally {
      setRunning(false);
    }
  };

  const copyLogs = () => {
    const text = diagnostics.diagnostics
      .map(log => `${log.timestamp} | ${log.message} ${log.data ? JSON.stringify(log.data) : ''}`)
      .join('\n');
    navigator.clipboard.writeText(text);
  };

  return (
    <Card className="border-purple-200 bg-purple-50/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-purple-600" />
          PDF Export Diagnostics (Admin)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium">Invoice Size</label>
            <select
              value={testData.invoiceSize}
              onChange={(e) => setTestData({ ...testData, invoiceSize: e.target.value })}
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
                checked={testData.withLetterhead}
                onChange={(e) => setTestData({ ...testData, withLetterhead: e.target.checked })}
              />
              <span className="text-sm font-medium">With Letterhead</span>
            </label>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={testData.enableWatermark}
                onChange={(e) => setTestData({ ...testData, enableWatermark: e.target.checked })}
              />
              <span className="text-sm font-medium">Watermark</span>
            </label>
          </div>
        </div>

        <Button
          onClick={generateTestInvoice}
          disabled={running}
          className="bg-purple-600 hover:bg-purple-700 w-full"
        >
          {running ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Generating Test PDF...
            </>
          ) : (
            <>
              <Download className="h-4 w-4 mr-2" />
              Generate & Export Test PDF
            </>
          )}
        </Button>

        {diagnostics && (
          <div className="space-y-3">
            {diagnostics.success ? (
              <div className="p-3 bg-green-50 border border-green-200 rounded">
                <div className="flex items-center gap-2 text-green-700">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-medium">Export Successful</span>
                </div>
                <p className="text-sm text-green-600 mt-1">
                  Pages generated: {diagnostics.pageCount}
                </p>
              </div>
            ) : (
              <div className="p-3 bg-red-50 border border-red-200 rounded">
                <div className="flex items-center gap-2 text-red-700">
                  <AlertCircle className="h-5 w-5" />
                  <span className="font-medium">Export Failed</span>
                </div>
                <p className="text-sm text-red-600 mt-1">{diagnostics.error}</p>
              </div>
            )}

            {diagnostics.diagnostics && diagnostics.diagnostics.length > 0 && (
              <div className="p-3 bg-slate-50 border rounded font-mono text-xs max-h-64 overflow-y-auto">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold">Export Logs:</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={copyLogs}
                    className="h-6 px-2"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
                {diagnostics.diagnostics.map((log, idx) => (
                  <div key={idx} className="mb-1 text-slate-700">
                    <span className="text-slate-400">{log.timestamp.split('T')[1].substring(0, 8)}</span>
                    {' '} {log.message}
                    {log.data && <span className="text-slate-500"> {JSON.stringify(log.data)}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}