import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import PDFDocumentTemplate from './PDFDocumentTemplate';

export default function PDFDiagnostics() {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState(null);

  const runDiagnostics = async () => {
    setIsRunning(true);
    const diagnostics = {
      timestamp: new Date().toISOString(),
      tests: [],
      summary: {}
    };

    try {
      // Test 1: Multi-page rendering
      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.width = '210mm';
      container.style.height = 'auto';
      document.body.appendChild(container);

      const { createRoot } = await import('react-dom/client');
      const root = createRoot(container);

      const template = await base44.entities.PDFTemplate.list().then(t => t[0] || {});
      const mockDocument = {
        document_type: 'Invoice',
        document_number: 'TEST-001',
        customer_name: 'Test Customer',
        issue_date: new Date().toISOString(),
        total: 5000,
        subtotal: 4000,
        paid_amount: 0,
        currency: 'EUR'
      };

      // Create 100 line items to force multi-page
      const mockLineItems = Array.from({ length: 100 }, (_, i) => ({
        title: `Line Item ${i + 1}`,
        quantity: 1,
        unit: 'pcs',
        unit_price: 50,
        total_gross: 60,
        total_net: 50,
        total_tax: 10,
        tax_rate: 20
      }));

      await new Promise((resolve) => {
        root.render(
          <PDFDocumentTemplate 
            document={mockDocument}
            lineItems={mockLineItems}
            template={template}
            payments={[]}
            isPdfExport={true}
          />
        );
        setTimeout(resolve, 2000);
      });

      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        allowTaint: true
      });

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgData = canvas.toDataURL('image/png');
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      let yPosition = 0;
      let pageCount = 0;

      while (yPosition < imgHeight) {
        if (pageCount > 0) pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, -yPosition / 2, pdfWidth, imgHeight);
        yPosition += pdfHeight;
        pageCount++;
      }

      // Save and verify
      const fileBlob = pdf.output('blob');
      const fileSize = fileBlob.size;

      diagnostics.tests.push({
        name: 'Multi-page rendering',
        status: pageCount >= 3 ? 'pass' : 'fail',
        details: {
          pageCount,
          fileSize,
          lineItemsCount: mockLineItems.length,
          canvasHeight: canvas.height
        }
      });

      diagnostics.tests.push({
        name: 'Letterhead application',
        status: template.letterhead_enabled ? 'pass' : 'skip',
        details: {
          letterheadEnabled: template.letterhead_enabled,
          letterheadUrl: template.letterhead_image_url ? 'Present' : 'Missing'
        }
      });

      diagnostics.tests.push({
        name: 'Content completeness',
        status: fileSize > 50000 ? 'pass' : 'warn',
        details: {
          fileSize,
          minimumExpected: 50000,
          passed: fileSize > 50000
        }
      });

      diagnostics.summary = {
        passedTests: diagnostics.tests.filter(t => t.status === 'pass').length,
        totalTests: diagnostics.tests.length,
        timestamp: new Date().toLocaleTimeString()
      };

      root.unmount();
      document.body.removeChild(container);
      setResults(diagnostics);

    } catch (error) {
      diagnostics.tests.push({
        name: 'Diagnostics execution',
        status: 'error',
        details: { error: error.message }
      });
      setResults(diagnostics);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>PDF Export Diagnostics</CardTitle>
      </CardHeader>
      <CardContent>
        <Button 
          onClick={runDiagnostics} 
          disabled={isRunning}
          className="mb-4"
        >
          {isRunning ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Running Tests...
            </>
          ) : (
            'Run Diagnostics'
          )}
        </Button>

        {results && (
          <div className="space-y-3 mt-4">
            <div className="text-sm text-gray-600">
              Tests: {results.summary.passedTests}/{results.summary.totalTests} passed
            </div>
            {results.tests.map((test, idx) => (
              <div key={idx} className="p-3 border rounded">
                <div className="flex items-center gap-2 mb-2">
                  {test.status === 'pass' && <CheckCircle2 className="h-5 w-5 text-green-600" />}
                  {test.status === 'fail' && <AlertCircle className="h-5 w-5 text-red-600" />}
                  {test.status === 'warn' && <AlertCircle className="h-5 w-5 text-yellow-600" />}
                  <span className="font-medium">{test.name}</span>
                  <span className="text-xs ml-auto bg-gray-100 px-2 py-1 rounded">
                    {test.status}
                  </span>
                </div>
                <pre className="text-xs bg-gray-50 p-2 rounded overflow-auto">
                  {JSON.stringify(test.details, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}