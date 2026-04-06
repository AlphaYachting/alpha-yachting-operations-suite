// Planning Agent V2 — Specialist-Priority Resource Matching
// READ-ONLY. No writes. No side effects. No entity mutations.

// ─── DOMAIN TIER CLASSIFICATION ───────────────────────────────────────────────
// TIER 1: specialist-dominant — wrong person causes real operational risk
// TIER 2: skill-preferred — specialist preferred but capable generalist acceptable
// TIER 3: general — availability and proximity are the primary signals

const DOMAIN_TIERS = {
  // TIER 1 — specialist-dominant
  'Electronics':    1,
  'Rigging':        1,
  'HVAC':           1,
  'GRP/Bodywork':   1,
  'Sail Making':    1,
  'Tent Making':    1,
  'Sealing':        1,   // teak/deck sealing is specialist finishing

  // TIER 2 — skill-preferred
  'Plumbing':       2,
  'Installation':   2,
  'Diagnostics':    2,
  'Carpentry':      2,
  'Woodworking':    2,
  'Electrical':     2,   // basic electrical is Tier 2; navigation electronics is Tier 1

  // TIER 3 — general
  'General Service':3,
  'Mechanical':     3,
  'Antifouling':    3,
  'Polish':         3,
  'Steel Work':     3,
  'Other':          3,
  // Organisation: Tier 3 so only techs with the 'Organisation' skill match.
  // Execution mechanics have NO_MEANINGFUL_MATCH here → excluded from org WO pools.
  'Organisation':   3,
};

export function getDomainTier(serviceArea) {
  return DOMAIN_TIERS[serviceArea] || 3;
}

// ─── ZONE MODEL ───────────────────────────────────────────────────────────────
const ZONE_PATTERNS = [
  { zone: 'NORTH_ISTRIA',    keywords: ['novigrad', 'umag', 'tar ', 'poreč', 'porec', 'buje'] },
  { zone: 'WEST_ISTRIA',     keywords: ['rovinj', 'vrsar', 'fažana', 'fazana'] },
  { zone: 'SOUTH_ISTRIA',    keywords: ['pula', 'medulin', 'premantura', 'brijuni'] },
  { zone: 'SLOVENIA_COAST',  keywords: ['koper', 'izola', 'piran', 'portorož', 'portoroz'] },
  { zone: 'WORKSHOP_INLAND', keywords: ['workshop', 'base', 'yard', 'dry storage', 'werkstatt', 'lager'] },
];

export function getZone(text) {
  const lower = (text || '').toLowerCase();
  for (const { zone, keywords } of ZONE_PATTERNS) {
    if (keywords.some(k => lower.includes(k))) return zone;
  }
  return 'UNKNOWN';
}

const ADJACENT_ZONES = {
  NORTH_ISTRIA:    ['WEST_ISTRIA', 'SLOVENIA_COAST', 'WORKSHOP_INLAND'],
  WEST_ISTRIA:     ['NORTH_ISTRIA', 'SOUTH_ISTRIA', 'WORKSHOP_INLAND'],
  SOUTH_ISTRIA:    ['WEST_ISTRIA', 'WORKSHOP_INLAND'],
  SLOVENIA_COAST:  ['NORTH_ISTRIA', 'WORKSHOP_INLAND'],
  WORKSHOP_INLAND: ['NORTH_ISTRIA', 'WEST_ISTRIA', 'SOUTH_ISTRIA', 'SLOVENIA_COAST'],
};

export function getZoneCompatibility(jobZone, techZone) {
  if (!jobZone || jobZone === 'UNKNOWN' || !techZone || techZone === 'UNKNOWN') return 'unknown';
  if (jobZone === techZone) return 'near';
  if (ADJACENT_ZONES[jobZone]?.includes(techZone)) return 'reasonable';
  return 'inefficient';
}

