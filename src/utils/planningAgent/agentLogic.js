// Planning Agent V2 — Heuristic Decision Logic
// READ-ONLY. No writes. No side effects.
import { buildResourcePools, getZone, UNAVAILABLE_FOR_PLANNING, isNonExecutionStaff } from './resourceMatcher.js';

// ─── Service Area Inference ───────────────────────────────────────────────────
const AREA_KEYWORDS = {
  // Organisation must be first — prevents org-titled WOs from matching 'service'/'check' keywords below
  Organisation:     ['organisation', 'kommunikation', 'communication', 'koordination', 'coordination'],
  Mechanical:       ['motor', 'engine', 'getriebe', 'diesel', 'pump', 'pumpe', 'antrieb', 'propeller', 'shaft', 'welle'],
  Electrical:       ['elektr', 'kabel', 'battery', 'batterie', 'strom', 'wiring', 'panel', 'sicherung', 'fuse'],
  // Electronics (Tier 1) — must include navigation + lighting to prevent fallthrough to Diagnostics
  // 'navigat' catches navigation checks; 'positionslicht'/'signallampe' catch nav lights; 'licht'/'light' moved here from Electrical
  Electronics:      ['chart', 'plotter', 'vhf', 'ais', 'radar', 'nmea', 'autopilot', 'gps', 'display', 'elektronik', 'navigat', 'positionslicht', 'signallampe', 'nav light', 'licht', 'light'],
  'GRP/Bodywork':   ['osmose', 'rumpf', 'gelcoat', 'grp', 'laminat', 'antifouling', 'polish', 'reparatur', 'scratch', 'dent'],
  Sealing:          ['dicht', 'seal', 'leak', 'leck', 'silicon', 'sealant', 'teak', 'window', 'fenster', 'hatch'],
  HVAC:             ['klima', 'hvac', 'heiz', 'heat', 'ventilation', 'aircon', 'cooling'],
  Rigging:          ['rigg', 'mast', 'segel', 'sail', 'shroud', 'stay', 'halyard', 'fall', 'winch'],
  Plumbing:         ['wasser', 'water', 'toilet', 'head', 'bilge', 'seacock', 'hahn', 'schlauch', 'hose', 'tank'],
  Diagnostics:      ['diagnos', 'check', 'inspection', 'inspektion', 'service', 'survey', 'test'],
};

export function inferServiceArea(text) {
  const lower = (text || '').toLowerCase();
  for (const [area, keywords] of Object.entries(AREA_KEYWORDS)) {
    if (keywords.some(k => lower.includes(k))) return { area, inferred: true };
  }
  return { area: null, inferred: false };
}

// ─── Effort Estimation ────────────────────────────────────────────────────────
const SERVICE_AREA_EFFORT = {
  Mechanical:        { min: 3, max: 6 },
  Electrical:        { min: 2, max: 5 },
  Electronics:       { min: 1.5, max: 4 },
  'GRP/Bodywork':    { min: 4, max: 10 },
  Sealing:           { min: 2, max: 5 },
  HVAC:              { min: 3, max: 6 },
  Rigging:           { min: 2, max: 5 },
  Plumbing:          { min: 2, max: 4 },
  'General Service': { min: 1.5, max: 4 },
  Diagnostics:       { min: 1.5, max: 3 },
  Installation:      { min: 2, max: 5 },
  Other:             { min: 2, max: 6 },
};

export function estimateEffort(workOrder, tasks, serviceArea) {
  if (workOrder.estimated_duration_hours) {
    return { min: workOrder.estimated_duration_hours, max: workOrder.estimated_duration_hours, source: 'explicit' };
  }
  const tasksWithEstimate = (tasks || []).filter(t => t.estimated_minutes > 0);
  if (tasksWithEstimate.length > 0) {
    const raw = tasksWithEstimate.reduce((s, t) => s + t.estimated_minutes, 0) / 60;
    return {
      min: parseFloat((raw * 0.8).toFixed(1)),
      max: parseFloat((raw * 1.3).toFixed(1)),
      source: 'task_based',
    };
  }
  if (serviceArea && SERVICE_AREA_EFFORT[serviceArea]) {
    return { ...SERVICE_AREA_EFFORT[serviceArea], source: 'service_area_default' };
  }
  return { min: 2, max: 8, source: 'global_fallback' };
}

