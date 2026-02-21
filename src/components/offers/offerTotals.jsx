/**
 * Single source of truth for Offer totals calculation
 * Used by both UI and PDF generation
 */

export function computeOfferTotals(offer, tasks) {
  // 1. Calculate subtotal (excl tax) from line items
  const subtotal_excl_tax = tasks.reduce((sum, task) => {
    if (task.is_optional) return sum;
    return sum + (task.total_amount || 0);
  }, 0);

  // 2. Calculate discount (excl tax)
  let discount_amount_excl_tax = 0;
  const mode = offer.discount_mode || 'NONE';
  
  if (mode === 'PERCENT' && offer.discount_percent > 0) {
    discount_amount_excl_tax = Math.round(subtotal_excl_tax * offer.discount_percent / 100 * 100) / 100;
  } else if (mode === 'TARGET_TOTAL' && offer.discount_target_total > 0) {
    // Interpret target as excl tax target
    discount_amount_excl_tax = Math.max(0, Math.min(
      subtotal_excl_tax,
      Math.round((subtotal_excl_tax - offer.discount_target_total) * 100) / 100
    ));
  }

  // 3. Apply discount BEFORE VAT
  const taxable_base_excl_tax = Math.max(0, subtotal_excl_tax - discount_amount_excl_tax);

  // 4. Calculate VAT from discounted base
  const vat_rate = offer.vat_rate || 0;
  const vat_amount = Math.round(taxable_base_excl_tax * vat_rate / 100 * 100) / 100;

  // 5. Calculate final total
  const total_incl_tax = Math.round((taxable_base_excl_tax + vat_amount) * 100) / 100;

  // Calculate derived percent for TARGET_TOTAL mode
  const derived_percent = subtotal_excl_tax > 0 
    ? Math.round((discount_amount_excl_tax / subtotal_excl_tax * 100) * 100) / 100
    : 0;

  return {
    subtotal_excl_tax,
    discount_mode: mode,
    discount_percent: mode === 'PERCENT' ? offer.discount_percent : derived_percent,
    discount_target_total: offer.discount_target_total,
    discount_amount_excl_tax,
    taxable_base_excl_tax,
    vat_rate,
    vat_amount,
    total_incl_tax
  };
}