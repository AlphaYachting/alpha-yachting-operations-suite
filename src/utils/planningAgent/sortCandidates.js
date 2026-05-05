// Shared candidate ordering for all ownership quick-change dropdowns.
// Reuses already-computed preferredResourcePool / fallbackResourcePool from item.derived
// so we never need to re-run the scorer inside a UI component.
//
// Sort order:
//   Tier A — in preferredResourcePool (score order, index 0 = best)
//   Tier B — in fallbackResourcePool (score order)
//   Tier C — remaining eligible techs, alphabetical
//
// Filter:
//   Exclude Inactive status
//   Exclude availability_status in UNAVAILABLE_FOR_PLANNING (['Sick','Vacation','Off Duty'])
//   Aligns exactly with resourceMatcher.UNAVAILABLE_FOR_PLANNING

const UNAVAILABLE = ['Sick', 'Vacation', 'Off Duty'];

export function sortedCandidates(technicians, preferredPool = [], fallbackPool = []) {
  const preferredIds = preferredPool.map(r => r.id);
  const fallbackIds  = fallbackPool.map(r => r.id);

  const eligible = (technicians || []).filter(t =>
    t.status !== 'Inactive' &&
    !UNAVAILABLE.includes(t.availability_status)
  );

  const tierA = preferredIds
    .map(id => eligible.find(t => t.id === id))
    .filter(Boolean);

  const tierB = fallbackIds
    .filter(id => !preferredIds.includes(id))
    .map(id => eligible.find(t => t.id === id))
    .filter(Boolean);

  const usedIds = new Set([...preferredIds, ...fallbackIds]);
  const tierC = eligible
    .filter(t => !usedIds.has(t.id))
    .sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`));

  return [...tierA, ...tierB, ...tierC];
}