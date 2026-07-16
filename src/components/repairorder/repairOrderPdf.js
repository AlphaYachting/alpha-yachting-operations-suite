import jsPDF from 'jspdf';

const WORK_CATEGORIES = [
  'Motor / Antrieb', 'Elektrik / Elektronik', 'Rumpf / Gelcoat',
  'Osmose / Unterwasserschiff', 'Antifouling', 'Rigg / Segel',
  'Winterlager / Konservierung', 'Kranung / Transport', 'Anhänger'
];

const TRAILER_WORK = [
  'Beleuchtung / Elektrik', 'Reifen / Räder', 'Bremsen / Auflaufeinrichtung',
  'Rahmen / Rost', 'Stützrad / Seilwinde', 'Sliprollen / Auflagen'
];

const LEGAL_TEXT =
  'Mit der Unterschrift erteilt der Auftraggeber Alpha Yachting den verbindlichen Auftrag zur Durchführung der beschriebenen Arbeiten. Ein Kostenvoranschlag ist unverbindlich; Abweichungen bis 15 % gelten als genehmigt, darüber hinaus wird vor Ausführung Rücksprache gehalten. Es gilt die gesetzliche Gewährleistung. Bis zur vollständigen Bezahlung besteht ein Unternehmerpfandrecht an Boot und Anhänger; danach anfallende Liege-/Standkosten trägt der Auftraggeber. Die angegebenen Daten werden ausschließlich zur Auftragsabwicklung gemäß DSGVO verarbeitet. Ergänzend gelten die AGB von Alpha Yachting.';

function checkbox(checked) {
  return checked ? '\u2611' : '\u2610';
}