// ─── SKILL → SERVICE AREA MAP ─────────────────────────────────────────────────
const AREA_TO_SKILLS = {
  'Electronics':     ['Electronics'],
  'Electrical':      ['Electronics'],
  'GRP/Bodywork':    ['GRP/Gelcoat'],
  'Sealing':         ['Sealing'],
  'HVAC':            ['HVAC'],
  'Rigging':         ['Rigging', 'Sail Making'],
  'Sail Making':     ['Sail Making', 'Rigging'],
  'Tent Making':     ['Tent Making'],
  'Plumbing':        ['Plumbing'],
  'Installation':    ['Installations'],
  'Diagnostics':     ['Diagnostics', 'Mechanics'],
  'Mechanical':      ['Mechanics'],
  'General Service': ['General Service', 'Mechanics'],
  'Antifouling':     ['Antifouling'],
  'Polish':          ['Polish'],
  'Carpentry':       ['Carpentry', 'Woodworking'],
  'Woodworking':     ['Woodworking', 'Carpentry'],
  'Steel Work':      ['Steel Work'],
  'Other':           ['General Service'],
  // Organisation: only maps to 'Organisation' skill.
  // Execution techs (Mechanics, Electronics etc.) have NO_MEANINGFUL_MATCH → excluded.
  // Org-skilled staff (Silke, Oliver, Irene, Alfons) → CAPABLE_MATCH/STRONG_MATCH → preferred pool.
  'Organisation':    ['Organisation'],
};

// Adjacent skill map — PRUNED to remove misleading Tier 1 adjacencies.
// KEY CHANGE: Diagnostics → Electronics removed. That adjacency was causing
// coordination candidates (Alfons) to appear as technical electronics matches.
const ADJACENT_SKILLS_BY_TIER = {
  // Tier 1 adjacencies — very tight, only truly related specialist pairs
  1: {
    'GRP/Gelcoat': ['Sealing'],
    'Sealing':     ['GRP/Gelcoat'],
    'Rigging':     ['Sail Making'],
    'Sail Making': ['Rigging'],
  },
  // Tier 2 adjacencies — moderate
  2: {
    'Mechanics':       ['Diagnostics', 'General Service'],
    'Diagnostics':     ['Mechanics'],
    'General Service': ['Mechanics', 'Diagnostics'],
    'Carpentry':       ['Woodworking'],
    'Woodworking':     ['Carpentry'],
    'Installations':   ['Electronics', 'Plumbing'],
    'Plumbing':        ['Installations'],
  },
  // Tier 3 adjacencies — broad
  3: {
    'Mechanics':       ['Diagnostics', 'General Service', 'Electronics'],
    'Diagnostics':     ['Mechanics', 'Electronics'],
    'General Service': ['Mechanics', 'Diagnostics', 'Installations'],
    'Electronics':     ['Diagnostics'],
    'Antifouling':     ['GRP/Gelcoat', 'Polish'],
    'Polish':          ['Antifouling'],
    'Carpentry':       ['Woodworking', 'Steel Work'],
    'Woodworking':     ['Carpentry'],
    'Steel Work':      ['Carpentry'],
    'Installations':   ['Electronics', 'Plumbing', 'Mechanics'],
  },
};

// ─── DOMAIN OWNERSHIP CLASSIFICATION ─────────────────────────────────────────
// Five-level ownership model replaces the old binary strong/partial/weak/none.
// This is the core change that allows Oliver to outrank Stiven for electronics work.
//
// DOMAIN_OWNER:   SPECIALIST tendency + direct skill match + focused profile
// STRONG_MATCH:   direct skill match + LEAD/EXECUTION/SPECIALIST tendency
// CAPABLE_MATCH:  direct skill match + broad/generalist profile
// ADJACENT_CAPABLE: adjacent skill only (no direct match)
// NO_MEANINGFUL_MATCH: excluded

const SPECIALIST_TENDENCY = 'SPECIALIST';

