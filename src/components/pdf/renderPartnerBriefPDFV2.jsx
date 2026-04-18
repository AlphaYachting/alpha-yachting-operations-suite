import { jsPDF } from 'jspdf';

/**
 * Partner Briefing PDF V2
 * Clean, professional operational document for external workers / partners.
 * Rebuilt from scratch with clear typography, section hierarchy, and bilingual support.
 * Reuses branding assets (logo, company info, color palette) from the template object.
 */

// ─── Brand & Layout Constants ────────────────────────────────────────────────
const TEAL  = { r: 0,   g: 160, b: 180 };  // primary accent
const DARK  = { r: 30,  g: 40,  b: 55  };  // near-black text
const MID   = { r: 90,  g: 100, b: 115 };  // secondary text
const LIGHT = { r: 200, g: 210, b: 215 };  // subtle rules
const WARN_BG  = { r: 255, g: 248, b: 235 };
const WARN_ACC = { r: 220, g: 110, b: 20  };

const FONT   = 'helvetica';
const PAGE_W = 210;   // A4 mm
const PAGE_H = 297;
const ML     = 18;    // margin left
const MR     = 18;    // margin right
const MT     = 18;    // margin top
const MB     = 18;    // margin bottom
const CW     = PAGE_W - ML - MR;  // content width

// ─── Low-level Drawing Helpers ────────────────────────────────────────────────

function setColor(doc, { r, g, b }) {
  doc.setTextColor(r, g, b);
}

function setFill(doc, { r, g, b }) {
  doc.setFillColor(r, g, b);
}

function setDraw(doc, { r, g, b }) {
  doc.setDrawColor(r, g, b);
}

function rule(doc, x, y, w, color = LIGHT, lw = 0.3) {
  doc.setLineWidth(lw);
  setDraw(doc, color);
  doc.line(x, y, x + w, y);
}

function wrappedText(doc, text, x, y, maxW, lineH, checkBreak) {
  const lines = doc.splitTextToSize(text, maxW);
  lines.forEach(line => {
    if (checkBreak) checkBreak(lineH + 1);
    doc.text(line, x, y);
    y += lineH;
  });
  return y;
}

// ─── Page Footer ─────────────────────────────────────────────────────────────

function drawFooter(doc, template, pageNum) {
  const fy = PAGE_H - MB + 6;
  doc.setFont(FONT, 'normal');
  doc.setFontSize(7);
  setColor(doc, MID);

  const parts = [
    template?.company_name || 'Alpha Yachting',
    template?.company_address,
    template?.contact_email,
    template?.contact_phone,
  ].filter(Boolean).join('  ·  ');

  doc.text(parts, PAGE_W / 2, fy, { align: 'center' });
  doc.text(`${pageNum}`, PAGE_W - MR, fy, { align: 'right' });

  rule(doc, ML, fy - 3, CW, LIGHT, 0.2);
}

// ─── Section Header ───────────────────────────────────────────────────────────

function sectionHeader(doc, label, y) {
  // Teal accent bar left
  setFill(doc, TEAL);
  doc.rect(ML, y - 3.5, 2, 6, 'F');

  doc.setFont(FONT, 'bold');
  doc.setFontSize(8.5);
  setColor(doc, TEAL);
  doc.text(label.toUpperCase(), ML + 5, y);

  rule(doc, ML + 5, y + 1.5, CW - 5, TEAL, 0.25);

  return y + 7;
}

// ─── Key/Value Info Block ─────────────────────────────────────────────────────

/**
 * Renders a compact 2-column key/value grid.
 * rows: [[label, value], ...] or [[label, value, label2, value2], ...]
 */
function infoGrid(doc, rows, y) {
  const COL2_X = ML + CW / 2;
  const LABEL_W = 28;

  rows.forEach(([l1, v1, l2, v2]) => {
    doc.setFont(FONT, 'bold');
    doc.setFontSize(8.5);
    setColor(doc, MID);
    doc.text((l1 || '').toString(), ML, y);

    doc.setFont(FONT, 'normal');
    setColor(doc, DARK);
    const v1str = (v1 || '—').toString();
    // Clip long values within their column
    const v1lines = doc.splitTextToSize(v1str, CW / 2 - LABEL_W - 4);
    doc.text(v1lines[0], ML + LABEL_W, y);

    if (l2) {
      doc.setFont(FONT, 'bold');
      setColor(doc, MID);
      doc.text((l2 || '').toString(), COL2_X, y);

      doc.setFont(FONT, 'normal');
      setColor(doc, DARK);
      const v2str = (v2 || '—').toString();
      const v2lines = doc.splitTextToSize(v2str, CW / 2 - LABEL_W - 4);
      doc.text(v2lines[0], COL2_X + LABEL_W, y);
    }

    y += 5;
  });

  return y;
}

