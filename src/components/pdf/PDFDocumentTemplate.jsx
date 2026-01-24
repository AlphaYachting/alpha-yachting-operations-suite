import React from 'react';
import { format } from 'date-fns';

export default function PDFDocumentTemplate({ document, lineItems, template, payments = [] }) {
  const isInvoice = document.document_type === 'Invoice';
  const currency = document.currency === 'EUR' ? '€' : document.currency;

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
      padding: '40px',
      maxWidth: '210mm',
      margin: '0 auto',
      backgroundColor: 'white',
      color: '#000',
      fontSize: '10pt'
    }}>
      {/* Header */}
      <div style={{ marginBottom: '30px', borderBottom: `3px solid ${template.primary_color || '#2563eb'}`, paddingBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            {template.logo_url && (
              <img src={template.logo_url} alt="Logo" style={{ maxHeight: '60px', marginBottom: '10px' }} />
            )}
            <h1 style={{ margin: 0, color: template.primary_color || '#2563eb', fontSize: '24pt' }}>
              {template.company_name || 'Alpha Yachting'}
            </h1>
            <div style={{ fontSize: '9pt', color: '#666', marginTop: '5px' }}>
              {template.company_address && <div>{template.company_address}</div>}
              {template.company_vat && <div>VAT: {template.company_vat}</div>}
              {template.company_registration && <div>Reg: {template.company_registration}</div>}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '9pt', color: '#666' }}>
              {template.contact_phone && <div>Tel: {template.contact_phone}</div>}
              {template.contact_email && <div>{template.contact_email}</div>}
              {template.contact_website && <div>{template.contact_website}</div>}
            </div>
          </div>
        </div>
      </div>

      {/* Document Title & Number */}
      <div style={{ marginBottom: '30px' }}>
        <h2 style={{ 
          margin: 0, 
          fontSize: '20pt', 
          color: template.primary_color || '#2563eb',
          textTransform: 'uppercase',
          letterSpacing: '1px'
        }}>
          {isInvoice ? 'INVOICE' : 'OFFER'}
        </h2>
        <div style={{ fontSize: '11pt', marginTop: '8px', fontWeight: 'bold' }}>
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
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '30px' }}>
        <div style={{ width: '48%' }}>
          <div style={{ fontSize: '9pt', color: '#666', marginBottom: '5px', fontWeight: 'bold' }}>BILL TO:</div>
          <div style={{ fontSize: '10pt' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '3px' }}>{document.customer_name}</div>
            {document.customer_address && (
              <div style={{ whiteSpace: 'pre-line', color: '#333' }}>{document.customer_address}</div>
            )}
            {document.customer_vat && (
              <div style={{ marginTop: '5px', color: '#666' }}>VAT: {document.customer_vat}</div>
            )}
          </div>
        </div>
        <div style={{ width: '48%' }}>
          <table style={{ width: '100%', fontSize: '9pt', borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td style={{ padding: '4px 0', color: '#666', fontWeight: 'bold' }}>Issue Date:</td>
                <td style={{ padding: '4px 0', textAlign: 'right' }}>
                  {document.issue_date ? format(new Date(document.issue_date), 'dd.MM.yyyy') : '-'}
                </td>
              </tr>
              {isInvoice && document.due_date && (
                <tr>
                  <td style={{ padding: '4px 0', color: '#666', fontWeight: 'bold' }}>Due Date:</td>
                  <td style={{ padding: '4px 0', textAlign: 'right' }}>
                    {format(new Date(document.due_date), 'dd.MM.yyyy')}
                  </td>
                </tr>
              )}
              {!isInvoice && document.valid_until && (
                <tr>
                  <td style={{ padding: '4px 0', color: '#666', fontWeight: 'bold' }}>Valid Until:</td>
                  <td style={{ padding: '4px 0', textAlign: 'right' }}>
                    {format(new Date(document.valid_until), 'dd.MM.yyyy')}
                  </td>
                </tr>
              )}
              {document.payment_terms && (
                <tr>
                  <td style={{ padding: '4px 0', color: '#666', fontWeight: 'bold' }}>Payment Terms:</td>
                  <td style={{ padding: '4px 0', textAlign: 'right' }}>{document.payment_terms}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Boat & Location Info */}
      {(document.boat_name || document.location_name) && (
        <div style={{ marginBottom: '20px', padding: '10px', backgroundColor: '#f8fafc', borderRadius: '4px' }}>
          <div style={{ fontSize: '9pt' }}>
            {document.boat_name && (
              <div><span style={{ fontWeight: 'bold' }}>Vessel:</span> {document.boat_name}</div>
            )}
            {document.boat_details && (
              <div style={{ color: '#666', fontSize: '8pt', marginTop: '2px' }}>{document.boat_details}</div>
            )}
            {document.location_name && (
              <div style={{ marginTop: '5px' }}><span style={{ fontWeight: 'bold' }}>Location:</span> {document.location_name}</div>
            )}
          </div>
        </div>
      )}

      {/* Line Items Table */}
      <table style={{ 
        width: '100%', 
        borderCollapse: 'collapse', 
        marginBottom: '20px',
        fontSize: '9pt'
      }}>
        <thead>
          <tr style={{ 
            backgroundColor: template.primary_color || '#2563eb', 
            color: 'white',
            textAlign: 'left'
          }}>
            <th style={{ padding: '8px 4px', width: '5%' }}>#</th>
            <th style={{ padding: '8px 4px', width: '35%' }}>Description</th>
            <th style={{ padding: '8px 4px', width: '10%', textAlign: 'right' }}>Qty</th>
            <th style={{ padding: '8px 4px', width: '8%' }}>Unit</th>
            <th style={{ padding: '8px 4px', width: '12%', textAlign: 'right' }}>Unit Price</th>
            {template.show_vat_column && (
              <th style={{ padding: '8px 4px', width: '8%', textAlign: 'right' }}>VAT %</th>
            )}
            <th style={{ padding: '8px 4px', width: '15%', textAlign: 'right' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {lineItems.map((item, index) => (
            <tr key={index} style={{ borderBottom: '1px solid #e2e8f0' }}>
              <td style={{ padding: '8px 4px', color: '#666' }}>{index + 1}</td>
              <td style={{ padding: '8px 4px' }}>
                <div style={{ fontWeight: 'bold' }}>{item.title}</div>
                {item.description && (
                  <div style={{ fontSize: '8pt', color: '#666', marginTop: '2px', whiteSpace: 'pre-line' }}>
                    {item.description}
                  </div>
                )}
              </td>
              <td style={{ padding: '8px 4px', textAlign: 'right' }}>{item.quantity || 0}</td>
              <td style={{ padding: '8px 4px' }}>{item.unit || '-'}</td>
              <td style={{ padding: '8px 4px', textAlign: 'right' }}>
                {currency}{(item.unit_price || 0).toFixed(2)}
              </td>
              {template.show_vat_column && (
                <td style={{ padding: '8px 4px', textAlign: 'right' }}>{item.tax_rate || 0}%</td>
              )}
              <td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 'bold' }}>
                {currency}{(item.total_gross || 0).toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals Section */}
      <div style={{ marginLeft: 'auto', width: '50%', marginBottom: '30px' }}>
        <table style={{ width: '100%', fontSize: '10pt' }}>
          <tbody>
            <tr>
              <td style={{ padding: '6px 0', textAlign: 'right', paddingRight: '20px' }}>Subtotal (Net):</td>
              <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 'bold' }}>
                {currency}{(document.subtotal || 0).toFixed(2)}
              </td>
            </tr>
            {Object.entries(taxBreakdown).map(([rate, amount]) => (
              <tr key={rate}>
                <td style={{ padding: '6px 0', textAlign: 'right', paddingRight: '20px', color: '#666' }}>
                  VAT {rate}%:
                </td>
                <td style={{ padding: '6px 0', textAlign: 'right', color: '#666' }}>
                  {currency}{amount.toFixed(2)}
                </td>
              </tr>
            ))}
            <tr style={{ 
              borderTop: '2px solid #000', 
              fontSize: '12pt',
              fontWeight: 'bold'
            }}>
              <td style={{ padding: '10px 0', textAlign: 'right', paddingRight: '20px' }}>
                Total (Gross):
              </td>
              <td style={{ padding: '10px 0', textAlign: 'right' }}>
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
        <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f8fafc', borderRadius: '4px' }}>
          <div style={{ fontSize: '9pt', fontWeight: 'bold', marginBottom: '5px' }}>Notes:</div>
          <div style={{ fontSize: '9pt', whiteSpace: 'pre-line' }}>{document.public_notes}</div>
        </div>
      )}

      {/* Payment Info (for invoices) */}
      {isInvoice && template.bank_iban && (
        <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#eff6ff', borderRadius: '4px', border: '1px solid #dbeafe' }}>
          <div style={{ fontSize: '9pt', fontWeight: 'bold', marginBottom: '8px' }}>Payment Information:</div>
          <div style={{ fontSize: '9pt' }}>
            {template.bank_name && <div><strong>Bank:</strong> {template.bank_name}</div>}
            <div><strong>IBAN:</strong> {template.bank_iban}</div>
            {template.bank_bic && <div><strong>BIC:</strong> {template.bank_bic}</div>}
            <div style={{ marginTop: '5px', color: '#666' }}>
              Payment reference: {document.document_number}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ 
        marginTop: '40px', 
        paddingTop: '20px', 
        borderTop: `2px solid ${template.primary_color || '#2563eb'}`,
        fontSize: '8pt',
        color: '#666',
        textAlign: 'center'
      }}>
        {template.footer_text && (
          <div style={{ marginBottom: '10px' }}>{template.footer_text}</div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div>{template.company_name || 'Alpha Yachting'}</div>
          <div>Generated: {format(new Date(), 'dd.MM.yyyy HH:mm')}</div>
        </div>
      </div>
    </div>
  );
}