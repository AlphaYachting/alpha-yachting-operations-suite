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
    
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(worksheet);

    console.log('[IMPORT] Loaded rows:', rawData.length);

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

    const importedRows = [];
    const rejectedRows = [];
    const seenSkus = new Set();

    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      const rowIndex = i + 2; // Excel row (1-indexed + header)
      const reasons = [];

      // Extract and process fields
      const skuRaw = row['SKU'] ? String(row['SKU']).trim().toUpperCase() : '';
      const nameRaw = row['Item name (EN)'] ? String(row['Item name (EN)']).trim() : '';
      const unitSourceRaw = row['Unit (as in source)'] ? String(row['Unit (as in source)']).trim() : '';
      const stockRaw = row['Stock'];
      const unitCostRaw = row['Unit cost (purchase)'];
      const salesPriceRaw = row['Sales price (MPC)'];

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

      // Build the item object with defaults
      const itemData = {
        sku: skuRaw,
        name: nameRaw,
        unit,
        item_type: 'PART',
        category: 'Other',
        status: 'Active',
        vat_rate: 25,
        quantity_mode: 'pooled',
        stock_novigrad: stockNovigrad,
        stock_van_1: 0,
        stock_van_2: 0,
        stock_reserved: 0,
        serial_number_required: false
      };

      // Add optional numeric fields only if present
      if (unitCost !== null) {
        itemData.unit_cost = unitCost;
      }
      if (salesPrice !== null) {
        itemData.sales_price = salesPrice;
      }

      importedRows.push(itemData);
    }

    // Check for existing SKUs in database
    const existingItems = await base44.entities.InventoryItem.list();
    const existingSkus = new Set(existingItems.map(item => item.sku));
    
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