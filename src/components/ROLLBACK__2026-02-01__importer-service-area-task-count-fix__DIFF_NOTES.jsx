# DIFF NOTES: Service Area → Task Count Fix

## ROOT CAUSE
Task counter was counting all rows with task titles, regardless of whether a service area was mapped. This caused:
- 9 tasks counted in validation
- But all 9 tasks grouped as "Uncategorized" (no service area mapping)
- Importer skips creating "Uncategorized" tasks
- Result: 0 tasks created

## SOLUTION (MINIMAL)
Added condition to task counter: only count tasks that have a valid (non-Uncategorized) service area assignment.

### File Changed
`components/taskimport/validationEngine.jsx`

### Change
**Line 80 (before):**
```javascript
if (titleCol && row[titleCol] && String(row[titleCol]).trim() !== '') {
```

**Line 80 (after):**
```javascript
if (titleCol && row[titleCol] && String(row[titleCol]).trim() !== '' && serviceArea !== 'Uncategorized') {
```

### Impact
- ✅ Tasks with valid service areas are counted
- ✅ Tasks without service areas are NOT counted (prevents false promises of creation)
- ✅ Validation result now matches what actually gets created
- ❌ No schema changes
- ❌ No Excel format changes
- ❌ No importer refactoring
- ❌ No new features added

## VERIFICATION
After fix, user should see:
1. Step 5: "9 Tasks to be created" (not 0)
2. Service Areas Preview shows real areas (Motor & Technik, etc., not just Uncategorized)
3. Import succeeds and creates tasks