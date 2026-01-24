import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Eye, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import PDFDocumentTemplate from './PDFDocumentTemplate';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function PDFExportButton({ document, lineItems, payments = [], variant = "outline" }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [template, setTemplate] = useState(null);

  const loadTemplate = async () => {
    try {
      const templates = await base44.entities.PDFTemplate.list();
      const defaultTemplate = templates.find(t => t.is_default) || templates[0];
      
      if (!defaultTemplate) {
        // Create default template if none exists
        const newTemplate = await base44.entities.PDFTemplate.create({
          company_name: 'Alpha Yachting',
          company_address: 'Novigrad, Croatia',
          primary_color: '#2563eb',
          secondary_color: '#06b6d4',
          show_vat_column: true,
          show_net_gross: true,
          is_default: true
        });
        return newTemplate;
      }
      
      return defaultTemplate;
    } catch (error) {
      console.error('Error loading template:', error);
      // Return default fallback
      return {
        company_name: 'Alpha Yachting',
        primary_color: '#2563eb',
        show_vat_column: true
      };
    }
  };

  const generatePDF = () => {
    // Use browser's print to PDF functionality
    window.print();
  };

  const handlePreview = async () => {
    const templateData = await loadTemplate();
    setTemplate(templateData);
    setShowPreview(true);
  };

  return (
    <>
      <div className="flex gap-2">
        <Button 
          variant={variant}
          onClick={handlePreview}
          disabled={isGenerating}
        >
          <Eye className="h-4 w-4 mr-2" />
          Preview PDF
        </Button>
        <Button 
          variant={variant}
          onClick={generatePDF}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Download className="h-4 w-4 mr-2" />
              Export PDF
            </>
          )}
        </Button>
      </div>

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>PDF Preview</DialogTitle>
          </DialogHeader>
          {template && (
            <div className="bg-slate-100 p-4">
              <PDFDocumentTemplate 
                document={document} 
                lineItems={lineItems}
                template={template}
                payments={payments}
              />
            </div>
          )}
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              Close
            </Button>
            <Button onClick={() => { setShowPreview(false); generatePDF(); }}>
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}