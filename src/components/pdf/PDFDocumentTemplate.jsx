import React, { useMemo } from 'react';
import { buildPDFHTML } from './pdfTemplateUtils';

export default function PDFDocumentTemplate({ document, lineItems, template, payments = [], offerSections = [] }) {
  // Generate unified HTML template and render as iframe preview
  const htmlContent = useMemo(() => {
    return buildPDFHTML(document, lineItems, template, payments, offerSections);
  }, [document, lineItems, template, payments, offerSections]);

  return (
    <iframe
      srcDoc={htmlContent}
      style={{
        width: '100%',
        height: '100%',
        border: 'none',
        minHeight: '1200px',
        background: 'white'
      }}
      title="PDF Preview"
    />
  );
}