/**
 * Visit bundling recommendation analyzer.
 * Identifies work order grouping opportunities for efficient same-visit execution.
 */

const HARD_BLOCKER_STATUSES = ['Cancelled', 'Waiting for Parts', 'Waiting for Approval'];
const LOW_CONFIDENCE_STATUSES = ['Paused', 'On Hold'];
const MAX_BUNDLE_EFFORT = 8; // hours
const TIMING_WINDOW_DAYS = 7;

export function findBundleCandidates(workOrder, allWorkOrders, jobs, locations) {
  if (!workOrder || !allWorkOrders) return { group: [], tier: null, reason: null, blockedReason: null };

  const wo = workOrder;
  const job = jobs?.[wo.job_id];
  const location = locations?.[job?.location_id];

  // Exclude self and excluded statuses
  const candidates = allWorkOrders.filter(
    w => w.id !== wo.id && !['Cancelled', 'Completed'].includes(w.status)
  );

  // TIER 1: Same boat + job + location
  const sameBoatGroup = candidates.filter(
    w => {
      const wJob = jobs?.[w.job_id];
      return wJob?.boat_id === job?.boat_id &&
             w.job_id === wo.job_id &&
             wJob?.location_id === job?.location_id;
    }
  );

  if (sameBoatGroup.length > 0) {
    const bundleCheck = checkBundlingValidity(wo, sameBoatGroup, jobs);
    if (!bundleCheck.blocked) {
      const analysis = analyzeActionabilityAndEffort(wo, sameBoatGroup);
      return {
        group: sameBoatGroup,
        tier: 'SAME_BOAT',
        reason: `Same vessel at ${location?.name || 'same location'}. Can combine into efficient visit.`,
        blockedReason: null,
        effort: analysis.effort,
        actionable: analysis.actionable,
        excluded: analysis.excluded,
      };
    }
    return {
      group: [],
      tier: null,
      reason: null,
      blockedReason: bundleCheck.reason,
    };
  }

  // TIER 2: Same location only
  const sameLocationGroup = candidates.filter(
    w => jobs?.[w.job_id]?.location_id === job?.location_id
  );

  if (sameLocationGroup.length > 0) {
    const bundleCheck = checkBundlingValidity(wo, sameLocationGroup, jobs);
    if (!bundleCheck.blocked) {
      const analysis = analyzeActionabilityAndEffort(wo, sameLocationGroup);
      return {
        group: sameLocationGroup,
        tier: 'SAME_LOCATION',
        reason: `Same marina (${location?.name || 'same location'}), different vessels. May combine if scheduling allows.`,
        blockedReason: null,
        effort: analysis.effort,
        actionable: analysis.actionable,
        excluded: analysis.excluded,
      };
    }
    return {
      group: [],
      tier: null,
      reason: null,
      blockedReason: bundleCheck.reason,
    };
  }

  return { group: [], tier: null, reason: null, blockedReason: null };
}

function checkBundlingValidity(mainWo, candidates, jobs) {
  // Check for hard blockers on ALL members
  for (const wo of [mainWo, ...candidates]) {
    if (HARD_BLOCKER_STATUSES.includes(wo.status)) {
      return { blocked: true, reason: `One work order is ${wo.status.toLowerCase()}. Cannot bundle until resolved.` };
    }
  }

  // Check combined effort on ACTIONABLE items only (exclude low-confidence)
  const allWos = [mainWo, ...candidates.slice(0, 3)];
  const actionable = allWos.filter(w => !LOW_CONFIDENCE_STATUSES.includes(w.status));
  const effort = estimateBundleEffort(actionable);
  if (effort.max > MAX_BUNDLE_EFFORT) {
    return { blocked: true, reason: `Combined effort (${effort.min}–${effort.max}h) exceeds practical visit duration. Consider separate visits.` };
  }

  // Check timing window
  const dates = allWos
    .map(w => w.scheduled_date ? new Date(w.scheduled_date).getTime() : null)
    .filter(d => d !== null);
  
  if (dates.length > 1) {
    const daysDiff = (Math.max(...dates) - Math.min(...dates)) / (1000 * 60 * 60 * 24);
    if (daysDiff > TIMING_WINDOW_DAYS) {
      return { blocked: true, reason: `Work orders scheduled too far apart (${Math.ceil(daysDiff)} days). Different visit windows.` };
    }
  }

  return { blocked: false };
}

export function estimateBundleEffort(workOrders) {
  let minHours = 0;
  let maxHours = 0;

  for (const wo of workOrders) {
    // Estimate from tasks if available, otherwise use workOrder field
    const min = wo.estimated_duration_hours ? wo.estimated_duration_hours * 0.8 : 2;
    const max = wo.estimated_duration_hours ? wo.estimated_duration_hours * 1.2 : 4;

    minHours += min;
    maxHours += max;
  }

  // Round to nearest 0.5
  return {
    min: Math.round(minHours * 2) / 2,
    max: Math.round(maxHours * 2) / 2,
  };
}

/**
 * Separates actionable from excluded work orders and calculates effort for actionable items only.
 * Excludes:
 * - Hard blockers (Waiting for Parts, Waiting for Approval)
 * - Low-confidence statuses (Paused, On Hold)
 */
function analyzeActionabilityAndEffort(mainWo, candidates) {
  const actionable = [mainWo, ...candidates].filter(
    w => !HARD_BLOCKER_STATUSES.includes(w.status) && !LOW_CONFIDENCE_STATUSES.includes(w.status)
  );
  const excluded = [mainWo, ...candidates].filter(
    w => HARD_BLOCKER_STATUSES.includes(w.status) || LOW_CONFIDENCE_STATUSES.includes(w.status)
  );

  return {
    effort: estimateBundleEffort(actionable),
    actionable,
    excluded,
  };
}

export function getBundleSummary(bundling) {
  if (!bundling?.group?.length) return null;

  const count = bundling.group.length;
  const tier = bundling.tier;
  const effort = bundling.effort;
  const actionableCount = bundling.actionable?.length || 0;
  const excludedCount = bundling.excluded?.length || 0;

  return {
    count,
    tier,
    label: count === 1
      ? `Can combine with 1 other WO on ${tier === 'SAME_BOAT' ? 'same vessel' : 'same marina'}`
      : `Can combine with ${count} other WOs on ${tier === 'SAME_BOAT' ? 'same vessel' : 'same marina'}`,
    effort,
    reason: bundling.reason,
    actionableCount,
    excludedCount,
    actionable: bundling.actionable,
    excluded: bundling.excluded,
  };
}