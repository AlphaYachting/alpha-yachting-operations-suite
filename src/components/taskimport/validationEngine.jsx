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

  let workOrderCount = 0;
  let taskCount = 0;

  // Validate each row
  parsedData.forEach((row, rowIdx) => {
    const rowNum = rowIdx + 2; // Excel row numbers start at 2 (1 is header)
    const mappedRow = {};

    // Extract mapped values
    Object.entries(fieldMapping).forEach(([excelCol, targetField]) => {
      if (targetField && row[excelCol] !== undefined) {
        mappedRow[targetField] = row[excelCol];
      }
    });

    // Check required fields
    REQUIRED_FIELDS.forEach(requiredField => {
      if (!mappedRow[requiredField] || String(mappedRow[requiredField]).trim() === '') {
        errors.push({
          row: rowNum,
          field: requiredField,
          message: `Required field "${requiredField}" is empty`
        });
      }
    });

    // Group by service area (if exists)
    const serviceArea = mappedRow.service_category || 'Uncategorized';
    if (!serviceAreaGroups[serviceArea]) {
      serviceAreaGroups[serviceArea] = {
        rows: [],
        count: 0
      };
    }
    serviceAreaGroups[serviceArea].rows.push(rowNum);
    serviceAreaGroups[serviceArea].count++;

    // Count tasks
    if (mappedRow.title) {
      taskCount++;
    }
  });

  // Count work orders (unique combinations of certain fields if available)
  const uniqueWorkOrders = new Set();
  parsedData.forEach(row => {
    const key = [
      row[Object.entries(fieldMapping).find(([_, v]) => v === 'job_id')?.[0]] || 'default',
      row[Object.entries(fieldMapping).find(([_, v]) => v === 'scheduled_date')?.[0]] || 'default'
    ].join('|');
    uniqueWorkOrders.add(key);
  });
  workOrderCount = uniqueWorkOrders.size || 1;

  const isValid = errors.length === 0 && (config?.dryRunMode || true);

  return {
    valid: isValid,
    errors,
    warnings,
    workOrderCount,
    taskCount,
    serviceAreaGroups
  };
}