import jsPDF from 'jspdf';

const WORK_CATEGORIES = [
  'Motor / Antrieb', 'Elektrik / Elektronik', 'Rumpf / Gelcoat',
  'Osmose / Unterwasserschiff', 'Antifouling', 'Rigg / Segel',
  'Winterlager / Konservierung', 'Kranung / Transport', 'Anhänger (siehe oben)'
];

const TRAILER_WORK = [
  'Beleuchtung / Elektrik', 'Reifen / Räder', 'Bremsen / Auflaufeinrichtung',
  'Rahmen / Rost', 'Stützrad / Seilwinde', 'Sliprollen / Auflagen'
];

const LEGAL_TEXT =
  'Mit der Unterschrift erteilt der Auftraggeber Alpha Yachting den verbindlichen Auftrag zur Durchführung der beschriebenen Arbeiten. Ein Kostenvoranschlag ist unverbindlich; Abweichungen bis 15 % gelten als genehmigt, darüber hinaus wird vor Ausführung Rücksprache gehalten. Es gilt die gesetzliche Gewährleistung. Bis zur vollständigen Bezahlung besteht ein Unternehmerpfandrecht an Boot und Anhänger; danach anfallende Liege-/Standkosten trägt der Auftraggeber. Die angegebenen Daten werden ausschließlich zur Auftragsabwicklung gemäß DSGVO verarbeitet. Ergänzend gelten die AGB von Alpha Yachting.';

// Brand colours from the template
const NAVY = [42, 72, 106];        // section bars / header rule
const LABEL_GREY = [110, 120, 130];
const LINE_GREY = [205, 210, 216];

