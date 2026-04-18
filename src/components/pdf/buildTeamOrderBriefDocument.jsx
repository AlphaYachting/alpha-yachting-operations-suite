/**
 * Single source of truth for Team Order / External Worker Briefing document
 * Unified content builder for both preview and PDF rendering
 */

function stripHtmlTags(text) {
  if (!text) return '';
  return text.replace(/<[^>]*>/g, '').trim();
}

function formatDate(dateString) {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleDateString('de-DE', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

export function buildTeamOrderBriefDocument(briefingContext, translatedProjectDescriptionDE = null) {
  if (!briefingContext) return null;

  const wo           = briefingContext.work_order    || {};
  const job          = briefingContext.job           || {};
  const customer     = briefingContext.customer      || {};
  const boat         = briefingContext.boat          || {};
  const location     = briefingContext.location      || {};
  const tasks        = briefingContext.tasks         || [];
  const externalWorker = briefingContext.external_worker || {};
  const budgetPolicy = briefingContext.budget_policy || {};
  const costPolicies = briefingContext.cost_policies || {};
  const approvalRules = briefingContext.approval_rules || {};
  const externalNotes = briefingContext.external_notes || {};

  // === PROJECT IDENTIFICATION ===
  const projectIdentification = {
    workOrderNumber: wo.number || 'N/A',
    workOrderTitle:  wo.title  || 'N/A',
    workOrderStatus: wo.status || 'N/A',
    scheduledDate:   formatDate(wo.scheduled_date),
    scheduledStartTime: wo.scheduled_start_time || null,
    scheduledEndDate:   wo.scheduled_end_date ? formatDate(wo.scheduled_end_date) : null,
    customerName:    customer.name || 'N/A',
    vesselName:      boat.name     || 'N/A',
    locationName:    location.name || 'N/A',
    serviceCategory: job.service_category || null,
    jobType:         job.job_type         || null,
    priority:        job.priority         || null,
  };

  // === ASSIGNED PARTNER ===
  const assignedPartner = {
    name:    externalWorker.name    || 'N/A',
    role:    externalWorker.role    || 'N/A',
    contact: externalWorker.contact || 'N/A',
    email:   externalWorker.email   || 'N/A',
  };

  // === BILINGUAL PROJECT DESCRIPTION ===
  const buildProjectDescription = () => {
    const scope       = externalNotes.scope_summary || '';
    const woDesc      = stripHtmlTags(wo.description  || '');
    const jobDesc     = stripHtmlTags(job.description || '');
    const partnerNotes = externalNotes.partner_notes  || '';

    let en = scope || woDesc || jobDesc || '';
    if (en && partnerNotes) en += '\n\n';
    if (partnerNotes) en += `Additional Notes: ${partnerNotes}`;
    if (!en.trim()) en = 'Work order scheduled. See tasks and schedule details below.';

    const de = translatedProjectDescriptionDE || '';
    return { en: en.trim(), de: de.trim() };
  };

  const projectDescription = buildProjectDescription();

  // === VESSEL INFO ===
  const vesselInfo = {
    name:              boat.name              || 'N/A',
    type:              boat.type              || null,
    length_m:          boat.length_m          || null,
    year:              boat.year              || null,
    berth:             boat.berth             || null,
    access_details:    boat.access_details    || null,
    engine_type:       boat.engine_type       || null,
    engine_manufacturer: boat.engine_manufacturer || null,
    engine_model:      boat.engine_model      || null,
    electrical_system: boat.electrical_system || null,
    known_issues:      boat.known_context     || null,
  };

  // === LOCATION & ACCESS ===
  const locationAccess = {
    name:           location.name           || 'N/A',
    address:        location.address        || 'N/A',
    city:           location.city           || null,
    country:        location.country        || null,
    accessNotes:    location.access_notes   || null,
    openingHours:   location.opening_hours  || null,
    contactPerson:  location.contact_person || null,
    contactPhone:   location.contact_phone  || null,
    marinaFeeEnabled: location.marina_fee_enabled || false,
    marinaFeeType:  location.marina_fee_type   || null,
    marinaFeeAmount: location.marina_fee_amount || null,
  };

  // === TASKS ===
  const taskList = tasks
    .sort((a, b) => (a.sequence_order || 0) - (b.sequence_order || 0))
    .map((task, idx) => ({
      number:           idx + 1,
      title:            task.title || 'N/A',
      description:      stripHtmlTags(task.description || ''),
      estimatedMinutes: task.estimated_minutes || null,
      estimatedHours:   task.estimated_minutes ? Math.round(task.estimated_minutes / 60) : null,
      status:           task.status || 'Not Started',
      stream:           task.task_stream || 'EXECUTION',
    }));

  // === COST POLICIES ===
  const costPoliciesDoc = {
    // Accommodation
    accommodationPaid:        costPolicies.accommodation_paid           || false,
    accommodationMaxPerNight: costPolicies.accommodation_max_per_night  || null,
    accommodationNotes:       costPolicies.accommodation_notes          || null,
    // Meals / Per Diem
    perDiemPaid:              costPolicies.meals_per_diem_paid          || false,
    perDiemRatePerDay:        costPolicies.per_diem_rate_per_day        || null,
    // Mileage
    mileagePaid:              costPolicies.mileage_paid                 || false,
    mileageRatePerKm:         costPolicies.mileage_rate_per_km          || null,
    mileageCapTotal:          costPolicies.mileage_cap_total            || null,
    // Travel time
    travelTimePaid:           costPolicies.travel_time_paid             || false,
    travelTimeRatePerHour:    costPolicies.travel_time_rate_per_hour    || null,
    // Other
    otherReimbursablesAllowed: costPolicies.other_reimbursables_allowed || false,
    otherReimbursablesNotes:   costPolicies.other_reimbursables_notes   || null,
  };

  // === APPROVAL RULES ===
  const approvalRulesDoc = {
    budgetExceedRequiresApproval: approvalRules.budget_exceed_requires_approval !== false,
    requiresPreapprovalOver:      approvalRules.requires_preapproval_over || 500,
    currency:                     approvalRules.currency || budgetPolicy.currency || 'EUR',
  };

  // === BUDGET ===
  const budget = budgetPolicy.approved_budget_total > 0 ? {
    totalApproved: budgetPolicy.approved_budget_total || 0,
    labor:         budgetPolicy.labor_budget          || 0,
    travel:        budgetPolicy.travel_budget         || 0,
    accommodation: budgetPolicy.accommodation_budget  || 0,
    perDiem:       budgetPolicy.per_diem_budget       || 0,
    currency:      budgetPolicy.currency              || 'EUR',
  } : null;

  // === DOCUMENTATION & PAYMENT NOTICE ===
  const documentationNotice = {
    en: 'Payment for this project requires proper documentation. After completion of the project, clear photo documentation of the performed work must be submitted. For projects lasting multiple days, we additionally expect a short daily progress report so that we can forward the progress to the customer.',
    de: 'Die Bezahlung dieses Projekts setzt eine genaue Dokumentation voraus. Nach Abschluss des Projekts sind aussagekräftige Fotos der durchgeführten Arbeiten zu übermitteln. Bei Projekten, die mehrere Tage dauern, erwarten wir zusätzlich einen kurzen täglichen Fortschrittsbericht, damit wir diesen an den Kunden weiterleiten können.',
  };

  // === SAFETY NOTES ===
  const safetyNotes = wo.safety_notes ? stripHtmlTags(wo.safety_notes) : null;

  // === UNIFIED DOCUMENT ===
  return {
    meta: {
      documentType: 'ExternalWorkerBrief',
      generatedAt: new Date().toISOString(),
      timestamp: new Date().toLocaleDateString('de-DE', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit',
      }),
    },
    projectIdentification,
    assignedPartner,
    projectDescription,
    vesselInfo,
    taskList,
    locationAccess,
    costPolicies: costPoliciesDoc,
    approvalRules: approvalRulesDoc,
    documentationNotice,
    safetyNotes,
    budget,
  };
}