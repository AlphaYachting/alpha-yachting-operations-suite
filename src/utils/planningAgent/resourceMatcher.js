// Planning Agent V2 — Resource Matching & Zone Logic
// READ-ONLY. No writes. No side effects.

// ─── Zone Model ───────────────────────────────────────────────────────────────
const ZONE_PATTERNS = [
  { zone: 'NORTH_ISTRIA',    keywords: ['novigrad', 'umag', 'tar ', 'poreč', 'porec', 'buje'] },
  { zone: 'WEST_ISTRIA',     keywords: ['rovinj', 'vrsar', 'fažana', 'fazana'] },
  { zone: 'SOUTH_ISTRIA',    keywords: ['pula', 'medulin', 'premantura', 'brijuni', 'fažana', 'fazana'] },
  { zone: 'SLOVENIA_COAST',  keywords: ['koper', 'izola', 'piran', 'portorož', 'portoroz'] },
  { zone: 'WORKSHOP_INLAND', keywords: ['workshop', 'base', 'yard', 'dry storage', 'werkstatt', 'lager'] },
];

export function getZone(text = '') {
  const lower = (text || '').toLowerCase();
  for (const { zone, keywords } of ZONE_PATTERNS) {
    if (keywords.some(k => lower.includes(k))) return zone;
  }
  return 'UNKNOWN';
}

// Adjacent zones — used for compatibility
const ADJACENT = {
  NORTH_ISTRIA:    ['WEST_ISTRIA', 'SLOVENIA_COAST', 'WORKSHOP_INLAND'],
  WEST_ISTRIA:     ['NORTH_ISTRIA', 'SOUTH_ISTRIA', 'WORKSHOP_INLAND'],
  SOUTH_ISTRIA:    ['WEST_ISTRIA', 'WORKSHOP_INLAND'],
  SLOVENIA_COAST:  ['NORTH_ISTRIA', 'WORKSHOP_INLAND'],
  WORKSHOP_INLAND: ['NORTH_ISTRIA', 'WEST_ISTRIA', 'SOUTH_ISTRIA', 'SLOVENIA_COAST'],
};

export function getZoneCompatibility(jobZone, techZone) {
  if (!jobZone || jobZone === 'UNKNOWN' || !techZone || techZone === 'UNKNOWN') return 'unknown';
  if (jobZone === techZone) return 'near';
  if (ADJACENT[jobZone]?.includes(techZone)) return 'reasonable';
  return 'inefficient';
}

export function zoneLabel(zone) {
  const labels = {
    NORTH_ISTRIA: 'North Istria',
    WEST_ISTRIA: 'West Istria',
    SOUTH_ISTRIA: 'South Istria',
    SLOVENIA_COAST: 'Slovenia Coast',
    WORKSHOP_INLAND: 'Workshop/Base',
    UNKNOWN: 'Unknown',
  };
  return labels[zone] || zone;
}

// ─── Skill Mapping ────────────────────────────────────────────────────────────
// Maps WO service_area → Technician skill tags
const AREA_TO_SKILLS = {
  Mechanical:       ['Mechanics'],
  Electrical:       ['Electronics'],
  Electronics:      ['Electronics'],
  'GRP/Bodywork':   ['GRP/Gelcoat'],
  Sealing:          ['Sealing'],
  HVAC:             ['HVAC'],
  Rigging:          ['Rigging', 'Sail Making'],
  Plumbing:         ['Plumbing'],
  Installation:     ['Installations'],
  Diagnostics:      ['Diagnostics', 'Mechanics'],
  'General Service':['General Service', 'Mechanics'],
  Antifouling:      ['Antifouling'],
  Polish:           ['Polish'],
  Carpentry:        ['Carpentry', 'Woodworking'],
  Other:            ['General Service'],
};

// Adjacent skills for partial match
const ADJACENT_SKILLS = {
  Mechanics:       ['Diagnostics', 'General Service'],
  Electronics:     ['Diagnostics'],
  'GRP/Gelcoat':   ['Sealing'],
  Sealing:         ['GRP/Gelcoat'],
  Diagnostics:     ['Mechanics', 'Electronics'],
  'General Service':['Mechanics', 'Diagnostics'],
  Antifouling:     ['GRP/Gelcoat', 'Polish'],
  Polish:          ['Antifouling'],
  Carpentry:       ['Woodworking'],
  Woodworking:     ['Carpentry'],
};

