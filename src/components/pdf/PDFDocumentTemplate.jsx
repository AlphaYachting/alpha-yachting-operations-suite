import React from 'react';
import { format } from 'date-fns';

export default function PDFDocumentTemplate({ document, lineItems, template, payments = [] }) {
  const isInvoice = document.document_type === 'Invoice';
  const currency = document.currency === 'EUR' ? '€' : document.currency;

  // Margins
  const margins = { 
    top: template.margin_top_mm || 20, 
    right: template.margin_right_mm || 20, 
    bottom: template.margin_bottom_mm || 20, 
    left: template.margin_left_mm || 20 
  };

  // Watermark configuration
  const useWatermark = template.watermark_enabled;
  const watermarkText = template.watermark_text || 'DRAFT';
  const watermarkOpacity = template.watermark_opacity ?? 0.1;
  const watermarkAngle = template.watermark_angle ?? -45;

  // Table column configuration
  const columnWidths = template.table_column_widths || {
    index: 4,
    description: 38,
    quantity: 8,
    unit: 8,
    unit_price: 13,
    vat: 8,
    total: 13
  };

  const columnAlign = template.table_column_align || {
    index: 'center',
    description: 'left',
    quantity: 'right',
    unit: 'center',
    unit_price: 'right',
    vat: 'right',
    total: 'right'
  };

  // Calculate tax breakdown
  const taxBreakdown = lineItems.reduce((acc, item) => {
    const rate = item.tax_rate || 0;
    if (!acc[rate]) acc[rate] = 0;
    acc[rate] += item.total_tax || 0;
    return acc;
  }, {});

  const outstanding = isInvoice ? (document.total || 0) - (document.paid_amount || 0) : 0;

  // Get typography settings
  const fontFamily = template.font_family || 'Arial';
  const fontSizeBody = template.font_size_body || 11;
  const fontSizeHeading = template.font_size_heading || 18;
  const fontSizeCompanyName = template.font_size_company_name || 20;
  const lineSpacing = template.line_spacing || 1.5;
  const paragraphSpacing = template.paragraph_spacing || 15;

  return (
    <div id="pdf-content" style={{
      fontFamily: `${fontFamily}, sans-serif`,
      width: '100%',
      minHeight: '100%',
      padding: `${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm`,
      margin: '0',
      backgroundColor: 'white',
      color: '#000',
      fontSize: `${fontSizeBody}pt`,
      boxSizing: 'border-box',
      lineHeight: lineSpacing,
      position: 'relative'
    }}>
      {/* Watermark */}
      {useWatermark && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: `translate(-50%, -50%) rotate(${watermarkAngle}deg)`,
          fontSize: '72pt',
          fontWeight: 'bold',
          color: '#ccc',
          opacity: watermarkOpacity,
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          zIndex: 0
        }}>
          {watermarkText}
        </div>
      )}
      {/* Header with Logo */}
      <div style={{ marginBottom: `${paragraphSpacing}pt`, borderBottom: `2px solid ${template.primary_color || '#2563eb'}`, paddingBottom: '15px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            {template.logo_url && (
              <img src={template.logo_url} alt="Logo" style={{ height: `${template.logo_height_mm || 20}mm`, marginBottom: '8px', objectFit: 'contain' }} />
            )}
            <h1 style={{ margin: 0, color: template.primary_color || '#2563eb', fontSize: `${fontSizeCompanyName}pt`, fontWeight: 'bold' }}>
              {template.company_name || 'Alpha Yachting'}
            </h1>
            <div style={{ fontSize: `${fontSizeBody - 2}pt`, color: '#555', marginTop: '4px', lineHeight: lineSpacing }}>
              {template.company_address && <div>{template.company_address}</div>}
              {template.company_vat && <div>VAT: {template.company_vat}</div>}
              {template.company_registration && <div>Reg: {template.company_registration}</div>}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: `${fontSizeBody - 2}pt`, color: '#555', lineHeight: lineSpacing }}>
              {template.contact_phone && <div>Tel: {template.contact_phone}</div>}
              {template.contact_email && <div>{template.contact_email}</div>}
              {template.contact_website && <div>{template.contact_website}</div>}
            </div>
          </div>
        </div>
      </div>

      {/* Document Title & Number */}
      <div style={{ marginBottom: `${paragraphSpacing}pt` }}>
        <h2 style={{ 
          margin: 0, 
          fontSize: `${fontSizeHeading}pt`, 
          color: template.primary_color || '#2563eb',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          fontWeight: 'bold'
        }}>
          {isInvoice ? 'INVOICE' : 'OFFER'}
        </h2>
        <div style={{ fontSize: `${fontSizeBody}pt`, marginTop: '6px', fontWeight: 'bold' }}>
          {document.document_number}
        </div>
        {document.status === 'Draft' && (
          <div style={{ 
            color: '#dc2626', 
            fontSize: '14pt', 
            fontWeight: 'bold',
            marginTop: '10px',
            opacity: 0.3,
            transform: 'rotate(-15deg)',
            position: 'absolute',
            top: '200px',
            left: '50%',
            transform: 'translateX(-50%) rotate(-15deg)',
            fontSize: '48pt'
          }}>
            DRAFT
          </div>
        )}
      </div>

      {/* Customer & Document Info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div style={{ width: '50%' }}>
          <div style={{ fontSize: '8pt', color: '#666', marginBottom: '4px', fontWeight: 'bold' }}>BILL TO:</div>
          <div style={{ fontSize: '10pt', lineHeight: '1.4' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>{document.customer_name}</div>
            {document.customer_address && (
              <div style={{ whiteSpace: 'pre-line', color: '#333', fontSize: '9pt' }}>{document.customer_address}</div>
            )}
            {document.customer_vat && (
              <div style={{ marginTop: '4px', color: '#666', fontSize: '9pt' }}>VAT: {document.customer_vat}</div>
            )}
          </div>
        </div>
        <div style={{ width: '45%' }}>
          <table style={{ width: '100%', fontSize: '9pt', borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td style={{ padding: '3px 0', color: '#666', fontWeight: 'bold' }}>Issue Date:</td>
                <td style={{ padding: '3px 0', textAlign: 'right' }}>
                  {document.issue_date ? format(new Date(document.issue_date), 'dd.MM.yyyy') : '-'}
                </td>
              </tr>
              {isInvoice && document.due_date && (
                <tr>
                  <td style={{ padding: '3px 0', color: '#666', fontWeight: 'bold' }}>Due Date:</td>
                  <td style={{ padding: '3px 0', textAlign: 'right' }}>
                    {format(new Date(document.due_date), 'dd.MM.yyyy')}
                  </td>
                </tr>
              )}
              {!isInvoice && document.valid_until && (
                <tr>
                  <td style={{ padding: '3px 0', color: '#666', fontWeight: 'bold' }}>Valid Until:</td>
                  <td style={{ padding: '3px 0', textAlign: 'right' }}>
                    {format(new Date(document.valid_until), 'dd.MM.yyyy')}
                  </td>
                </tr>
              )}
              {document.payment_terms && (
                <tr>
                  <td style={{ padding: '3px 0', color: '#666', fontWeight: 'bold' }}>Payment Terms:</td>
                  <td style={{ padding: '3px 0', textAlign: 'right' }}>{document.payment_terms}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Boat & Location Info */}
      {(document.boat_name || document.location_name) && (
        <div style={{ marginBottom: '15px', padding: '8px 10px', backgroundColor: '#f8fafc', borderRadius: '3px' }}>
          <div style={{ fontSize: '9pt', lineHeight: '1.3' }}>
            {document.boat_name && (
              <div><span style={{ fontWeight: 'bold' }}>Vessel:</span> {document.boat_name}</div>
            )}
            {document.boat_details && (
              <div style={{ color: '#666', fontSize: '8pt', marginTop: '1px' }}>{document.boat_details}</div>
            )}
            {document.location_name && (
              <div style={{ marginTop: '3px' }}><span style={{ fontWeight: 'bold' }}>Location:</span> {document.location_name}</div>
            )}
          </div>
        </div>
      )}

      {/* Line Items Table */}
      <table style={{ 
       width: '100%', 
       borderCollapse: 'collapse', 
       marginBottom: '15px',
       fontSize: '9pt',
       pageBreakInside: 'avoid'
      }}>
       <thead>
         <tr style={{ 
           backgroundColor: template.primary_color || '#2563eb', 
           color: 'white',
           textAlign: 'left'
         }}>
           <th style={{ padding: '6px 4px', width: `${columnWidths.index}%`, fontSize: '9pt', textAlign: columnAlign.index }}>#</th>
           <th style={{ padding: '6px 4px', width: `${columnWidths.description}%`, fontSize: '9pt', textAlign: columnAlign.description }}>Description</th>
           <th style={{ padding: '6px 4px', width: `${columnWidths.quantity}%`, fontSize: '9pt', textAlign: columnAlign.quantity }}>Qty</th>
           <th style={{ padding: '6px 4px', width: `${columnWidths.unit}%`, fontSize: '9pt', textAlign: columnAlign.unit }}>Unit</th>
           <th style={{ padding: '6px 4px', width: `${columnWidths.unit_price}%`, fontSize: '9pt', textAlign: columnAlign.unit_price }}>Unit Price</th>
           {template.show_vat_column && (
             <th style={{ padding: '6px 4px', width: `${columnWidths.vat}%`, fontSize: '9pt', textAlign: columnAlign.vat }}>VAT %</th>
           )}
           <th style={{ padding: '6px 4px', width: `${columnWidths.total}%`, fontSize: '9pt', textAlign: columnAlign.total }}>Total</th>
         </tr>
       </thead>
       <tbody>
         {lineItems.map((item, index) => (
           <tr key={index} style={{ borderBottom: '1px solid #e2e8f0', pageBreakInside: 'avoid' }}>
             <td style={{ padding: '6px 4px', color: '#666', fontSize: '9pt', textAlign: columnAlign.index }}>{index + 1}</td>
             <td style={{ padding: '6px 4px', textAlign: columnAlign.description }}>
               <div style={{ fontWeight: 'bold', fontSize: '9pt' }}>{item.title}</div>
               {item.description && (
                 <div style={{ fontSize: '8pt', color: '#666', marginTop: '1px', whiteSpace: 'pre-line', lineHeight: '1.2' }}>
                   {item.description}
                 </div>
               )}
             </td>
             <td style={{ padding: '6px 4px', textAlign: columnAlign.quantity, fontSize: '9pt' }}>{item.quantity || 0}</td>
             <td style={{ padding: '6px 4px', fontSize: '9pt', textAlign: columnAlign.unit }}>{item.unit || '-'}</td>
             <td style={{ padding: '6px 4px', textAlign: columnAlign.unit_price, fontSize: '9pt' }}>
               {currency}{(item.unit_price || 0).toFixed(2)}
             </td>
             {template.show_vat_column && (
               <td style={{ padding: '6px 4px', textAlign: columnAlign.vat, fontSize: '9pt' }}>{item.tax_rate || 0}%</td>
             )}
             <td style={{ padding: '6px 4px', textAlign: columnAlign.total, fontWeight: 'bold', fontSize: '9pt' }}>
               {currency}{(item.total_gross || 0).toFixed(2)}
             </td>
           </tr>
         ))}
       </tbody>
      </table>

      {/* Totals Section */}
      <div style={{ 
        marginLeft: 'auto', 
        width: '45%', 
        marginBottom: '20px',
        pageBreakBefore: template.page_break_rules?.break_before_totals ? 'always' : 'auto',
        pageBreakInside: 'avoid'
      }}>
        <table style={{ width: '100%', fontSize: '10pt' }}>
          <tbody>
            <tr>
              <td style={{ padding: '5px 0', textAlign: 'right', paddingRight: '15px' }}>Subtotal (Net):</td>
              <td style={{ padding: '5px 0', textAlign: 'right', fontWeight: 'bold' }}>
                {currency}{(document.subtotal || 0).toFixed(2)}
              </td>
            </tr>
            {Object.entries(taxBreakdown).map(([rate, amount]) => (
              <tr key={rate}>
                <td style={{ padding: '5px 0', textAlign: 'right', paddingRight: '15px', color: '#666' }}>
                  VAT {rate}%:
                </td>
                <td style={{ padding: '5px 0', textAlign: 'right', color: '#666' }}>
                  {currency}{amount.toFixed(2)}
                </td>
              </tr>
            ))}
            <tr style={{ 
              borderTop: '2px solid #000', 
              fontSize: '11pt',
              fontWeight: 'bold'
            }}>
              <td style={{ padding: '8px 0', textAlign: 'right', paddingRight: '15px' }}>
                Total (Gross):
              </td>
              <td style={{ padding: '8px 0', textAlign: 'right' }}>
                {currency}{(document.total || 0).toFixed(2)}
              </td>
            </tr>
            {isInvoice && document.paid_amount > 0 && (
              <>
                <tr>
                  <td style={{ padding: '6px 0', textAlign: 'right', paddingRight: '20px', color: '#059669' }}>
                    Paid:
                  </td>
                  <td style={{ padding: '6px 0', textAlign: 'right', color: '#059669' }}>
                    -{currency}{document.paid_amount.toFixed(2)}
                  </td>
                </tr>
                <tr style={{ fontWeight: 'bold', fontSize: '11pt' }}>
                  <td style={{ padding: '6px 0', textAlign: 'right', paddingRight: '20px' }}>
                    Outstanding:
                  </td>
                  <td style={{ padding: '6px 0', textAlign: 'right', color: outstanding > 0 ? '#dc2626' : '#059669' }}>
                    {currency}{outstanding.toFixed(2)}
                  </td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* Notes */}
      {document.public_notes && (
        <div style={{ 
          marginBottom: '15px', 
          padding: '10px', 
          backgroundColor: '#f8fafc', 
          borderRadius: '3px',
          pageBreakBefore: template.page_break_rules?.break_before_notes ? 'always' : 'auto',
          pageBreakInside: 'avoid'
        }}>
          <div style={{ fontSize: '8pt', fontWeight: 'bold', marginBottom: '4px' }}>Notes:</div>
          <div style={{ fontSize: '9pt', whiteSpace: 'pre-line', lineHeight: '1.3' }}>{document.public_notes}</div>
        </div>
      )}

      {/* Payment Info (for invoices) */}
      {isInvoice && template.bank_iban && (
        <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#eff6ff', borderRadius: '3px', border: '1px solid #dbeafe' }}>
          <div style={{ fontSize: '8pt', fontWeight: 'bold', marginBottom: '6px' }}>Payment Information:</div>
          <div style={{ fontSize: '9pt', lineHeight: '1.3' }}>
            {template.bank_name && <div><strong>Bank:</strong> {template.bank_name}</div>}
            <div><strong>IBAN:</strong> {template.bank_iban}</div>
            {template.bank_bic && <div><strong>BIC:</strong> {template.bank_bic}</div>}
            <div style={{ marginTop: '4px', color: '#666', fontSize: '8pt' }}>
              Payment reference: {document.document_number}
            </div>
          </div>
        </div>
      )}

      {/* Footer with Graphics */}
      <div style={{ 
        marginTop: `${paragraphSpacing * 2}pt`, 
        paddingTop: '15px', 
        borderTop: `1px solid ${template.primary_color || '#2563eb'}`,
        fontSize: `${fontSizeBody - 3}pt`,
        color: '#666',
        textAlign: 'center',
        lineHeight: lineSpacing
      }}>
        {template.footer_graphic_url && (
          <img src={template.footer_graphic_url} alt="Footer" style={{ maxWidth: '100%', height: `${template.footer_graphic_height_mm || 25}mm`, marginBottom: '12px', objectFit: 'contain' }} />
        )}
        {template.footer_text && (
          <div style={{ marginBottom: '8px' }}>{template.footer_text}</div>
        )}
        {template.custom_footer && (
          <div style={{ marginBottom: '8px', borderTop: '1px solid #ddd', paddingTop: '8px' }}>{template.custom_footer}</div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: `${fontSizeBody - 3}pt` }}>
          <div>{template.company_name || 'Alpha Yachting'}</div>
          <div>Generated: {format(new Date(), 'dd.MM.yyyy HH:mm')}</div>
        </div>
      </div>
    </div>
  );
}