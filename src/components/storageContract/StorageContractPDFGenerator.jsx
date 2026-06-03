import React from 'react';
import jsPDF from 'jspdf';
import { LEGAL_TEXT, COMPANY_HEADER, REQUIRED_SECTION_KEYS, validateLegalTextCompleteness } from '@/lib/storageContractLegalText';

/**
 * Validates contract completeness before PDF generation.
 * Returns { valid: bool, errors: string[] }
 */
export function validateContractForPDF(contract, serviceItems, isDraft = false) {
  const errors = [];

  // Language
  const missingLegal = validateLegalTextCompleteness(contract.language);
  if (missingLegal.length > 0) {
    errors.push(`Missing legal text blocks for language "${contract.language}": ${missingLegal.join(', ')}`);
  }

  if (!isDraft) {
    // Required contract data
    if (!contract.customer_id) errors.push('Customer is required');
    if (!contract.boat_id) errors.push('Boat data is required');
    if (!contract.storage_type) errors.push('Storage type is required');
    if (!contract.storage_start_date) errors.push('Storage start date is required');
    if (!contract.storage_end_date) errors.push('Storage end date is required');
    if (!contract.price_total_gross && contract.price_total_gross !== 0) errors.push('Pricing data is required');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Generates a complete storage contract PDF.
 * @param {object} contract - StorageContract record
 * @param {object} customer - Customer record
 * @param {object} boat - Boat record
 * @param {object} location - Location record (optional)
 * @param {array} serviceItems - StorageContractServiceItem records
 * @param {boolean} isDraft - If true, adds DRAFT watermark
 * @returns {jsPDF} - jsPDF instance (call .save() or .output() on it)
 */
export function generateStorageContractPDF(contract, customer, boat, location, serviceItems = [], isDraft = false) {
  const lang = contract.language || 'de';
  const T = LEGAL_TEXT[lang];
  if (!T) throw new Error(`Legal text not available for language: ${lang}`);

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pageW = 210;
  const marginL = 15;
  const marginR = 15;
  const contentW = pageW - marginL - marginR;
  let y = 15;
  const pageH = 297;
  const bottomMargin = 20;

  // ── Typography helpers ───────────────────────────────────────────────────
  const checkPage = (neededHeight = 10) => {
    if (y + neededHeight > pageH - bottomMargin) {
      doc.addPage();
      y = 15;
    }
  };

  const drawLine = (color = [200, 200, 200]) => {
    doc.setDrawColor(...color);
    doc.line(marginL, y, pageW - marginR, y);
    y += 3;
  };

  const heading1 = (text) => {
    checkPage(12);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 50, 80);
    doc.text(text, marginL, y);
    y += 7;
    doc.setDrawColor(30, 50, 80);
    doc.line(marginL, y - 2, pageW - marginR, y - 2);
    y += 3;
  };

  const heading2 = (text) => {
    checkPage(10);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40, 70, 120);
    doc.text(text, marginL, y);
    y += 6;
  };

  const body = (text, indent = 0) => {
    if (!text) return;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(50, 50, 50);
    const lines = doc.splitTextToSize(text, contentW - indent);
    for (const line of lines) {
      checkPage(5);
      doc.text(line, marginL + indent, y);
      y += 4.5;
    }
  };

  const labelValue = (label, value, bold = false) => {
    checkPage(6);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(80, 80, 80);
    doc.text(label + ':', marginL, y);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setTextColor(30, 30, 30);
    const valLines = doc.splitTextToSize(value || '–', contentW - 45);
    doc.text(valLines, marginL + 47, y);
    y += Math.max(5, valLines.length * 4.5);
  };

  const gap = (h = 4) => { y += h; };

  // ── DRAFT WATERMARK ──────────────────────────────────────────────────────
  const addDraftWatermark = () => {
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(72);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(200, 200, 200);
      doc.setGState(doc.GState({ opacity: 0.15 }));
      doc.text('DRAFT', pageW / 2, pageH / 2, { align: 'center', angle: 45 });
      doc.setGState(doc.GState({ opacity: 1 }));
    }
  };

  // ── PAGE HEADER (repeated on each page via footer logic) ─────────────────
  const drawPageHeader = () => {
    doc.setFillColor(20, 40, 80);
    doc.rect(0, 0, pageW, 24, 'F');
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(COMPANY_HEADER.name, marginL, 10);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(200, 220, 255);
    doc.text(`${COMPANY_HEADER.address}  |  OIB: ${COMPANY_HEADER.oib}  |  ${COMPANY_HEADER.email}`, marginL, 16);
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 200);

    const contractTitle = {
      de: 'LAGERVERTRAG',
      en: 'STORAGE CONTRACT',
      hr: 'UGOVOR O SKLADIŠTENJU',
      sl: 'POGODBA O SKLADIŠČENJU',
    }[lang] || 'STORAGE CONTRACT';

    doc.setFont('helvetica', 'bold');
    doc.text(contractTitle, pageW - marginR, 10, { align: 'right' });
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(200, 220, 255);
    doc.text(contract.contract_number || '', pageW - marginR, 16, { align: 'right' });
    y = 30;
  };

  // ── CONTRACT META BAR ─────────────────────────────────────────────────────
  drawPageHeader();

  doc.setFillColor(245, 247, 250);
  doc.rect(marginL, y, contentW, 18, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);

  const metaLabels = {
    de: { contract: 'Vertragsnummer', status: 'Status', lang: 'Sprache', date: 'Erstellt am' },
    en: { contract: 'Contract No.', status: 'Status', lang: 'Language', date: 'Generated' },
    hr: { contract: 'Broj ugovora', status: 'Status', lang: 'Jezik', date: 'Kreirano' },
    sl: { contract: 'Številka pogodbe', status: 'Status', lang: 'Jezik', date: 'Ustvarjeno' },
  }[lang];

  const langNames = { de: 'Deutsch', en: 'English', hr: 'Hrvatski', sl: 'Slovenščina' };
  const statusLabel = isDraft ? 'DRAFT' : (contract.status || 'Draft');

  doc.text(`${metaLabels.contract}: ${contract.contract_number || '–'}`, marginL + 3, y + 6);
  doc.text(`${metaLabels.status}: ${statusLabel}`, marginL + 60, y + 6);
  doc.text(`${metaLabels.lang}: ${langNames[lang] || lang}`, marginL + 110, y + 6);
  doc.text(`${metaLabels.date}: ${new Date().toLocaleDateString('de-DE')}`, marginL + 150, y + 6);
  y += 22;

  // ── SECTION 1: CUSTOMER DATA ─────────────────────────────────────────────
  heading1(T.sectionTitles.customerData);
  const customerName = [customer?.first_name, customer?.last_name].filter(Boolean).join(' ') || '–';
  const labels = {
    de: { name: 'Name / Firma', address: 'Adresse', city: 'PLZ / Ort', country: 'Land', phone: 'Telefon', email: 'E-Mail', vat: 'UID / OIB' },
    en: { name: 'Name / Company', address: 'Address', city: 'ZIP / City', country: 'Country', phone: 'Phone', email: 'E-Mail', vat: 'VAT / OIB' },
    hr: { name: 'Ime / Tvrtka', address: 'Adresa', city: 'PTT / Grad', country: 'Država', phone: 'Telefon', email: 'E-pošta', vat: 'PDV / OIB' },
    sl: { name: 'Ime / Podjetje', address: 'Naslov', city: 'PTT / Kraj', country: 'Država', phone: 'Telefon', email: 'E-pošta', vat: 'DDV / OIB' },
  }[lang];

  labelValue(labels.name, customer?.company_name ? `${customerName} (${customer.company_name})` : customerName);
  labelValue(labels.address, customer?.billing_address);
  labelValue(labels.city, [customer?.billing_postal_code, customer?.billing_city].filter(Boolean).join(' '));
  labelValue(labels.country, customer?.billing_country);
  labelValue(labels.phone, customer?.phone);
  labelValue(labels.email, customer?.email);
  if (customer?.vat_number) labelValue(labels.vat, customer.vat_number);
  gap();

  // ── SECTION 2: BOAT DATA ──────────────────────────────────────────────────
  heading1(T.sectionTitles.boatData);
  const boatLabels = {
    de: { name: 'Bootsname', type: 'Bootstyp', make: 'Hersteller / Modell', year: 'Baujahr', length: 'Länge', reg: 'Kennzeichen', engine: 'Motor', hull: 'Rumpfmaterial', location: 'Lagerstandort' },
    en: { name: 'Vessel Name', type: 'Vessel Type', make: 'Make / Model', year: 'Year', length: 'Length', reg: 'Registration', engine: 'Engine', hull: 'Hull Material', location: 'Storage Location' },
    hr: { name: 'Naziv plovila', type: 'Vrsta plovila', make: 'Proizvođač / Model', year: 'Godište', length: 'Duljina', reg: 'Reg. oznaka', engine: 'Motor', hull: 'Materijal trupa', location: 'Lokacija skladištenja' },
    sl: { name: 'Ime plovila', type: 'Vrsta plovila', make: 'Proizvajalec / Model', year: 'Leto', length: 'Dolžina', reg: 'Registrska ozn.', engine: 'Motor', hull: 'Material trupa', location: 'Lokacija skladiščenja' },
  }[lang];

  labelValue(boatLabels.name, boat?.vessel_name);
  labelValue(boatLabels.type, boat?.vessel_type);
  labelValue(boatLabels.make, [boat?.manufacturer, boat?.model].filter(Boolean).join(' '));
  if (boat?.year) labelValue(boatLabels.year, String(boat.year));
  labelValue(boatLabels.length, contract.boat_length_m ? `${contract.boat_length_m} m` : (boat?.length_m ? `${boat.length_m} m` : '–'));
  if (boat?.registration_number) labelValue(boatLabels.reg, boat.registration_number);
  if (boat?.engine_manufacturer) labelValue(boatLabels.engine, [boat.engine_manufacturer, boat.engine_model].filter(Boolean).join(' '));
  if (boat?.hull_material) labelValue(boatLabels.hull, boat.hull_material);
  if (location) labelValue(boatLabels.location, `${location.name || ''}${location.city ? `, ${location.city}` : ''}`);
  if (contract.boat_location_on_site) {
    const siteLbl = { de: 'Stellplatz', en: 'Site Position', hr: 'Mjesto na lokaciji', sl: 'Mesto na lokaciji' }[lang];
    labelValue(siteLbl, contract.boat_location_on_site);
  }
  gap();

  // ── SECTION 3: TRAILER ────────────────────────────────────────────────────
  heading1(T.sectionTitles.trailerData);
  const trailerYes = { de: 'Ja', en: 'Yes', hr: 'Da', sl: 'Da' }[lang];
  const trailerNo = { de: 'Nein', en: 'No', hr: 'Ne', sl: 'Ne' }[lang];
  const trailerLbl = { de: 'Trailer vorhanden', en: 'Trailer present', hr: 'Prikolica prisutna', sl: 'Prikolica prisotna' }[lang];
  labelValue(trailerLbl, contract.trailer_present ? trailerYes : trailerNo);
  if (contract.trailer_present) {
    if (contract.trailer_type) labelValue({ de: 'Typ / Marke', en: 'Type / Make', hr: 'Tip / Marka', sl: 'Tip / Znamka' }[lang], contract.trailer_type);
    if (contract.trailer_plate) labelValue({ de: 'Kennzeichen', en: 'License Plate', hr: 'Reg. oznaka', sl: 'Reg. oznaka' }[lang], contract.trailer_plate);
    if (contract.trailer_dimensions) labelValue({ de: 'Maße', en: 'Dimensions', hr: 'Dimenzije', sl: 'Mere' }[lang], contract.trailer_dimensions);
  }
  gap();

  // ── SECTION 4: STORAGE TYPE & DURATION ───────────────────────────────────
  heading1(T.sectionTitles.storageType);
  const storageLbl = {
    de: { type: 'Lagerart', start: 'Lagerbeginn', end: 'Lagerende', period: 'Bezeichnung', transport: 'Transport', pickup: 'Abholadresse', dist: 'Entfernung' },
    en: { type: 'Storage Type', start: 'Start Date', end: 'End Date', period: 'Period', transport: 'Transport', pickup: 'Pickup Address', dist: 'Distance' },
    hr: { type: 'Vrsta skladištenja', start: 'Početak', end: 'Kraj', period: 'Opis perioda', transport: 'Transport', pickup: 'Adresa preuzimanja', dist: 'Udaljenost' },
    sl: { type: 'Vrsta skladiščenja', start: 'Začetek', end: 'Konec', period: 'Opis obdobja', transport: 'Transport', pickup: 'Naslov prevzema', dist: 'Razdalja' },
  }[lang];

  const storageTypeNames = {
    outdoor: { de: 'Außen (unbedeckt)', en: 'Outdoor (uncovered)', hr: 'Vanjsko (nepokriveno)', sl: 'Zunaj (nepokrito)' }[lang],
    indoor: { de: 'Innen / Halle', en: 'Indoor / Hall', hr: 'Unutarnje / Hala', sl: 'Notranje / Hala' }[lang],
    indoor_roof: { de: 'Innen / Dach gedeckt', en: 'Indoor / Roof Covered', hr: 'Unutarnje / Pod krovom', sl: 'Notranje / Pod streho' }[lang],
    tent: { de: 'Zelt / Überdachung', en: 'Tent / Covered', hr: 'Šator / Nadstrešnica', sl: 'Šotor / Nadstrešek' }[lang],
  };

  labelValue(storageLbl.type, storageTypeNames[contract.storage_type] || contract.storage_type);
  labelValue(storageLbl.start, contract.storage_start_date ? new Date(contract.storage_start_date).toLocaleDateString('de-DE') : '–');
  labelValue(storageLbl.end, contract.storage_end_date ? new Date(contract.storage_end_date).toLocaleDateString('de-DE') : '–');
  if (contract.storage_period_label) labelValue(storageLbl.period, contract.storage_period_label);
  const transportYes = { de: 'Ja', en: 'Yes', hr: 'Da', sl: 'Da' }[lang];
  const transportNo = { de: 'Nein', en: 'No', hr: 'Ne', sl: 'Ne' }[lang];
  labelValue(storageLbl.transport, contract.transport_included ? transportYes : transportNo);
  if (contract.transport_included) {
    if (contract.transport_pickup_address) labelValue(storageLbl.pickup, contract.transport_pickup_address);
    if (contract.transport_distance_km) labelValue(storageLbl.dist, `${contract.transport_distance_km} km`);
  }
  gap();

  // ── SECTION 5: PRICING ────────────────────────────────────────────────────
  checkPage(60);
  heading1(T.sectionTitles.pricing);

  // Line items table
  const colX = [marginL, marginL + 90, marginL + 120, marginL + 148, marginL + 168];
  const colW = [90, 30, 28, 20, 12];
  const prcLbl = {
    de: { desc: 'Leistung', qty: 'Menge', unit: 'Einheit', price: 'Preis/E.', total: 'Gesamt', subtotal: 'Nettobetrag', vat: 'MwSt.', gross: 'Gesamtbetrag' },
    en: { desc: 'Service', qty: 'Qty', unit: 'Unit', price: 'Price/U.', total: 'Total', subtotal: 'Net Total', vat: 'VAT', gross: 'Gross Total' },
    hr: { desc: 'Usluga', qty: 'Kol.', unit: 'Jed.', price: 'Cijena/J.', total: 'Ukupno', subtotal: 'Neto iznos', vat: 'PDV', gross: 'Bruto iznos' },
    sl: { desc: 'Storitev', qty: 'Kol.', unit: 'Enota', price: 'Cena/E.', total: 'Skupaj', subtotal: 'Neto znesek', vat: 'DDV', gross: 'Bruto znesek' },
  }[lang];

  // Table header
  doc.setFillColor(30, 50, 80);
  doc.rect(marginL, y, contentW, 7, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(prcLbl.desc, colX[0] + 1, y + 5);
  doc.text(prcLbl.qty, colX[1], y + 5, { align: 'right' });
  doc.text(prcLbl.unit, colX[2], y + 5, { align: 'right' });
  doc.text(prcLbl.price, colX[3] + 19, y + 5, { align: 'right' });
  doc.text(prcLbl.total, pageW - marginR, y + 5, { align: 'right' });
  y += 8;

  // Rows
  const allItems = serviceItems.length > 0 ? serviceItems : [];
  if (allItems.length === 0 && contract.price_total_net) {
    // Fallback single row
    allItems.push({
      title: { de: 'Lagerservice', en: 'Storage Service', hr: 'Usluga skladištenja', sl: 'Storitev skladiščenja' }[lang],
      quantity: 1, unit: 'pau',
      unit_price: contract.price_storage_net || contract.price_total_net,
      total_price: contract.price_storage_net || contract.price_total_net,
    });
  }

  allItems.forEach((item, idx) => {
    checkPage(7);
    doc.setFillColor(idx % 2 === 0 ? 248 : 255, idx % 2 === 0 ? 250 : 255, idx % 2 === 0 ? 252 : 255);
    doc.rect(marginL, y - 1, contentW, 6.5, 'F');
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 30, 30);
    const descLines = doc.splitTextToSize(item.title || '', 85);
    doc.text(descLines[0], colX[0] + 1, y + 4);
    doc.text(String(item.quantity || 1), colX[1], y + 4, { align: 'right' });
    doc.text(item.unit || '', colX[2], y + 4, { align: 'right' });
    doc.text(`€ ${parseFloat(item.unit_price || 0).toFixed(2)}`, colX[3] + 19, y + 4, { align: 'right' });
    doc.text(`€ ${parseFloat(item.total_price || 0).toFixed(2)}`, pageW - marginR, y + 4, { align: 'right' });
    y += 6.5;
  });

  // Totals
  gap(2);
  drawLine([180, 180, 180]);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);

  const formatEur = (v) => `€ ${parseFloat(v || 0).toFixed(2)}`;

  checkPage(8);
  doc.text(prcLbl.subtotal + ':', marginL + 110, y + 4);
  doc.setFont('helvetica', 'bold');
  doc.text(formatEur(contract.price_total_net), pageW - marginR, y + 4, { align: 'right' });
  y += 6;

  checkPage(7);
  doc.setFont('helvetica', 'normal');
  doc.text(`${prcLbl.vat} (${contract.vat_rate || 25}%):`, marginL + 110, y + 4);
  doc.setFont('helvetica', 'bold');
  doc.text(formatEur(contract.price_vat), pageW - marginR, y + 4, { align: 'right' });
  y += 6;

  checkPage(10);
  doc.setFillColor(20, 40, 80);
  doc.rect(marginL + 100, y - 1, contentW - 100, 9, 'F');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(prcLbl.gross + ':', marginL + 102, y + 5);
  doc.text(formatEur(contract.price_total_gross), pageW - marginR - 1, y + 5, { align: 'right' });
  y += 13;

  if (contract.payment_terms) {
    const ptLbl = { de: 'Zahlungsbedingungen', en: 'Payment Terms', hr: 'Uvjeti plaćanja', sl: 'Plačilni pogoji' }[lang];
    checkPage(10);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(60, 60, 60);
    doc.text(ptLbl + ':', marginL, y);
    y += 5;
    body(contract.payment_terms);
  }
  if (contract.payment_due_date) {
    const pdLbl = { de: 'Zahlungsfrist', en: 'Payment Due', hr: 'Rok plaćanja', sl: 'Rok plačila' }[lang];
    labelValue(pdLbl, new Date(contract.payment_due_date).toLocaleDateString('de-DE'));
  }
  gap();

  // ── SECTION 6: ADDITIONAL SERVICES ───────────────────────────────────────
  const extraItems = serviceItems.filter(i => i.category !== 'STORAGE' && i.category !== 'TRANSPORT');
  if (extraItems.length > 0) {
    heading1(T.sectionTitles.additionalServices);
    extraItems.forEach(item => {
      checkPage(6);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(40, 40, 40);
      doc.text(`• ${item.title}`, marginL + 2, y);
      y += 4.5;
      if (item.description) body(item.description, 4);
    });
    gap();
  }

  // ── SECTION 7: BOAT CONDITION ─────────────────────────────────────────────
  heading1(T.sectionTitles.boatCondition);
  const bcLbl = {
    de: { condition: 'Allgemeiner Zustand', damage: 'Vorhandene Schäden', insurance: 'Versicherung', insurer: 'Versicherer', policy: 'Policennummer', valid: 'Gültig bis', sum: 'Versicherungssumme' },
    en: { condition: 'General Condition', damage: 'Existing Damage', insurance: 'Insurance', insurer: 'Insurer', policy: 'Policy Number', valid: 'Valid Until', sum: 'Coverage Amount' },
    hr: { condition: 'Opće stanje', damage: 'Postojeća oštećenja', insurance: 'Osiguranje', insurer: 'Osiguravatelj', policy: 'Broj police', valid: 'Vrijedi do', sum: 'Osigurana svota' },
    sl: { condition: 'Splošno stanje', damage: 'Obstoječe poškodbe', insurance: 'Zavarovanje', insurer: 'Zavarovalnica', policy: 'Številka police', valid: 'Veljavno do', sum: 'Zavarovalna vsota' },
  }[lang];

  if (contract.boat_condition_notes) {
    body(contract.boat_condition_notes);
  } else {
    const noNotes = { de: 'Keine besonderen Anmerkungen.', en: 'No special remarks.', hr: 'Nema posebnih napomena.', sl: 'Ni posebnih opomb.' }[lang];
    body(noNotes);
  }
  if (contract.existing_damage_notes) {
    gap(2);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(60, 60, 60);
    doc.text(bcLbl.damage + ':', marginL, y);
    y += 5;
    body(contract.existing_damage_notes);
  }
  gap(3);

  // Insurance
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 70, 120);
  doc.text(bcLbl.insurance, marginL, y);
  y += 5;
  labelValue(bcLbl.insurer, contract.insurance_provider);
  labelValue(bcLbl.policy, contract.insurance_policy_number);
  if (contract.insurance_valid_until) labelValue(bcLbl.valid, new Date(contract.insurance_valid_until).toLocaleDateString('de-DE'));
  if (contract.insurance_coverage_amount) labelValue(bcLbl.sum, `€ ${contract.insurance_coverage_amount.toLocaleString()}`);
  gap();

  // ── FIXED LEGAL SECTIONS 8–15 ─────────────────────────────────────────────
  const legalSections = [
    { key: 'customerObligations', title: T.sectionTitles.customerObligations },
    { key: 'providerObligations', title: T.sectionTitles.providerObligations },
    { key: 'liabilityInsurance', title: T.sectionTitles.liabilityInsurance },
    { key: 'access', title: T.sectionTitles.access },
    { key: 'pickupRelease', title: T.sectionTitles.pickupRelease },
    { key: 'termination', title: T.sectionTitles.termination },
    { key: 'dataProtection', title: T.sectionTitles.dataProtection },
    { key: 'finalProvisions', title: T.sectionTitles.finalProvisions },
  ];

  for (const section of legalSections) {
    checkPage(20);
    heading1(section.title);
    body(T[section.key]);
    gap(3);
  }

  // ── SECTION 16: SPECIAL AGREEMENTS & SIGNATURES ───────────────────────────
  checkPage(60);
  heading1(T.sectionTitles.specialAgreements);

  if (contract.special_agreements) {
    body(contract.special_agreements);
  } else {
    const noSpecial = { de: 'Keine besonderen Vereinbarungen.', en: 'No special agreements.', hr: 'Nema posebnih sporazuma.', sl: 'Ni posebnih dogovorov.' }[lang];
    body(noSpecial);
  }

  gap(8);
  checkPage(50);

  // Place & Date
  const placeDate = contract.signed_place
    ? `${contract.signed_place}, ${contract.signed_date ? new Date(contract.signed_date).toLocaleDateString('de-DE') : new Date().toLocaleDateString('de-DE')}`
    : `__________________, ${new Date().toLocaleDateString('de-DE')}`;

  const placeLbl = { de: 'Ort, Datum', en: 'Place, Date', hr: 'Mjesto, Datum', sl: 'Kraj, Datum' }[lang];
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  doc.text(`${placeLbl}: ${placeDate}`, marginL, y);
  y += 12;

  // Signature boxes
  const sigW = (contentW - 10) / 2;
  const sigH = 28;
  const sigY = y;

  doc.setDrawColor(120, 120, 120);
  doc.setLineWidth(0.3);
  doc.rect(marginL, sigY, sigW, sigH);
  doc.rect(marginL + sigW + 10, sigY, sigW, sigH);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 40, 80);

  const sigLbl1 = { de: 'Auftraggeber (Kunde)', en: 'Client (Customer)', hr: 'Naručitelj (Klijent)', sl: 'Naročnik (Stranka)' }[lang];
  const sigLbl2 = { de: 'Lagerhalter (Auftragnehmer)', en: 'Storage Provider', hr: 'Skladištar (Izvršitelj)', sl: 'Skladiščar (Izvajalec)' }[lang];
  const sigNameLbl = { de: 'Name in Druckschrift', en: 'Name in print', hr: 'Ime tiskanim slovima', sl: 'Ime tiskano' }[lang];

  doc.text(sigLbl1, marginL + 2, sigY + 5);
  doc.text(sigLbl2, marginL + sigW + 12, sigY + 5);

  if (contract.signed_by_customer) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 30, 30);
    doc.text(contract.signed_by_customer, marginL + 2, sigY + 18);
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(150, 150, 150);
    doc.text('___________________________', marginL + 2, sigY + 18);
    doc.setFontSize(7);
    doc.text(sigNameLbl, marginL + 2, sigY + 23);
  }

  if (contract.signed_by_provider) {
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 30, 30);
    doc.text(contract.signed_by_provider, marginL + sigW + 12, sigY + 18);
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(150, 150, 150);
    doc.setFontSize(8.5);
    doc.text('___________________________', marginL + sigW + 12, sigY + 18);
    doc.setFontSize(7);
    doc.text(sigNameLbl, marginL + sigW + 12, sigY + 23);
  }

  y += sigH + 5;

  // ── Page numbers ──────────────────────────────────────────────────────────
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(150, 150, 150);
    doc.text(`${i} / ${totalPages}`, pageW - marginR, pageH - 8, { align: 'right' });
    doc.text(COMPANY_HEADER.name + ' | ' + COMPANY_HEADER.oib, marginL, pageH - 8);
  }

  // ── Draft watermark ───────────────────────────────────────────────────────
  if (isDraft) addDraftWatermark();

  return doc;
}

export default function StorageContractPDFButton({ contract, customer, boat, location, serviceItems, isDraft = false, className = '' }) {
  const handleGenerate = () => {
    const { valid, errors } = validateContractForPDF(contract, serviceItems, isDraft);
    if (!valid) {
      alert('PDF generation blocked:\n\n' + errors.join('\n'));
      return;
    }
    const doc = generateStorageContractPDF(contract, customer, boat, location, serviceItems, isDraft);
    const filename = `${contract.contract_number || 'StorageContract'}_${contract.language || 'de'}${isDraft ? '_DRAFT' : ''}.pdf`;
    doc.save(filename);
  };

  return (
    <button onClick={handleGenerate} className={className}>
      {isDraft ? '📄 Download Draft PDF' : '📄 Download Contract PDF'}
    </button>
  );
}