export function getSkillMatch(technician, serviceArea) {
  if (!serviceArea) return 'weak'; // can't assess — treat as weak/generic
  const requiredSkills = AREA_TO_SKILLS[serviceArea] || [];
  const techSkills = technician.skills || [];

  // Strong: direct skill match
  if (requiredSkills.some(s => techSkills.includes(s))) return 'strong';

  // Partial: adjacent skill match
  const adjacentCheck = requiredSkills.flatMap(s => ADJACENT_SKILLS[s] || []);
  if (adjacentCheck.some(s => techSkills.includes(s))) return 'partial';

  // Weak: LEAD tendency or General Service — can handle many tasks
  if (
    technician.primary_role_tendency === 'LEAD' ||
    techSkills.includes('General Service')
  ) return 'weak';

  return 'none';
}

// ─── Priority helpers ─────────────────────────────────────────────────────────
const AVAIL_PRIORITY = {
  CORE_PREFERRED: 1,
  CORE_LIMITED:   2,
  EXTERNAL_REGULAR:   3,
  EXTERNAL_SPECIALIST: 4,
  EXTERNAL_ON_REQUEST: 5,
};
const SKILL_PRIORITY  = { strong: 1, partial: 2, weak: 3, none: 9 };
const ZONE_PRIORITY   = { near: 1, reasonable: 2, inefficient: 3, unknown: 3, only_with_strong_reason: 5 };

// ─── Main Builder ─────────────────────────────────────────────────────────────
export function buildResourcePools(technicians, serviceArea, jobZone, effortMax, dayOfWeek) {
  const active = (technicians || []).filter(t => t.status !== 'Inactive');

  const candidates = active.map(t => {
    const techZone    = getZone(t.home_base || '');
    const zoneCompat  = getZoneCompatibility(jobZone, techZone);
    const skillMatch  = getSkillMatch(t, serviceArea);
    if (skillMatch === 'none') return null;

    const score =
      (AVAIL_PRIORITY[t.availability_class] || 5) * 10 +
      (SKILL_PRIORITY[skillMatch] || 9) * 5 +
      (ZONE_PRIORITY[zoneCompat] || 3) * 2;

    const shortNote = t.extended_skill_notes
      ? t.extended_skill_notes.split(';')[0].replace(/\.$/, '').trim()
      : '';

    return {
      id: t.id,
      name: [t.first_name, t.last_name].filter(Boolean).join(' '),
      team_type: t.team_type || 'Core',
      availability_class: t.availability_class || 'CORE_PREFERRED',
      primary_role_tendency: t.primary_role_tendency || 'EXECUTION',
      quick_response_mode: t.quick_response_mode || 'next_day',
      skill_match_level: skillMatch,
      zone_compatibility: zoneCompat,
      short_note: shortNote,
      _score: score,
    };
  }).filter(Boolean).sort((a, b) => a._score - b._score);

  // preferred pool: core with strong/partial skill, near/reasonable zone
  const preferred = candidates.filter(c =>
    ['CORE_PREFERRED', 'CORE_LIMITED'].includes(c.availability_class) &&
    ['strong', 'partial'].includes(c.skill_match_level) &&
    ['near', 'reasonable', 'unknown'].includes(c.zone_compatibility)
  ).slice(0, 3).map(({ _score, ...c }) => c);

  // fallback pool: everyone else with at least partial match
  const preferredIds = new Set(preferred.map(c => c.id));
  const fallback = candidates.filter(c =>
    !preferredIds.has(c.id) &&
    ['strong', 'partial', 'weak'].includes(c.skill_match_level)
  ).slice(0, 3).map(({ _score, ...c }) => c);

  // Resource reasoning
  let reasoning;
  if (preferred.length > 0) {
    const top = preferred[0];
    reasoning = `${top.name} is the preferred candidate (${top.skill_match_level} skill match, ${top.zone_compatibility} zone).`;
    if (preferred.length > 1) reasoning += ` ${preferred[1].name} is an additional option.`;
    if (fallback.length > 0) reasoning += ` Fallback: ${fallback[0].name} (${fallback[0].availability_class}).`;
  } else if (fallback.length > 0) {
    const f = fallback[0];
    reasoning = `No core preferred candidate found. ${f.name} (${f.team_type} / ${f.availability_class}) is available with ${f.skill_match_level} skill match.`;
    if (['EXTERNAL_ON_REQUEST', 'EXTERNAL_SPECIALIST'].includes(f.availability_class)) {
      reasoning += ' Requires advance notice.';
    }
  } else {
    reasoning = 'No suitable resource identified for this work type. Manual assignment required.';
  }

  // Day-of-week resource gate: Thu/Fri — need same_day or next_day core candidate
  const isThurFri = dayOfWeek === 4 || dayOfWeek === 5;
  let weekResourceGate = 'ok';
  if (isThurFri) {
    const hasQuickCore = preferred.some(c =>
      ['same_day', 'next_day'].includes(c.quick_response_mode)
    );
    if (!hasQuickCore) weekResourceGate = 'shift_next_week';
  }

  return { preferred, fallback, reasoning, jobZone, weekResourceGate };
}