function classifyDomainOwnership(technician, serviceArea, domainTier) {
  const requiredSkills = AREA_TO_SKILLS[serviceArea] || [];
  const techSkills = technician.skills || [];
  const tendency = technician.primary_role_tendency;

  const hasDirectMatch = requiredSkills.some(s => techSkills.includes(s));

  if (hasDirectMatch) {
    // DOMAIN_OWNER: specialist tendency + direct match + focused profile (≤5 skills)
    if (tendency === SPECIALIST_TENDENCY && techSkills.length <= 5) {
      return 'DOMAIN_OWNER';
    }
    // STRONG_MATCH: direct match + any meaningful active tendency
    if (['SPECIALIST', 'LEAD', 'EXECUTION'].includes(tendency)) {
      return 'STRONG_MATCH';
    }
    // CAPABLE_MATCH: direct match but broad/unfocused profile or support tendency
    return 'CAPABLE_MATCH';
  }

  // No direct match — check adjacent skills for this tier
  const adjacentMap = ADJACENT_SKILLS_BY_TIER[domainTier] || {};
  const requiredAdjacent = requiredSkills.flatMap(s => adjacentMap[s] || []);
  const hasAdjacent = requiredAdjacent.some(s => techSkills.includes(s));

  if (hasAdjacent) return 'ADJACENT_CAPABLE';
  return 'NO_MEANINGFUL_MATCH';
}

// ─── SCORING MODEL (tier-aware) ───────────────────────────────────────────────
// Priority order by tier:
// Tier 1: domain correctness > role tendency > availability > zone > response speed
// Tier 2: domain correctness > availability > role tendency > zone > response speed
// Tier 3: availability > domain correctness > zone > role tendency > response speed

// Lower score = better rank (sort ascending)

const OWNERSHIP_BASE = {
  DOMAIN_OWNER:        0,
  STRONG_MATCH:        8,
  CAPABLE_MATCH:       18,
  ADJACENT_CAPABLE:    30,
  NO_MEANINGFUL_MATCH: 999,
};

// Role tendency modifier per tier
function roleTendencyModifier(tendency, domainTier) {
  if (domainTier === 1) {
    return { SPECIALIST: 0, LEAD: 4, EXECUTION: 6, FINISHING_QC: 8, SUPPORT: 15 }[tendency] ?? 10;
  }
  if (domainTier === 2) {
    return { SPECIALIST: 0, LEAD: 2, EXECUTION: 3, FINISHING_QC: 5, SUPPORT: 8 }[tendency] ?? 5;
  }
  // Tier 3
  return { EXECUTION: 0, LEAD: 1, SPECIALIST: 2, FINISHING_QC: 3, SUPPORT: 4 }[tendency] ?? 2;
}

// Availability modifier per tier
// CRITICAL CHANGE: for Tier 1, availability step-size is reduced so it cannot
// overcome a domain ownership advantage.
function availabilityModifier(availabilityClass, domainTier) {
  const steps = {
    CORE_PREFERRED:      0,
    CORE_LIMITED:        1,
    EXTERNAL_REGULAR:    2,
    EXTERNAL_SPECIALIST: 3,
    EXTERNAL_ON_REQUEST: 5,
  };
  const step = steps[availabilityClass] ?? 4;
  // Tier 1: availability matters least (small multiplier)
  // Tier 3: availability matters most (large multiplier)
  const multiplier = domainTier === 1 ? 2 : domainTier === 2 ? 4 : 7;
  return step * multiplier;
}

function zoneModifier(zoneCompatibility, domainTier) {
  const steps = { near: 0, reasonable: 1, inefficient: 3, unknown: 2 };
  const step = steps[zoneCompatibility] ?? 2;
  // Zone is a soft signal in all tiers
  return step * 2;
}

function computeCandidateScore(ownership, tendency, availabilityClass, zoneCompatibility, domainTier) {
  return (
    OWNERSHIP_BASE[ownership] +
    roleTendencyModifier(tendency, domainTier) +
    availabilityModifier(availabilityClass, domainTier) +
    zoneModifier(zoneCompatibility, domainTier)
  );
}

// ─── POOL ADMISSION RULES ─────────────────────────────────────────────────────
// Defines what quality of candidate is allowed in each pool per tier.
// This is the suppression logic that prevents adjacent matches from polluting
// the preferred pool for specialist work.

