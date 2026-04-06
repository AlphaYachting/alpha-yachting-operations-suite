import React, { useState } from 'react';

// Module-level template cache to avoid repeated API calls
let _cachedTemplate = null;
let _cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
import { Button } from '@/components/ui/button';
import { Download, Eye, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { generatePDFWithJsPDF } from './jsPDFGenerator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function PDFExportButton({ document: documentData, lineItems, payments = [], offerSections = [], variant = "outline", templateId = null }) {
  const [showPreview, setShowPreview] = useState(false);
  const [template, setTemplate] = useState(null);
  const [pdfError, setPdfError] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);

  const loadTemplate = async () => {
    // Return cached template if still fresh
    if (_cachedTemplate && (Date.now() - _cacheTimestamp) < CACHE_TTL_MS) {
      return _cachedTemplate;
    }

    // Retry up to 3 times with backoff
    let lastError;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        if (attempt > 0) await new Promise(r => setTimeout(r, attempt * 1000));
        const templates = await base44.entities.PDFTemplate.list();

        let selectedTemplate = null;
        if (templateId) {
          selectedTemplate = templates.find(t => t.id === templateId || t.template_name === templateId);
        }

        const defaultTemplate = selectedTemplate || templates.find(t => t.is_default) || templates[0];

        if (!defaultTemplate) {
          const newTemplate = await base44.entities.PDFTemplate.create({
            company_name: 'Alpha Yachting',
            company_address: 'Novigrad, Croatia',
            primary_color: '#2563eb',
            secondary_color: '#06b6d4',
            show_vat_column: true,
            show_net_gross: true,
            is_default: true,
            render_dpi: 150,
            page_format: 'A4'
          });
          _cachedTemplate = newTemplate;
          _cacheTimestamp = Date.now();
          return newTemplate;
        }

        _cachedTemplate = defaultTemplate;
        _cacheTimestamp = Date.now();
        return defaultTemplate;
      } catch (error) {
        lastError = error;
        console.warn(`Template load attempt ${attempt + 1} failed:`, error.message);
      }
    }
    throw lastError;
  };

  const generateAndDownloadPDF = async () => {
    try {
      if (!documentData?.id) {
        setPdfError('Document ID is missing. Please save the document first.');
        return;
      }
      
      setIsGenerating(true);
      setPdfError(null);
      
      const templateData = await loadTemplate();
      // Ensure payment terms are included in the document data
      const completeDocumentData = {
        ...documentData,
        payment_terms_type: documentData.payment_terms_type || 'Full',
        downpayment_percent: documentData.downpayment_percent || 0,
        downpayment_amount: documentData.downpayment_amount || 0,
        payment_schedule: documentData.payment_schedule || '',
        retention_of_title_enabled: documentData.retention_of_title_enabled !== false,
        retention_of_title_text: documentData.retention_of_title_text || '',
        safety_compliance_clause: documentData.safety_compliance_clause || '',
        show_marina_fees_notice: documentData.show_marina_fees_notice || false
      };
      const pdfDoc = await generatePDFWithJsPDF(completeDocumentData, lineItems, templateData, payments);
      
      // Download the PDF
      const fileName = `${documentData.document_number || 'document'}.pdf`;
      pdfDoc.save(fileName);
      
      setIsGenerating(false);
    } catch (error) {
      console.error('Error generating PDF:', error);
      setPdfError('Failed to generate PDF: ' + error.message);
      setIsGenerating(false);
    }
  };

  const handlePreview = async () => {
    try {
      setPdfError(null);
      setIsGenerating(true);
      
      const templateData = await loadTemplate();
      // Ensure payment terms are included in the document data
      const completeDocumentData = {
        ...documentData,
        payment_terms_type: documentData.payment_terms_type || 'Full',
        downpayment_percent: documentData.downpayment_percent || 0,
        downpayment_amount: documentData.downpayment_amount || 0,
        payment_schedule: documentData.payment_schedule || '',
        retention_of_title_enabled: documentData.retention_of_title_enabled !== false,
        retention_of_title_text: documentData.retention_of_title_text || '',
        safety_compliance_clause: documentData.safety_compliance_clause || '',
        show_marina_fees_notice: documentData.show_marina_fees_notice || false
      };
      const pdfDoc = await generatePDFWithJsPDF(completeDocumentData, lineItems, templateData, payments, offerSections);
      
      // Generate blob URL for preview
      const pdfBlob = pdfDoc.output('blob');
      const url = URL.createObjectURL(pdfBlob);
      
      setPreviewUrl(url);
      setTemplate(templateData);
      setShowPreview(true);
      setIsGenerating(false);
    } catch (error) {
      console.error('Preview error:', error);
      setPdfError('Failed to load preview: ' + error.message);
      setIsGenerating(false);
    }
  };
  
  const handleClosePreview = () => {
    setShowPreview(false);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  };

  return (
    <>
      <div className="flex gap-2">
        <Button 
          variant={variant}
          onClick={handlePreview}
          disabled={isGenerating || !documentData?.id}
        >
          {isGenerating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Eye className="h-4 w-4 mr-2" />}
          Preview PDF
        </Button>
        <Button 
          variant={variant}
          onClick={generateAndDownloadPDF}
          disabled={!documentData?.id || isGenerating}
        >
          {isGenerating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
          Export PDF
        </Button>
      </div>

      {pdfError && (
        <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {pdfError}
        </div>
      )}

      <Dialog open={showPreview} onOpenChange={handleClosePreview}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>PDF Preview</DialogTitle>
          </DialogHeader>
          {previewUrl && (
            <iframe 
              src={previewUrl}
              className="w-full h-[600px] border-0"
              title="PDF Preview"
            />
          )}
          <div className="flex justify-end gap-3 pt-4">
           <Button variant="outline" onClick={handleClosePreview}>
             Close
           </Button>
           <Button onClick={generateAndDownloadPDF} disabled={!documentData?.id || isGenerating}>
             {isGenerating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
             Download PDF
           </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}