// ─── Team Size ────────────────────────────────────────────────────────────────
export function estimateTeamSize(effortMin, effortMax, serviceArea) {
  const grp = serviceArea === 'GRP/Bodywork';
  let min = 1, max = 1;
  if (effortMax <= 2)      { min = 1; max = 1; }
  else if (effortMax <= 5) { min = 1; max = 1; }
  else if (effortMax <= 8) { min = 1; max = 2; }
  else                     { min = 2; max = 3; }
  if (grp) { min = Math.max(min, 1); max = Math.max(max, 2); }
  return { min, max };
}

// ─── Blocker Detection ────────────────────────────────────────────────────────
export function detectBlocker(workOrder, job, customer) {
  if (customer?.status === 'Blocked') return { type: 'HARD', reason: 'Customer account is blocked' };
  if (workOrder.status === 'Cancelled') return { type: 'HARD', reason: 'Work order is cancelled' };
  if (job && !job.location_id) return { type: 'HARD', reason: 'No location assigned to job' };
  if (job && job.requires_parts && !job.parts_ordered) return { type: 'HARD', reason: 'Parts required but not ordered' };
  if (workOrder.status === 'Waiting for Parts') return { type: 'EXTERNAL', reason: 'Waiting for parts delivery' };
  if (workOrder.status === 'Waiting for Approval') return { type: 'EXTERNAL', reason: 'Waiting for customer approval' };
  // E: align with readinessEvaluator PARTS_ETA_PASSED — parts ordered but delivery date passed
  if (job && job.parts_eta && new Date(job.parts_eta) < new Date()) return { type: 'EXTERNAL', reason: 'Parts delivery date has passed — follow up with supplier' };
  return { type: 'NONE', reason: null };
}

// ─── Confidence ───────────────────────────────────────────────────────────────
export function computeConfidence(workOrder, job, effortSource, serviceArea, orgTasksMissing) {
  const hasLocation = !!(job && job.location_id);
  const durationExplicit = effortSource === 'explicit';
  const durationTaskBased = effortSource === 'task_based';
  const hasServiceArea = !!serviceArea;

  let softCount = 0;
  if (!workOrder.assigned_technicians?.length) softCount++;
  if (!workOrder.access_confirmed) softCount++;
  if (!hasServiceArea) softCount++;
  // Org gap nudges confidence down for non-trivial WOs (not quick-wins)
  if (orgTasksMissing && workOrder.estimated_duration_hours > 2) softCount++;

  if ((durationExplicit || durationTaskBased) && hasLocation && hasServiceArea && softCount === 0) return 'HIGH';
  if ((durationExplicit || durationTaskBased || effortSource === 'service_area_default') && hasLocation && softCount <= 1) return 'MEDIUM';
  return 'LOW';
}

// ─── Planning Bucket ──────────────────────────────────────────────────────────
const URGENT_PRIORITIES = ['Urgent', 'Express'];
const HIGH_PRIORITIES   = ['Urgent', 'Express', 'High'];

export function classifyBucket(workOrder, job, blocker, confidence, today, resourceGate, orgTasksMissing, effortMax) {
  if (!today) today = new Date();
  if (blocker.type === 'HARD' || blocker.type === 'EXTERNAL') return 'BLOCKED';

  const isOrphan = !workOrder.job_id || !job;
  if (isOrphan) return 'NEEDS_CLARIFICATION';
  if (!job.location_id) return 'BLOCKED';

  const requestedDate = job.requested_date ? new Date(job.requested_date) : null;
  const scheduledDate = workOrder.scheduled_date ? new Date(workOrder.scheduled_date) : null;
  const priority = job.priority || 'Normal';

  const weekEnd     = new Date(today); weekEnd.setDate(today.getDate() + 7);
  const twoWeekEnd  = new Date(today); twoWeekEnd.setDate(today.getDate() + 14);

  const isUrgent = URGENT_PRIORITIES.includes(priority);
  const isHigh   = HIGH_PRIORITIES.includes(priority);

  const requestedThisWeek = requestedDate && requestedDate <= weekEnd;
  const requestedNextWeek = requestedDate && requestedDate <= twoWeekEnd;
  const scheduledThisWeek = scheduledDate && scheduledDate >= today && scheduledDate <= weekEnd;
  const scheduledNextWeek = scheduledDate && scheduledDate > weekEnd && scheduledDate <= twoWeekEnd;
  const isOverdue         = requestedDate && requestedDate < today;

  const thisWeekSignal = requestedThisWeek || scheduledThisWeek || isUrgent || isOverdue;

  if (thisWeekSignal) {
    if (confidence === 'LOW' && !isUrgent) return 'NEEDS_CLARIFICATION';
    // Org gap: non-urgent, non-trivial WOs missing org tasks pushed to clarification
    if (orgTasksMissing && !isUrgent && effortMax > 2) return 'NEEDS_CLARIFICATION';
    // V2: day-of-week resource gate — Thu/Fri shifts non-urgent WOs with no quick-response candidate
    if (resourceGate === 'shift_next_week' && !isUrgent) return 'NEXT_WEEK_CANDIDATE';
    return 'THIS_WEEK_CANDIDATE';
  }

  const nextWeekSignal = requestedNextWeek || scheduledNextWeek || isHigh;
  if (nextWeekSignal) {
    if (confidence === 'LOW') return 'NEEDS_CLARIFICATION';
    return 'NEXT_WEEK_CANDIDATE';
  }

  return 'NEEDS_CLARIFICATION';
}

