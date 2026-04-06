/**
 * Shared technician filtering logic for planner selects.
 * Ensures consistent candidate selection across all planner actions.
 */

export function getTechnicianCandidates(workOrder, technicians) {
  // Step 1: Exclude inactive
  const active = technicians.filter(t => t.status !== 'Inactive');
  
  // Step 2: If team assigned, constrain to team members only
  if (workOrder.assigned_technicians?.length > 0) {
    return active.filter(t => workOrder.assigned_technicians.includes(t.id));
  }
  
  // Step 3: Otherwise, show execution-capable staff (exclude pure SUPPORT)
  return active.filter(t => t.primary_role_tendency !== 'SUPPORT');
}

export function reorderByOwnerType(candidates, ownerType) {
  if (ownerType === 'ORG_OWNER') {
    const org = candidates.filter(t => (t.skills || []).includes('Organisation'));
    const rest = candidates.filter(t => !(t.skills || []).includes('Organisation'));
    return [...org, ...rest];
  }
  
  if (ownerType === 'EXEC_OWNER') {
    const exec = candidates.filter(t => t.primary_role_tendency !== 'SUPPORT');
    const rest = candidates.filter(t => t.primary_role_tendency === 'SUPPORT');
    return [...exec, ...rest];
  }
  
  return candidates;
}