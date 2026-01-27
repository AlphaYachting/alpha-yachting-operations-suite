import React from 'react';
import { format } from 'date-fns';

export default function PDFDocumentTemplate({ document, lineItems, template, payments = [] }) {
  const isInvoice = document.document_type === 'Invoice';
  const currency = document.currency === 'EUR' ? '€' : document.currency;
  const useLetterhead = template.letterhead_enabled && template.letterhead_image_url;

  // Calculate tax breakdown
  const taxBreakdown = lineItems.reduce((acc, item) => {
    const rate = item.tax_rate || 0;
    if (!acc[rate]) acc[rate] = 0;
    acc[rate] += item.total_tax || 0;
    return acc;
  }, {});

  const outstanding = isInvoice ? (document.total || 0) - (document.paid_amount || 0) : 0;

  return (
    <div id="pdf-content" style={{
      fontFamily: 'Arial, sans-serif',
      width: '100%',
      minHeight: '100%',
      padding: '0',
      margin: '0',
      backgroundColor: useLetterhead ? 'transparent' : 'white',
      color: '#000',
      fontSize: '11pt',
      boxSizing: 'border-box',
      lineHeight: '1.5'
    }}>
      {/* Header - Only show if letterhead is disabled */}
      {!useLetterhead && (
        <div style={{ marginBottom: '25px', borderBottom: `2px solid ${template.primary_color || '#2563eb'}`, paddingBottom: '15px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              {template.logo_url && (
                <img src={template.logo_url} alt="Logo" style={{ maxHeight: '50px', marginBottom: '8px' }} />
              )}
              <h1 style={{ margin: 0, color: template.primary_color || '#2563eb', fontSize: '20pt', fontWeight: 'bold' }}>
                {template.company_name || 'Alpha Yachting'}
              </h1>
              <div style={{ fontSize: '9pt', color: '#555', marginTop: '4px', lineHeight: '1.3' }}>
                {template.company_address && <div>{template.company_address}</div>}
                {template.company_vat && <div>VAT: {template.company_vat}</div>}
                {template.company_registration && <div>Reg: {template.company_registration}</div>}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '9pt', color: '#555', lineHeight: '1.3' }}>
                {template.contact_phone && <div>Tel: {template.contact_phone}</div>}
                {template.contact_email && <div>{template.contact_email}</div>}
                {template.contact_website && <div>{template.contact_website}</div>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Document Title & Number */}
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ 
          margin: 0, 
          fontSize: '18pt', 
          color: template.primary_color || '#2563eb',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          fontWeight: 'bold'
        }}>
          {isInvoice ? 'INVOICE' : 'OFFER'}
        </h2>
        <div style={{ fontSize: '11pt', marginTop: '6px', fontWeight: 'bold' }}>
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
        fontSize: '9pt'
      }}>
        <thead>
          <tr style={{ 
            backgroundColor: template.primary_color || '#2563eb', 
            color: 'white',
            textAlign: 'left'
          }}>
            <th style={{ padding: '6px 4px', width: '4%', fontSize: '9pt' }}>#</th>
            <th style={{ padding: '6px 4px', width: '38%', fontSize: '9pt' }}>Description</th>
            <th style={{ padding: '6px 4px', width: '8%', textAlign: 'right', fontSize: '9pt' }}>Qty</th>
            <th style={{ padding: '6px 4px', width: '8%', fontSize: '9pt' }}>Unit</th>
            <th style={{ padding: '6px 4px', width: '13%', textAlign: 'right', fontSize: '9pt' }}>Unit Price</th>
            {template.show_vat_column && (
              <th style={{ padding: '6px 4px', width: '8%', textAlign: 'right', fontSize: '9pt' }}>VAT %</th>
            )}
            <th style={{ padding: '6px 4px', width: '13%', textAlign: 'right', fontSize: '9pt' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {lineItems.map((item, index) => (
            <tr key={index} style={{ borderBottom: '1px solid #e2e8f0' }}>
              <td style={{ padding: '6px 4px', color: '#666', fontSize: '9pt' }}>{index + 1}</td>
              <td style={{ padding: '6px 4px' }}>
                <div style={{ fontWeight: 'bold', fontSize: '9pt' }}>{item.title}</div>
                {item.description && (
                  <div style={{ fontSize: '8pt', color: '#666', marginTop: '1px', whiteSpace: 'pre-line', lineHeight: '1.2' }}>
                    {item.description}
                  </div>
                )}
              </td>
              <td style={{ padding: '6px 4px', textAlign: 'right', fontSize: '9pt' }}>{item.quantity || 0}</td>
              <td style={{ padding: '6px 4px', fontSize: '9pt' }}>{item.unit || '-'}</td>
              <td style={{ padding: '6px 4px', textAlign: 'right', fontSize: '9pt' }}>
                {currency}{(item.unit_price || 0).toFixed(2)}
              </td>
              {template.show_vat_column && (
                <td style={{ padding: '6px 4px', textAlign: 'right', fontSize: '9pt' }}>{item.tax_rate || 0}%</td>
              )}
              <td style={{ padding: '6px 4px', textAlign: 'right', fontWeight: 'bold', fontSize: '9pt' }}>
                {currency}{(item.total_gross || 0).toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals Section */}
      <div style={{ marginLeft: 'auto', width: '45%', marginBottom: '20px' }}>
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
        <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#f8fafc', borderRadius: '3px' }}>
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

      {/* Footer - Only show if letterhead is disabled */}
      {!useLetterhead && (
        <div style={{ 
          marginTop: '30px', 
          paddingTop: '15px', 
          borderTop: `1px solid ${template.primary_color || '#2563eb'}`,
          fontSize: '8pt',
          color: '#666',
          textAlign: 'center',
          lineHeight: '1.3'
        }}>
          {template.footer_text && (
            <div style={{ marginBottom: '8px' }}>{template.footer_text}</div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>{template.company_name || 'Alpha Yachting'}</div>
            <div>Generated: {format(new Date(), 'dd.MM.yyyy HH:mm')}</div>
          </div>
        </div>
      )}
    </div>
  );
}