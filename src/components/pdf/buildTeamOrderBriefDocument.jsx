/**
 * Single source of truth for Team Order / External Worker Briefing document
 * Unified content builder for both preview and PDF rendering
 * No duplication, no email-style salutation, one clean worker-oriented output
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
  if (!briefingContext) {
    return null;
  }

  const wo = briefingContext.work_order || {};
  const job = briefingContext.job || {};
  const customer = briefingContext.customer || {};
  const boat = briefingContext.boat || {};
  const location = briefingContext.location || {};
  const tasks = briefingContext.tasks || [];
  const externalWorker = briefingContext.external_worker || {};
  const budgetPolicy = briefingContext.budget_policy || {};
  const externalNotes = briefingContext.external_notes || {};

  // === PROJECT IDENTIFICATION ===
  const projectIdentification = {
    workOrderNumber: wo.number || 'N/A',
    workOrderTitle: wo.title || 'N/A',
    workOrderStatus: wo.status || 'N/A',
    scheduledDate: formatDate(wo.scheduled_date),
    customerName: customer.name || 'N/A',
    vesselName: boat.name || 'N/A',
    locationName: location.name || 'N/A'
  };

  // === ASSIGNED PARTNER ===
  const assignedPartner = {
    name: externalWorker.name || 'N/A',
    role: externalWorker.role || 'N/A',
    contact: externalWorker.contact || 'N/A',
    email: externalWorker.email || 'N/A'
  };

  // === BILINGUAL PROJECT DESCRIPTION ===
  // Build one coherent worker-oriented description (no duplicates, no email language)
  // German version is translated via LLM in the parent component (async flow)
  const buildProjectDescription = () => {
    const scope = externalNotes.scope_summary || '';
    const woDesc = stripHtmlTags(wo.description || '');
    const jobDesc = stripHtmlTags(job.description || '');
    const partnerNotes = externalNotes.partner_notes || '';

    // Primary content (English)
    let en = '';
    if (scope) {
      en += scope;
    } else if (woDesc || jobDesc) {
      en += (woDesc || jobDesc);
    }
    if (en && partnerNotes) en += '\n\n';
    if (partnerNotes) en += `Additional Notes: ${partnerNotes}`;
    if (!en.trim()) {
      en = 'Work order scheduled. See tasks and schedule details below.';
    }

    // German version: use translated version if provided, otherwise leave empty
    // (Never fallback to English - that would duplicate English text under German label)
    let de = translatedProjectDescriptionDE || '';

    return { 
      en: en.trim(), 
      de: de.trim()
    };
  };

  const projectDescription = buildProjectDescription();

  // === TASKS ===
  const taskList = tasks
    .sort((a, b) => (a.sequence_order || 0) - (b.sequence_order || 0))
    .map((task, idx) => ({
      number: idx + 1,
      title: task.title || 'N/A',
      description: stripHtmlTags(task.description || ''),
      estimatedMinutes: task.estimated_minutes || null,
      estimatedHours: task.estimated_minutes ? Math.round(task.estimated_minutes / 60) : null,
      status: task.status || 'Not Started'
    }));

  // === LOCATION & ACCESS ===
  const locationAccess = {
    name: location.name || 'N/A',
    address: location.address || 'N/A',
    city: location.city || 'N/A',
    accessNotes: location.access_notes || 'No special access notes'
  };

  // === DOCUMENTATION & PAYMENT REQUIREMENT NOTICE ===
  const documentationNotice = {
    en: 'Payment for this project requires proper documentation. After completion of the project, clear photo documentation of the performed work must be submitted. For projects lasting multiple days, we additionally expect a short daily progress report so that we can forward the progress to the customer.',
    de: 'Die Bezahlung dieses Projekts setzt eine genaue Dokumentation voraus. Nach Abschluss des Projekts sind aussagekräftige Fotos der durchgeführten Arbeiten zu übermitteln. Bei Projekten, die mehrere Tage dauern, erwarten wir zusätzlich einen kurzen täglichen Fortschrittsbericht, damit wir diesen an den Kunden weiterleiten können.'
  };

  // === SAFETY NOTES ===
  const safetyNotes = wo.safety_notes ? stripHtmlTags(wo.safety_notes) : null;

  // === BUDGET INFORMATION ===
  const budget = budgetPolicy.approved_budget_total > 0 ? {
    totalApproved: budgetPolicy.approved_budget_total || 0,
    labor: budgetPolicy.labor_budget || 0,
    travel: budgetPolicy.travel_budget || 0,
    accommodation: budgetPolicy.accommodation_budget || 0,
    perDiem: budgetPolicy.per_diem_budget || 0
  } : null;

  // === UNIFIED DOCUMENT OBJECT ===
  return {
    meta: {
      documentType: 'ExternalWorkerBrief',
      generatedAt: new Date().toISOString(),
      timestamp: new Date().toLocaleDateString('de-DE', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
    },
    projectIdentification,
    assignedPartner,
    projectDescription,
    taskList,
    locationAccess,
    documentationNotice,
    safetyNotes,
    budget
  };
}