function getPoolAdmission(ownership, tendency, availabilityClass, domainTier) {
  // Hard exclusions
  if (ownership === 'NO_MEANINGFUL_MATCH') return 'exclude';
  if (availabilityClass === 'EXTERNAL_ON_REQUEST') return 'fallback'; // always fallback regardless

  if (domainTier === 1) {
    // Tier 1 specialist work — tight preferred pool
    if (['DOMAIN_OWNER', 'STRONG_MATCH'].includes(ownership)) return 'preferred';
    if (ownership === 'CAPABLE_MATCH' && tendency !== 'SUPPORT') return 'fallback';
    // ADJACENT_CAPABLE → fallback only if not SUPPORT tendency
    if (ownership === 'ADJACENT_CAPABLE' && tendency === 'SUPPORT') return 'exclude';
    if (ownership === 'ADJACENT_CAPABLE') return 'fallback';
    return 'exclude';
  }

  if (domainTier === 2) {
    // Tier 2 — moderate
    if (['DOMAIN_OWNER', 'STRONG_MATCH', 'CAPABLE_MATCH'].includes(ownership)) return 'preferred';
    if (ownership === 'ADJACENT_CAPABLE' && tendency !== 'SUPPORT') return 'fallback';
    return 'exclude';
  }

  // Tier 3 — broad
  if (ownership !== 'NO_MEANINGFUL_MATCH') return 'preferred';
  return 'exclude';
}

// ─── MAIN BUILDER ─────────────────────────────────────────────────────────────
// B: statuses that make a technician truly unavailable for planning proposals
// Exported so computeCapacity() in agentLogic.js can reuse the same constant
export const UNAVAILABLE_FOR_PLANNING = ['Sick', 'Vacation', 'Off Duty'];

// Phase 1.2: non-execution staff exclusion — structural rule, NOT name-based
// Excludes SUPPORT-role technicians whose skills contain only 'Organisation' (no execution skills).
// Null primary_role_tendency → safe default = included (field not yet filled).
// Mixed profiles (SUPPORT + any technical skill) → included (hybrid roles).
export function isNonExecutionStaff(tech) {
  if (tech.primary_role_tendency !== 'SUPPORT') return false;
  const skills = tech.skills || [];
  return skills.length === 0 || skills.every(s => s === 'Organisation');
}

