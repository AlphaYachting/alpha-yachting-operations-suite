/**
 * Visit Planning Computation Engine
 * Groups work orders into operational visits (boat + project + location clusters)
 * with actionable/blocked work separation.
 */

const TIME_WINDOW_DAYS = 7; // Work orders within 7 days of earliest scheduled_date belong to same visit
const HARD_BLOCKER_STATUSES = ['Waiting for Parts', 'Waiting for Approval', 'Cancelled'];
const LOW_CONFIDENCE_STATUSES = ['Paused', 'On Hold'];

/**
 * Compute visits from work orders.
 * A visit = one boat + one job/project + one location + time-adjacent work orders
 * Each visit tracks actionable vs blocked/paused items separately.
 */
export function computeVisits(workOrders, jobs = {}, locations = {}, technicians = []) {
  if (!workOrders?.length) return [];

  // Start with non-terminal work orders (exclude Completed, Cancelled, Draft)
  const candidates = workOrders.filter(
    wo => !['Completed', 'Cancelled', 'Draft'].includes(wo.status)
  );

  if (!candidates.length) return [];

  // Group by boat + project + location
  const visitMap = new Map(); // key = `${boatId}|${jobId}|${locationId}`

  for (const wo of candidates) {
    const job = jobs[wo.job_id];
    if (!job) continue;

    const location = locations[job.location_id];
    const boatId = job.boat_id || 'unknown';
    const jobId = wo.job_id;
    const locationId = job.location_id || 'unknown';
    const key = `${boatId}|${jobId}|${locationId}`;

    if (!visitMap.has(key)) {
      visitMap.set(key, {
        boatId,
        jobId,
        locationId,
        boat: null,
        job,
        location,
        workOrders: [],
      });
    }

    visitMap.get(key).workOrders.push(wo);
  }

  // Compute visit details
  const visits = [];
  for (const visitData of visitMap.values()) {
    const visit = buildVisit(visitData, technicians);
    if (visit) visits.push(visit);
  }

  // Sort by start date, then effort
  visits.sort((a, b) => {
    const dateA = new Date(a.startDate).getTime();
    const dateB = new Date(b.startDate).getTime();
    if (dateA !== dateB) return dateA - dateB;
    return b.effort.max - a.effort.max;
  });

  return visits;
}

/**
 * Build a single visit object with computed metrics.
 */
function buildVisit(visitData, technicians) {
  const { boatId, jobId, locationId, job, location, workOrders } = visitData;

  if (!workOrders.length) return null;

  // Separate actionable from blocked/paused
  const actionable = workOrders.filter(
    wo => !HARD_BLOCKER_STATUSES.includes(wo.status) && !LOW_CONFIDENCE_STATUSES.includes(wo.status)
  );
  const blocked = workOrders.filter(
    wo => HARD_BLOCKER_STATUSES.includes(wo.status) || LOW_CONFIDENCE_STATUSES.includes(wo.status)
  );

  // Compute effort from actionable items only
  const effort = estimateEffort(actionable);

  // Start date = earliest scheduled_date from actionable items
  const startDate = getStartDate(actionable);

  // Suggest executor from lead_technician_id or resource pool
  const executor = suggestExecutor(actionable, technicians);

  return {
    // Identity
    boatId,
    jobId,
    locationId,
    boat: null, // populated by caller if needed
    job,
    location,
    
    // Temporal
    startDate,
    
    // Work composition
    workOrders, // all
    actionable,
    blocked,
    
    // Metrics
    effort, // { min, max } in hours
    actionableCount: actionable.length,
    blockedCount: blocked.length,
    
    // Execution
    executor,
    
    // Derived
    timeBucket: getTimeBucket(startDate),
  };
}

/**
 * Calculate effort from work orders (actionable only).
 */
function estimateEffort(workOrders) {
  let minHours = 0;
  let maxHours = 0;

  for (const wo of workOrders) {
    const min = wo.estimated_duration_hours ? wo.estimated_duration_hours * 0.8 : 2;
    const max = wo.estimated_duration_hours ? wo.estimated_duration_hours * 1.2 : 4;
    minHours += min;
    maxHours += max;
  }

  return {
    min: Math.round(minHours * 2) / 2,
    max: Math.round(maxHours * 2) / 2,
  };
}

/**
 * Get start date for a visit.
 * = earliest scheduled_date from actionable items, or today if none scheduled.
 */
function getStartDate(workOrders) {
  const scheduled = workOrders
    .filter(wo => wo.scheduled_date)
    .map(wo => new Date(wo.scheduled_date).getTime());

  if (scheduled.length === 0) {
    return new Date().toISOString().split('T')[0];
  }

  const earliest = Math.min(...scheduled);
  const date = new Date(earliest);
  return date.toISOString().split('T')[0];
}

/**
 * Group visits into time buckets: "This Week", "Next Week", "Later"
 */
export function groupVisitsByTimeBucket(visits) {
  const today = new Date();
  const thisWeekEnd = new Date(today);
  thisWeekEnd.setDate(today.getDate() + 7);

  const buckets = {
    'This Week': [],
    'Next Week': [],
    'Later': [],
  };

  for (const visit of visits) {
    const visitDate = new Date(visit.startDate);
    if (visitDate < thisWeekEnd) {
      buckets['This Week'].push(visit);
    } else {
      const nextWeekEnd = new Date(thisWeekEnd);
      nextWeekEnd.setDate(thisWeekEnd.getDate() + 7);
      buckets[visitDate < nextWeekEnd ? 'Next Week' : 'Later'].push(visit);
    }
  }

  return buckets;
}

/**
 * Get human-readable time bucket label.
 */
function getTimeBucket(dateStr) {
  const date = new Date(dateStr);
  const today = new Date();
  const thisWeekEnd = new Date(today);
  thisWeekEnd.setDate(today.getDate() + 7);

  if (date < thisWeekEnd) return 'This Week';

  const nextWeekEnd = new Date(thisWeekEnd);
  nextWeekEnd.setDate(thisWeekEnd.getDate() + 7);

  if (date < nextWeekEnd) return 'Next Week';

  return 'Later';
}

/**
 * Suggest executor for a visit based on work orders.
 * Priority: use existing lead_technician_id, else suggest from resource pool.
 */
function suggestExecutor(workOrders, technicians) {
  // Check if any WO has a lead_technician already assigned
  for (const wo of workOrders) {
    if (wo.lead_technician_id) {
      const tech = technicians.find(t => t.id === wo.lead_technician_id);
      if (tech) {
        return {
          id: tech.id,
          name: `${tech.first_name} ${tech.last_name}`,
          assigned: true,
        };
      }
    }
  }

  // Suggest first available core technician (future: use resource matcher)
  const available = technicians.filter(t => t.status === 'Active' && !t.is_external);
  if (available.length > 0) {
    const tech = available[0];
    return {
      id: tech.id,
      name: `${tech.first_name} ${tech.last_name}`,
      assigned: false,
      suggestion: true,
    };
  }

  return {
    id: null,
    name: 'TBD',
    assigned: false,
  };
}