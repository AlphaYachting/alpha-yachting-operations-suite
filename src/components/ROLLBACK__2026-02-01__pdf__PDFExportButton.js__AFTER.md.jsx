
import React, { useState, useEffect } from 'react';
import { Button } from '@mui/material'; // Assuming Material-UI or similar
import { jsPDF } from 'jspdf'; // Assuming jspdf for PDF generation

// Assuming a structure for templates
const mockTemplates = [
  { id: 'default', name: 'Default Template', content: (doc, data) => { /* some pdf drawing */ doc.text('Default Content for: ' + (data?.title || 'Untitled'), 10, 10); } },
  { id: 'invoice', name: 'Invoice Template', content: (doc, data) => { /* some pdf drawing */ doc.text('Invoice for ' + (data?.customer || 'N/A'), 10, 20); doc.text('Amount: $' + (data?.amount || '0.00'), 10, 30); } },
  { id: 'report', name: 'Report Template', content: (doc, data) => { /* some pdf drawing */ doc.text('Report Title: ' + (data?.title || 'No Title'), 10, 30); doc.text('Date: ' + new Date().toLocaleDateString(), 10, 40); } },
];

// Line 13 (Modified: Added templateId prop)
function PDFExportButton({ data, filename = 'export.pdf', onExportComplete, templateId }) {
  const [loading, setLoading] = useState(false);
  const [template, setTemplate] = useState(null);
  const [templates, setTemplates] = useState(mockTemplates); // In a real app, this might come from an API or prop, or be passed as a prop

  // Lines 20-32 (Modified: loadTemplate() now checks for templateId)
  const loadTemplate = async () => {
    let selectedTemplate = null;

    if (templateId) {
      // Search for template by ID or name
      selectedTemplate = templates.find(
        (t) => t.id === templateId || t.name === templateId
      );

      if (!selectedTemplate) {
        console.warn(`Template with ID or name "${templateId}" not found. Falling back to default.`);
      }
    }

    // If no specific template was found via templateId, or templateId was not provided,
    // fall back to the first template in the list (which serves as the default)
    if (!selectedTemplate && templates.length > 0) {
      selectedTemplate = templates[0];
    }

    if (selectedTemplate) {
      setTemplate(selectedTemplate);
    } else {
      console.warn("No template available to load. PDF export might not function.");
      setTemplate(null);
    }
  }; // End of loadTemplate function

  useEffect(() => {
    // In a real app, you might fetch templates here, or they might be passed as props.
    // For now, we use mockTemplates directly and trigger loadTemplate when templates or templateId change.
    loadTemplate();
  }, [templates, templateId]); // Added templateId to dependency array

  const handleExport = async () => {
    if (!template) {
      console.error("No template loaded for PDF export. Cannot proceed.");
      return;
    }

    setLoading(true);
    try {
      const doc = new jsPDF();
      // Ensure data is always an object, even if not provided
      template.content(doc, data || {}); // Call the template's content function

      doc.save(filename);
      onExportComplete && onExportComplete(true);
    } catch (error) {
      console.error("Error generating PDF:", error);
      onExportComplete && onExportComplete(false, error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="contained"
      color="primary"
      onClick={handleExport}
      disabled={loading || !template}
    >
      {loading ? 'Exporting...' : 'Export PDF'}
    </Button>
  );
}

export default PDFExportButton;