// ─── Ranking Score ────────────────────────────────────────────────────────────
export function computeRankingScore(workOrder, job, confidence, effortMax, serviceArea, blocker, today) {
  if (!today) today = new Date();
  const requestedDate = job && job.requested_date ? new Date(job.requested_date) : null;
  const priority = (job && job.priority) || 'Normal';
  const diffDays = requestedDate ? Math.floor((requestedDate - today) / 86400000) : null;

  let dateScore = 0;
  if (diffDays !== null) {
    if (diffDays < 0)        dateScore = 35;
    else if (diffDays === 0) dateScore = 33;
    else if (diffDays <= 3)  dateScore = 28;
    else if (diffDays <= 7)  dateScore = 20;
    else if (diffDays <= 14) dateScore = 12;
  }

  const priorityScore = { Express: 25, Urgent: 22, High: 14, Normal: 6, Low: 0 }[priority] || 6;
  const confScore     = { HIGH: 20, MEDIUM: 12, LOW: 4 }[confidence] || 4;

  let quickWinBonus = 0;
  if (effortMax <= 2) quickWinBonus = confidence !== 'LOW' ? 10 : 4;

  const badWeatherBonus = ['Electronics', 'Electrical', 'HVAC'].includes(serviceArea) ? 5
    : serviceArea === 'GRP/Bodywork' ? 3 : 0;

  let penalty = 0;
  if (!workOrder.assigned_technicians?.length) penalty += 4;
  if (!workOrder.access_confirmed)             penalty += 3;
  if (!workOrder.service_area && !serviceArea) penalty += 3;
  if (blocker.type !== 'NONE')                 penalty += 5;
  penalty = Math.min(penalty, 15);

  const total = Math.min(100, Math.max(0, dateScore + priorityScore + confScore + quickWinBonus + badWeatherBonus - penalty));

  return {
    score: total,
    breakdown: { dateScore, priorityScore, confScore, quickWinBonus, badWeatherBonus, penalty: -penalty },
  };
}

// ─── Suggested Action ────────────────────────────────────────────────────────
export function suggestNextAction(blocker, workOrder, job, confidence, resourcePools, orgTasksMissing) {
  if (blocker.type === 'HARD') {
    if (blocker.reason.includes('Parts'))    return 'Order parts before scheduling';
    if (blocker.reason.includes('location')) return 'Assign a location to the job';
    if (blocker.reason.includes('Customer')) return 'Resolve customer account issue';
    return 'Resolve hard blocker before planning';
  }
  if (blocker.type === 'EXTERNAL') return 'Wait for external resolution, then re-evaluate';

  // V2: use resource pool to make action more specific
  if (!workOrder.assigned_technicians?.length) {
    const top = resourcePools && resourcePools.preferred && resourcePools.preferred[0];
    if (top) {
      return 'Consider ' + top.name + ' as lead candidate - confirm availability and schedule';
    }
    const fallback = resourcePools && resourcePools.fallback && resourcePools.fallback[0];
    if (fallback) {
      return 'No core match - check ' + fallback.name + ' (' + fallback.availability_class + ') availability';
    }
    return 'Assign a technician and schedule';
  }
  if (orgTasksMissing) return 'Add organization tasks (access, customer coordination, scheduling prep)';
  if (!workOrder.estimated_duration_hours) return 'Confirm duration estimate';
  if (!workOrder.access_confirmed) return 'Confirm boat/site access';
  if (confidence === 'HIGH') return 'Ready to schedule - confirm date';
  return 'Review details and schedule when ready';
}