export function buildResourcePools(technicians, serviceArea, jobZone, effortMax, remainingWorkdays, workloadMap = {}) {
  const domainTier = getDomainTier(serviceArea);
  // B: exclude Inactive AND currently unavailable technicians from all pools
  // Phase 1.2: also exclude non-execution staff (SUPPORT tendency + no execution skills)
  const active = (technicians || []).filter(t =>
    t.status !== 'Inactive' &&
    !UNAVAILABLE_FOR_PLANNING.includes(t.availability_status) &&
    !isNonExecutionStaff(t)
  );

  // Build candidate list with ownership + score
  const evaluated = active.map(t => {
    const ownership = classifyDomainOwnership(t, serviceArea, domainTier);
    if (ownership === 'NO_MEANINGFUL_MATCH') return null;

    const techZone       = getZone(t.home_base || '');
    const zoneCompat     = getZoneCompatibility(jobZone, techZone);
    const availClass     = t.availability_class || 'EXTERNAL_ON_REQUEST';
    const tendency       = t.primary_role_tendency || 'EXECUTION';
    const pool           = getPoolAdmission(ownership, tendency, availClass, domainTier);
    if (pool === 'exclude') return null;

    // C: soft load penalty — techs already assigned to many active WOs are deprioritized
    const currentLoad = workloadMap[t.id] || 0;
    const loadPenalty = currentLoad >= 4 ? 12 : currentLoad >= 2 ? 6 : 0;
    const score = computeCandidateScore(ownership, tendency, availClass, zoneCompat, domainTier) + loadPenalty;
    const hasMetadata = !!(t.availability_class && t.primary_role_tendency && t.team_type);

    return {
      id:                t.id,
      name:              [t.first_name, t.last_name].filter(Boolean).join(' ').trim(),
      team_type:         t.team_type || 'Unknown',
      availability_class: availClass,
      primary_role_tendency: tendency,
      quick_response_mode:   t.quick_response_mode || 'by_arrangement',
      ownership_level:   ownership,
      skill_match_level: ownershipToLegacyLabel(ownership), // kept for UI backward compat
      zone_compatibility: zoneCompat,
      pool_slot:         pool,
      short_note:        t.extended_skill_notes
        ? t.extended_skill_notes.split(';')[0].replace(/\.$/, '').trim()
        : '',
      has_metadata_gap:  !hasMetadata,
      current_load:      currentLoad,  // C: exposed for UI transparency
      _score:            score,
    };
  }).filter(Boolean).sort((a, b) => a._score - b._score);

  const preferred = evaluated.filter(c => c.pool_slot === 'preferred').slice(0, 3);
  const preferredIds = new Set(preferred.map(c => c.id));
  const fallback  = evaluated.filter(c => c.pool_slot === 'fallback' && !preferredIds.has(c.id)).slice(0, 3);

  // Resource reasoning
  const reasoning = buildReasoning(preferred, fallback, serviceArea, domainTier);

  // D: week-end pressure gate — ≤1 remaining workday requires a quick-response preferred candidate
  // remainingWorkdays: Mon=4, Tue=3, Wed=2, Thu=1, Fri=0, weekend=5
  let weekResourceGate = 'ok';
  if (remainingWorkdays <= 1 && preferred.length > 0) {
    const hasQuick = preferred.some(c => ['same_day', 'next_day'].includes(c.quick_response_mode));
    if (!hasQuick) weekResourceGate = 'shift_next_week';
  }

  // Clean up internal score field before returning
  const clean = arr => arr.map(({ _score, pool_slot, ...c }) => c);

  return {
    preferred: clean(preferred),
    fallback:  clean(fallback),
    reasoning,
    jobZone,
    domainTier,
    weekResourceGate,
  };
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function ownershipToLegacyLabel(ownership) {
  // Maps new ownership levels back to the legacy skill_match_level labels used in UI display
  return {
    DOMAIN_OWNER:     'strong',
    STRONG_MATCH:     'strong',
    CAPABLE_MATCH:    'partial',
    ADJACENT_CAPABLE: 'weak',
  }[ownership] || 'weak';
}

function buildReasoning(preferred, fallback, serviceArea, domainTier) {
  const tierLabel = ['', 'specialist-dominant', 'skill-preferred', 'general'][domainTier];
  if (preferred.length === 0 && fallback.length === 0) {
    return `No suitable resource found for ${serviceArea} (${tierLabel}). Manual assignment required.`;
  }

  const parts = [];
  if (preferred.length > 0) {
    const top = preferred[0];
    const ownerLabel = top.ownership_level === 'DOMAIN_OWNER'
      ? 'domain owner'
      : top.ownership_level === 'STRONG_MATCH' ? 'strong match' : 'capable match';
    parts.push(`${top.name} is the top candidate (${ownerLabel}, ${top.zone_compatibility} zone) for ${serviceArea} (${tierLabel}).`);
    if (preferred.length > 1) {
      parts.push(`${preferred[1].name} is an additional ${preferred[1].ownership_level === 'DOMAIN_OWNER' ? 'domain specialist' : 'capable candidate'}.`);
    }
  } else if (fallback.length > 0) {
    const f = fallback[0];
    parts.push(`No preferred candidate available. ${f.name} (${f.ownership_level}) is the best fallback for ${serviceArea}.`);
  }

  if (fallback.length > 0 && preferred.length > 0) {
    const f = fallback[0];
    const coordinationNote = f.primary_role_tendency === 'SUPPORT' || f.ownership_level === 'ADJACENT_CAPABLE'
      ? ' (coordination support only, not a technical candidate)'
      : '';
    parts.push(`Fallback: ${f.name}${coordinationNote}.`);
  }

  const metadataGaps = [...preferred, ...fallback].filter(c => c.has_metadata_gap);
  if (metadataGaps.length > 0) {
    parts.push(`⚠ Missing planning metadata: ${metadataGaps.map(c => c.name).join(', ')} — results may be less reliable.`);
  }

  return parts.join(' ');
}