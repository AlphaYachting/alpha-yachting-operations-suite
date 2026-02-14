/**
 * Price parsing utilities for PDF extraction
 * Handles EU (1.234,56) and US (1,234.56) number formats
 */

/**
 * Parse a price string to number
 * Supports: "75,00 €", "75.00", "1.234,56", "1,234.56"
 */
export function parsePrice(raw) {
  if (!raw) return null;
  
  const cleaned = String(raw).replace(/[^\d,.-]/g, '').trim();
  if (!cleaned) return null;

  // EU format: has comma as decimal separator (e.g., 1.234,56)
  if (/\d+\.\d{3},\d{1,2}/.test(cleaned)) {
    return parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
  }
  
  // EU short format: comma as decimal (e.g., 75,00)
  if (/^\d+,\d{1,2}$/.test(cleaned)) {
    return parseFloat(cleaned.replace(',', '.'));
  }
  
  // US format: has period as decimal separator, comma as thousands (e.g., 1,234.56)
  if (/\d{1,3}(,\d{3})+\.\d{1,2}/.test(cleaned)) {
    return parseFloat(cleaned.replace(/,/g, ''));
  }
  
  // Simple number with period as decimal
  return parseFloat(cleaned.replace(/,/g, ''));
}

/**
 * Validate extracted price against total
 * Returns true if unit_price * quantity ≈ total_price (within 5% tolerance)
 */
export function validatePrice(unitPrice, quantity, totalPrice) {
  if (!unitPrice || !quantity || !totalPrice) return false;
  
  const calculated = unitPrice * quantity;
  const tolerance = Math.abs(calculated * 0.05); // 5% tolerance
  
  return Math.abs(calculated - totalPrice) <= tolerance;
}

/**
 * Score price extraction confidence
 */
export function scoreConfidence(unitPrice, quantity, totalPrice, hasExplicitCurrency) {
  // No price extracted
  if (!unitPrice && !totalPrice) return 'None';
  
  // Unit price found with validation and currency
  if (unitPrice && totalPrice && validatePrice(unitPrice, quantity, totalPrice) && hasExplicitCurrency) {
    return 'High';
  }
  
  // Unit price found but no validation, OR total price found
  if ((unitPrice && !totalPrice) || (totalPrice && quantity > 0)) {
    return 'Medium';
  }
  
  // Price found but failed validation or ambiguous
  return 'Low';
}

/**
 * Extract currency from raw price string
 */
export function extractCurrency(raw) {
  if (!raw) return null;
  
  const str = String(raw).toUpperCase();
  if (str.includes('€') || str.includes('EUR')) return 'EUR';
  if (str.includes('$') || str.includes('USD')) return 'USD';
  if (str.includes('£') || str.includes('GBP')) return 'GBP';
  if (str.includes('CHF')) return 'CHF';
  
  return null;
}

/**
 * Process extracted position with price parsing
 */
export function processExtractedPosition(position, defaultUnitPrice) {
  const unitPriceParsed = parsePrice(position.unit_price_raw);
  const totalPriceParsed = parsePrice(position.total_price_raw);
  const currency = extractCurrency(position.unit_price_raw || position.total_price_raw);
  const quantity = position.quantity || 1;
  
  // Determine final unit price
  let finalUnitPrice = defaultUnitPrice;
  let priceSource = 'fallback';
  
  if (unitPriceParsed) {
    finalUnitPrice = unitPriceParsed;
    priceSource = 'unit_price';
  } else if (totalPriceParsed && quantity > 0) {
    finalUnitPrice = totalPriceParsed / quantity;
    priceSource = 'total_calculated';
  }
  
  // Calculate confidence
  const priceConfidence = scoreConfidence(
    unitPriceParsed,
    quantity,
    totalPriceParsed,
    !!currency
  );
  
  return {
    ...position,
    unit_price: finalUnitPrice,
    total_amount: finalUnitPrice * quantity,
    unit_price_extracted: unitPriceParsed,
    total_price_extracted: totalPriceParsed,
    price_confidence: priceConfidence,
    price_source: priceSource,
    currency_detected: currency
  };
}