export function generateRepairOrderPdf(data) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = 210;
  const pageH = 297;
  const margin = 18;
  const contentW = pageW - margin * 2;
  let y = margin;

  // Draw an empty checkbox as a vector square (no special glyphs → no encoding artefacts)
  const drawBox = (x, cy, checked) => {
    const s = 3;
    doc.setDrawColor(90, 100, 110);
    doc.setLineWidth(0.3);
    doc.rect(x, cy - s + 0.6, s, s);
    if (checked) {
      doc.setLineWidth(0.5);
      doc.setDrawColor(30, 40, 55);
      doc.line(x + 0.5, cy - 0.8, x + 1.2, cy + 0.1);
      doc.line(x + 1.2, cy + 0.1, x + 2.6, cy - s + 1);
      doc.setLineWidth(0.3);
    }
  };

  // "☐ Ja  ☐ Nein" pair. Returns x after the block.
  const jaNein = (x, cy, value) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(40, 45, 50);
    drawBox(x, cy, value === true);
    doc.text('Ja', x + 4, cy);
    drawBox(x + 11, cy, value === false);
    doc.text('Nein', x + 15, cy);
    return x + 28;
  };

  const sectionTitle = (text) => {
    doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
    doc.rect(margin, y, contentW, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text(text, margin + 3, y + 4.8);
    doc.setTextColor(0, 0, 0);
    y += 11;
  };

  // Row of underline fields with a small grey label above the line
  const fieldRow = (fields) => {
    doc.setFontSize(7.5);
    const colW = contentW / fields.length;
    fields.forEach((f, i) => {
      const x = margin + i * colW;
      const w = colW - 4;
      // value
      doc.setTextColor(30, 35, 40);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      if (f.value != null && f.value !== '') {
        doc.text(String(f.value), x, y - 1.5);
      }
      // underline
      doc.setDrawColor(LINE_GREY[0], LINE_GREY[1], LINE_GREY[2]);
      doc.setLineWidth(0.3);
      doc.line(x, y, x + w, y);
      // label under the line
      doc.setTextColor(LABEL_GREY[0], LABEL_GREY[1], LABEL_GREY[2]);
      doc.setFontSize(6.8);
      doc.text(f.label, x, y + 3.2);
    });
    doc.setTextColor(0, 0, 0);
    y += 9;
  };

  // ---------- HEADER ----------
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.text('Alpha YACHTING', margin, y + 4);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(120, 130, 140);
  doc.text('Premium Solutions', margin, y + 8);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(40, 45, 55);
  doc.text('REPARATURAUFTRAG', pageW - margin, y + 3, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(120, 130, 140);
  doc.text('Auftragsannahme', pageW - margin, y + 8, { align: 'right' });
  doc.setTextColor(0, 0, 0);
  y += 15;
  doc.setDrawColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.setLineWidth(0.6);
  doc.line(margin, y, pageW - margin, y);
  doc.setLineWidth(0.3);
  y += 8;

  // Top meta row
  fieldRow([
    { label: 'Auftrags-Nr.', value: data.order_number },
    { label: 'Datum', value: data.order_date },
    { label: 'Angenommen von', value: data.accepted_by }
  ]);
  y += 3;

  // ---------- 1 CUSTOMER ----------
  sectionTitle('1 · Auftraggeber (Kunde)');
  fieldRow([
    { label: 'Name / Firma', value: data.customer_name },
    { label: 'Kunden-Nr.', value: data.customer_number }
  ]);
  fieldRow([
    { label: 'Adresse (Straße, PLZ, Ort)', value: data.customer_address },
    { label: 'Telefon / E-Mail', value: [data.customer_phone, data.customer_email].filter(Boolean).join(' / ') }
  ]);
  y += 3;

  // ---------- 2 BOAT ----------
  sectionTitle('2 · Boot / Yacht');
  fieldRow([
    { label: 'Bootstyp / Modell', value: data.boat_type_model },
    { label: 'Bootsname', value: data.boat_name },
    { label: 'Baujahr', value: data.boat_year }
  ]);
  fieldRow([
    { label: 'Amtl. Kennzeichen', value: data.boat_registration },
    { label: 'Rumpf-/HIN-Nr.', value: data.boat_hin },
    { label: 'Länge (m)', value: data.boat_length_m },
    { label: 'Standort', value: data.boat_location }
  ]);
  fieldRow([
    { label: 'Motor (Hersteller / Typ)', value: data.engine_make_type },
    { label: 'Leistung (kW/PS)', value: data.engine_power },
    { label: 'Betriebsstd.', value: data.engine_hours }
  ]);
  y += 3;

  // ---------- 3 TRAILER ----------
  sectionTitle('3 · Bootsanhänger / Trailer');
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(40, 45, 50);
  doc.text('Boot kommt am Anhänger:', margin, y);
  jaNein(margin + 44, y, data.trailer_on_arrival === true ? true : (data.trailer_on_arrival === false ? false : null));
  doc.text('Anhänger verbleibt bei Alpha Yachting:', margin + 90, y);
  jaNein(margin + 155, y, data.trailer_stays === true ? true : (data.trailer_stays === false ? false : null));
  y += 8;
  doc.setTextColor(0, 0, 0);
  fieldRow([
    { label: 'Anhänger-Kennzeichen', value: data.trailer_registration },
    { label: 'Typ / Hersteller', value: data.trailer_type },
    { label: 'zul. Gesamtgewicht (kg)', value: data.trailer_max_weight }
  ]);
  doc.setFontSize(7.5);
  doc.setTextColor(LABEL_GREY[0], LABEL_GREY[1], LABEL_GREY[2]);
  doc.text('Arbeiten am Anhänger gewünscht / Zustand (Zutreffendes ankreuzen):', margin, y);
  doc.setTextColor(0, 0, 0);
  y += 5;
  const tw = data.trailer_work || [];
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  const col3W = contentW / 3;
  TRAILER_WORK.forEach((w, idx) => {
    const c = idx % 3;
    const x = margin + c * col3W;
    drawBox(x, y, tw.includes(w));
    doc.text(w, x + 4.5, y);
    if (c === 2) y += 6;
  });
  if (TRAILER_WORK.length % 3 !== 0) y += 6;
  y += 3;

  // ---------- 4 WORK ----------
  sectionTitle('4 · Auftrag / gewünschte Arbeiten');
  const wc = data.work_categories || [];
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  WORK_CATEGORIES.forEach((cat, idx) => {
    const c = idx % 3;
    const x = margin + c * col3W;
    drawBox(x, y, wc.includes(cat));
    doc.text(cat, x + 4.5, y);
    if (c === 2) y += 6;
  });
  if (WORK_CATEGORIES.length % 3 !== 0) y += 6;
  doc.setFontSize(7.5);
  doc.setTextColor(LABEL_GREY[0], LABEL_GREY[1], LABEL_GREY[2]);
  doc.text('Beschreibung des Mangels / der gewünschten Arbeiten:', margin, y);
  doc.setTextColor(0, 0, 0);
  y += 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const descLines = doc.splitTextToSize(data.work_description || '', contentW);
  doc.text(descLines.slice(0, 4), margin, y);
  y += Math.max(descLines.slice(0, 4).length * 4.2, 12) + 3;

  // ---------- 5 POSITIONS (table with borders) ----------
  sectionTitle('5 · Auszuführende Arbeiten / Positionen');
  const colPos = margin;
  const colDesc = margin + 14;
  const colQtyX = margin + 128;
  const colPriceX = margin + 156;
  const tableRight = pageW - margin;
  const rowH = 9;
  // header
  doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.rect(margin, y, contentW, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('Pos.', colPos + 2, y + 4.7);
  doc.text('Beschreibung der Arbeit / Leistung', colDesc + 2, y + 4.7);
  doc.text('Menge/Std.', colQtyX + 2, y + 4.7);
  doc.text('Preis / €', colPriceX + 2, y + 4.7);
  y += 7;
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const positions = (data.positions && data.positions.length > 0)
    ? data.positions.slice(0, 6)
    : [];
  const rowCount = Math.max(4, positions.length);
  doc.setDrawColor(LINE_GREY[0], LINE_GREY[1], LINE_GREY[2]);
  doc.setLineWidth(0.3);
  for (let i = 0; i < rowCount; i++) {
    const p = positions[i] || {};
    // cell text
    doc.text(String(i + 1), colPos + 2, y + 5.8);
    if (p.description) {
      const pd = doc.splitTextToSize(String(p.description), colQtyX - colDesc - 4);
      doc.text(pd.slice(0, 1), colDesc + 2, y + 5.8);
    }
    if (p.quantity != null && p.quantity !== '') doc.text(String(p.quantity), colQtyX + 2, y + 5.8);
    if (p.price != null && p.price !== '') doc.text(String(p.price), colPriceX + 2, y + 5.8);
    // horizontal separator
    doc.line(margin, y + rowH, tableRight, y + rowH);
    y += rowH;
  }
  // vertical borders + outer box
  const tableTop = y - rowCount * rowH - 7;
  doc.rect(margin, tableTop, contentW, rowCount * rowH + 7);
  [colDesc, colQtyX, colPriceX].forEach((cx) => {
    doc.line(cx, tableTop, cx, y);
  });
  y += 5;

  // ---------- 6 COSTS ----------
  sectionTitle('6 · Kosten & Konditionen');
  fieldRow([
    { label: 'Stundensatz (€, netto)', value: data.hourly_rate },
    { label: 'Kostenobergrenze o. Rückfrage (€)', value: data.cost_cap },
    { label: 'Voraussichtl. Fertigstellung', value: data.expected_completion }
  ]);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(40, 45, 50);
  doc.text('Kostenvoranschlag gewünscht:', margin, y);
  jaNein(margin + 52, y, data.cost_estimate_wanted === true ? true : (data.cost_estimate_wanted === false ? false : null));
  doc.text('Probefahrt:', margin + 88, y);
  jaNein(margin + 108, y, data.test_drive_wanted === true ? true : (data.test_drive_wanted === false ? false : null));
  doc.text('Altteile entsorgen:', margin + 140, y);
  jaNein(margin + 172, y, data.dispose_old_parts === true ? true : (data.dispose_old_parts === false ? false : null));
  doc.setTextColor(0, 0, 0);
  y += 9;

  // ---------- 7 TERMS ----------
  sectionTitle('7 · Auftragsbedingungen & Datenschutz');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(70, 78, 88);
  const legalLines = doc.splitTextToSize(LEGAL_TEXT, contentW);
  doc.text(legalLines, margin, y);
  doc.setTextColor(0, 0, 0);
  y += legalLines.length * 3.2 + 8;

  // Signatures
  fieldRow([{ label: 'Ort, Datum', value: '' }]);
  y += 12;
  doc.setDrawColor(90, 100, 110);
  doc.setLineWidth(0.4);
  const sigW = 75;
  doc.line(margin, y, margin + sigW, y);
  doc.line(pageW - margin - sigW, y, pageW - margin, y);
  y += 4;
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(LABEL_GREY[0], LABEL_GREY[1], LABEL_GREY[2]);
  doc.text('Unterschrift Auftraggeber', margin, y);
  doc.text('Alpha Yachting (Auftragsannahme)', pageW - margin - sigW, y);
  doc.setTextColor(0, 0, 0);

  // ---------- PAGE 2 — Mechanic worksheet ----------
  doc.addPage();
  y = margin;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.text('Alpha YACHTING', margin, y + 4);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(120, 130, 140);
  doc.text('Premium Solutions', margin, y + 8);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(40, 45, 55);
  doc.text('ARBEITSNACHWEIS', pageW - margin, y + 3, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(120, 130, 140);
  doc.text('Mechaniker / Zeiterfassung', pageW - margin, y + 8, { align: 'right' });
  doc.setTextColor(0, 0, 0);
  y += 15;
  doc.setDrawColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.setLineWidth(0.6);
  doc.line(margin, y, pageW - margin, y);
  doc.setLineWidth(0.3);
  y += 8;

  fieldRow([
    { label: 'Auftrags-Nr.', value: data.order_number },
    { label: 'Boot', value: data.boat_name || data.boat_type_model },
    { label: 'Kunde', value: data.customer_name }
  ]);
  y += 3;

  // Time table
  sectionTitle('Durchgeführte Arbeiten & Zeiterfassung');
  const cols = [
    { label: 'Datum', w: 20 },
    { label: 'Mechaniker', w: 30 },
    { label: 'Durchgeführte Arbeit', w: 74 },
    { label: 'Von', w: 14 },
    { label: 'Bis', w: 14 },
    { label: 'Pause', w: 14 },
    { label: 'Std.', w: 0 }
  ];
  // compute widths (last col fills remainder)
  const usedW = cols.slice(0, -1).reduce((a, c) => a + c.w, 0);
  cols[cols.length - 1].w = contentW - usedW;
  const colXs = [];
  let cx = margin;
  cols.forEach((c) => { colXs.push(cx); cx += c.w; });
  const tableRight2 = pageW - margin;

  // header row
  doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.rect(margin, y, contentW, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  cols.forEach((c, i) => doc.text(c.label, colXs[i] + 2, y + 4.7));
  y += 7;
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');

  const wsRowH = 9;
  const wsRows = 20;
  const wsTop = y;
  doc.setDrawColor(LINE_GREY[0], LINE_GREY[1], LINE_GREY[2]);
  doc.setLineWidth(0.3);
  for (let r = 0; r < wsRows; r++) {
    doc.line(margin, y + wsRowH, tableRight2, y + wsRowH);
    y += wsRowH;
  }
  // outer box + verticals
  doc.rect(margin, wsTop - 7, contentW, wsRows * wsRowH + 7);
  colXs.slice(1).forEach((vx) => doc.line(vx, wsTop - 7, vx, y));
  y += 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Summe Stunden gesamt:', margin, y);
  doc.setDrawColor(90, 100, 110);
  doc.line(margin + 48, y + 0.5, margin + 90, y + 0.5);
  y += 16;
  doc.setDrawColor(90, 100, 110);
  doc.setLineWidth(0.4);
  doc.line(margin, y, margin + sigW, y);
  y += 4;
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(LABEL_GREY[0], LABEL_GREY[1], LABEL_GREY[2]);
  doc.text('Datum / Unterschrift Mechaniker', margin, y);
  doc.setTextColor(0, 0, 0);

  return doc;
}

export function openRepairOrderPdf(data) {
  const doc = generateRepairOrderPdf(data);
  doc.autoPrint();
  window.open(doc.output('bloburl'), '_blank');
}