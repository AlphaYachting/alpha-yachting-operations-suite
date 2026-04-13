# BEFORE: validationEngine.jsx — Task Counting Bug

```javascript
// Line 78-82: Tasks counted WITHOUT validating Service Area assignment
const titleCol = Object.entries(fieldMapping).find(([_, v]) => v === 'taskTitle')?.[0];
if (titleCol && row[titleCol] && String(row[titleCol]).trim() !== '') {
  taskCount++;  // <-- COUNTS EVEN IF SERVICE AREA UNMAPPED
}
```

**Problem:**
- Task is counted if title exists
- But if serviceArea column is not mapped, task becomes "Uncategorized"
- "Uncategorized" tasks are never created (no matching service area in system)
- Result: `taskCount=9` in validation but `0 tasks created`

**Context:**
Lines 58-76 group tasks by service area (correctly).
Lines 78-82 count tasks (incorrectly—ignores grouping result).