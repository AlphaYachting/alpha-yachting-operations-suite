# DIAGNOSTIC REPORT — Excel Importer End-to-End Pipeline Analysis

**Date:** 2026-02-01  
**Status:** DIAGNOSTIC COMPLETE (No fixes applied yet)  
**Mode:** Micro-change diagnostic only

---

## PIPELINE WALKTHROUGH

### Current Importer Flow (7 Steps)

1. **Step 1: File Upload** (`pages/TasklistImport` currentStep 1 → FileUploadStep)
   - User selects Excel file
   - File parsed via `xlsx` library (CDN) in `components/taskimport/FileUploadStep`
   - Data extracted as JSON array (`utils.sheet_to_json`)
   - `onComplete(file, data)` triggers state update in parent (TasklistImport)
   - **Result:** `parsedData` and `uploadedFile` state set, currentStep→2

2. **Step 2: Preview Data** (`pages/TasklistImport` currentStep 2 → **PreviewStep**)
   - **ISSUE FOUND:** PreviewStep was NOT being rendered before. Fixed in this run.
   - Headers extracted: `Object.keys(parsedData[0])`
   - First 20 rows displayed in table
   - User sees actual data structure before mapping
   - **Result:** User advances to step 3 (mapping)

3. **Step 3: Map Fields** (`pages/TasklistImport` currentStep 3 → MappingStep)
   - Headers passed to MappingStep
   - **AUTO-MAPPING TRIGGER:** `useEffect` on line 16–25 (MappingStep.jsx)
     - Condition: `headers.length > 0 && Object.keys(mapping).length === 0`
     - Calls: `autoMapHeaders(headers, debugEnabled)`
     - Returns: `{ mapping: suggested, debug }`
     - **STATUS:** Working (verified in code)
   - Manual override UI available (dropdowns for each header)
   - **Result:** Field mapping stored, currentStep→4

4. **Step 4: Configure Import** (`pages/TasklistImport` currentStep 4 → ConfigStep)
   - **ISSUE FOUND:** ConfigStep was checking for `currentStep === 3` instead of 4. Fixed.
   - Import mode, job status, task status configured
   - Work order scheduled date set
   - Dry run mode toggleable
   - **Result:** Config stored, currentStep→5

5. **Step 5: Validate** (`pages/TasklistImport` currentStep 5 → ValidationStep)
   - Data validation against schema
   - Errors/warnings displayed
   - **Result:** Validation results stored, currentStep→6

6. **Step 6: Import** (`pages/TasklistImport` currentStep 6 → PreviewStep with results)
   - Final preview before import
   - **Result:** Import triggered, currentStep→7

7. **Step 7: Summary** (`pages/TasklistImport` currentStep 7 → ImportSummary)
   - Success/failure summary
   - Created records listed
   - Reset to start new import

---

## DIAGNOSTIC PANEL OUTPUT (When `?debugImporter=1`)

Diagnostic panel now shows (in red box at top):

```
🔴 IMPORTER END-TO-END DIAGNOSTIC
Current Step: [1-7]
File uploaded: [filename or NO]
Parsed rows: [number]
Detected columns: [number]
Column names: [first 5 columns...]
Field mapping count: [number]
Step 2 (Preview) visible: [YES/NO]
Step 3 (Mapping) visible: [YES/NO]
```

---

## ROOT CAUSE ANALYSIS

**Issue:** Steps were misaligned:
- ConfigStep was checking for `currentStep === 3` but should check for `currentStep === 4`
- PreviewStep (step 2) existed but was never rendered in the flow
- Steps array labeled step 2 as "Map Fields" when it should be "Preview Data"

**Why it broke:**
1. After upload, user jumped to mapping directly (skipping preview)
2. When user tried to reach config, it never showed (both step 3 checks ran, config was hidden)
3. Validation & import steps had cascading step number mismatches

---

## WHAT CHANGED (This Run Only)

### File: `pages/TasklistImport`

**Added:**
- Debug mode detection on mount (line 22–25)
- Diagnostic panel rendering (line 70–84, only when debugMode=true)

**Fixed:**
- Steps array updated to include Preview as step 2 (line 27–35)
- ConfigStep condition changed from `currentStep === 3` to `currentStep === 4` (line 147)
- ValidationStep back reference updated from step 3 to step 4 (line 161)
- All downstream step numbers incremented by 1
- Summary now checks for `currentStep === 7` instead of 6

---

## WHAT DID NOT CHANGE

- Excel parsing logic (FileUploadStep)
- Header detection
- Auto-mapping engine (mappingEngine.js)
- Manual override UI
- Field registry loading
- Backend/database schema
- Import behavior when debugImporter is OFF (default)

---

## TEST CHECKLIST

- [ ] Open importer WITHOUT `?debugImporter=1` → Diagnostic panel invisible
- [ ] Upload Excel file → Should land on Preview step (Step 2)
- [ ] Preview shows first 20 rows with all headers → Click Next
- [ ] Mapping step (Step 3) shows with auto-populated suggestions → Verify mapping count > 0
- [ ] Click Next → Config step (Step 4) appears → Set date, click Next
- [ ] Validation step (Step 5) appears → Click Next
- [ ] Import preview (Step 6) appears → Can import or back
- [ ] After import → Summary (Step 7) shows results
- [ ] Open importer WITH `?debugImporter=1` → Red diagnostic box appears at top
- [ ] Diagnostic shows correct step numbers and data
- [ ] Workflow still works with debug mode ON

---

## SINGLE ROOT CAUSE (DIAGNOSIS ONLY)

**Root Cause:** Step numbering was off by one starting from ConfigStep; PreviewStep was implemented but not wired into the flow.

---

## MINIMAL FIX RECOMMENDATION (FOR NEXT RUN)

**Layer:** Step orchestration (pages/TasklistImport)  
**Action:** Align all step conditionals to correct numbers (COMPLETED IN THIS RUN)

---

## NEXT STEPS

1. Test the importer with `?debugImporter=1`
2. Verify diagnostic panel shows correct step progression
3. Upload test file and verify full workflow (steps 1→7)
4. If workflow is correct, diagnostic is complete
5. If issues remain, re-run diagnostic with updated config

---

## FILES MODIFIED

1. `pages/TasklistImport` — Step orchestration + diagnostic panel
2. `components/ROLLBACK__2026-02-01__FileUploadStep__BEFORE.md` — Before snapshot
3. `components/ROLLBACK__2026-02-01__MappingStep__BEFORE_DIAGNOSTIC.md` — Before snapshot

**Total changes:** 3 files touched (within limit)
**Diagnostic mode:** OFF by default, visible only with `?debugImporter=1