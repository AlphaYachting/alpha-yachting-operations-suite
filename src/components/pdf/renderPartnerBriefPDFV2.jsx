import { jsPDF } from 'jspdf';

/**
 * Partner Briefing PDF V2 — Clean professional operational document
 * Rebuilt architecture: clear hierarchy, calm layout, bilingual support.
 * Reuses branding assets (logo, company info, color palette) from the template object.
 */

// ─── Brand & Layout Constants ─────────────────────────────────────────────────
const TEAL     = { r: 0,   g: 155, b: 175 };
const DARK     = { r: 28,  g: 38,  b: 52  };
const MID      = { r: 95,  g: 108, b: 120 };
const SUBTLE   = { r: 155, g: 165, b: 175 };
const LIGHT_BG = { r: 247, g: 250, b: 252 };
const WARN_BG  = { r: 255, g: 249, b: 238 };
const WARN_ACC = { r: 195, g: 110, b: 20  };

const FONT = 'helvetica';
const PAGE_W = 210;
const PAGE_H = 297;
const ML = 20;   // margin left
const MR = 20;   // margin right
const MT = 16;   // margin top
const MB = 16;   // margin bottom
const CW = PAGE_W - ML - MR;

// ─── Primitive Helpers ────────────────────────────────────────────────────────

const setC  = (doc, { r, g, b }) => doc.setTextColor(r, g, b);
const setF  = (doc, { r, g, b }) => doc.setFillColor(r, g, b);
const setD  = (doc, { r, g, b }) => doc.setDrawColor(r, g, b);

function hRule(doc, x, y, w, color, lw = 0.25) {
  doc.setLineWidth(lw);
  setD(doc, color);
  doc.line(x, y, x + w, y);
}

