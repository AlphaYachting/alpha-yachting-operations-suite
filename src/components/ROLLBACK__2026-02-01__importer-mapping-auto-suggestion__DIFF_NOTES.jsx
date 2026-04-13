# DIFF NOTES: Auto-Mapping Restoration — Importer Mapping Diagnosis & Fix

**Date:** 2026-02-01  
**Issue:** Excel importer was showing "0 of 25 columns mapped" — auto-suggestion logic was completely missing.  
**Root Cause:** MappingStep component had zero auto-mapping logic; it only provided manual dropdown selection.  
**Solution:** Created a new mapping engine with fuzzy matching and integrated auto-suggestion into MappingStep.

---

## FILES CHANGED

### 1. **NEW FILE: `components/taskimport/mappingEngine.js`**

**What:**
- Centralized mapping logic with fuzzy string matching (Levenshtein distance)
- Header normalization (trim, lowercase, umlauts, punctuation removal)
- Alias-based exact matching for common column names
- Confidence scoring (0.5–1.0 threshold)
- Debug output structure for diagnostics

**Key Functions:**
- `autoMapHeaders(headers, debugMode)` — Auto-suggests field mappings, returns suggestions + debug data
- `normalizeHeader(header)` — Normalizes column names for comparison
- `stringSimilarity(a, b)` — Levenshtein-based fuzzy matching

**Target Fields with Aliases:**
```
customerName: ['customer', 'customer name', 'kunde', 'name']
taskTitle: ['task', 'title', 'aufgabe', 'beschreibung', 'name']
... (all 26 fields with multilingual aliases)
```

---

### 2. **MODIFIED: `components/taskimport/MappingStep.jsx`**

**What Changed:**
- Added auto-mapping logic on component mount (when headers change and mapping is empty)
- Imported `autoMapHeaders`, `getTargetFields`, `getRequiredFields` from mappingEngine
- Added debug mode detection (`?debugImporter=1` URL param)
- Added diagnostic panel that displays when debug mode is active

**Debug Panel Shows (when `?debugImporter=1`):**
- Header count
- Target fields registry size
- Auto-mapped count
- Missing required fields (in red)
- Suggestion list with confidence scores

**Behavior:**
- When user uploads file → headers extracted → auto-mapping triggers automatically
- Suggestions are populated into the mapping state
- User can still manually override any suggestion
- Debug panel is **invisible by default**

---

## HOW IT WORKS

1. **User uploads Excel** → FileUploadStep extracts headers
2. **Headers passed to MappingStep** → useEffect detects empty mapping + headers present
3. **autoMapHeaders() called** → fuzzy matching + alias resolution
4. **Mapping suggestions auto-populated** → UI shows mapped fields immediately
5. **User sees "15 of 25 columns mapped"** instead of "0 of 25"
6. **If `?debugImporter=1`** → diagnostic panel shows why each field was/wasn't matched

---

## WHAT DID NOT CHANGE

- Backend schema/database
- FileUploadStep (still parses Excel the same way)
- ConfigStep, ValidationStep, PreviewStep, ImportSummary (unchanged)
- Manual override capability (user can still change any suggestion)
- Behavior when debug mode is OFF (invisible by default)

---

## TESTING CHECKLIST

- [ ] Upload Excel file without `?debugImporter=1` → Should auto-map and show "X of Y columns mapped"
- [ ] Upload Excel file with `?debugImporter=1` → Debug panel shows suggestions with scores
- [ ] Manually override a suggestion → New mapping takes effect
- [ ] Verify required fields (customerName, taskTitle) are mapped after auto-suggestion
- [ ] Test with German column names (e.g., "Kunde" → should map to customerName)

---

## DEBUGGING GUIDE (FOR USERS)

If mapping is not working:

1. Open importer URL with `?debugImporter=1`
2. Upload the same Excel file
3. Check diagnostic panel:
   - Do headers appear under "Headers detected"?
   - Is "Target fields registry" > 0?
   - Why are suggestions empty or low-confidence?
4. Compare "Suggestions" list against Excel column names
5. If no suggestions appear → likely header normalization issue or field registry not loading

---

## ROLLBACK PLAN

If issues arise:

1. Delete `components/taskimport/mappingEngine.js`
2. Revert MappingStep.jsx to BEFORE snapshot
3. Manual selection will be available (but no auto-suggestion)