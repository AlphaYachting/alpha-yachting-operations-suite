import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import * as XLSX from 'npm:xlsx@0.18.5';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { file_url, manufacturer_id, file_name } = await req.json();
  if (!file_url || !manufacturer_id) {
    return Response.json({ error: 'file_url and manufacturer_id required' }, { status: 400 });
  }

  // Fetch and parse Excel
  const fileResp = await fetch(file_url);
  const arrayBuffer = await fileResp.arrayBuffer();
  const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  if (!rows.length) {
    return Response.json({ error: 'No rows found in file' }, { status: 400 });
  }

  // --- Column mapping (normalize header names) ---
  const normalize = (s) => String(s).trim().toLowerCase().replace(/\s+/g, '_');

  // Detect columns from first row keys
  const firstRowKeys = Object.keys(rows[0]).map(k => ({ orig: k, norm: normalize(k) }));
  const findCol = (...candidates) => {
    for (const c of candidates) {
      const found = firstRowKeys.find(k => k.norm.includes(c));
      if (found) return found.orig;
    }
    return null;
  };

  const colCode   = findCol('produktcode', 'product_code', 'code', 'artikelnummer', 'sku');
  const colName   = findCol('name', 'bezeichnung', 'product_name', 'artikel');
  const colGross  = findCol('bruttobetrag', 'bruttopreis', 'gross', 'brutto');
  const colTax    = findCol('ust', 'mwst', 'vat', 'tax', 'steuer');
  const colNet    = findCol('nettobetrag', 'nettopreis', 'netto', 'net');
  const colPurch  = findCol('einkaufspreis', 'ekp', 'purchase', 'ek');
  const colKpd    = findCol('kpd', 'category', 'kategorie');

  if (!colCode || !colName) {
    return Response.json({ error: `Could not detect required columns. Found: ${Object.keys(rows[0]).join(', ')}` }, { status: 400 });
  }

  // Create import log record
  const importRecord = await base44.asServiceRole.entities.ProductCatalogImport.create({
    manufacturer_id,
    file_name: file_name || 'upload.xlsx',
    imported_by: user.email,
    row_count: rows.length,
    status: 'running',
  });

  // Load existing products for this manufacturer (for upsert logic)
  const existing = await base44.asServiceRole.entities.ProductCatalogItem.filter({ manufacturer_id });
  const existingMap = {};
  for (const p of existing) {
    existingMap[p.product_code] = p;
  }

  // Fetch manufacturer name for searchable_text
  const manufacturers = await base44.asServiceRole.entities.Manufacturer.filter({ id: manufacturer_id });
  const manufacturerName = manufacturers[0]?.name || '';

  let created = 0, updated = 0, skipped = 0;
  const errors = [];
  const toCreate = [];
  const toUpdate = [];

  const parseNum = (v) => {
    if (v === '' || v === null || v === undefined) return null;
    const n = parseFloat(String(v).replace(',', '.'));
    return isNaN(n) ? null : n;
  };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const productCode = String(row[colCode] || '').trim();
    const productName = String(row[colName] || '').trim();

    if (!productCode || !productName) {
      errors.push({ row: i + 2, reason: 'Missing product_code or product_name', data: row });
      skipped++;
      continue;
    }

    const grossPrice   = parseNum(row[colGross]);
    const taxRate      = parseNum(row[colTax]);
    const netPrice     = parseNum(row[colNet]);
    const purchPrice   = parseNum(row[colPurch]);
    const kpd          = colKpd ? String(row[colKpd] || '').trim() : '';

    if (netPrice === null) {
      errors.push({ row: i + 2, reason: 'Missing net_price', product_code: productCode });
      skipped++;
      continue;
    }

    const searchableText = [manufacturerName, productCode, productName, kpd].filter(Boolean).join(' ').toLowerCase();
    const hash = btoa(unescape(encodeURIComponent(`${productCode}|${netPrice}|${grossPrice}|${taxRate}`))).slice(0, 32);

    const itemData = {
      manufacturer_id,
      source_import_id: importRecord.id,
      product_code: productCode,
      product_name: productName,
      gross_price: grossPrice,
      net_price: netPrice,
      purchase_price: purchPrice,
      tax_rate: taxRate ?? 20,
      external_category_code: kpd || null,
      currency: 'EUR',
      active: true,
      searchable_text: searchableText,
      source_row_hash: hash,
      last_imported_at: new Date().toISOString(),
    };

    if (existingMap[productCode]) {
      const ex = existingMap[productCode];
      if (ex.source_row_hash !== hash) {
        toUpdate.push({ id: ex.id, data: itemData });
        updated++;
      } else {
        skipped++;
      }
    } else {
      toCreate.push(itemData);
      created++;
    }
  }

  // Batch create
  if (toCreate.length > 0) {
    const CHUNK = 50;
    for (let i = 0; i < toCreate.length; i += CHUNK) {
      await base44.asServiceRole.entities.ProductCatalogItem.bulkCreate(toCreate.slice(i, i + CHUNK));
    }
  }

  // Batch update
  for (const u of toUpdate) {
    await base44.asServiceRole.entities.ProductCatalogItem.update(u.id, u.data);
  }

  // Update import log
  await base44.asServiceRole.entities.ProductCatalogImport.update(importRecord.id, {
    row_count: rows.length,
    created_count: created,
    updated_count: updated,
    skipped_count: skipped,
    status: 'completed',
    import_log_json: { errors: errors.slice(0, 100) },
  });

  return Response.json({
    success: true,
    import_id: importRecord.id,
    row_count: rows.length,
    created,
    updated,
    skipped,
    errors: errors.slice(0, 20),
  });
});