export function generateRepairOrderPdf(data) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = 210;
  const margin = 14;
  const contentW = pageW - margin * 2;
  let y = margin;

  const line = (h = 6) => { y += h; };
  const sectionTitle = (text) => {
    doc.setFillColor(30, 41, 59);
    doc.rect(margin, y, contentW, 6, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(text, margin + 2, y + 4.2);
    doc.setTextColor(0, 0, 0);
    y += 8;
  };
  const kv = (pairs) => {
    doc.setFontSize(8);
    const colW = contentW / pairs.length;
    pairs.forEach((p, i) => {
      const x = margin + i * colW;
      doc.setFont('helvetica', 'bold');
      doc.text(p.label, x, y);
      doc.setFont('helvetica', 'normal');
      doc.text(String(p.value || '—'), x, y + 4);
    });
    y += 9;
  };

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('ALPHA YACHTING', margin, y + 4);
  doc.setFontSize(13);
  doc.text('REPARATURAUFTRAG', pageW - margin, y + 4, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('Service · Reparatur · Refit', margin, y + 9);
  doc.text('Auftragsannahme', pageW - margin, y + 9, { align: 'right' });
  y += 14;
  doc.setDrawColor(200);
  doc.line(margin, y, pageW - margin, y);
  y += 5;

  kv([
    { label: 'Auftrags-Nr.', value: data.order_number },
    { label: 'Datum', value: data.order_date },
    { label: 'Angenommen von', value: data.accepted_by }
  ]);

  // 1 Customer
  sectionTitle('1 · Auftraggeber (Kunde)');
  kv([
    { label: 'Name / Firma', value: data.customer_name },
    { label: 'Kunden-Nr.', value: data.customer_number }
  ]);
  kv([
    { label: 'Adresse', value: data.customer_address },
    { label: 'Telefon / E-Mail', value: [data.customer_phone, data.customer_email].filter(Boolean).join(' / ') }
  ]);

  // 2 Boat
  sectionTitle('2 · Boot / Yacht');
  kv([
    { label: 'Bootstyp / Modell', value: data.boat_type_model },
    { label: 'Bootsname', value: data.boat_name },
    { label: 'Baujahr', value: data.boat_year }
  ]);
  kv([
    { label: 'Amtl. Kennzeichen', value: data.boat_registration },
    { label: 'Rumpf-/HIN-Nr.', value: data.boat_hin },
    { label: 'Länge (m)', value: data.boat_length_m },
    { label: 'Standort', value: data.boat_location }
  ]);
  kv([
    { label: 'Motor (Hersteller / Typ)', value: data.engine_make_type },
    { label: 'Leistung (kW/PS)', value: data.engine_power },
    { label: 'Betriebsstd.', value: data.engine_hours }
  ]);

  // 3 Trailer
  sectionTitle('3 · Bootsanhänger / Trailer');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`${checkbox(data.trailer_on_arrival)} Boot kommt am Anhänger`, margin, y);
  doc.text(`${checkbox(data.trailer_stays)} Anhänger verbleibt bei Alpha Yachting`, margin + contentW / 2, y);
  y += 6;
  const tw = data.trailer_work || [];
  let tcol = 0;
  doc.setFontSize(7.5);
  TRAILER_WORK.forEach((w) => {
    const x = margin + (tcol % 3) * (contentW / 3);
    doc.text(`${checkbox(tw.includes(w))} ${w}`, x, y);
    tcol++;
    if (tcol % 3 === 0) y += 5;
  });
  if (tcol % 3 !== 0) y += 5;
  y += 2;

  // 4 Work
  sectionTitle('4 · Auftrag / gewünschte Arbeiten');
  const wc = data.work_categories || [];
  let col = 0;
  doc.setFontSize(7.5);
  WORK_CATEGORIES.forEach((c) => {
    const x = margin + (col % 3) * (contentW / 3);
    doc.text(`${checkbox(wc.includes(c))} ${c}`, x, y);
    col++;
    if (col % 3 === 0) y += 5;
  });
  if (col % 3 !== 0) y += 5;
  y += 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('Beschreibung des Mangels / der gewünschten Arbeiten:', margin, y);
  y += 4;
  doc.setFont('helvetica', 'normal');
  const descLines = doc.splitTextToSize(data.work_description || '', contentW);
  doc.text(descLines.slice(0, 5), margin, y);
  y += Math.max(descLines.slice(0, 5).length * 4, 8) + 2;

  // 5 Positions
  sectionTitle('5 · Auszuführende Arbeiten / Positionen');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('Pos.', margin, y);
  doc.text('Beschreibung', margin + 12, y);
  doc.text('Menge/Std.', margin + 120, y);
  doc.text('Preis / €', pageW - margin, y, { align: 'right' });
  y += 2;
  doc.setDrawColor(200);
  doc.line(margin, y, pageW - margin, y);
  y += 4;
  doc.setFont('helvetica', 'normal');
  const positions = (data.positions && data.positions.length > 0) ? data.positions : [{}, {}, {}, {}];
  positions.forEach((p, i) => {
    doc.text(String(i + 1), margin, y);
    const pd = doc.splitTextToSize(p.description || '', 100);
    doc.text(pd.slice(0, 2), margin + 12, y);
    doc.text(String(p.quantity || ''), margin + 120, y);
    doc.text(p.price != null && p.price !== '' ? String(p.price) : '', pageW - margin, y, { align: 'right' });
    y += Math.max(pd.slice(0, 2).length * 4, 5) + 2;
  });
  y += 2;

  // 6 Costs
  sectionTitle('6 · Kosten & Konditionen');
  kv([
    { label: 'Stundensatz (€, netto)', value: data.hourly_rate },
    { label: 'Kostenobergrenze o. Rückfrage (€)', value: data.cost_cap },
    { label: 'Voraussichtl. Fertigstellung', value: data.expected_completion }
  ]);
  doc.setFontSize(7.5);
  doc.text(`${checkbox(data.cost_estimate_wanted)} Kostenvoranschlag gewünscht`, margin, y);
  doc.text(`${checkbox(data.test_drive_wanted)} Probefahrt`, margin + contentW / 3, y);
  doc.text(`${checkbox(data.dispose_old_parts)} Altteile entsorgen`, margin + (contentW / 3) * 2, y);
  y += 7;

  // 7 Terms
  sectionTitle('7 · Auftragsbedingungen & Datenschutz');
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  const legalLines = doc.splitTextToSize(LEGAL_TEXT, contentW);
  doc.text(legalLines, margin, y);
  y += legalLines.length * 3 + 6;

  // Signatures
  doc.setFontSize(8);
  doc.text('Ort, Datum: __________________________', margin, y);
  y += 14;
  doc.setDrawColor(120);
  doc.line(margin, y, margin + 70, y);
  doc.line(pageW - margin - 70, y, pageW - margin, y);
  y += 4;
  doc.setFontSize(7.5);
  doc.text('Unterschrift Auftraggeber', margin, y);
  doc.text('Alpha Yachting (Auftragsannahme)', pageW - margin, y, { align: 'right' });

  // PAGE 2 — Mechanic time sheet
  doc.addPage();
  y = margin;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('ALPHA YACHTING', margin, y + 4);
  doc.setFontSize(13);
  doc.text('ARBEITSZEITEN', pageW - margin, y + 4, { align: 'right' });
  y += 10;
  doc.setDrawColor(200);
  doc.line(margin, y, pageW - margin, y);
  y += 5;
  kv([
    { label: 'Auftrags-Nr.', value: data.order_number },
    { label: 'Boot', value: data.boat_name || data.boat_type_model },
    { label: 'Kunde', value: data.customer_name }
  ]);

  sectionTitle('Zeiterfassung Mechaniker');
  const headers = ['Datum', 'Mechaniker', 'Tätigkeit', 'Von', 'Bis', 'Pause', 'Std.'];
  const colX = [margin, margin + 22, margin + 55, margin + 118, margin + 133, margin + 148, margin + 166];
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  headers.forEach((h, i) => doc.text(h, colX[i], y));
  y += 2;
  doc.line(margin, y, pageW - margin, y);
  y += 6;
  // 18 empty rows
  doc.setDrawColor(220);
  for (let r = 0; r < 18; r++) {
    doc.line(margin, y, pageW - margin, y);
    y += 8;
  }
  y += 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Summe Stunden gesamt: ______________', margin, y);
  y += 16;
  doc.setDrawColor(120);
  doc.line(margin, y, margin + 70, y);
  y += 4;
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text('Datum / Unterschrift Mechaniker', margin, y);

  return doc;
}

export function openRepairOrderPdf(data) {
  const doc = generateRepairOrderPdf(data);
  doc.autoPrint();
  window.open(doc.output('bloburl'), '_blank');
}