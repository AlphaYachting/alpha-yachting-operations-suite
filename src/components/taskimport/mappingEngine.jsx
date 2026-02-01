// Auto-mapping engine for Excel column headers to system fields
// Implements fuzzy matching with confidence scoring

const TARGET_FIELDS = [
  { value: 'projectName', label: 'Project Name', aliases: ['project', 'project name', 'projekt'] },
  { value: 'customerType', label: 'Customer Type', aliases: ['customer type', 'kundentyp', 'type'] },
  { value: 'customerName', label: 'Customer Name', aliases: ['customer', 'customer name', 'kunde', 'name'] },
  { value: 'boatModel', label: 'Boat Type / Yacht Model', aliases: ['boat', 'yacht', 'vessel', 'boot', 'modell', 'type'] },
  { value: 'boatLength', label: 'Boat Length (m)', aliases: ['length', 'länge', 'boat length', 'size'] },
  { value: 'locationMarina', label: 'Location / Marina', aliases: ['location', 'marina', 'ort', 'hafen', 'standort'] },
  { value: 'serviceArea', label: 'Service Area', aliases: ['area', 'service', 'region', 'bereich'] },
  { value: 'module', label: 'Subproject / Module', aliases: ['module', 'subproject', 'modul', 'project'] },
  { value: 'taskId', label: 'Task ID', aliases: ['id', 'task id', 'nr', 'nummer'] },
  { value: 'taskTitle', label: 'Task Title', aliases: ['task', 'title', 'aufgabe', 'beschreibung', 'name'] },
  { value: 'taskDescription', label: 'Task Description', aliases: ['description', 'desc', 'beschreibung', 'details'] },
  { value: 'category', label: 'Category', aliases: ['category', 'kategorie', 'type', 'art'] },
  { value: 'requiredQualification', label: 'Required Qualification', aliases: ['qualification', 'qualifikation', 'skill', 'anforderung'] },
  { value: 'estimatedHours', label: 'Time Required (hrs)', aliases: ['hours', 'stunden', 'time', 'duration', 'dauer'] },
  { value: 'materialRequired', label: 'Material Required', aliases: ['material', 'material required', 'material benötigt'] },
  { value: 'materialDescription', label: 'Material Description', aliases: ['material desc', 'material description', 'material details'] },
  { value: 'dependencies', label: 'Dependencies', aliases: ['dependencies', 'depends', 'abhängigkeiten'] },
  { value: 'priority', label: 'Priority', aliases: ['priority', 'priorität', 'wichtigkeit'] },
  { value: 'workLocation', label: 'Work Location', aliases: ['work location', 'location', 'arbeitsort'] },
  { value: 'riskNotes', label: 'Risk / Special Notes', aliases: ['risk', 'notes', 'special', 'risiko', 'hinweise'] },
  { value: 'acceptanceRequired', label: 'Acceptance Required', aliases: ['acceptance', 'required', 'genehmigung'] },
  { value: 'acceptanceBy', label: 'Acceptance By', aliases: ['acceptance by', 'accept by', 'genehmigt durch'] },
  { value: 'billingType', label: 'Billing Type', aliases: ['billing', 'billing type', 'rechnungsart'] },
  { value: 'assumptionUncertainty', label: 'Assumption / Uncertainty', aliases: ['assumption', 'uncertainty', 'voraussetzung'] },
  { value: 'assignedPerson', label: 'Assigned Person', aliases: ['assigned', 'person', 'assigned to', 'zugewiesen', 'person'] },
  { value: 'dueDate', label: 'Due Date', aliases: ['due', 'date', 'due date', 'fälligkeitsdatum'] }
];

const REQUIRED_FIELDS = ['customerName', 'taskTitle'];

// Normalize header string for matching
function normalizeHeader(header) {
  if (!header) return '';
  return header
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ') // Collapse whitespace
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss');
}

// Calculate string similarity (Levenshtein-inspired simple score)
function stringSimilarity(a, b) {
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(a, b) {
  const costs = [];
  for (let i = 0; i <= a.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= b.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (a.charAt(i - 1) !== b.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[b.length] = lastValue;
  }
  return costs[b.length];
}

// Auto-suggest mappings with confidence scores
export function autoMapHeaders(headers, debugMode = false) {
  const normalized = headers.map(h => ({ original: h, normalized: normalizeHeader(h) }));
  const mapping = {};
  const debug = {
    fileName: 'Excel File',
    headerCount: headers.length,
    headersRaw: headers,
    headersNormalized: normalized.map(h => h.normalized),
    targetFieldsCount: TARGET_FIELDS.length,
    requiredFields: REQUIRED_FIELDS,
    suggestions: [],
    mappedCount: 0,
    missingRequired: []
  };

  // Try to match each header
  for (const header of normalized) {
    let bestMatch = null;
    let bestScore = 0.5; // Minimum confidence threshold

    // Test exact alias match first
    for (const field of TARGET_FIELDS) {
      for (const alias of field.aliases) {
        if (header.normalized === alias) {
          bestMatch = field.value;
          bestScore = 1.0;
          break;
        }
      }
      if (bestScore === 1.0) break;
    }

    // If no exact match, try fuzzy matching (prefer longer alias matches)
    if (bestScore < 1.0) {
      for (const field of TARGET_FIELDS) {
        let fieldScore = 0;
        let longestAliasLen = 0;
        
        // Test against all aliases, prefer longer aliases
        for (const alias of field.aliases) {
          const sim = stringSimilarity(header.normalized, alias);
          if (sim > fieldScore || (sim === fieldScore && alias.length > longestAliasLen)) {
            fieldScore = sim;
            longestAliasLen = alias.length;
          }
        }

        if (fieldScore > bestScore || (fieldScore === bestScore && fieldScore > 0.6)) {
          bestScore = fieldScore;
          bestMatch = field.value;
        }
      }
    }

    if (bestMatch && bestScore >= 0.5) {
      mapping[header.original] = bestMatch;
      debug.suggestions.push({
        header: header.original,
        matched: bestMatch,
        score: (bestScore * 100).toFixed(0) + '%'
      });
      debug.mappedCount++;
    }
  }

  // Check for missing required fields
  const mappedValues = Object.values(mapping);
  for (const required of REQUIRED_FIELDS) {
    if (!mappedValues.includes(required)) {
      debug.missingRequired.push(required);
    }
  }

  if (debugMode) {
    console.log('[AUTO-MAPPER DEBUG]', debug);
  }

  return { mapping, debug };
}

export function getTargetFields() {
  return TARGET_FIELDS;
}

export function getRequiredFields() {
  return REQUIRED_FIELDS;
}