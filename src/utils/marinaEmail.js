/**
 * Builds a mailto: URL for marina work notification emails.
 * Used from OfferDetail, JobDetail, and WorkOrderDetail.
 */
export function buildMarinaEmailUrl({ location, boat, customer, tasks = [], refNumber = '' }) {
  const marinaEmail = location?.email || location?.contact_email || location?.contact_phone || '';
  const marinaName = location?.name || '[Marina Name]';
  const boatName = boat?.vessel_name || '[Vessel Name]';
  const boatDetails = [boat?.manufacturer, boat?.model, boat?.year, boat?.length_m ? `${boat.length_m}m` : null]
    .filter(Boolean).join(', ');
  const ownerName = customer
    ? (customer.company_name || `${customer.first_name || ''} ${customer.last_name || ''}`.trim())
    : '[Owner Name]';
  const refSuffix = refNumber ? ` (Ref: ${refNumber})` : '';

  const taskLines = tasks
    .filter(t => t.item_type !== 'Chapter' && t.title)
    .map(t => `  - ${t.title}${t.description ? ': ' + t.description : ''}`)
    .join('\n');

  const subject = encodeURIComponent(`Work Notification – ${boatName} – Service Works${refSuffix}`);
  const body = encodeURIComponent(
`Dear ${marinaName} Team,

We would like to inform you that Alpha Yachting will be carrying out service works on the following vessel at your marina:

Vessel: ${boatName}${boatDetails ? '\nDetails: ' + boatDetails : ''}
Owner: ${ownerName}
Location: ${marinaName}

Planned Works:
${taskLines || '  - See attached document for details'}

Start Date:              [                    ]
End Date:                [                    ]
Number of Technicians:   [                    ]
Special Requirements:    [                    ]

Please confirm access arrangements and any marina-specific requirements.

Kind regards,
Alpha Yachting Service Team`);

  return `mailto:${marinaEmail}?subject=${subject}&body=${body}`;
}