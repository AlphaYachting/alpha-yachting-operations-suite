/**
 * Test Fixtures for PDF Export
 * Used for automated testing and manual reproduction of issues
 */

export const TestInvoices = {
  small: {
    name: 'Small Invoice (Single Page, 10 items)',
    data: {
      document: {
        document_type: 'Invoice',
        document_number: 'TEST-INV-001',
        status: 'Issued',
        customer_name: 'Test Customer Inc.',
        customer_address: 'Teststrasse 42, 6900 Bregenz, Austria',
        customer_vat: 'ATU12345678',
        boat_name: 'Test Vessel A',
        boat_details: 'Sailboat, 12m, GRP',
        location_name: 'Test Marina',
        issue_date: new Date().toISOString().split('T')[0],
        due_date: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
        payment_terms: 'Net 14 days',
        public_notes: 'Thank you for your business. Payment reference: TEST-INV-001',
        currency: 'EUR',
        language: 'German',
        subtotal: 1100,
        tax_total: 220,
        total: 1320,
        paid_amount: 0
      },
      lineItems: [
        { title: 'Engine Diagnostic', description: 'Full diagnostic scan and report', quantity: 2, unit: 'hrs', unit_price: 100, tax_rate: 20, total_net: 200, total_tax: 40, total_gross: 240 },
        { title: 'Oil & Filter Change', description: 'Premium synthetic oil + new filter', quantity: 1, unit: 'job', unit_price: 120, tax_rate: 20, total_net: 120, total_tax: 24, total_gross: 144 },
        { title: 'Battery Replacement', description: 'Marine AGM battery 100Ah', quantity: 1, unit: 'pcs', unit_price: 250, tax_rate: 20, total_net: 250, total_tax: 50, total_gross: 300 },
        { title: 'Coolant Flush', description: 'Complete coolant system flush and refill', quantity: 1.5, unit: 'hrs', unit_price: 80, tax_rate: 20, total_net: 120, total_tax: 24, total_gross: 144 },
        { title: 'Belt Inspection', description: 'Alternator and pump belt check + tension', quantity: 1, unit: 'job', unit_price: 45, tax_rate: 20, total_net: 45, total_tax: 9, total_gross: 54 },
        { title: 'Hose & Clamp Replacement', description: 'Replace worn cooling hoses', quantity: 1, unit: 'job', unit_price: 85, tax_rate: 20, total_net: 85, total_tax: 17, total_gross: 102 },
        { title: 'Spark Plug Change', description: '8 premium marine spark plugs', quantity: 1, unit: 'set', unit_price: 60, tax_rate: 20, total_net: 60, total_tax: 12, total_gross: 72 },
        { title: 'Fuel Filter Service', description: 'Primary and secondary fuel filter replacement', quantity: 1, unit: 'job', unit_price: 50, tax_rate: 20, total_net: 50, total_tax: 10, total_gross: 60 },
        { title: 'Water Pump Service', description: 'Inspection and replacement if needed', quantity: 2, unit: 'hrs', unit_price: 95, tax_rate: 20, total_net: 190, total_tax: 38, total_gross: 228 },
        { title: 'Transmission Fluid Check', description: 'Check, top-up if needed', quantity: 0.5, unit: 'hrs', unit_price: 75, tax_rate: 20, total_net: 37.5, total_tax: 7.5, total_gross: 45 }
      ]
    }
  },

  large: {
    name: 'Large Invoice (Multi-Page, 120 items)',
    data: {
      document: {
        document_type: 'Invoice',
        document_number: 'TEST-INV-002',
        status: 'Issued',
        customer_name: 'Major Shipyard GmbH',
        customer_address: 'Werftstrasse 99, 6900 Bregenz, Austria',
        customer_vat: 'ATU98765432',
        boat_name: 'Test Vessel B (Extended Refit)',
        boat_details: 'Motor Yacht, 25m, full service contract',
        location_name: 'Dry Marina Bregenz',
        issue_date: new Date().toISOString().split('T')[0],
        due_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
        payment_terms: 'Net 30 days',
        public_notes: 'Extended service contract – Phase 1 of 3. Invoice covers engine compartment and auxiliary systems.',
        currency: 'EUR',
        language: 'German',
        subtotal: 12650,
        tax_total: 2530,
        total: 15180,
        paid_amount: 5000
      },
      lineItems: Array.from({ length: 120 }, (_, i) => {
        const categories = [
          { name: 'Engine Service', price: 120 },
          { name: 'Electrical Work', price: 95 },
          { name: 'Plumbing Repair', price: 85 },
          { name: 'GRP Restoration', price: 150 },
          { name: 'Electronics', price: 110 },
          { name: 'Rigging Inspection', price: 100 },
          { name: 'Material Supply', price: 200 }
        ];
        const category = categories[i % categories.length];
        
        return {
          title: `${category.name} #${i + 1}`,
          description: `Work item #${i + 1}: ${category.name.toLowerCase()} – Standard procedure`,
          quantity: Math.floor(Math.random() * 4) + 1,
          unit: ['hrs', 'pcs', 'job', 'm', 'set'][i % 5],
          unit_price: category.price + (Math.random() * 30 - 15),
          tax_rate: 20,
          total_net: (category.price + (Math.random() * 30 - 15)) * (Math.floor(Math.random() * 4) + 1),
          total_tax: ((category.price + (Math.random() * 30 - 15)) * (Math.floor(Math.random() * 4) + 1)) * 0.2,
          total_gross: ((category.price + (Math.random() * 30 - 15)) * (Math.floor(Math.random() * 4) + 1)) * 1.2
        };
      })
    }
  }
};

