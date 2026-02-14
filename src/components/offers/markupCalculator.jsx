/**
 * Markup calculation utilities for PDF extraction preview
 */

/**
 * Apply markup percentage to a price
 */
export function applyMarkup(price, markupPercent) {
  if (!price || !markupPercent) return price;
  return price * (1 + markupPercent / 100);
}

/**
 * Round price according to rounding rule
 */
export function roundPrice(price, roundingRule) {
  if (!price || roundingRule === 'None') return price;
  
  const roundTo = {
    '1€': 1,
    '5€': 5,
    '10€': 10
  }[roundingRule];
  
  if (!roundTo) return price;
  
  return Math.round(price / roundTo) * roundTo;
}

/**
 * Calculate final price with markup and rounding
 */
export function calculateFinalPrice(basePrice, markupPercent, roundingRule) {
  const withMarkup = applyMarkup(basePrice, markupPercent);
  return roundPrice(withMarkup, roundingRule);
}