function wrappedBlock(doc, text, x, y, maxW, lineH, checkBreak) {
  const lines = doc.splitTextToSize(text || '', maxW);
  lines.forEach(line => {
    checkBreak(lineH + 1);
    doc.text(line, x, y);
    y += lineH;
  });
  return y;
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function drawFooter(doc, template, pageNum) {
  const fy = PAGE_H - MB + 5;
  hRule(doc, ML, fy - 4, CW, SUBTLE, 0.2);
  doc.setFont(FONT, 'normal');
  doc.setFontSize(7);
  setC(doc, SUBTLE);
  const parts = [
    template?.company_name || 'Alpha Yachting',
    template?.company_address,
    template?.contact_email,
    template?.contact_phone,
  ].filter(Boolean).join('   ·   ');
  doc.text(parts, PAGE_W / 2, fy, { align: 'center' });
  doc.text(String(pageNum), PAGE_W - MR, fy, { align: 'right' });
}

// ─── Section Header — calm, clean, not heavy ──────────────────────────────────

function sectionHeader(doc, label, y) {
  // Small teal left accent
  setF(doc, TEAL);
  doc.rect(ML, y - 4, 2.5, 7, 'F');

  doc.setFont(FONT, 'bold');
  doc.setFontSize(9);
  setC(doc, TEAL);
  doc.text(label.toUpperCase(), ML + 6, y);

  // Light rule only — no heavy colored line
  hRule(doc, ML + 6, y + 2, CW - 6, { r: 210, g: 225, b: 230 }, 0.25);

  return y + 9;
}

// ─── Info Grid — 2-column key/value ──────────────────────────────────────────

function infoGrid(doc, rows, y) {
  const COL2_X  = ML + CW / 2 + 2;
  const LABEL_W = 30;
  const VAL_MAX = CW / 2 - LABEL_W - 5;

  rows.forEach(([l1, v1, l2, v2]) => {
    // Label
    doc.setFont(FONT, 'bold');
    doc.setFontSize(8);
    setC(doc, SUBTLE);
    doc.text((l1 || '').toString(), ML, y);

    // Value (wrap within column if long)
    doc.setFont(FONT, 'normal');
    doc.setFontSize(9);
    setC(doc, DARK);
    const v1lines = doc.splitTextToSize((v1 || '—').toString(), VAL_MAX);
    doc.text(v1lines[0], ML + LABEL_W, y);

    if (l2) {
      doc.setFont(FONT, 'bold');
      doc.setFontSize(8);
      setC(doc, SUBTLE);
      doc.text((l2 || '').toString(), COL2_X, y);

      doc.setFont(FONT, 'normal');
      doc.setFontSize(9);
      setC(doc, DARK);
      const v2lines = doc.splitTextToSize((v2 || '—').toString(), VAL_MAX);
      doc.text(v2lines[0], COL2_X + LABEL_W, y);
    }

    y += 5.5;
  });

  return y;
}

// ─── Narrative Block — bilingual, paragraph-aware ────────────────────────────

function narrativeBlock(doc, langLabel, text, x, y, maxW, checkBreak) {
  if (!text || !text.trim()) return y;

  // Language pill label
  setF(doc, TEAL);
  doc.roundedRect(x, y - 3.5, 20, 5, 1, 1, 'F');
  doc.setFont(FONT, 'bold');
  doc.setFontSize(7.5);
  setC(doc, { r: 255, g: 255, b: 255 });
  doc.text(langLabel, x + 10, y, { align: 'center' });
  y += 7;

  doc.setFont(FONT, 'normal');
  doc.setFontSize(9.5);
  setC(doc, DARK);

  const paragraphs = text.split('\n').filter(p => p.trim());
  paragraphs.forEach((para, i) => {
    const lines = doc.splitTextToSize(para.trim(), maxW);
    lines.forEach(line => {
      checkBreak(5.5);
      doc.text(line, x, y);
      y += 5.2;
    });
    if (i < paragraphs.length - 1) y += 2.5;
  });

  return y + 5;
}

// ─── Main Renderer ────────────────────────────────────────────────────────────

export async function renderPartnerBriefPDFV2(briefDocument, template = {}) {
  if (!briefDocument) throw new Error('No brief document provided');

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  let y = MT;
  let pageNum = 1;

  const checkBreak = (needed = 12) => {
    if (y + needed > PAGE_H - MB - 14) {
      drawFooter(doc, template, pageNum);
      doc.addPage();
      pageNum++;
      y = MT;
    }
  };

  // ───────────────────────────────────────────────────────────────────────────
  // A. HEADER — Logo dominant left, company identity right, title below
  // ───────────────────────────────────────────────────────────────────────────

  const LOGO_MAX_H = 28;   // significantly larger
  const LOGO_MAX_W = 80;
  const HEADER_BLOCK_H = LOGO_MAX_H + 4;

  // Load logo
  if (template?.logo_url) {
    try {
      await new Promise(resolve => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const ratio = img.naturalWidth / img.naturalHeight;
          let dh = LOGO_MAX_H;
          let dw = ratio * dh;
          if (dw > LOGO_MAX_W) { dw = LOGO_MAX_W; dh = dw / ratio; }
          // Vertically center logo in header block
          const logoY = y + (HEADER_BLOCK_H - dh) / 2;
          try { doc.addImage(img, 'PNG', ML, logoY, dw, dh, undefined, 'FAST'); } catch (_) {}
          resolve();
        };
        img.onerror = () => resolve();
        img.src = template.logo_url;
      });
    } catch (_) {}
  }

  // Company block — right side, vertically aligned with logo
  const companyName = template?.company_name || 'Alpha Yachting';
  doc.setFont(FONT, 'bold');
  doc.setFontSize(10.5);
  setC(doc, TEAL);
  doc.text(companyName, PAGE_W - MR, y + 6, { align: 'right' });

  doc.setFont(FONT, 'normal');
  doc.setFontSize(8);
  setC(doc, MID);
  let companyY = y + 12;
  if (template?.company_address) {
    doc.text(template.company_address, PAGE_W - MR, companyY, { align: 'right' });
    companyY += 4.5;
  }
  if (template?.contact_email) {
    doc.text(template.contact_email, PAGE_W - MR, companyY, { align: 'right' });
    companyY += 4.5;
  }
  if (template?.contact_phone) {
    doc.text(template.contact_phone, PAGE_W - MR, companyY, { align: 'right' });
  }

  y += HEADER_BLOCK_H + 5;

  y += 4;

  // Document title
  doc.setFont(FONT, 'bold');
  doc.setFontSize(20);
  setC(doc, DARK);
  doc.text('PARTNER BRIEFING', ML, y);

  y += 5;

  // Meta line — WO number + date + vessel name
  const { projectIdentification: id } = briefDocument;
  const vesselNameMeta = briefDocument.vesselInfo?.name && briefDocument.vesselInfo.name !== 'N/A'
    ? briefDocument.vesselInfo.name
    : (id?.vesselName || null);

  doc.setFont(FONT, 'normal');
  doc.setFontSize(8.5);
  setC(doc, MID);
  const metaParts = [
    `Work Order ${id?.workOrderNumber || '—'}`,
    id?.scheduledDate || '—',
    vesselNameMeta ? `Vessel: ${vesselNameMeta}` : null,
    `Generated: ${briefDocument.meta?.timestamp || ''}`,
  ].filter(Boolean);
  doc.text(metaParts.join('   ·   '), ML, y);

  y += 10;

  // ───────────────────────────────────────────────────────────────────────────
  // B. ASSIGNMENT SUMMARY
  // ───────────────────────────────────────────────────────────────────────────

  checkBreak(45);
  y = sectionHeader(doc, 'Assignment Summary', y);

  // Light background card
  setF(doc, LIGHT_BG);
  doc.rect(ML, y - 3, CW, 32, 'F');

  const vessel0 = briefDocument.vesselInfo;
  const berthStr = vessel0?.berth ? `Berth / Gate: ${vessel0.berth}` : null;

  y = infoGrid(doc, [
    ['Work Order',  id?.workOrderNumber || '—',  'Status',   id?.workOrderStatus || '—'],
    ['Title',       id?.workOrderTitle  || '—',  'Date',     id?.scheduledDate   || '—'],
    ['Vessel',      id?.vesselName      || '—',  'Berth / Gate', vessel0?.berth || '—'],
    ['Location',    id?.locationName    || '—',  null,       null],
  ], y + 1);

  const partner = briefDocument.assignedPartner;
  if (partner?.name && partner.name !== 'N/A') {
    hRule(doc, ML + 4, y + 1, CW - 8, { r: 220, g: 230, b: 235 }, 0.2);
    y += 6;
    y = infoGrid(doc, [
      ['Assigned To', partner.name    || '—', 'Role',  partner.role    || '—'],
      ['Contact',     partner.contact || '—', 'Email', partner.email   || '—'],
    ], y);
  }

  y += 8;

  // ───────────────────────────────────────────────────────────────────────────
  // C. SCOPE OF WORK — main narrative, visual center of the document
  // ───────────────────────────────────────────────────────────────────────────

  const desc = briefDocument.projectDescription;
  if (desc?.de || desc?.en) {
    checkBreak(40);
    y = sectionHeader(doc, 'Scope of Work', y);

    // German first — primary language for this partner type
    if (desc.de && desc.de.trim()) {
      y = narrativeBlock(doc, 'Deutsch', desc.de, ML, y, CW, checkBreak);
    }

    // English second
    if (desc.en && desc.en.trim()) {
      checkBreak(25);
      y = narrativeBlock(doc, 'English', desc.en, ML, y, CW, checkBreak);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // D. MAIN TASKS
  // ───────────────────────────────────────────────────────────────────────────

  const tasks = briefDocument.taskList || [];
  if (tasks.length > 0) {
    checkBreak(30);
    y = sectionHeader(doc, 'Main Tasks', y);

    // Table header
    const COL_NR   = ML;
    const COL_TITLE = ML + 8;
    const COL_TIME  = PAGE_W - MR;
    const ROW_H    = 7;

    setF(doc, { r: 40, g: 52, b: 68 });
    doc.rect(ML, y - 4, CW, 6.5, 'F');
    doc.setFont(FONT, 'bold');
    doc.setFontSize(7.5);
    setC(doc, { r: 255, g: 255, b: 255 });
    doc.text('#', COL_NR + 1, y);
    doc.text('Task', COL_TITLE, y);
    doc.text('Est.', COL_TIME, y, { align: 'right' });
    y += 5;

    tasks.forEach((task, idx) => {
      const isEven = idx % 2 === 0;

      // Measure title + description lines
      const titleLines = doc.splitTextToSize(task.title || '', CW - 22);
      const descLines  = task.description
        ? doc.splitTextToSize(task.description, CW - 22)
        : [];
      const rowH = titleLines.length * 5 + (descLines.length > 0 ? descLines.length * 4.2 + 2 : 0) + 5;
      checkBreak(rowH + 2);

      // Row background
      setF(doc, isEven ? LIGHT_BG : { r: 255, g: 255, b: 255 });
      doc.rect(ML, y - 3.5, CW, rowH, 'F');

      // Number
      doc.setFont(FONT, 'bold');
      doc.setFontSize(8);
      setC(doc, TEAL);
      doc.text(String(task.number), COL_NR + 2, y, { align: 'center' });

      // Title
      doc.setFont(FONT, 'bold');
      doc.setFontSize(9);
      setC(doc, DARK);
      titleLines.forEach((line, li) => {
        doc.text(line, COL_TITLE, y + li * 5);
      });

      // Est. time
      if (task.estimatedHours) {
        doc.setFont(FONT, 'normal');
        doc.setFontSize(8);
        setC(doc, MID);
        doc.text(`~${task.estimatedHours}h`, COL_TIME, y, { align: 'right' });
      }

      let rowY = y + titleLines.length * 5;

      // Description — subtle, smaller
      if (descLines.length > 0) {
        doc.setFont(FONT, 'normal');
        doc.setFontSize(7.5);
        setC(doc, MID);
        descLines.forEach(line => {
          doc.text(line, COL_TITLE, rowY);
          rowY += 4.2;
        });
        rowY += 1;
      }

      y = rowY + 3;
    });

    y += 4;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // E. VESSEL INFO
  // ───────────────────────────────────────────────────────────────────────────

  const vessel = briefDocument.vesselInfo;
  if (vessel && vessel.name && vessel.name !== 'N/A') {
    checkBreak(35);
    y = sectionHeader(doc, 'Vessel Information', y);

    const vesselRows = [
      ['Vessel', vessel.name || '—', 'Type', vessel.type || '—'],
      ['Length', vessel.length_m ? `${vessel.length_m} m` : '—', 'Year', vessel.year ? String(vessel.year) : '—'],
      ['Berth', vessel.berth || '—', 'Electrical', vessel.electrical_system || '—'],
    ];
    if (vessel.engine_type || vessel.engine_manufacturer || vessel.engine_model) {
      const engineStr = [vessel.engine_manufacturer, vessel.engine_model, vessel.engine_type].filter(Boolean).join(' · ');
      vesselRows.push(['Engine', engineStr, null, null]);
    }
    y = infoGrid(doc, vesselRows, y);

    if (vessel.access_details) {
      y += 1;
      doc.setFont(FONT, 'bold');
      doc.setFontSize(8);
      setC(doc, SUBTLE);
      doc.text('Vessel Access / Keys', ML, y);
      y += 5.5;
      doc.setFont(FONT, 'normal');
      doc.setFontSize(9);
      setC(doc, DARK);
      y = wrappedBlock(doc, vessel.access_details, ML + 3, y, CW - 6, 5, checkBreak);
    }
    if (vessel.known_issues) {
      y += 2;
      doc.setFont(FONT, 'bold');
      doc.setFontSize(8);
      setC(doc, SUBTLE);
      doc.text('Known Issues', ML, y);
      y += 5.5;
      doc.setFont(FONT, 'normal');
      doc.setFontSize(9);
      setC(doc, DARK);
      y = wrappedBlock(doc, vessel.known_issues, ML + 3, y, CW - 6, 5, checkBreak);
    }
    y += 6;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // F. LOCATION & ACCESS
  // ───────────────────────────────────────────────────────────────────────────

  const loc = briefDocument.locationAccess;
  if (loc) {
    checkBreak(35);
    y = sectionHeader(doc, 'Location & Access', y);

    const locRows = [
      ['Marina', loc.name    || '—', 'City',    [loc.city, loc.country].filter(Boolean).join(', ') || '—'],
      ['Address', loc.address || '—', null,      null],
    ];
    if (loc.contactPerson || loc.contactPhone) {
      locRows.push(['Marina Contact', loc.contactPerson || '—', 'Phone', loc.contactPhone || '—']);
    }
    if (loc.openingHours) {
      locRows.push(['Opening Hours', loc.openingHours, null, null]);
    }
    y = infoGrid(doc, locRows, y);

    if (loc.marinaFeeEnabled && loc.marinaFeeAmount) {
      y += 1;
      setF(doc, { r: 255, g: 249, b: 238 });
      doc.rect(ML, y - 2, CW, 8, 'F');
      doc.setFont(FONT, 'bold');
      doc.setFontSize(8);
      setC(doc, WARN_ACC);
      doc.text('Marina Fee applies:', ML + 3, y + 2);
      doc.setFont(FONT, 'normal');
      setC(doc, DARK);
      const feeLabel = loc.marinaFeeType === 'percent_commission'
        ? `${loc.marinaFeeAmount}% commission`
        : `€ ${loc.marinaFeeAmount} (${loc.marinaFeeType || 'flat'})`;
      doc.text(feeLabel, ML + 40, y + 2);
      y += 10;
    }

    const accessNotesText = loc.accessNotes && loc.accessNotes !== 'No special access notes' ? loc.accessNotes : null;
    if (accessNotesText) {
      y += 1;
      doc.setFont(FONT, 'bold');
      doc.setFontSize(8);
      setC(doc, SUBTLE);
      doc.text('Access Notes', ML, y);
      y += 5.5;
      doc.setFont(FONT, 'normal');
      doc.setFontSize(9);
      setC(doc, DARK);
      y = wrappedBlock(doc, accessNotesText, ML + 3, y, CW - 6, 5, checkBreak);
    }
    y += 6;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // F. SAFETY NOTES (if present)
  // ───────────────────────────────────────────────────────────────────────────

  if (briefDocument.safetyNotes) {
    checkBreak(25);
    y = sectionHeader(doc, 'Safety Notes', y);

    const safetyLines = doc.splitTextToSize(briefDocument.safetyNotes, CW - 8);
    const safetyBoxH = safetyLines.length * 5 + 9;
    setF(doc, { r: 255, g: 245, b: 245 });
    setD(doc, { r: 210, g: 80, b: 80 });
    doc.setLineWidth(0.4);
    doc.rect(ML, y - 2, CW, safetyBoxH, 'FD');

    doc.setFont(FONT, 'normal');
    doc.setFontSize(9);
    setC(doc, DARK);
    safetyLines.forEach(line => {
      checkBreak(5.5);
      doc.text(line, ML + 4, y);
      y += 5;
    });
    y += 7;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // G. DOCUMENTATION REQUIREMENTS — important, but visually subordinate to scope
  // ───────────────────────────────────────────────────────────────────────────

  const notice = briefDocument.documentationNotice;
  if (notice) {
    checkBreak(50);
    y = sectionHeader(doc, 'Documentation Requirements', y);

    const deLines = notice.de ? doc.splitTextToSize(notice.de, CW - 12) : [];
    const enLines = notice.en ? doc.splitTextToSize(notice.en, CW - 12) : [];
    const boxH = (deLines.length + enLines.length) * 5 + 24;

    // Softer warning box — amber tint, thinner border
    setF(doc, WARN_BG);
    setD(doc, { r: 210, g: 160, b: 70 });
    doc.setLineWidth(0.4);
    doc.rect(ML, y - 2, CW, boxH, 'FD');

    // Label — less aggressive than before
    doc.setFont(FONT, 'bold');
    doc.setFontSize(8);
    setC(doc, WARN_ACC);
    doc.text('Wichtig / Important', ML + 5, y + 3);
    y += 10;

    if (deLines.length > 0) {
      doc.setFont(FONT, 'bold');
      doc.setFontSize(7.5);
      setC(doc, TEAL);
      doc.text('Deutsch', ML + 5, y);
      y += 4.5;

      doc.setFont(FONT, 'normal');
      doc.setFontSize(8.5);
      setC(doc, DARK);
      deLines.forEach(line => {
        doc.text(line, ML + 5, y);
        y += 4.8;
      });
      y += 4;
    }

    if (enLines.length > 0) {
      doc.setFont(FONT, 'bold');
      doc.setFontSize(7.5);
      setC(doc, TEAL);
      doc.text('English', ML + 5, y);
      y += 4.5;

      doc.setFont(FONT, 'normal');
      doc.setFontSize(8.5);
      setC(doc, DARK);
      enLines.forEach(line => {
        doc.text(line, ML + 5, y);
        y += 4.8;
      });
    }

    y += 10;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // H. COST POLICIES & APPROVAL RULES
  // ───────────────────────────────────────────────────────────────────────────

  const cp = briefDocument.costPolicies;
  const ar = briefDocument.approvalRules;
  if (cp || ar) {
    checkBreak(55);
    y = sectionHeader(doc, 'Cost Policies & Approval Rules', y);

    // Build policy rows — only show enabled items
    const policyRows = [];
    if (cp?.accommodationPaid) {
      const val = cp.accommodationMaxPerNight ? `Ja — max. € ${cp.accommodationMaxPerNight}/Nacht` : 'Ja';
      policyRows.push(['Unterkunft', val, null, null]);
      if (cp.accommodationNotes) policyRows.push(['', cp.accommodationNotes, null, null]);
    } else {
      policyRows.push(['Unterkunft', 'Nicht gedeckt', null, null]);
    }
    if (cp?.perDiemPaid) {
      policyRows.push(['Verpflegung', cp.perDiemRatePerDay ? `€ ${cp.perDiemRatePerDay}/Tag` : 'Ja', null, null]);
    } else {
      policyRows.push(['Verpflegung', 'Nicht gedeckt', null, null]);
    }
    if (cp?.mileagePaid) {
      const val = [
        cp.mileageRatePerKm ? `€ ${cp.mileageRatePerKm}/km` : '',
        cp.mileageCapTotal  ? `max. € ${cp.mileageCapTotal}` : '',
      ].filter(Boolean).join(', ') || 'Ja';
      policyRows.push(['Kilometerentsch.', val, null, null]);
    } else {
      policyRows.push(['Kilometerentsch.', 'Nicht vergütet', null, null]);
    }
    if (cp?.travelTimePaid) {
      policyRows.push(['Fahrtzeit', cp.travelTimeRatePerHour ? `€ ${cp.travelTimeRatePerHour}/h` : 'Ja', null, null]);
    } else {
      policyRows.push(['Fahrtzeit', 'Nicht vergütet', null, null]);
    }
    if (cp?.otherReimbursablesAllowed) {
      policyRows.push(['Sonstige Kosten', cp.otherReimbursablesNotes || 'Nach Absprache erlaubt', null, null]);
    } else {
      policyRows.push(['Sonstige Kosten', 'Nicht erstattungsfähig', null, null]);
    }

    y = infoGrid(doc, policyRows, y);
    y += 4;

    // Approval rules box
    if (ar) {
      const currency = ar.currency || 'EUR';
      setF(doc, { r: 240, g: 245, b: 255 });
      setD(doc, { r: 160, g: 180, b: 220 });
      doc.setLineWidth(0.35);
      doc.rect(ML, y - 2, CW, 16, 'FD');

      doc.setFont(FONT, 'bold');
      doc.setFontSize(8);
      setC(doc, { r: 50, g: 80, b: 160 });
      doc.text('Genehmigungsregeln / Approval Rules', ML + 4, y + 2);

      doc.setFont(FONT, 'normal');
      doc.setFontSize(8.5);
      setC(doc, DARK);
      const rule1 = ar.budgetExceedRequiresApproval
        ? `Budget-Überschreitung erfordert Genehmigung.`
        : `Keine Genehmigung bei Budget-Überschreitung erforderlich.`;
      const rule2 = `Vorabgenehmigung erforderlich für Ausgaben über ${currency} ${ar.requiresPreapprovalOver}.`;
      doc.text(rule1, ML + 4, y + 7);
      doc.text(rule2, ML + 4, y + 12);
      y += 20;
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // I. BUDGET & COST COVERAGE
  // ───────────────────────────────────────────────────────────────────────────

  const budget = briefDocument.budget;
  if (budget) {
    checkBreak(40);
    y = sectionHeader(doc, 'Budget & Cost Coverage', y);

    // Subtle header row
    setF(doc, { r: 40, g: 52, b: 68 });
    doc.rect(ML, y - 3.5, CW, 6.5, 'F');
    doc.setFont(FONT, 'bold');
    doc.setFontSize(8);
    setC(doc, { r: 255, g: 255, b: 255 });
    doc.text('Category', ML + 4, y);
    doc.text('Amount (EUR)', PAGE_W - MR - 3, y, { align: 'right' });
    y += 7;

    const budgetRows = [
      { label: 'Total Approved Budget', value: budget.totalApproved, bold: true },
      { label: 'Labor',                 value: budget.labor,         bold: false },
      { label: 'Travel',                value: budget.travel,        bold: false },
      { label: 'Accommodation',         value: budget.accommodation, bold: false },
      { label: 'Per Diem / Daily',      value: budget.perDiem,       bold: false },
    ].filter(r => r.bold || (r.value && r.value > 0));

    budgetRows.forEach((row, idx) => {
      const isEven = idx % 2 === 0;
      setF(doc, isEven ? LIGHT_BG : { r: 255, g: 255, b: 255 });
      doc.rect(ML, y - 3.5, CW, 6, 'F');

      // Left accent for total row
      if (row.bold) {
        setF(doc, TEAL);
        doc.rect(ML, y - 3.5, 2.5, 6, 'F');
      }

      doc.setFont(FONT, row.bold ? 'bold' : 'normal');
      doc.setFontSize(9);
      setC(doc, row.bold ? DARK : MID);
      doc.text(row.label, ML + (row.bold ? 6 : 4), y);
      doc.text(`€ ${(row.value || 0).toFixed(2)}`, PAGE_W - MR - 3, y, { align: 'right' });
      y += 6;
    });

    y += 4;
  }

  // Final footer
  drawFooter(doc, template, pageNum);

  return doc;
}