# BEFORE SNAPSHOT: pages/TasklistImport.js
**Date:** 2026-02-02  
**Issue:** Mapping state lost between steps (step 3 → 4 transition)

```javascript
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, FileText, CheckCircle } from 'lucide-react';
import FileUploadStep from '@/components/taskimport/FileUploadStep';
import MappingStep from '@/components/taskimport/MappingStep';
import ConfigStep from '@/components/taskimport/ConfigStep';
import ValidationStep from '@/components/taskimport/ValidationStep';
import PreviewStep from '@/components/taskimport/PreviewStep';
import ImportSummary from '@/components/taskimport/ImportSummary';

export default function TasklistImport() {
  const [currentStep, setCurrentStep] = useState(1);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [parsedData, setParsedData] = useState([]);
  const [fieldMapping, setFieldMapping] = useState({});
  const [config, setConfig] = useState({});
  const [validationResults, setValidationResults] = useState(null);
  const [importResults, setImportResults] = useState(null);
  const [debugMode, setDebugMode] = useState(false);

  // Detect debug mode on mount
  React.useEffect(() => {
    const debugEnabled = new URLSearchParams(window.location.search).get('debugImporter') === '1';
    setDebugMode(debugEnabled);
  }, []);

  const steps = [
    { number: 1, title: 'Upload File', icon: Upload },
    { number: 2, title: 'Preview Data', icon: FileText },
    { number: 3, title: 'Map Fields', icon: FileText },
    { number: 4, title: 'Configure', icon: FileText },
    { number: 5, title: 'Validate', icon: CheckCircle },
    { number: 6, title: 'Import', icon: CheckCircle },
    { number: 7, title: 'Summary', icon: CheckCircle }
  ];

  const handleFileUpload = (file, data) => {
    setUploadedFile(file);
    setParsedData(data);
    setCurrentStep(2);
  };

  const handleMappingComplete = (mapping) => {
    setFieldMapping(mapping);
    setCurrentStep(3);
  };

  const handleConfigComplete = (configData) => {
    setConfig(configData);
    setCurrentStep(4);
  };

  const handleValidationComplete = (results) => {
    setValidationResults(results);
    setCurrentStep(5);
  };

  const handleImportComplete = (results) => {
    setImportResults(results);
    setCurrentStep(6);
  };

  return (
    <div className="space-y-6">
      {/* ... render code ... */}
      {/* CRITICAL LINE 140-146: MappingStep receives fieldMapping prop */}
      {currentStep === 3 && (
        <MappingStep
          headers={parsedData.length > 0 ? Object.keys(parsedData[0]) : []}
          mapping={fieldMapping}
          onMappingChange={setFieldMapping}
          onNext={handleMappingComplete}
          onBack={() => setCurrentStep(2)}
        />
      )}
      {/* CRITICAL LINE 148-154: ConfigStep here */}
      {currentStep === 4 && (
        <ConfigStep
          config={config}
          onConfigChange={setConfig}
          onNext={() => handleConfigComplete(config)}
          onBack={() => setCurrentStep(3)}
        />
      )}
      {/* ... rest ... */}
    </div>
  );
}
```

**Key State Holders:**
- Line 15: `const [fieldMapping, setFieldMapping] = useState({});` — initial empty
- Line 143: MappingStep receives `mapping={fieldMapping}` 
- Line 143: MappingStep receives `onMappingChange={setFieldMapping}` 

**Data Flow on Step 3→4 transition:**
1. User completes mapping in MappingStep
2. Clicks "Next: Configure Import" (line 144 in MappingStep)
3. `onNext={handleMappingComplete}` called (line 143)
4. handleMappingComplete(mapping) at line 43 calls `setFieldMapping(mapping); setCurrentStep(3);`
5. BUT: handleMappingComplete has `setCurrentStep(3)` NOT `setCurrentStep(4)`
6. **BUG:** Step stays at 3, MappingStep re-renders, mapping prop passed correctly

**WAIT - Looking closer:**
- Line 44 says `setCurrentStep(3)` but we're already on step 3
- This should be `setCurrentStep(4)` to advance to ConfigStep
- This is the bug! handleMappingComplete advances to step 3, not 4
- So ConfigStep never renders

**Root Cause:** `handleMappingComplete` sets `currentStep` to 3 instead of 4.