// ─── Main Evaluator ───────────────────────────────────────────────────────────
export function evaluateWorkOrder({ workOrder, job, customer, boat, location, tasks, technicians, today, workloadMap = {}, jobOrgTaskCount = null }) {
  if (!today) today = new Date();
  if (!technicians) technicians = [];

  const orphanedWo = !workOrder.job_id || !job;

  // Service area
  const knownArea = workOrder.service_area;
  const titleInference = inferServiceArea((workOrder.title || '') + ' ' + (workOrder.description || ''));
  const serviceArea = knownArea || titleInference.area;
  const areaInferred = !knownArea && titleInference.inferred;

  // Effort
  const effort = estimateEffort(workOrder, tasks || [], serviceArea);
  const durationUnknown = effort.source === 'global_fallback';

  // Team size
  const team = estimateTeamSize(effort.min, effort.max, serviceArea);

  // Blocker
  const blocker = detectBlocker(workOrder, job, customer);

  // Parts ETA
  const partsEtaUnknown = !!(job && job.requires_parts && job.parts_ordered && !job.parts_eta);

  // Org task detection — must be before confidence
  const orgTasks = (tasks || []).filter(t => t.task_stream === 'ORGANIZATION');
  const orgTasksMissing = orgTasks.length === 0;
  const orgOwnerSet = orgTasks.some(t => !!t.assigned_user_id);
  // Job-level org gap: no org tasks exist anywhere across the entire job's WOs
  // jobOrgTaskCount is the total ORGANIZATION tasks across ALL WOs of this job (passed from caller)
  // null means caller didn't provide it — treat as unknown, don't flag
  const jobOrgGapMissing = jobOrgTaskCount !== null && jobOrgTaskCount === 0 && effort.max > 2;

  // Confidence
  const confidence = blocker.type !== 'NONE' ? 'LOW' : computeConfidence(workOrder, job, effort.source, serviceArea, orgTasksMissing);

  // V2: Job zone + resource pools
  const locationText = [(location && location.name) || '', (location && location.city) || '', (location && location.address) || ''].join(' ');
  const jobZone = getZone(locationText);
  const dayOfWeek = today.getDay();
  // D: remaining workdays in current week — Mon=4, Tue=3, Wed=2, Thu=1, Fri=0, weekend treated as 5
  const remainingWorkdays = dayOfWeek >= 1 && dayOfWeek <= 5 ? (5 - dayOfWeek) : 5;
  const resourcePools = buildResourcePools(technicians, serviceArea, jobZone, effort.max, remainingWorkdays, workloadMap);

  // Bucket (resource-gate aware)
  const bucket = classifyBucket(workOrder, job, blocker, confidence, today, resourcePools.weekResourceGate, orgTasksMissing, effort.max);

  // Ranking
  const { score, breakdown } = computeRankingScore(workOrder, job, confidence, effort.max, serviceArea, blocker, today);

  // Flags
  const isQuickWin = effort.max <= 2 && confidence !== 'LOW' && blocker.type === 'NONE';
  const isBadWeatherCandidate = ['Electronics', 'Electrical', 'HVAC', 'GRP/Bodywork'].includes(serviceArea) && blocker.type === 'NONE';

  // Uncertainty
  const mainBlocker = blocker.type !== 'NONE' ? blocker.reason : null;
  let mainUncertainty = null;
  if (durationUnknown) mainUncertainty = 'Duration unknown (global fallback used)';
  else if (effort.source === 'service_area_default') mainUncertainty = 'Duration estimated from service area average';
  else if (!workOrder.assigned_technicians?.length) mainUncertainty = 'No technician assigned';

  const reasoningSummary = buildReasoning(bucket, blocker, confidence, effort, serviceArea, areaInferred, workOrder, job, orgTasksMissing, jobOrgGapMissing);
  const suggestedNextAction = suggestNextAction(blocker, workOrder, job, confidence, resourcePools, orgTasksMissing);

  // Phase 2: ownership gap detection
  const executionOwnerMissing = !workOrder.lead_technician_id;

  return {
    workOrder,
    job,
    customer,
    boat,
    location,
    tasks: tasks || [],
    derived: {
      taskCount: (tasks || []).length,
      executionOwnerMissing,
      orgTasksMissing,
      orgOwnerSet,
      orgTaskCount: orgTasks.length,
      jobOrgGapMissing,
      taskEstimatedMinutesSum: (tasks || []).filter(t => t.estimated_minutes).reduce((s, t) => s + t.estimated_minutes, 0),
      inferredServiceArea: serviceArea,
      effortSource: effort.source,
      estimatedEffortMin: effort.min,
      estimatedEffortMax: effort.max,
      estimatedTeamSizeMin: team.min,
      estimatedTeamSizeMax: team.max,
      confidenceLevel: confidence,
      blockerType: blocker.type,
      planningBucket: bucket,
      rankingScore: score,
      rankingBreakdown: breakdown,
      isQuickWin,
      isBadWeatherCandidate,
      orphanedWo,
      areaInferred,
      durationUnknown,
      partsEtaUnknown,
      mainBlocker,
      mainUncertainty,
      suggestedNextAction,
      reasoningSummary,
      // V2 resource fields
      jobZone,
      preferredResourcePool: resourcePools.preferred,
      fallbackResourcePool: resourcePools.fallback,
      resourceReasoning: resourcePools.reasoning,
    },
  };
}

