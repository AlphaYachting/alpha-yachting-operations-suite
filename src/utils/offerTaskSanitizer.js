/**
 * offerTaskSanitizer.js
 *
 * Utility for sanitizing OfferTask titles when importing into internal Tasks or Work Orders.
 *
 * ARCHITECTURE RULE:
 *   - `title` = clean internal/customer-facing title (German, English, etc.)
 *   - `title_hr` = optional Croatian export label, used ONLY by FIRA export
 *   - Task import must ALWAYS use clean title only, never title_hr
 *
 * This module protects downstream Task creation from legacy contaminated titles
 * where Croatian text was previously appended directly into title:
 *   e.g. "Replace water hoses / Zamjena vodenih cijevi"
 *
 * Sanitation is scoped ONLY to the task import path.
 * It does NOT destructively rewrite source OfferTask records.
 */

/**
 * Returns the clean internal title for use in Task/WorkOrder creation.
 * Strips Croatian fragment if legacy contamination pattern is detected.
 *
 * Pattern: "Internal Title / Kroatski tekst"
 * The split is only performed when the separator " / " is present AND
 * the second part looks like a Croatian fragment (non-German/English characters).
 *
 * @param {string} title - Raw title from OfferTask.title
 * @returns {string} - Clean internal title
 */
export function getCleanInternalTitle(title) {
  if (!title || typeof title !== 'string') return title || '';

  const sepIdx = title.indexOf(' / ');
  if (sepIdx === -1) return title.trim();

  const firstPart = title.substring(0, sepIdx).trim();
  const secondPart = title.substring(sepIdx + 3).trim();

  // Only strip if second part looks like a Croatian fragment:
  // contains Croatian-specific characters (č,ć,š,ž,đ) or is clearly a translation
  const croatianPattern = /[čćšžđČĆŠŽĐ]/;
  if (croatianPattern.test(secondPart)) {
    return firstPart;
  }

  // If no Croatian markers, keep full title (could be a legitimate " / " in the title)
  return title.trim();
}

/**
 * Maps an OfferTask to a clean Task creation payload.
 * Always uses title (sanitized), never title_hr.
 *
 * @param {object} offerTask - OfferTask record
 * @param {string} workOrderId - Target Work Order ID
 * @param {number} sequenceOrder - Sequence index
 * @returns {object} - Task creation payload
 */
export function offerTaskToTaskPayload(offerTask, workOrderId, sequenceOrder = 0) {
  return {
    work_order_id: workOrderId,
    title: getCleanInternalTitle(offerTask.title),
    description: offerTask.description || '',
    sequence_order: sequenceOrder,
    status: 'Not Started',
    estimated_minutes: offerTask.item_type === 'Labor' && offerTask.quantity
      ? Math.round(offerTask.quantity * 60)
      : null,
  };
}