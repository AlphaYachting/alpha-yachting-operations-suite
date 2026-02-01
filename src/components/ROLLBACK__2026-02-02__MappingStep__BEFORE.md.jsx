# BEFORE SNAPSHOT: components/taskimport/MappingStep.js
**Date:** 2026-02-02  
**Issue:** Mapping state lost when returning to step 3 or re-entering

```javascript
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, ArrowRight, CheckCircle2, AlertTriangle } from 'lucide-react';
import { autoMapHeaders, getTargetFields, getRequiredFields } from './mappingEngine';

const TARGET_FIELDS = getTargetFields().map(f => ({ ...f, required: getRequiredFields().includes(f.value) }));
const REQUIRED_FIELD_VALUES = getRequiredFields();

export default function MappingStep({ headers = [], mapping = {}, onMappingChange, onNext, onBack }) {
  const [autoMapping, setAutoMapping] = useState(null);
  const [debugMode, setDebugMode] = useState(false);

  // CRITICAL SECTION: Auto-map on component mount or when headers change
  useEffect(() => {
    if (headers.length > 0 && Object.keys(mapping).length === 0) {
      const debugEnabled = new URLSearchParams(window.location.search).get('debugImporter') === '1';
      setDebugMode(debugEnabled);

      const { mapping: suggested, debug } = autoMapHeaders(headers, debugEnabled);
      setAutoMapping(debug);
      onMappingChange(suggested);  // Line 23: calls parent setFieldMapping
    }
  }, [headers]);  // LINE 25: DEPENDENCY ISSUE - only triggers on headers change, NOT on mapping change

  const handleMappingChange = (header, targetField) => {
    const newMapping = { ...mapping };
    Object.keys(newMapping).forEach(key => {
      if (newMapping[key] === targetField && key !== header) delete newMapping[key];
    });
    if (targetField) {
      newMapping[header] = targetField;
    }
    onMappingChange(newMapping);  // Updates parent state
  };

  const getMappedCount = () => {
    return Object.values(mapping || {}).filter(Boolean).length;
  };

  const getRequiredMapped = () => {
    const mapped = Object.values(mapping || {});
    return REQUIRED_FIELD_VALUES.filter(r => mapped.includes(r)).length;
  };

  const requiredFields = TARGET_FIELDS.filter(f => f.required);
  const allRequiredMapped = getRequiredMapped() === requiredFields.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 3: Map Columns</CardTitle>
        <CardDescription>
          Map your Excel columns to system fields. {getMappedCount()} of {headers.length} columns mapped.
          {!allRequiredMapped && (
            <span className="text-red-600 font-medium ml-2">
              ⚠ Required fields not all mapped
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* ... debug panel and mapping UI ... */}
        <div className="flex justify-between mt-6">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <Button onClick={onNext} disabled={!allRequiredMapped}>
            Next: Configure Import
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

**Risk Analysis:**
- Line 17: Guard condition `Object.keys(mapping).length === 0` is CORRECT (only auto-map if mapping is empty)
- Line 25: Dependency array `[headers]` means useEffect only triggers when headers change, NOT when mapping prop changes from parent
- **Scenario:** If user navigates back to step 3 from step 4, then forward again:
  1. MappingStep unmounts (step 3 → 4) ✓
  2. MappingStep remounts (step 4 → 3 back → 3 again)
  3. headers prop unchanged from before
  4. useEffect dependency `[headers]` does NOT trigger because headers haven't changed
  5. Mapping prop is passed from parent (should be preserved)
  6. **Issue:** If parent state was somehow reset, mapping would be empty {}

**Actual Root Cause:**
The guard on line 17 is good. But if parent `fieldMapping` state gets reset to `{}` unexpectedly (due to step transition bug), MappingStep would re-run auto-mapping.

Confirmed: handleMappingComplete in parent sets `currentStep` to wrong value (3 instead of 4), so user never leaves step 3.