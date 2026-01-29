import React from 'react';

export default function PartnerBriefTemplate({ workOrder, teamOrder, job, customer, boat, location, tasks, technicians, template }) {
  const assignedTechs = technicians.filter(t => workOrder.assigned_technicians?.includes(t.id));
  const customerName = customer?.company_name || `${customer?.first_name || ''} ${customer?.last_name || ''}`.trim() || 'Unknown';
  
  const costPolicies = [];
  if (teamOrder.accommodation_paid) {
    costPolicies.push(`Accommodation: up to €${teamOrder.accommodation_max_per_night || 'TBD'}/night`);
  }
  if (teamOrder.meals_per_diem_paid) {
    costPolicies.push(`Per Diem: €${teamOrder.per_diem_rate_per_day || 'TBD'}/day`);
  }
  if (teamOrder.mileage_paid) {
    costPolicies.push(`Mileage: €${teamOrder.mileage_rate_per_km || '0.35'}/km (cap: €${teamOrder.mileage_cap_total || 'TBD'})`);
  }
  if (teamOrder.travel_time_paid) {
    costPolicies.push(`Travel Time: €${teamOrder.travel_time_rate_per_hour || 'TBD'}/hour`);
  }

  return (
    <div id="partner-brief-print" className="print-document-container" style={{ fontFamily: template?.font_family || 'Arial' }}>
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: ${template?.margin_top_mm || 20}mm ${template?.margin_right_mm || 20}mm ${template?.margin_bottom_mm || 20}mm ${template?.margin_left_mm || 20}mm;
          }
          body * { visibility: hidden; }
          #partner-brief-print, #partner-brief-print * { visibility: visible; }
          #partner-brief-print {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        {template?.logo_url && (
          <img src={template.logo_url} alt="Logo" style={{ height: `${template.logo_height_mm || 20}mm` }} />
        )}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: `${template?.font_size_company_name || 20}pt`, fontWeight: 'bold', color: template?.primary_color || '#2563eb' }}>
            {template?.company_name || 'Alpha Yachting'}
          </div>
          {template?.company_address && (
            <div style={{ fontSize: `${template?.font_size_body - 2 || 9}pt`, color: '#555' }}>
              {template.company_address}
            </div>
          )}
        </div>
      </div>

      <h1 style={{ color: template?.primary_color || '#2563eb', fontSize: `${template?.font_size_heading || 18}pt`, borderBottom: `2px solid ${template?.primary_color || '#2563eb'}`, paddingBottom: '6px', marginBottom: '10px' }}>
        PARTNER BRIEFING
      </h1>
      <div style={{ color: '#999', fontSize: '8pt', marginBottom: '15px' }}>
        Generated: {new Date().toLocaleString('de-DE')}
      </div>

      {/* Work Order Information */}
      <h2 style={{ color: template?.primary_color || '#2563eb', fontSize: '12pt', marginTop: '15px', marginBottom: '8px', borderBottom: `1px solid ${template?.primary_color || '#2563eb'}`, paddingBottom: '4px' }}>
        WORK ORDER INFORMATION
      </h2>
      <div style={{ marginBottom: '12px' }}>
        <div style={{ marginBottom: '6px' }}>
          <strong style={{ color: template?.primary_color || '#2563eb', fontSize: '8pt' }}>Work Order #</strong>
          <div style={{ fontSize: `${template?.font_size_body || 11}pt`, marginTop: '2px' }}>
            {workOrder.work_order_number || workOrder.id.slice(-6)}
          </div>
        </div>
        <div style={{ marginBottom: '6px' }}>
          <strong style={{ color: template?.primary_color || '#2563eb', fontSize: '8pt' }}>Title</strong>
          <div style={{ fontSize: `${template?.font_size_body || 11}pt`, marginTop: '2px' }}>
            {workOrder.title}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
          <div>
            <strong style={{ color: template?.primary_color || '#2563eb', fontSize: '8pt' }}>Status</strong>
            <div style={{ fontSize: `${template?.font_size_body || 11}pt`, marginTop: '2px' }}>
              {workOrder.status}
            </div>
          </div>
          <div>
            <strong style={{ color: template?.primary_color || '#2563eb', fontSize: '8pt' }}>Scheduled Date</strong>
            <div style={{ fontSize: `${template?.font_size_body || 11}pt`, marginTop: '2px' }}>
              {workOrder.scheduled_date || 'TBD'}
            </div>
          </div>
        </div>
      </div>

      {/* Customer & Vessel */}
      <h2 style={{ color: template?.primary_color || '#2563eb', fontSize: '12pt', marginTop: '15px', marginBottom: '8px', borderBottom: `1px solid ${template?.primary_color || '#2563eb'}`, paddingBottom: '4px' }}>
        CUSTOMER & VESSEL
      </h2>
      <div style={{ marginBottom: '12px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '10px' }}>
          <div>
            <strong style={{ color: template?.primary_color || '#2563eb', fontSize: '8pt' }}>Customer</strong>
            <div style={{ fontSize: `${template?.font_size_body || 11}pt`, marginTop: '2px' }}>
              {customerName}
            </div>
          </div>
          <div>
            <strong style={{ color: template?.primary_color || '#2563eb', fontSize: '8pt' }}>Vessel</strong>
            <div style={{ fontSize: `${template?.font_size_body || 11}pt`, marginTop: '2px' }}>
              {boat?.vessel_name || 'Unknown'}
            </div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
          <div>
            <strong style={{ color: template?.primary_color || '#2563eb', fontSize: '8pt' }}>Type</strong>
            <div style={{ fontSize: `${template?.font_size_body || 11}pt`, marginTop: '2px' }}>
              {boat?.vessel_type || 'Unknown'}
            </div>
          </div>
          <div>
            <strong style={{ color: template?.primary_color || '#2563eb', fontSize: '8pt' }}>Length</strong>
            <div style={{ fontSize: `${template?.font_size_body || 11}pt`, marginTop: '2px' }}>
              {boat?.length_m ? boat.length_m + 'm' : 'Unknown'}
            </div>
          </div>
        </div>
      </div>

      {/* Location & Access */}
      <h2 style={{ color: template?.primary_color || '#2563eb', fontSize: '12pt', marginTop: '15px', marginBottom: '8px', borderBottom: `1px solid ${template?.primary_color || '#2563eb'}`, paddingBottom: '4px' }}>
        LOCATION & ACCESS
      </h2>
      <div style={{ marginBottom: '12px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '10px' }}>
          <div>
            <strong style={{ color: template?.primary_color || '#2563eb', fontSize: '8pt' }}>Location</strong>
            <div style={{ fontSize: `${template?.font_size_body || 11}pt`, marginTop: '2px' }}>
              {location?.name || 'Unknown'}
            </div>
          </div>
          <div>
            <strong style={{ color: template?.primary_color || '#2563eb', fontSize: '8pt' }}>Address</strong>
            <div style={{ fontSize: `${template?.font_size_body || 11}pt`, marginTop: '2px' }}>
              {location?.address || '-'}
            </div>
          </div>
        </div>
        <div>
          <strong style={{ color: template?.primary_color || '#2563eb', fontSize: '8pt' }}>Access Notes</strong>
          <div style={{ fontSize: `${template?.font_size_body || 11}pt`, marginTop: '2px' }}>
            {location?.access_notes || 'None'}
          </div>
        </div>
      </div>

      {/* Work Description */}
      {workOrder.description && (
        <>
          <h2 style={{ color: template?.primary_color || '#2563eb', fontSize: '12pt', marginTop: '15px', marginBottom: '8px', borderBottom: `1px solid ${template?.primary_color || '#2563eb'}`, paddingBottom: '4px' }}>
            WORK DESCRIPTION
          </h2>
          <div style={{ marginBottom: '12px', whiteSpace: 'pre-wrap', fontSize: `${template?.font_size_body - 1 || 10}pt` }}>
            {workOrder.description}
          </div>
        </>
      )}

      {/* Tasks */}
      {tasks.length > 0 && (
        <>
          <h2 style={{ color: template?.primary_color || '#2563eb', fontSize: '12pt', marginTop: '15px', marginBottom: '8px', borderBottom: `1px solid ${template?.primary_color || '#2563eb'}`, paddingBottom: '4px' }}>
            TASKS & CHECKLIST
          </h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9pt', marginBottom: '12px' }}>
            <thead>
              <tr style={{ backgroundColor: template?.primary_color || '#2563eb', color: 'white' }}>
                <th style={{ padding: '6px', border: '1px solid #ddd', textAlign: 'left' }}>#</th>
                <th style={{ padding: '6px', border: '1px solid #ddd', textAlign: 'left' }}>Task</th>
                <th style={{ padding: '6px', border: '1px solid #ddd', textAlign: 'left' }}>Est. Time</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task, idx) => (
                <tr key={task.id} style={{ backgroundColor: idx % 2 === 0 ? 'white' : '#f9f9f9' }}>
                  <td style={{ padding: '6px', border: '1px solid #ddd' }}>{idx + 1}</td>
                  <td style={{ padding: '6px', border: '1px solid #ddd' }}>{task.title}</td>
                  <td style={{ padding: '6px', border: '1px solid #ddd' }}>
                    {task.estimated_minutes ? Math.round(task.estimated_minutes / 60) + 'h' : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* Budget */}
      <h2 style={{ color: template?.primary_color || '#2563eb', fontSize: '12pt', marginTop: '15px', marginBottom: '8px', borderBottom: `1px solid ${template?.primary_color || '#2563eb'}`, paddingBottom: '4px' }}>
        COST COVERAGE & BUDGET
      </h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9pt', marginBottom: '12px' }}>
        <thead>
          <tr style={{ backgroundColor: template?.primary_color || '#2563eb', color: 'white' }}>
            <th style={{ padding: '6px', border: '1px solid #ddd', textAlign: 'left' }}>Budget Category</th>
            <th style={{ padding: '6px', border: '1px solid #ddd', textAlign: 'left' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr style={{ backgroundColor: 'white' }}>
            <td style={{ padding: '6px', border: '1px solid #ddd' }}>Total Approved Budget</td>
            <td style={{ padding: '6px', border: '1px solid #ddd' }}>€{(teamOrder.approved_budget_total || 0).toFixed(2)}</td>
          </tr>
          <tr style={{ backgroundColor: '#f9f9f9' }}>
            <td style={{ padding: '6px', border: '1px solid #ddd' }}>Labor</td>
            <td style={{ padding: '6px', border: '1px solid #ddd' }}>€{(teamOrder.labor_budget || 0).toFixed(2)}</td>
          </tr>
          <tr style={{ backgroundColor: 'white' }}>
            <td style={{ padding: '6px', border: '1px solid #ddd' }}>Travel</td>
            <td style={{ padding: '6px', border: '1px solid #ddd' }}>€{(teamOrder.travel_budget || 0).toFixed(2)}</td>
          </tr>
          <tr style={{ backgroundColor: '#f9f9f9' }}>
            <td style={{ padding: '6px', border: '1px solid #ddd' }}>Accommodation</td>
            <td style={{ padding: '6px', border: '1px solid #ddd' }}>€{(teamOrder.accommodation_budget || 0).toFixed(2)}</td>
          </tr>
          <tr style={{ backgroundColor: 'white' }}>
            <td style={{ padding: '6px', border: '1px solid #ddd' }}>Per Diem</td>
            <td style={{ padding: '6px', border: '1px solid #ddd' }}>€{(teamOrder.per_diem_budget || 0).toFixed(2)}</td>
          </tr>
        </tbody>
      </table>

      {/* Covered Costs */}
      <h2 style={{ color: template?.primary_color || '#2563eb', fontSize: '12pt', marginTop: '15px', marginBottom: '8px', borderBottom: `1px solid ${template?.primary_color || '#2563eb'}`, paddingBottom: '4px' }}>
        COVERED COSTS
      </h2>
      <div style={{ marginBottom: '12px' }}>
        {costPolicies.length > 0 ? (
          <ul style={{ marginLeft: '20px', fontSize: `${template?.font_size_body || 11}pt` }}>
            {costPolicies.map((policy, idx) => (
              <li key={idx}>{policy}</li>
            ))}
            {teamOrder.other_reimbursables_allowed && (
              <li>Other reimbursables allowed (pre-approval required)</li>
            )}
          </ul>
        ) : (
          <p style={{ fontSize: `${template?.font_size_body || 11}pt` }}>No additional costs covered</p>
        )}
      </div>

      {/* Approval Requirements */}
      {(teamOrder.requires_preapproval_over > 0 || teamOrder.budget_exceed_requires_approval) && (
        <>
          <h2 style={{ color: template?.primary_color || '#2563eb', fontSize: '12pt', marginTop: '15px', marginBottom: '8px', borderBottom: `1px solid ${template?.primary_color || '#2563eb'}`, paddingBottom: '4px' }}>
            APPROVAL REQUIREMENTS
          </h2>
          <div style={{ marginBottom: '12px' }}>
            <ul style={{ marginLeft: '20px', fontSize: `${template?.font_size_body || 11}pt` }}>
              {teamOrder.requires_preapproval_over > 0 && (
                <li>Purchases over €{teamOrder.requires_preapproval_over} require pre-approval</li>
              )}
              {teamOrder.budget_exceed_requires_approval && (
                <li>Budget overages require approval before proceeding</li>
              )}
            </ul>
          </div>
        </>
      )}

      {/* Assigned Team */}
      <h2 style={{ color: template?.primary_color || '#2563eb', fontSize: '12pt', marginTop: '15px', marginBottom: '8px', borderBottom: `1px solid ${template?.primary_color || '#2563eb'}`, paddingBottom: '4px' }}>
        ASSIGNED TEAM
      </h2>
      {assignedTechs.length > 0 ? (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9pt', marginBottom: '12px' }}>
          <thead>
            <tr style={{ backgroundColor: template?.primary_color || '#2563eb', color: 'white' }}>
              <th style={{ padding: '6px', border: '1px solid #ddd', textAlign: 'left' }}>Name</th>
              <th style={{ padding: '6px', border: '1px solid #ddd', textAlign: 'left' }}>Phone</th>
            </tr>
          </thead>
          <tbody>
            {assignedTechs.map((tech, idx) => (
              <tr key={tech.id} style={{ backgroundColor: idx % 2 === 0 ? 'white' : '#f9f9f9' }}>
                <td style={{ padding: '6px', border: '1px solid #ddd' }}>{tech.first_name} {tech.last_name}</td>
                <td style={{ padding: '6px', border: '1px solid #ddd' }}>{tech.phone || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p style={{ fontSize: `${template?.font_size_body || 11}pt` }}>No technicians assigned</p>
      )}

      {/* Special Notes */}
      {teamOrder.partner_notes && (
        <>
          <h2 style={{ color: template?.primary_color || '#2563eb', fontSize: '12pt', marginTop: '15px', marginBottom: '8px', borderBottom: `1px solid ${template?.primary_color || '#2563eb'}`, paddingBottom: '4px' }}>
            SPECIAL NOTES
          </h2>
          <div style={{ marginBottom: '12px', whiteSpace: 'pre-wrap', fontSize: `${template?.font_size_body - 1 || 10}pt` }}>
            {teamOrder.partner_notes}
          </div>
        </>
      )}

      {/* Footer */}
      <div style={{ marginTop: '30px', paddingTop: '15px', borderTop: '1px solid #ddd', fontSize: '8pt', color: '#666', textAlign: 'center' }}>
        {template?.company_name || 'Alpha Yachting'} | This briefing is confidential and intended for the assigned partner.
      </div>
    </div>
  );
}