function buildReasoning(bucket, blocker, confidence, effort, serviceArea, areaInferred, workOrder, job, orgTasksMissing, jobOrgGapMissing) {
  const parts = [];
  parts.push('Classified as ' + bucket.replace(/_/g, ' ') + '.');
  if (blocker.type !== 'NONE') parts.push(blocker.type + ' blocker: ' + blocker.reason + '.');
  parts.push('Effort: ' + effort.min + '-' + effort.max + 'h (' + effort.source.replace(/_/g, ' ') + ').');
  if (areaInferred) parts.push('Service area inferred from title.');
  if (!serviceArea) parts.push('Service area unknown.');
  parts.push('Confidence: ' + confidence + '.');
  if (!workOrder.assigned_technicians?.length) parts.push('No technician assigned.');
  if (jobOrgGapMissing) parts.push('Project has no organization tasks at all — project-level coordination is undefined.');
  else if (orgTasksMissing) parts.push('This work order is missing organization tasks — access, coordination and prep not yet defined.');
  if (job && job.requested_date) parts.push('Requested by: ' + new Date(job.requested_date).toLocaleDateString('de-AT') + '.');
  return parts.join(' ');
}

// ─── Capacity ─────────────────────────────────────────────────────────────────
export function computeCapacity(technicians, thisWeekItems, nextWeekItems) {
  // V2: only count CORE team as base capacity
  // Phase 1.1: exclude Sick/Vacation/Off Duty — aligned with resource pool filter in resourceMatcher.js
  // Phase 1.2: exclude non-execution staff (SUPPORT tendency + no execution skills)
  const active = (technicians || []).filter(t =>
    t.status !== 'Inactive' &&
    !UNAVAILABLE_FOR_PLANNING.includes(t.availability_status) &&
    !isNonExecutionStaff(t)
  );
  const coreTechs = active.filter(t =>
    t.team_type === 'Core' || ['CORE_PREFERRED', 'CORE_LIMITED'].includes(t.availability_class)
  );
  const activeTechs = coreTechs.length || active.length;
  const externalSupportCount = active.filter(t =>
    t.team_type === 'External' || ['EXTERNAL_REGULAR', 'EXTERNAL_SPECIALIST', 'EXTERNAL_ON_REQUEST'].includes(t.availability_class)
  ).length;

  const weeklyCapacity = activeTechs * 8 * 5;

  const thisMin = thisWeekItems.reduce((s, i) => s + i.derived.estimatedEffortMin, 0);
  const thisMax = thisWeekItems.reduce((s, i) => s + i.derived.estimatedEffortMax, 0);
  const nextMin = nextWeekItems.reduce((s, i) => s + i.derived.estimatedEffortMin, 0);
  const nextMax = nextWeekItems.reduce((s, i) => s + i.derived.estimatedEffortMax, 0);

  const utilPct = weeklyCapacity > 0 ? Math.round((thisMax / weeklyCapacity) * 100) : 0;
  let utilizationStatus = 'ok';
  if (utilPct > 120)      utilizationStatus = 'critical';
  else if (utilPct > 90)  utilizationStatus = 'overloaded';
  else if (utilPct > 70)  utilizationStatus = 'near_full';

  return {
    activeTechs,
    externalSupportCount,
    weeklyCapacity,
    thisWeekEffortMin: Math.round(thisMin * 10) / 10,
    thisWeekEffortMax: Math.round(thisMax * 10) / 10,
    nextWeekEffortMin: Math.round(nextMin * 10) / 10,
    nextWeekEffortMax: Math.round(nextMax * 10) / 10,
    utilizationPct: utilPct,
    utilizationStatus,
    isRoughEstimate: true,
  };
}