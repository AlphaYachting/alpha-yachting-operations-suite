import jsPDF from 'jspdf';

export const STORAGE_SERVICES = [
  'Bootsreinigung außen',
  'Bootsreinigung innen',
  'Motor-Konservierung / Einwinterung',
  'Batterie ausbauen / laden / prüfen',
  'Batterieservice während der Lagerzeit',
  'Kontrolle von Bilge / Feuchtigkeit',
  'Abdeckung / Plane montieren',
  'Antifouling prüfen / Angebot erstellen',
  'Politur / Pflegearbeiten',
  'Motorservice / Wartung',
  'Sonstige Arbeiten gemäß separatem Angebot'
];

const INTERVALS = ['Täglich', 'Wöchentlich', 'Monatlich', 'Jährlich', 'Winterlagerung / Saisonlagerung', 'Sonstiges'];
const BILLING_TYPES = ['Pro Tag', 'Pro Woche', 'Pro Monat', 'Pro Jahr / Saison', 'Pauschalpreis'];
const ROOF_OPTIONS = ['Ja', 'Nein', 'Nach Verfügbarkeit'];
const PHOTO_OPTIONS = ['Wurden erstellt', 'Werden noch erstellt', 'Nicht erstellt'];

const NAVY = [42, 72, 106];
const LABEL_GREY = [110, 120, 130];
const LINE_GREY = [205, 210, 216];

