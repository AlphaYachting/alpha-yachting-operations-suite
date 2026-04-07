// Pure evaluation logic — NO entity writes, NO side effects

const today = () => new Date();
const parseDate = (d) => d ? new Date(d) : null;

// ─── BLOCKER DEFINITIONS ───────────────────────────────────────────────────

export const BLOCKER_META = {
  // Hard blockers
  MISSING_LOCATION:            { label: 'No location',           severity: 'hard',  color: 'red' },
  CUSTOMER_BLOCKED:            { label: 'Customer blocked',       severity: 'hard',  color: 'red' },
  PARTS_NOT_ORDERED:           { label: 'Parts not ordered',      severity: 'hard',  color: 'red' },
  // Soft blockers
  MISSING_DURATION:            { label: 'No duration estimate',   severity: 'soft',  color: 'orange' },
  NO_SERVICE_AREA:             { label: 'No service area',        severity: 'soft',  color: 'orange' },
  NO_TECHNICIAN:               { label: 'No technician',          severity: 'soft',  color: 'orange' },
  ACCESS_UNCLEAR:              { label: 'Access unclear',         severity: 'soft',  color: 'orange' },
  PARTS_ETA_UNKNOWN:           { label: 'Parts ETA unknown',      severity: 'soft',  color: 'yellow' },
  PARTS_ETA_PASSED:            { label: 'Parts ETA passed',       severity: 'soft',  color: 'orange' },
  // Data gaps
  NO_TASKS:                    { label: 'No tasks defined',       severity: 'gap',   color: 'blue' },
  NO_PARENT_JOB:               { label: 'No parent project',      severity: 'gap',   color: 'blue' },
  BOAT_ACCESS_UNKNOWN:         { label: 'Boat access unknown',    severity: 'gap',   color: 'blue' },
  NO_LOCATION_NOTES:           { label: 'No location notes',      severity: 'gap',   color: 'blue' },
  ORG_TASKS_MISSING:           { label: 'No org tasks',           severity: 'gap',   color: 'orange' },
};

// ─── NEXT ACTION MAPPING ───────────────────────────────────────────────────

export const NEXT_ACTIONS = {
  MISSING_LOCATION:    { text: 'Assign a marina or work location to this job',         role: 'Operations Manager',  type: 'Internal clarification',  priority: 'Today' },
  CUSTOMER_BLOCKED:    { text: 'Resolve customer account blocking issue',              role: 'Operations Manager',  type: 'Internal clarification',  priority: 'Today' },
  PARTS_NOT_ORDERED:   { text: 'Initiate parts order for this job',                   role: 'Operations Manager',  type: 'Supplier follow-up',      priority: 'Today' },
  PARTS_ETA_PASSED:    { text: 'Follow up with supplier — parts past delivery date',  role: 'Operations Manager',  type: 'Supplier follow-up',      priority: 'Today' },
  MISSING_DURATION:    { text: 'Estimate work duration (hours) for this work order',  role: 'Lead Technician',     type: 'Technical estimation',    priority: 'This week' },
  NO_TECHNICIAN:       { text: 'Assign technician(s) to this work order',             role: 'Operations Manager',  type: 'Internal clarification',  priority: 'This week' },
  ACCESS_UNCLEAR:      { text: 'Confirm access details with customer or marina',       role: 'Operations Manager',  type: 'Customer communication',  priority: 'This week' },
  PARTS_ETA_UNKNOWN:   { text: 'Request delivery ETA from supplier',                  role: 'Operations Manager',  type: 'Supplier follow-up',      priority: 'This week' },
  NO_SERVICE_AREA:     { text: 'Classify service area for this work order',           role: 'Lead Technician',     type: 'Internal clarification',  priority: 'This week' },
  NO_TASKS:            { text: 'Create task checklist for this work order',           role: 'Lead Technician',     type: 'Internal clarification',  priority: 'Later' },
  NO_PARENT_JOB:       { text: 'Link this work order to a project',                   role: 'Operations Manager',  type: 'Internal clarification',  priority: 'Later' },
  BOAT_ACCESS_UNKNOWN: { text: 'Add access details to the boat record',               role: 'Operations Manager',  type: 'Internal clarification',  priority: 'Later' },
  NO_LOCATION_NOTES:   { text: 'Add access notes to the marina record',               role: 'Operations Manager',  type: 'Internal clarification',  priority: 'Later' },
  ORG_TASKS_MISSING:   { text: 'Create organization tasks: access coordination, customer confirmation, scheduling prep', role: 'Operations Manager', type: 'Organizational prep', priority: 'This week' },
};

