import { getRequiredFields } from './mappingEngine';

const REQUIRED_FIELDS = getRequiredFields();

export function validateImportData(parsedData, fieldMapping, config) {
  const errors = [];
  const warnings = [];
  const serviceAreaGroups = {};
  
  if (!Array.isArray(parsedData) || parsedData.length === 0) {
    return {
      valid: false,
      errors: [{ row: 0, field: 'Data', message: 'No data to import' }],
      warnings: [],
      workOrderCount: 0,
      taskCount: 0,
      serviceAreaGroups: {}
    };
  }

  // Find which Excel columns are mapped to required fields
  const requiredExcelColumns = {};
  Object.entries(fieldMapping).forEach(([excelCol, targetField]) => {
    if (REQUIRED_FIELDS.includes(targetField)) {
      requiredExcelColumns[targetField] = excelCol;
    }
  });

  let workOrderCount = 0;
  let taskCount = 0;

  // Debug: log mapping info on first row
  if (parsedData.length > 0) {
    console.log('[VALIDATION DEBUG] Field Mapping:', fieldMapping);
    console.log('[VALIDATION DEBUG] First Row Keys:', Object.keys(parsedData[0]));
    console.log('[VALIDATION DEBUG] First Row Full Data:', parsedData[0]);
    console.log('[VALIDATION DEBUG] Service Area mapping target:', Object.entries(fieldMapping).find(([_, v]) => v === 'serviceArea'));
  }

  // Validate each row
  parsedData.forEach((row, rowIdx) => {
    const rowNum = rowIdx + 2; // Excel row numbers start at 2 (1 is header)
    let rowHasAllRequired = true;

    // Check required fields have values in the Excel columns
    Object.entries(requiredExcelColumns).forEach(([requiredField, excelCol]) => {
      const value = row[excelCol];
      if (!value || String(value).trim() === '') {
        errors.push({
          row: rowNum,
          field: requiredField,
          message: `Required field "${requiredField}" is empty in column "${excelCol}"`
        });
        rowHasAllRequired = false;
      }
    });

    // Group by service area (if mapped) - check all possible keys
    let serviceArea = 'Uncategorized';
    const serviceAreaEntry = Object.entries(fieldMapping).find(([_, v]) => v === 'serviceArea' || v === 'service_category');
    if (serviceAreaEntry) {
      const serviceAreaCol = serviceAreaEntry[0];
      const serviceAreaValue = row[serviceAreaCol];
      if (serviceAreaValue && String(serviceAreaValue).trim() !== '') {
        serviceArea = String(serviceAreaValue).trim();
        if (rowIdx === 0) console.log('[VALIDATION DEBUG] Row 2 Service Area:', serviceArea, 'from column:', serviceAreaCol);
      }
    }
    if (!serviceAreaGroups[serviceArea]) {
      serviceAreaGroups[serviceArea] = {
        rows: [],
        count: 0
      };
    }
    if (!serviceAreaGroups[serviceArea].rows) {
      serviceAreaGroups[serviceArea].rows = [];
    }
    serviceAreaGroups[serviceArea].rows.push(rowNum);
    serviceAreaGroups[serviceArea].count++;

    // Count tasks (if title column is mapped and has value AND service area is assigned)
    const titleCol = Object.entries(fieldMapping).find(([_, v]) => v === 'taskTitle')?.[0];
    if (titleCol && row[titleCol] && String(row[titleCol]).trim() !== '' && serviceArea !== 'Uncategorized') {
      taskCount++;
    }
  });

  // Count work orders based on import mode
  if (config?.importMode === 'work-orders-by-service-area') {
    // One work order per service area per customer
    const uniqueWorkOrders = new Set();
    const customerCol = Object.entries(fieldMapping).find(([_, v]) => v === 'customerName')?.[0];
    parsedData.forEach(row => {
      let serviceArea = 'Uncategorized';
      const serviceAreaEntry = Object.entries(fieldMapping).find(([_, v]) => v === 'serviceArea' || v === 'service_category');
      if (serviceAreaEntry) {
        const serviceAreaCol = serviceAreaEntry[0];
        const serviceAreaValue = row[serviceAreaCol];
        if (serviceAreaValue && String(serviceAreaValue).trim() !== '') {
          serviceArea = String(serviceAreaValue).trim();
        }
      }
      const customer = row[customerCol] || 'default';
      const key = `${customer}_${serviceArea}`;
      uniqueWorkOrders.add(key);
    });
    workOrderCount = uniqueWorkOrders.size || 1;
  } else {
    // Original: one work order per customer
    const uniqueWorkOrders = new Set();
    const customerCol = Object.entries(fieldMapping).find(([_, v]) => v === 'customerName')?.[0];
    parsedData.forEach(row => {
      const key = row[customerCol] || 'default';
      uniqueWorkOrders.add(key);
    });
    workOrderCount = uniqueWorkOrders.size || 1;
  }

  const isValid = errors.length === 0;

  return {
    valid: isValid,
    errors,
    warnings,
    workOrderCount,
    taskCount,
    serviceAreaGroups
  };
}