export function generateEinlagerungsvertragPdf(data) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = 210;
  const pageH = 297;
  const margin = 18;
  const contentW = pageW - margin * 2;
  let y = margin;

  const ensure = (h) => {
    if (y + h > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

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

  const heading = (text) => {
    ensure(16);
    doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
    doc.rect(margin, y, contentW, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text(text, margin + 3, y + 4.8);
    doc.setTextColor(0, 0, 0);
    y += 11;
  };

  const para = (text, size = 7.5) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(size);
    doc.setTextColor(70, 78, 88);
    const lines = doc.splitTextToSize(text, contentW);
    const lh = size * 0.44;
    ensure(lines.length * lh + 3);
    doc.text(lines, margin, y);
    y += lines.length * lh + 3;
    doc.setTextColor(0, 0, 0);
  };

  const fieldRow = (fields) => {
    ensure(11);
    const colW = contentW / fields.length;
    fields.forEach((f, i) => {
      const x = margin + i * colW;
      const w = colW - 4;
      doc.setTextColor(30, 35, 40);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      if (f.value != null && f.value !== '') {
        doc.text(String(f.value), x, y - 1.5);
      }
      doc.setDrawColor(LINE_GREY[0], LINE_GREY[1], LINE_GREY[2]);
      doc.setLineWidth(0.3);
      doc.line(x, y, x + w, y);
      doc.setTextColor(LABEL_GREY[0], LABEL_GREY[1], LABEL_GREY[2]);
      doc.setFontSize(6.8);
      doc.text(f.label, x, y + 3.2);
    });
    doc.setTextColor(0, 0, 0);
    y += 9;
  };

  // Multi-line notes field: wraps text, draws each line on its own ruled line, paginates
  const notesField = (label, value, minLines = 2) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const lh = 6.5;
    const lines = value ? doc.splitTextToSize(String(value), contentW) : [];
    const count = Math.max(lines.length, minLines);
    for (let i = 0; i < count; i++) {
      ensure(lh + 5);
      if (lines[i]) {
        doc.setTextColor(30, 35, 40);
        doc.text(lines[i], margin, y - 1.5);
      }
      doc.setDrawColor(LINE_GREY[0], LINE_GREY[1], LINE_GREY[2]);
      doc.setLineWidth(0.3);
      doc.line(margin, y, margin + contentW, y);
      y += lh;
    }
    y -= lh;
    doc.setTextColor(LABEL_GREY[0], LABEL_GREY[1], LABEL_GREY[2]);
    doc.setFontSize(6.8);
    doc.text(label, margin, y + 3.2);
    doc.setTextColor(0, 0, 0);
    y += 9;
  };

  // Horizontal checkbox options, one selected value
  const checkOptions = (options, selected, perRow = 3) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(40, 45, 50);
    const colW = contentW / perRow;
    options.forEach((opt, idx) => {
      const c = idx % perRow;
      if (c === 0) ensure(7);
      const x = margin + c * colW;
      drawBox(x, y, selected === opt);
      doc.text(opt, x + 4.5, y);
      if (c === perRow - 1) y += 6;
    });
    if (options.length % perRow !== 0) y += 6;
    doc.setTextColor(0, 0, 0);
    y += 1;
  };

  // ---------- HEADER ----------
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.text('EINLAGERUNGSVERTRAG FÜR BOOTE', margin, y + 4);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(40, 45, 55);
  doc.text('Alpha YACHTING', pageW - margin, y + 2, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(120, 130, 140);
  doc.text('Premium Solutions', pageW - margin, y + 6, { align: 'right' });
  doc.setTextColor(0, 0, 0);
  y += 10;
  doc.setDrawColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.setLineWidth(0.6);
  doc.line(margin, y, pageW - margin, y);
  doc.setLineWidth(0.3);
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(40, 45, 50);
  doc.text('zwischen', margin, y);
  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.text('AQS GROUP d.o.o. / Alpha Yachting', margin, y);
  y += 4.2;
  doc.setFont('helvetica', 'normal');
  doc.text('Bužinija 32A, 52466 Novigrad, Kroatien', margin, y);
  y += 4.2;
  doc.text('OIB: HR69074711745', margin, y);
  y += 4.2;
  doc.setTextColor(90, 98, 108);
  doc.text('– nachfolgend „Auftragnehmer" oder „Lagerhalter" genannt –', margin, y);
  y += 5.5;
  doc.setTextColor(40, 45, 50);
  doc.text('und', margin, y);
  y += 6;

  // ---------- 1 KUNDENDATEN ----------
  heading('1 · Kundendaten');
  fieldRow([{ label: 'Name / Firma', value: data.customer_name }]);
  fieldRow([{ label: 'Adresse (Straße, PLZ, Ort, Land)', value: data.customer_address }]);
  fieldRow([
    { label: 'Telefon', value: data.customer_phone },
    { label: 'E-Mail', value: data.customer_email }
  ]);
  fieldRow([
    { label: 'OIB / Steuernummer / VAT-ID, falls vorhanden', value: data.customer_tax_id },
    { label: 'Kunden-Nr.', value: data.customer_number }
  ]);
  para('– nachfolgend „Kunde" oder „Auftraggeber" genannt – wird folgender Einlagerungsvertrag geschlossen:', 8);
  y += 1;

  // ---------- 2 BOOT ----------
  heading('2 · Angaben zum Boot');
  fieldRow([
    { label: 'Bootstyp / Hersteller / Modell', value: data.boat_type_model },
    { label: 'Bootsbezeichnung / Bootsname', value: data.boat_name }
  ]);
  fieldRow([
    { label: 'Kennzeichen / Registrierung, falls vorhanden', value: data.boat_registration },
    { label: 'Bootslänge (m)', value: data.boat_length_m },
    { label: 'Bootsbreite (m)', value: data.boat_beam_m },
    { label: 'Tiefgang (m)', value: data.boat_draft_m }
  ]);
  fieldRow([
    { label: 'Motor / Antrieb', value: [data.engine_make_type, data.engine_power].filter(Boolean).join(' / ') },
    { label: 'Wert des Bootes', value: data.boat_value }
  ]);
  notesField('Besondere Hinweise zum Boot', data.boat_notes, 1);
  y += 1;

  // ---------- 3 TRAILER ----------
  heading('3 · Trailer / Transportmittel');
  ensure(10);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(40, 45, 50);
  doc.text('Eigener Trailer vorhanden:', margin, y);
  drawBox(margin + 44, y, data.trailer_on_arrival === true);
  doc.text('Ja', margin + 48.5, y);
  drawBox(margin + 58, y, data.trailer_on_arrival === false);
  doc.text('Nein', margin + 62.5, y);
  doc.setTextColor(0, 0, 0);
  y += 8;
  fieldRow([
    { label: 'Trailertyp / Hersteller', value: data.trailer_type },
    { label: 'Kennzeichen, falls vorhanden', value: data.trailer_registration }
  ]);
  notesField('Zustand / Hinweise zum Trailer', data.trailer_condition_notes, 1);
  para('Der Kunde bestätigt, dass Trailer, Stützen, Böcke oder sonstige Transport- und Lagerhilfen, sofern vom Kunden gestellt, für das Boot geeignet und verkehrs- bzw. standsicher sind.');

  // ---------- 4 ART & DAUER ----------
  heading('4 · Art und Dauer der Einlagerung');
  doc.setFontSize(7.5);
  doc.setTextColor(LABEL_GREY[0], LABEL_GREY[1], LABEL_GREY[2]);
  doc.text('Gewünschte Einlagerung:', margin, y);
  doc.setTextColor(0, 0, 0);
  y += 5;
  checkOptions(INTERVALS, data.storage_interval, 3);
  if (data.storage_interval === 'Sonstiges' && data.storage_interval_other) {
    fieldRow([{ label: 'Sonstiges', value: data.storage_interval_other }]);
  }
  fieldRow([
    { label: 'Beginn der Einlagerung', value: data.storage_start_date },
    { label: 'Voraussichtliches Ende der Einlagerung', value: data.storage_end_date }
  ]);
  ensure(12);
  doc.setFontSize(7.5);
  doc.setTextColor(LABEL_GREY[0], LABEL_GREY[1], LABEL_GREY[2]);
  doc.text('Lagerung unter Dach:', margin, y);
  doc.setTextColor(0, 0, 0);
  y += 5;
  checkOptions(ROOF_OPTIONS, data.storage_under_roof, 3);
  fieldRow([{ label: 'Lagerort / Standort', value: data.storage_location }]);
  para('Der Lagerhalter ist berechtigt, den konkreten Stellplatz innerhalb des Lagergeländes nach organisatorischen und sicherheitstechnischen Erfordernissen festzulegen oder zu ändern, sofern dem Kunden hierdurch kein wesentlicher Nachteil entsteht.');

  // ---------- 5 PREISE ----------
  heading('5 · Preise und Zahlungsbedingungen');
  fieldRow([{ label: 'Vereinbarter Preis für die Einlagerung (EUR)', value: data.storage_price }]);
  ensure(12);
  doc.setFontSize(7.5);
  doc.setTextColor(LABEL_GREY[0], LABEL_GREY[1], LABEL_GREY[2]);
  doc.text('Abrechnungsart:', margin, y);
  doc.setTextColor(0, 0, 0);
  y += 5;
  checkOptions(BILLING_TYPES, data.storage_billing_type, 3);
  notesField('Sonstige vereinbarte Kosten / Nebenkosten', data.storage_extra_costs, 1);
  para('Die Zahlung ist, sofern nicht anders schriftlich vereinbart, nach Rechnungsstellung sofort ohne Abzug fällig. Bis zur vollständigen Zahlung sämtlicher offener Forderungen aus diesem Vertrag ist der Lagerhalter berechtigt, die Herausgabe des Bootes und/oder Zubehörs zurückzuhalten, soweit dies gesetzlich zulässig ist.');

  // ---------- 6 ZUSATZLEISTUNGEN ----------
  heading('6 · Zusatzleistungen / Serviceaufträge');
  para('Der Kunde beauftragt zusätzlich folgende Leistungen:', 8);
  const selected = data.storage_services || [];
  const rowH = 7;
  const colJa = margin + 110;
  const colNein = margin + 135;
  ensure(rowH + 7);
  // table header
  doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.rect(margin, y, contentW, 6, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('Leistung', margin + 2, y + 4.2);
  doc.text('Ja', colJa + 2, y + 4.2);
  doc.text('Nein', colNein + 2, y + 4.2);
  y += 6;
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setDrawColor(LINE_GREY[0], LINE_GREY[1], LINE_GREY[2]);
  STORAGE_SERVICES.forEach((svc) => {
    ensure(rowH);
    const isSel = selected.includes(svc);
    doc.text(svc, margin + 2, y + 4.6);
    drawBox(colJa + 3, y + 4.6, isSel);
    drawBox(colNein + 3, y + 4.6, !isSel && selected.length > 0);
    doc.line(margin, y + rowH, margin + contentW, y + rowH);
    y += rowH;
  });
  y += 5;
  notesField('Weitere Aufträge / freie Liste', data.storage_services_notes, 3);
  para('Zusatzleistungen werden, sofern nicht ausdrücklich als Pauschale vereinbart, gesondert nach Aufwand, Materialverbrauch und jeweils gültigem Angebot bzw. Preisstand abgerechnet.');

  // ---------- 7 ZUSTAND ----------
  heading('7 · Zustand des Bootes bei Übernahme');
  ensure(14);
  doc.setFontSize(8.5);
  doc.setTextColor(40, 45, 50);
  drawBox(margin, y, data.boat_condition_ok === true);
  doc.text('Ohne erkennbare äußere Schäden', margin + 4.5, y);
  y += 6;
  drawBox(margin, y, data.boat_condition_ok === false);
  doc.text('Mit folgenden sichtbaren Schäden / Mängeln:', margin + 4.5, y);
  doc.setTextColor(0, 0, 0);
  y += 7;
  notesField('Schäden / Mängel', data.boat_condition_damages, 1);
  ensure(12);
  doc.setFontSize(7.5);
  doc.setTextColor(LABEL_GREY[0], LABEL_GREY[1], LABEL_GREY[2]);
  doc.text('Fotos / Übergabeprotokoll:', margin, y);
  doc.setTextColor(0, 0, 0);
  y += 5;
  checkOptions(PHOTO_OPTIONS, data.photos_status, 3);
  para('Der Kunde bestätigt, dass alle ihm bekannten technischen, elektrischen, mechanischen oder sicherheitsrelevanten Besonderheiten des Bootes dem Lagerhalter mitgeteilt wurden.');

  // ---------- 8 PFLICHTEN KUNDE ----------
  heading('8 · Pflichten des Kunden');
  para('Der Kunde verpflichtet sich, 1. das Boot in einem lagerfähigen und sicheren Zustand zu übergeben; 2. gefährliche Stoffe, offene Flüssigkeiten, Lebensmittel, verderbliche Gegenstände und sonstige risikobehaftete Gegenstände vor Einlagerung zu entfernen; 3. Kraftstoff, Gas, Batterien und sonstige Energiequellen nach Absprache mit dem Lagerhalter in einen sicheren Zustand zu bringen; 4. dem Lagerhalter alle für Lagerung, Bewegung, Sicherung und Servicearbeiten erforderlichen Schlüssel, Codes, Unterlagen und Informationen rechtzeitig zur Verfügung zu stellen; 5. Änderungen seiner Kontaktdaten unverzüglich mitzuteilen; 6. das Boot spätestens zum vereinbarten Ende der Einlagerung abzuholen oder rechtzeitig eine Verlängerung schriftlich zu vereinbaren.');

  // ---------- 9 PFLICHTEN LAGERHALTER ----------
  heading('9 · Pflichten des Lagerhalters');
  para('Der Lagerhalter verpflichtet sich, das Boot während der vereinbarten Einlagerung mit der üblichen Sorgfalt eines gewerblichen Lagerhalters zu behandeln. Der Lagerhalter ist berechtigt, das Boot auf dem Lagergelände zu bewegen, umzusetzen, zu sichern oder kurzfristig umzustellen, soweit dies aus betrieblichen, organisatorischen, sicherheitsrelevanten oder witterungsbedingten Gründen erforderlich ist. Eine regelmäßige technische Überwachung, Wartung, Entlüftung, Kontrolle von Batterien, Bilge, Motor, Leitungen, Abdeckungen oder sonstigen Bauteilen ist nur geschuldet, wenn dies ausdrücklich als Zusatzleistung vereinbart wurde.');

  // ---------- 10 HAFTUNG ----------
  heading('10 · Haftung und Versicherung');
  para('Der Lagerhalter haftet nur für Schäden, die durch vorsätzliches oder grob fahrlässiges Verhalten des Lagerhalters, seiner gesetzlichen Vertreter oder Erfüllungsgehilfen verursacht wurden, soweit gesetzlich zulässig. Für Schäden durch höhere Gewalt, Unwetter, Sturm, Hagel, Blitzschlag, Überschwemmung, Feuer, Diebstahl, Vandalismus, Tiere, Feuchtigkeit, Schimmel, Korrosion, Frost, technische Defekte, Batterieentladung oder bereits vorhandene Mängel haftet der Lagerhalter nicht, sofern diese Schäden nicht durch ein schuldhaftes Verhalten des Lagerhalters verursacht wurden. Der Kunde ist verpflichtet, für das Boot eine ausreichende Bootsversicherung einschließlich Lager- und Transportrisiken abzuschließen und auf Verlangen nachzuweisen.');
  ensure(14);
  doc.setFontSize(8.5);
  doc.setTextColor(40, 45, 50);
  doc.text('Der Kunde bestätigt:', margin, y);
  y += 6;
  drawBox(margin, y, data.boat_insured === true);
  doc.text('Das Boot ist versichert.', margin + 4.5, y);
  doc.setTextColor(0, 0, 0);
  y += 7;
  fieldRow([
    { label: 'Versicherungsgesellschaft', value: data.insurance_company },
    { label: 'Polizzennummer / Vertragsnummer', value: data.insurance_policy_number }
  ]);
  ensure(8);
  doc.setFontSize(8.5);
  doc.setTextColor(40, 45, 50);
  drawBox(margin, y, data.boat_insured === false);
  doc.text('Das Boot ist nicht oder nicht ausreichend versichert. Der Kunde trägt das daraus entstehende Risiko selbst.', margin + 4.5, y);
  doc.setTextColor(0, 0, 0);
  y += 8;

  // ---------- 11–15 LEGAL ----------
  heading('11 · Zugang zum Boot während der Einlagerung');
  para('Ein Zugang des Kunden zum Boot während der Einlagerung ist nur nach vorheriger Terminvereinbarung und während der Geschäfts- bzw. Zugangszeiten des Lagerhalters möglich. Eigenständige Arbeiten durch den Kunden oder Dritte auf dem Lagergelände sind nur nach vorheriger Zustimmung des Lagerhalters zulässig. Der Kunde darf Dritte nur mit schriftlicher Zustimmung des Lagerhalters mit Arbeiten am Boot auf dem Lagergelände beauftragen.');

  heading('12 · Abholung und Herausgabe');
  para('Die Herausgabe des Bootes erfolgt nach vollständiger Zahlung aller fälligen Forderungen aus der Einlagerung und eventuell beauftragten Zusatzleistungen. Der Kunde ist verpflichtet, die Abholung rechtzeitig mit dem Lagerhalter abzustimmen. Wird das Boot nach Ablauf der vereinbarten Lagerzeit nicht abgeholt und keine Verlängerung vereinbart, ist der Lagerhalter berechtigt, die weitere Lagerung zu den jeweils gültigen Tages-, Wochen- oder Monatssätzen zu berechnen.');

  heading('13 · Kündigung / vorzeitige Beendigung');
  para('Eine vorzeitige Beendigung der Einlagerung ist nur nach vorheriger Abstimmung möglich. Bereits angefallene Lagergebühren, Serviceleistungen, Materialkosten und sonstige Aufwendungen bleiben in jedem Fall zahlbar. Bei Jahres-, Saison- oder Pauschalvereinbarungen erfolgt eine Rückerstattung nur, wenn dies ausdrücklich schriftlich vereinbart wurde.');

  heading('14 · Datenschutz');
  para('Der Lagerhalter verarbeitet die personenbezogenen Daten des Kunden ausschließlich zur Durchführung dieses Vertrages, zur Rechnungsstellung, zur Kommunikation sowie zur Erfüllung gesetzlicher Pflichten. Eine Weitergabe an Dritte erfolgt nur, soweit dies zur Vertragserfüllung erforderlich ist oder eine gesetzliche Verpflichtung besteht.');

  heading('15 · Schlussbestimmungen');
  para('Änderungen und Ergänzungen dieses Vertrages bedürfen der Schriftform, sofern nicht eine strengere gesetzliche Form vorgeschrieben ist. Sollte eine Bestimmung dieses Vertrages ganz oder teilweise unwirksam sein oder werden, bleibt die Wirksamkeit der übrigen Bestimmungen unberührt. Es gilt, soweit gesetzlich zulässig, das Recht der Republik Kroatien. Gerichtsstand ist, soweit gesetzlich zulässig, der Sitz des Lagerhalters.');

  // ---------- 16 BESONDERE VEREINBARUNGEN ----------
  heading('16 · Besondere Vereinbarungen');
  ensure(20);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(30, 35, 40);
  const agreementLines = doc.splitTextToSize(data.special_agreements || '', contentW);
  if (agreementLines.length > 0 && data.special_agreements) {
    ensure(agreementLines.length * 4.2 + 4);
    doc.text(agreementLines, margin, y);
    y += agreementLines.length * 4.2 + 4;
  } else {
    // empty lines to fill in manually
    doc.setDrawColor(LINE_GREY[0], LINE_GREY[1], LINE_GREY[2]);
    for (let i = 0; i < 3; i++) {
      ensure(8);
      doc.line(margin, y, margin + contentW, y);
      y += 7;
    }
  }
  doc.setTextColor(0, 0, 0);
  y += 2;

  // ---------- SIGNATURES ----------
  ensure(50);
  fieldRow([
    { label: 'Ort', value: data.signed_place || 'Novigrad' },
    { label: 'Datum', value: data.order_date }
  ]);
  y += 14;
  doc.setDrawColor(90, 100, 110);
  doc.setLineWidth(0.4);
  const sigW = 75;
  doc.line(margin, y, margin + sigW, y);
  doc.line(pageW - margin - sigW, y, pageW - margin, y);
  y += 4;
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(LABEL_GREY[0], LABEL_GREY[1], LABEL_GREY[2]);
  doc.text('Unterschrift Kunde / Auftraggeber', margin, y);
  doc.text('Unterschrift Lagerhalter / Auftragnehmer', pageW - margin - sigW, y);
  doc.setTextColor(0, 0, 0);
  y += 12;
  fieldRow([{ label: 'Name des unterzeichnenden Mitarbeiters', value: data.accepted_by }]);

  return doc;
}

export function openEinlagerungsvertragPdf(data) {
  const doc = generateEinlagerungsvertragPdf(data);
  doc.autoPrint();
  window.open(doc.output('bloburl'), '_blank');
}