export const TestOffers = {
  simple: {
    name: 'Simple Offer (3 tasks)',
    data: {
      document: {
        document_type: 'Offer',
        offer_number: 'TEST-OFFER-001',
        status: 'Draft',
        customer_name: 'Marina Test Customer',
        customer_address: 'Hafenstrasse 15, 6900 Bregenz',
        customer_vat: 'ATU55555555',
        boat_name: 'Test Boat',
        location_name: 'Test Marina',
        issue_date: new Date().toISOString().split('T')[0],
        valid_until: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
        currency: 'EUR',
        language: 'German',
        subtotal: 650,
        tax_total: 130,
        total: 780,
        public_notes: 'This is a preliminary offer valid for 30 days.'
      },
      lineItems: [
        { title: 'Engine Inspection & Diagnostics', description: 'Complete engine diagnostic with report', quantity: 4, unit: 'hrs', unit_price: 100, tax_rate: 20, total_net: 400, total_tax: 80, total_gross: 480 },
        { title: 'Cooling System Overhaul', description: 'Flush, refill, hose inspection', quantity: 3, unit: 'hrs', unit_price: 85, tax_rate: 20, total_net: 255, total_tax: 51, total_gross: 306 },
        { title: 'Electrical System Check', description: 'Battery, alternator, wiring', quantity: 2, unit: 'hrs', unit_price: 95, tax_rate: 20, total_net: 190, total_tax: 38, total_gross: 228 }
      ]
    }
  }
};

export function generateRandomTestInvoice(itemCount = 50) {
  const subtotal = itemCount * 105;
  const taxTotal = subtotal * 0.2;
  const total = subtotal + taxTotal;

  return {
    document: {
      document_type: 'Invoice',
      document_number: `TEST-RAND-${Date.now()}`,
      status: 'Issued',
      customer_name: 'Random Test Customer',
      customer_address: 'Testweg 999, Test City',
      issue_date: new Date().toISOString().split('T')[0],
      due_date: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
      currency: 'EUR',
      subtotal,
      tax_total: taxTotal,
      total,
      paid_amount: 0
    },
    lineItems: Array.from({ length: itemCount }, (_, i) => ({
      title: `Service Item ${i + 1}`,
      description: `Random test service #${i + 1}`,
      quantity: 1,
      unit: 'job',
      unit_price: 105,
      tax_rate: 20,
      total_net: 105,
      total_tax: 21,
      total_gross: 126
    }))
  };
}