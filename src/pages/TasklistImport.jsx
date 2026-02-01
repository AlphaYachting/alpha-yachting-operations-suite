import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, FileText, CheckCircle, Eye } from 'lucide-react';
import FileUploadStep from '@/components/taskimport/FileUploadStep';
import MappingStep from '@/components/taskimport/MappingStep';
import ConfigStep from '@/components/taskimport/ConfigStep';
import ValidationStep from '@/components/taskimport/ValidationStep';
import PreviewStep from '@/components/taskimport/PreviewStep';
import ImportPreviewStep from '@/components/taskimport/ImportPreviewStep';
import ImportStep from '@/components/taskimport/ImportStep';
import ImportSummary from '@/components/taskimport/ImportSummary';
import { validateImportData } from '@/components/taskimport/validationEngine';

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
  useEffect(() => {
    const debugEnabled = new URLSearchParams(window.location.search).get('debugImporter') === '1';
    setDebugMode(debugEnabled);
  }, []);

  const steps = [
    { number: 1, title: 'Upload File', icon: Upload },
    { number: 2, title: 'Preview Data', icon: FileText },
    { number: 3, title: 'Map Fields', icon: FileText },
    { number: 4, title: 'Configure', icon: FileText },
    { number: 5, title: 'Validate', icon: CheckCircle },
    { number: 6, title: 'Import Preview', icon: Eye },
    { number: 7, title: 'Import', icon: CheckCircle },
    { number: 8, title: 'Summary', icon: CheckCircle }
  ];

  const handleFileUpload = (file, data) => {
    if (debugMode) console.log('[IMPORTER] Step 1→2: File uploaded', file.name, 'Rows:', data.length);
    setUploadedFile(file);
    setParsedData(data);
    setFieldMapping({}); // Reset mapping for new file
    setCurrentStep(2);
  };

  const handlePreviewNext = () => {
    if (debugMode) console.log('[IMPORTER] Step 2→3: Moving to mapping');
    setCurrentStep(3);
  };

  const handleMappingComplete = (mapping) => {
    if (debugMode) console.log('[IMPORTER] Step 3→4: Mapping complete', mapping);
    setFieldMapping(mapping);
    setCurrentStep(4);
  };

  const handleConfigComplete = (configData) => {
    if (debugMode) console.log('[IMPORTER] Step 4→5: Config complete, mapping is:', fieldMapping);
    
    // Validate with the stored fieldMapping
    const results = validateImportData(parsedData, fieldMapping, configData);
    if (debugMode) console.log('[IMPORTER] Validation results:', results);
    
    setConfig(configData);
    setValidationResults(results);
    setCurrentStep(5);
  };

  const handleValidationProceed = () => {
    if (debugMode) console.log('[IMPORTER] Step 5→6: Proceeding to import preview');
    setCurrentStep(6);
  };

  const handlePreviewProceed = () => {
    if (debugMode) console.log('[IMPORTER] Step 6→7: Preview complete, proceeding with import');
    setCurrentStep(7);
  };

  const handleImportComplete = (results) => {
    if (debugMode) console.log('[IMPORTER] Step 7→8: Import complete');
    setImportResults(results);
    setCurrentStep(8);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Task List Import</h1>
        <p className="text-slate-500 mt-1">Import tasks from Excel or CSV files</p>
      </div>

      {debugMode && (
        <div className="p-4 bg-red-50 border-2 border-red-300 rounded-lg text-xs font-mono space-y-2">
          <div className="font-bold text-red-900">🔴 IMPORTER END-TO-END DIAGNOSTIC</div>
          <div className="text-red-800 space-y-1">
            <div><strong>Current Step:</strong> {currentStep}</div>
            <div><strong>File uploaded:</strong> {uploadedFile ? uploadedFile.name : 'NO'}</div>
            <div><strong>Parsed rows:</strong> {parsedData.length}</div>
            <div><strong>Field mapping keys:</strong> {Object.keys(fieldMapping).length}</div>
            <div><strong>Service Area mapped:</strong> {Object.values(fieldMapping).includes('serviceArea') ? '✓ YES' : '✗ NO'}</div>
            <div><strong>Validation ran:</strong> {validationResults ? 'YES' : 'NO'}</div>
            {validationResults && (
              <div className="mt-2 bg-white p-2 rounded">
                <strong>Validation Results:</strong>
                <div>- Service Areas detected: {Object.keys(validationResults.serviceAreaGroups).length}</div>
                <div>- Tasks to import: {validationResults.taskCount}</div>
                <div>- Uncategorized tasks: {validationResults.serviceAreaGroups['Uncategorized']?.count || 0}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Progress Steps */}
      <div className="flex items-center justify-between">
        {steps.map((step, idx) => (
          <div key={step.number} className="flex items-center flex-1">
            <div className="flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  currentStep === step.number
                    ? 'bg-blue-600 text-white'
                    : currentStep > step.number
                    ? 'bg-green-600 text-white'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {currentStep > step.number ? (
                  <CheckCircle className="h-5 w-5" />
                ) : (
                  <step.icon className="h-5 w-5" />
                )}
              </div>
              <span className="text-xs mt-2 text-slate-600">{step.title}</span>
            </div>
            {idx < steps.length - 1 && (
              <div
                className={`flex-1 h-1 mx-2 ${
                  currentStep > step.number ? 'bg-green-600' : 'bg-slate-200'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <Card>
        <CardHeader>
          <CardTitle>
            Step {currentStep}: {steps[currentStep - 1].title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {currentStep === 1 && (
            <FileUploadStep onComplete={handleFileUpload} />
          )}
          {currentStep === 2 && (
            <PreviewStep
              data={parsedData}
              headers={parsedData.length > 0 ? Object.keys(parsedData[0]) : []}
              onNext={handlePreviewNext}
              onBack={() => setCurrentStep(1)}
            />
          )}
          {currentStep === 3 && (
            <MappingStep
              headers={parsedData.length > 0 ? Object.keys(parsedData[0]) : []}
              mapping={fieldMapping}
              onMappingChange={setFieldMapping}
              onNext={() => handleMappingComplete(fieldMapping)}
              onBack={() => setCurrentStep(2)}
            />
          )}
          {currentStep === 4 && (
            <ConfigStep
              config={config}
              onConfigChange={setConfig}
              onNext={handleConfigComplete}
              onBack={() => setCurrentStep(3)}
            />
          )}
          {currentStep === 5 && (
            <ValidationStep
              results={validationResults || { valid: false, workOrderCount: 0, taskCount: 0, errors: [], warnings: [], serviceAreaGroups: {} }}
              fieldMapping={fieldMapping}
              parsedData={parsedData}
              onExecute={handleValidationProceed}
              onBack={() => setCurrentStep(4)}
              isProcessing={false}
              dryRunMode={config.dryRunMode}
            />
          )}
          {currentStep === 6 && (
            <ImportPreviewStep
              data={parsedData}
              mapping={fieldMapping}
              config={config}
              onNext={handlePreviewProceed}
              onBack={() => setCurrentStep(5)}
              isProcessing={false}
            />
          )}
          {currentStep === 7 && (
            <ImportStep
              parsedData={parsedData}
              fieldMapping={fieldMapping}
              config={config}
              onComplete={handleImportComplete}
              onBack={() => setCurrentStep(6)}
            />
          )}
          {currentStep === 8 && (
            <ImportSummary
              results={importResults}
              onReset={() => {
                setCurrentStep(1);
                setUploadedFile(null);
                setParsedData([]);
                setFieldMapping({});
                setConfig({});
                setValidationResults(null);
                setImportResults(null);
              }}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}