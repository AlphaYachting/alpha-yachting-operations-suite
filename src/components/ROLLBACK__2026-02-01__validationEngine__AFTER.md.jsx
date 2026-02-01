# AFTER: validationEngine.jsx — Task Counted Only When Service Area Assigned

```javascript
// Line 78-82: Tasks counted ONLY if service area is assigned (not Uncategorized)
const titleCol = Object.entries(fieldMapping).find(([_, v]) => v === 'taskTitle')?.[0];
if (titleCol && row[titleCol] && String(row[titleCol]).trim() !== '' && serviceArea !== 'Uncategorized') {
  taskCount++;  // <-- NOW ONLY COUNTS WHEN SERVICE AREA IS MAPPED
}
```

**Fix:**
Added `&& serviceArea !== 'Uncategorized'` condition so tasks are only counted if they have a valid service area assignment.

**Result:**
- If serviceArea column is mapped → task gets assigned → counted
- If serviceArea column NOT mapped → task becomes "Uncategorized" → NOT counted (correct, would fail creation)
- Validation now reports accurate task count