// ─── Narrative Text Block ─────────────────────────────────────────────────────

function narrativeBlock(doc, langLabel, text, x, y, maxW, checkBreak) {
  if (!text || !text.trim()) return y;

  // Language label
  doc.setFont(FONT, 'bold');
  doc.setFontSize(8);
  setColor(doc, TEAL);
  doc.text(langLabel, x, y);
  y += 5;

  // Body text
  doc.setFont(FONT, 'normal');
  doc.setFontSize(9);
  setColor(doc, DARK);

  const paragraphs = text.split('\n').filter(p => p.trim());
  paragraphs.forEach((para, i) => {
    const lines = doc.splitTextToSize(para.trim(), maxW);
    lines.forEach(line => {
      checkBreak(5.5);
      doc.text(line, x, y);
      y += 5;
    });
    if (i < paragraphs.length - 1) y += 2; // inter-paragraph spacing
  });

  return y + 3;
}

// ─── Main Export ─────────────────────────────────────────────────────────────

export async function renderPartnerBriefPDFV2(briefDocument, template = {}) {
  if (!briefDocument) throw new Error('No brief document provided');

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  let y = MT;
  let pageNum = 1;

  // ── Page break guard ──────────────────────────────────────────────────────
  const checkBreak = (needed = 10) => {
    if (y + needed > PAGE_H - MB - 12) {
      drawFooter(doc, template, pageNum);
      doc.addPage();
      pageNum++;
      y = MT;
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // 1. HEADER — Logo + Company identity + Document title
  // ─────────────────────────────────────────────────────────────────────────

  // Logo (top-left)
  const LOGO_MAX_H = 18;
  const LOGO_MAX_W = 55;
  let logoRendered = false;

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
          try {
            doc.addImage(img, 'PNG', ML, y, dw, dh, undefined, 'FAST');
            logoRendered = true;
          } catch (_) {}
          resolve();
        };
        img.onerror = () => resolve();
        img.src = template.logo_url;
      });
    } catch (_) {}
  }

  // Company name & address (top-right)
  doc.setFont(FONT, 'bold');
  doc.setFontSize(11);
  setColor(doc, TEAL);
  doc.text(template?.company_name || 'Alpha Yachting', PAGE_W - MR, y + 3, { align: 'right' });

  doc.setFont(FONT, 'normal');
  doc.setFontSize(8);
  setColor(doc, MID);
  if (template?.company_address) {
    doc.text(template.company_address, PAGE_W - MR, y + 8, { align: 'right' });
  }
  if (template?.contact_email) {
    doc.text(template.contact_email, PAGE_W - MR, y + 13, { align: 'right' });
  }

  y += LOGO_MAX_H + 10;

  // Full-width header rule
  setFill(doc, TEAL);
  doc.rect(ML, y, CW, 0.5, 'F');
  y += 5;

  // Document title
  doc.setFont(FONT, 'bold');
  doc.setFontSize(18);
  setColor(doc, DARK);
  doc.text('PARTNER BRIEFING', ML, y);

  // V2 badge (right-aligned, same line)
  doc.setFont(FONT, 'bold');
  doc.setFontSize(7.5);
  setColor(doc, { r: 255, g: 255, b: 255 });
  setFill(doc, TEAL);
  doc.roundedRect(PAGE_W - MR - 14, y - 5, 14, 6.5, 1, 1, 'F');
  doc.text('V2', PAGE_W - MR - 7, y - 0.5, { align: 'center' });

  y += 4;
  // Subtitle line
  doc.setFont(FONT, 'normal');
  doc.setFontSize(8);
  setColor(doc, MID);
  const { projectIdentification: id } = briefDocument;
  doc.text(`Work Order ${id?.workOrderNumber || '—'}  ·  Generated: ${briefDocument.meta?.timestamp || ''}`, ML, y);

  y += 8;

  // ─────────────────────────────────────────────────────────────────────────
  // 2. ASSIGNMENT SUMMARY — compact scannable block
  // ─────────────────────────────────────────────────────────────────────────

  checkBreak(40);
  y = sectionHeader(doc, 'Assignment Summary', y);

  // Summary box background
  setFill(doc, { r: 246, g: 250, b: 252 });
  doc.rect(ML, y - 2, CW, 30, 'F');
  rule(doc, ML, y - 2, CW, LIGHT, 0.3);

  y = infoGrid(doc, [
    ['Work Order',   id?.workOrderNumber  || '—',  'Status',    id?.workOrderStatus  || '—'],
    ['Title',        id?.workOrderTitle   || '—',  'Date',      id?.scheduledDate    || '—'],
    ['Customer',     id?.customerName     || '—',  'Vessel',    id?.vesselName       || '—'],
    ['Location',     id?.locationName     || '—',  null,        null],
  ], y + 2);

  // Partner info inline if available
  const partner = briefDocument.assignedPartner;
  if (partner?.name && partner.name !== 'N/A') {
    rule(doc, ML + 5, y + 1, CW - 10, LIGHT, 0.2);
    y += 5;
    y = infoGrid(doc, [
      ['Assigned To',  partner.name  || '—',  'Role',    partner.role    || '—'],
      ['Contact',      partner.contact || '—',  'Email',   partner.email   || '—'],
    ], y);
  }

  y += 6;

  // ─────────────────────────────────────────────────────────────────────────
  // 3. SCOPE OF WORK — bilingual narrative
  // ─────────────────────────────────────────────────────────────────────────

  const desc = briefDocument.projectDescription;
  if (desc?.en || desc?.de) {
    checkBreak(35);
    y = sectionHeader(doc, 'Scope of Work', y);

    // German first (native language of most partners)
    if (desc.de) {
      y = narrativeBlock(doc, 'Deutsch', desc.de, ML, y, CW, checkBreak);
    } else {
      doc.setFont(FONT, 'italic');
      doc.setFontSize(8);
      setColor(doc, MID);
      doc.text('Deutsche Übersetzung nicht verfügbar.', ML, y);
      y += 6;
    }

    // English
    if (desc.en) {
      checkBreak(20);
      y = narrativeBlock(doc, 'English', desc.en, ML, y, CW, checkBreak);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 4. MAIN TASKS — clean numbered work list
  // ─────────────────────────────────────────────────────────────────────────

  const tasks = briefDocument.taskList || [];
  if (tasks.length > 0) {
    checkBreak(30);
    y = sectionHeader(doc, 'Main Tasks', y);

    tasks.forEach((task, idx) => {
      const isLast = idx === tasks.length - 1;
      // Estimate needed space
      const descLines = task.description
        ? doc.splitTextToSize(task.description, CW - 12).length
        : 0;
      const needed = 8 + descLines * 4.5 + (task.estimatedHours ? 4 : 0) + 5;
      checkBreak(needed);

      // Task number chip
      setFill(doc, TEAL);
      doc.circle(ML + 3, y - 1, 3, 'F');
      doc.setFont(FONT, 'bold');
      doc.setFontSize(7.5);
      setColor(doc, { r: 255, g: 255, b: 255 });
      doc.text(String(task.number), ML + 3, y + 0.2, { align: 'center' });

      // Task title
      doc.setFont(FONT, 'bold');
      doc.setFontSize(9.5);
      setColor(doc, DARK);
      doc.text(task.title, ML + 9, y);

      // Estimated time (right-aligned if available)
      if (task.estimatedHours) {
        doc.setFont(FONT, 'normal');
        doc.setFontSize(8);
        setColor(doc, MID);
        doc.text(`~${task.estimatedHours}h`, PAGE_W - MR, y, { align: 'right' });
      }

      y += 5.5;

      // Task description
      if (task.description) {
        doc.setFont(FONT, 'normal');
        doc.setFontSize(8.5);
        setColor(doc, MID);
        const dlines = doc.splitTextToSize(task.description, CW - 12);
        dlines.forEach(line => {
          checkBreak(4.5);
          doc.text(line, ML + 9, y);
          y += 4.5;
        });
      }

      // Separator (not after last)
      if (!isLast) {
        y += 2;
        rule(doc, ML + 9, y, CW - 9, LIGHT, 0.2);
        y += 4;
      } else {
        y += 4;
      }
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 5. LOCATION & ACCESS
  // ─────────────────────────────────────────────────────────────────────────

  const loc = briefDocument.locationAccess;
  if (loc) {
    checkBreak(30);
    y = sectionHeader(doc, 'Location & Access', y);

    y = infoGrid(doc, [
      ['Marina / Location', loc.name    || '—', 'City',    loc.city    || '—'],
      ['Address',           loc.address || '—', null,      null],
    ], y);

    if (loc.accessNotes && loc.accessNotes !== 'No special access notes') {
      y += 1;
      doc.setFont(FONT, 'bold');
      doc.setFontSize(8.5);
      setColor(doc, MID);
      doc.text('Access Notes', ML, y);
      y += 5;

      doc.setFont(FONT, 'normal');
      doc.setFontSize(9);
      setColor(doc, DARK);
      y = wrappedText(doc, loc.accessNotes, ML + 3, y, CW - 6, 5, checkBreak);
    }
    y += 4;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 6. SAFETY NOTES
  // ─────────────────────────────────────────────────────────────────────────

  if (briefDocument.safetyNotes) {
    checkBreak(25);
    y = sectionHeader(doc, 'Safety Notes', y);

    // Subtle red-tinted box
    setFill(doc, { r: 255, g: 245, b: 245 });
    const safetyLines = doc.splitTextToSize(briefDocument.safetyNotes, CW - 8);
    const safetyBoxH = safetyLines.length * 5 + 8;
    doc.rect(ML, y - 2, CW, safetyBoxH, 'F');
    setDraw(doc, { r: 220, g: 80, b: 80 });
    doc.setLineWidth(0.5);
    doc.rect(ML, y - 2, CW, safetyBoxH);

    doc.setFont(FONT, 'normal');
    doc.setFontSize(9);
    setColor(doc, DARK);
    safetyLines.forEach(line => {
      checkBreak(5.5);
      doc.text(line, ML + 4, y);
      y += 5;
    });
    y += 6;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 7. DOCUMENTATION REQUIREMENTS
  // ─────────────────────────────────────────────────────────────────────────

  const notice = briefDocument.documentationNotice;
  if (notice) {
    checkBreak(45);
    y = sectionHeader(doc, 'Documentation Requirements', y);

    const deLines = doc.splitTextToSize(notice.de || '', CW - 10);
    const enLines = doc.splitTextToSize(notice.en || '', CW - 10);
    const boxH = (deLines.length + enLines.length) * 5 + 22;

    setFill(doc, WARN_BG);
    setDraw(doc, WARN_ACC);
    doc.setLineWidth(0.6);
    doc.rect(ML, y - 2, CW, boxH, 'FD');

    // Warning label
    doc.setFont(FONT, 'bold');
    doc.setFontSize(8);
    setColor(doc, WARN_ACC);
    doc.text('WICHTIG / IMPORTANT', ML + 5, y + 2);
    y += 8;

    // German notice
    if (notice.de) {
      doc.setFont(FONT, 'bold');
      doc.setFontSize(7.5);
      setColor(doc, TEAL);
      doc.text('Deutsch:', ML + 5, y);
      y += 4.5;

      doc.setFont(FONT, 'normal');
      doc.setFontSize(8.5);
      setColor(doc, DARK);
      deLines.forEach(line => {
        doc.text(line, ML + 5, y);
        y += 5;
      });
      y += 3;
    }

    // English notice
    if (notice.en) {
      checkBreak(enLines.length * 5 + 10);
      doc.setFont(FONT, 'bold');
      doc.setFontSize(7.5);
      setColor(doc, TEAL);
      doc.text('English:', ML + 5, y);
      y += 4.5;

      doc.setFont(FONT, 'normal');
      doc.setFontSize(8.5);
      setColor(doc, DARK);
      enLines.forEach(line => {
        doc.text(line, ML + 5, y);
        y += 5;
      });
    }

    y += 8;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 8. BUDGET & COST COVERAGE (compact, at the end)
  // ─────────────────────────────────────────────────────────────────────────

  const budget = briefDocument.budget;
  if (budget) {
    checkBreak(40);
    y = sectionHeader(doc, 'Budget & Cost Coverage', y);

    // Table header
    setFill(doc, DARK);
    doc.rect(ML, y - 3.5, CW, 6, 'F');
    doc.setFont(FONT, 'bold');
    doc.setFontSize(8.5);
    setColor(doc, { r: 255, g: 255, b: 255 });
    doc.text('Category', ML + 3, y);
    doc.text('Amount (EUR)', PAGE_W - MR - 2, y, { align: 'right' });
    y += 6;

    const budgetRows = [
      { label: 'Total Approved Budget', value: budget.totalApproved, bold: true  },
      { label: 'Labor',                 value: budget.labor,         bold: false },
      { label: 'Travel',                value: budget.travel,        bold: false },
      { label: 'Accommodation',         value: budget.accommodation, bold: false },
      { label: 'Per Diem',              value: budget.perDiem,       bold: false },
    ].filter(r => r.value > 0 || r.bold);

    budgetRows.forEach((row, idx) => {
      const bg = idx % 2 === 0 ? { r: 250, g: 252, b: 254 } : { r: 255, g: 255, b: 255 };
      setFill(doc, bg);
      doc.rect(ML, y - 3.5, CW, 5.5, 'F');

      doc.setFont(FONT, row.bold ? 'bold' : 'normal');
      doc.setFontSize(9);
      setColor(doc, row.bold ? DARK : MID);
      doc.text(row.label, ML + 3, y);
      doc.text(`€ ${(row.value || 0).toFixed(2)}`, PAGE_W - MR - 2, y, { align: 'right' });
      y += 5.5;
    });

    y += 3;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Final footer on last page
  // ─────────────────────────────────────────────────────────────────────────

  drawFooter(doc, template, pageNum);

  return doc;
}