// ─── CORE EVALUATOR ────────────────────────────────────────────────────────

export function evaluateWorkOrder({ workOrder, job, customer, boat, location, taskCount, taskEstimatedMinutesSum, orgTaskCount = 0 }) {
  const blockers = [];
  const now = today();

  const addBlocker = (code) => blockers.push(code);

  // ── PLANNING READINESS ──

  // Hard blockers
  if (job && !job.location_id) addBlocker('MISSING_LOCATION');
  if (customer?.status === 'Blocked') addBlocker('CUSTOMER_BLOCKED');
  if (job?.requires_parts === true && job?.parts_ordered !== true) addBlocker('PARTS_NOT_ORDERED');

  // Soft blockers
  const durationKnown = (workOrder.estimated_duration_hours > 0) || (taskEstimatedMinutesSum > 0);
  if (!durationKnown) addBlocker('MISSING_DURATION');
  if (!workOrder.service_area) addBlocker('NO_SERVICE_AREA');
  const hasAssigned = Array.isArray(workOrder.assigned_technicians) && workOrder.assigned_technicians.length > 0;
  if (!hasAssigned) addBlocker('NO_TECHNICIAN');
  if (!workOrder.access_confirmed && !boat?.access_details) addBlocker('ACCESS_UNCLEAR');
  if (job?.parts_ordered === true && !job?.parts_eta) addBlocker('PARTS_ETA_UNKNOWN');
  if (job?.parts_eta) {
    const eta = parseDate(job.parts_eta);
    if (eta && eta < now) addBlocker('PARTS_ETA_PASSED');
  }

  // Data gaps
  if (taskCount === 0) addBlocker('NO_TASKS');
  if (!workOrder.job_id) addBlocker('NO_PARENT_JOB');
  if (!boat?.access_details) addBlocker('BOAT_ACCESS_UNKNOWN');
  if (!location?.access_notes) addBlocker('NO_LOCATION_NOTES');
  // Org gap: non-trivial WOs with no organization tasks defined
  // Suppress if: this IS an org WO, already has a linked org WO, or explicitly marked not needed
  const durationHours = workOrder.estimated_duration_hours || (taskEstimatedMinutesSum / 60);
  const hasOrgCoverage = 
    workOrder.workorder_type === 'ORGANIZATION' ||
    workOrder.workorder_type === 'EXECUTION' && !!workOrder.linked_workorder_id ||
    workOrder.org_tasks_not_needed === true ||
    orgTaskCount > 0;
  if (!hasOrgCoverage && durationHours > 2) addBlocker('ORG_TASKS_MISSING');

  // ── PLANNING READINESS RESULT ──
  const hardBlockers = blockers.filter(b => BLOCKER_META[b]?.severity === 'hard');
  let planningReadiness;
  if (hardBlockers.length > 0) planningReadiness = 'not_plannable';
  else if (blockers.filter(b => BLOCKER_META[b]?.severity === 'soft').length > 0) planningReadiness = 'needs_clarification';
  else planningReadiness = 'ready';

  // ── DISPATCH READINESS ──
  const partsOk = !job?.requires_parts || job?.parts_ordered === true;
  const dispatchReady = durationKnown && hasAssigned && partsOk;

  // ── OPERATIONAL PRIORITY ──
  let priority = 'low';
  const reqDate = parseDate(job?.requested_date);
  const daysUntil = reqDate ? Math.ceil((reqDate - now) / (1000 * 60 * 60 * 24)) : null;
  if (job?.priority === 'Urgent' || job?.priority === 'Express' || (daysUntil !== null && daysUntil <= 3)) {
    priority = 'high';
  } else if (daysUntil !== null && daysUntil <= 14) {
    priority = 'medium';
  }

  // ── DEPLOYABLE THIS WEEK ──
  const deployable = planningReadiness === 'ready' && job?.location_id && durationKnown && partsOk && customer?.status !== 'Blocked';

  // ── NEXT ACTIONS ──
  const nextActions = blockers
    .filter(b => NEXT_ACTIONS[b])
    .map(b => ({ code: b, ...NEXT_ACTIONS[b] }));

  return {
    blockers,
    hardBlockers,
    planningReadiness,
    dispatchReady,
    priority,
    deployable,
    nextActions,
    durationKnown,
    hasAssigned,
  };
}