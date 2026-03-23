import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import * as XLSX from 'npm:xlsx@0.18.5';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { file_url } = body;

    if (!file_url) {
      return Response.json({ error: 'No file URL provided' }, { status: 400 });
    }

    // Fetch the Excel file
    const fileResponse = await fetch(file_url);
    const arrayBuffer = await fileResponse.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
    
    // Try to find "Inventory_EN" sheet, fallback to first sheet
    let sheetName = 'Inventory_EN';
    if (!workbook.SheetNames.includes(sheetName)) {
      sheetName = workbook.SheetNames[0];
    }
    
    const worksheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

    console.log('[IMPORT] Selected sheet:', sheetName);
    console.log('[IMPORT] Available sheets:', workbook.SheetNames);
    console.log('[IMPORT] Loaded rows:', rawData.length);
    
    // Diagnostics: Show detected headers
    if (rawData.length > 0) {
      const headers = Object.keys(rawData[0]);
      console.log('[IMPORT] Detected headers:', headers);
      
      // Show first 3 rows for debugging
      for (let i = 0; i < Math.min(3, rawData.length); i++) {
        console.log(`[IMPORT] Row ${i + 1} raw:`, rawData[i]);
      }
    }

    // Header mapping with synonyms (case-insensitive)
    const findColumn = (row, synonyms) => {
      for (const key of Object.keys(row)) {
        const normalizedKey = key.trim().toLowerCase();
        for (const syn of synonyms) {
          if (normalizedKey === syn.toLowerCase()) {
            return key;
          }
        }
      }
      return null;
    };

    // Unit mapping (deterministic)
    const unitMapping = {
      'kom': 'Piece',
      'kom.': 'Piece',
      'kom/p': 'Piece',
      'kom¸.': 'Piece',
      'par': 'Pair',
      'par.': 'Pair',
      'lit.': 'Liter',
      'met.': 'Meter',
      'm/nam': 'Meter',
      'set': 'Set',
      'pak.': 'Box'
    };

    // Normalize SKU (handle numeric values from Excel)
    const normalizeSKU = (value) => {
      if (value === null || value === undefined || value === '') return '';
      
      let str = String(value).trim();
      
      // If it's a number (including scientific notation), convert to integer string
      const num = Number(str);
      if (!isNaN(num) && str !== '') {
        str = Math.floor(num).toString();
      }
      
      return str.toUpperCase();
    };

    const importedRows = [];
    const rejectedRows = [];
    const seenSkus = new Set();

    // Detect column names using synonyms
    const sampleRow = rawData[0] || {};
    const skuCol = findColumn(sampleRow, ['SKU', 'Šifra', 'Sifra', 'Code']);
    const nameCol = findColumn(sampleRow, ['Item name (EN)', 'Naziv artikla', 'Item name', 'Name']);
    const groupCol = findColumn(sampleRow, ['Group', 'Grupa', 'Category']);
    const unitCol = findColumn(sampleRow, ['Unit (as in source)', 'Unit (source)', 'Jed. mj.', 'Unit', 'UOM']);
    const stockCol = findColumn(sampleRow, ['Stock']);
    const unitCostCol = findColumn(sampleRow, ['Unit cost (purchase)']);
    const salesPriceCol = findColumn(sampleRow, ['Sales price (MPC)', 'Sales price']);

    console.log('[IMPORT] Column mapping:', {
      sku: skuCol,
      name: nameCol,
      group: groupCol,
      unit: unitCol,
      stock: stockCol,
      unitCost: unitCostCol,
      salesPrice: salesPriceCol
    });

    // Group-based category mapping (PRIMARY)
    const groupMapping = {
      '14': { category: 'Workshop Supplies', item_type: 'CONSUMABLE' },
      '1': { category: 'Engine Parts', item_type: 'PART' },
      '15': { category: 'Consumables', item_type: 'CONSUMABLE' },
      '6': { category: 'Engine Parts', item_type: 'PART' },
      '4': { category: 'Electrical Power', item_type: 'PART' },
      '9': { category: 'Sealants/Adhesives', item_type: 'CONSUMABLE' },
      '5': { category: 'Fasteners', item_type: 'CONSUMABLE' },
      '23': { category: 'Other', item_type: 'PART' }
    };

    // Keyword-based fallback (ONLY if Group is missing/unknown)
    const categorizeByName = (name) => {
      const nameLower = name.toLowerCase();
      
      if (nameLower.includes('sandpaper') || nameLower.includes('abrasive') || nameLower.includes('putty')) {
        return { category: 'Workshop Supplies', item_type: 'CONSUMABLE' };
      }
      if (nameLower.includes('exhaust') || nameLower.includes('engine') || nameLower.includes('mercruiser')) {
        return { category: 'Engine Parts', item_type: 'PART' };
      }
      if (nameLower.includes('sealant') || nameLower.includes('adhesive')) {
        return { category: 'Sealants/Adhesives', item_type: 'CONSUMABLE' };
      }
      if (nameLower.includes('respirator') || nameLower.includes('mask') || nameLower.includes('gloves')) {
        return { category: 'PPE', item_type: 'PPE' };
      }
      
      // Default fallback
      return { category: 'Other', item_type: 'PART' };
    };

    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      const rowIndex = i + 2; // Excel row (1-indexed + header)
      const reasons = [];

      // Extract and process fields with normalization
      const skuRaw = skuCol ? normalizeSKU(row[skuCol]) : '';
      const nameRaw = nameCol ? String(row[nameCol] || '').trim() : '';
      const groupRaw = groupCol ? String(row[groupCol] || '').trim() : '';
      const unitSourceRaw = unitCol ? String(row[unitCol] || '').trim() : '';
      const stockRaw = stockCol ? row[stockCol] : null;
      const unitCostRaw = unitCostCol ? row[unitCostCol] : null;
      const salesPriceRaw = salesPriceCol ? row[salesPriceCol] : null;

      // Diagnostics for first 3 rows
      if (i < 3) {
        console.log(`[IMPORT] Row ${rowIndex} normalized:`, {
          sku: skuRaw,
          name: nameRaw,
          group: groupRaw,
          unit: unitSourceRaw,
          stock: stockRaw,
          unitCost: unitCostRaw,
          salesPrice: salesPriceRaw
        });
      }

      // Determine category and item_type
      let category, item_type;
      
      // PRIMARY: Use Group mapping if available
      if (groupRaw && groupMapping[groupRaw]) {
        const mapping = groupMapping[groupRaw];
        category = mapping.category;
        item_type = mapping.item_type;
      } else {
        // FALLBACK: Use keyword-based rules
        const fallback = categorizeByName(nameRaw);
        category = fallback.category;
        item_type = fallback.item_type;
      }

      // Validation 1: SKU must be present
      if (!skuRaw) {
        reasons.push('SKU missing');
      }

      // Validation 2: SKU must be unique in batch
      if (skuRaw && seenSkus.has(skuRaw)) {
        reasons.push(`Duplicate SKU: ${skuRaw}`);
      } else if (skuRaw) {
        seenSkus.add(skuRaw);
      }

      // Validation 3: Name must be present
      if (!nameRaw) {
        reasons.push('Name missing');
      }

      // Validation 4: Unit mapping
      let unit = null;
      if (unitSourceRaw) {
        unit = unitMapping[unitSourceRaw];
        if (!unit) {
          reasons.push(`Invalid unit: "${unitSourceRaw}"`);
        }
      } else {
        reasons.push('Unit missing');
      }

      // Validation 5: Numeric values
      let stockNovigrad = 0;
      let unitCost = null;
      let salesPrice = null;

      if (stockRaw !== null && stockRaw !== undefined && stockRaw !== '') {
        stockNovigrad = Number(stockRaw);
        if (isNaN(stockNovigrad) || stockNovigrad < 0) {
          reasons.push('Stock must be >= 0');
        }
      }

      if (unitCostRaw !== null && unitCostRaw !== undefined && unitCostRaw !== '') {
        unitCost = Number(unitCostRaw);
        if (isNaN(unitCost) || unitCost < 0) {
          reasons.push('Unit cost must be >= 0');
        }
      }

      if (salesPriceRaw !== null && salesPriceRaw !== undefined && salesPriceRaw !== '') {
        salesPrice = Number(salesPriceRaw);
        if (isNaN(salesPrice) || salesPrice < 0) {
          reasons.push('Sales price must be >= 0');
        }
      }

      // If validation failed, reject the row
      if (reasons.length > 0) {
        rejectedRows.push({
          sku: skuRaw || '(missing)',
          rowIndex,
          reasons: reasons.join('; ')
        });
        continue;
      }

      // Build the item object with determined categorization
      const itemData = {
        sku: skuRaw,
        name: nameRaw,
        unit,
        item_type,
        category,
        status: 'Active',
        quantity_mode: 'pooled',
        stock_novigrad: stockNovigrad,
        stock_van_1: 0,
        stock_van_2: 0,
        stock_reserved: 0,
        serial_number_required: false
      };

      // Add optional numeric fields only if present AND valid
      if (unitCost !== null && !isNaN(unitCost)) {
        itemData.unit_cost = unitCost;
      }
      if (salesPrice !== null && !isNaN(salesPrice)) {
        itemData.sales_price = salesPrice;
      }

      importedRows.push(itemData);
    }

    // Check for existing SKUs in database
    let existingSkus = new Set();
    try {
      const existingItems = await base44.entities.InventoryItem.list();
      existingSkus = new Set(Array.isArray(existingItems) ? existingItems.map(item => item.sku) : []);
    } catch (error) {
      console.log('[IMPORT] Warning: Could not check existing SKUs:', error.message);
    }
    
    const finalImported = [];
    for (const item of importedRows) {
      if (existingSkus.has(item.sku)) {
        rejectedRows.push({
          sku: item.sku,
          rowIndex: '(validation)',
          reasons: 'SKU already exists in database'
        });
      } else {
        finalImported.push(item);
      }
    }

    return Response.json({
      success: true,
      summary: {
        totalRows: rawData.length,
        importedCount: finalImported.length,
        rejectedCount: rejectedRows.length
      },
      importedRows: finalImported,
      rejectedRows
    });

  } catch (error) {
    console.error('[IMPORT] Error:', error);
    return Response.json({
      error: error.message,
      details: error.stack
    }, { status: 500 });
  }
});