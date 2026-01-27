import React, { useMemo } from 'react';
import { buildPDFHTML } from './pdfTemplateUtils.js';

export default function PDFDocumentTemplate({ document, lineItems, template, payments = [] }) {
  // Generate unified HTML template and render as iframe preview
  const htmlContent = useMemo(() => {
    return buildPDFHTML(document, lineItems, template, payments);
  }, [document, lineItems, template, payments]);

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