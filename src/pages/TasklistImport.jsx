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
    setCurrentStep(4);
  };

  const handleConfigComplete = (configData) => {
    setConfig(configData);
    setCurrentStep(5);
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
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Task List Import</h1>
        <p className="text-slate-500 mt-1">Import tasks from Excel or CSV files</p>
      </div>

      {/* DIAGNOSTIC PANEL - ONLY IN DEBUG MODE */}
      {debugMode && (
        <div className="p-4 bg-red-50 border-2 border-red-300 rounded-lg text-xs font-mono space-y-2">
          <div className="font-bold text-red-900">🔴 IMPORTER END-TO-END DIAGNOSTIC</div>
          <div className="text-red-800 space-y-1">
            <div><strong>Current Step:</strong> {currentStep} (0=not started, 1=upload, 2=preview, 3=mapping, 4=config, 5=validation, 6=preview&import, 7=summary)</div>
            <div><strong>File uploaded:</strong> {uploadedFile ? uploadedFile.name : 'NO'}</div>
            <div><strong>Parsed rows:</strong> {parsedData.length}</div>
            <div><strong>Detected columns:</strong> {parsedData.length > 0 ? Object.keys(parsedData[0]).length : 0}</div>
            <div><strong>Column names:</strong> {parsedData.length > 0 ? Object.keys(parsedData[0]).slice(0, 5).join(', ') + (Object.keys(parsedData[0]).length > 5 ? '...' : '') : 'N/A'}</div>
            <div><strong>Field mapping count:</strong> {Object.keys(fieldMapping).length}</div>
            <div><strong>Step 2 (Preview) visible:</strong> {currentStep === 2 ? 'YES' : 'NO'}</div>
            <div><strong>Step 3 (Mapping) visible:</strong> {currentStep === 3 ? 'YES' : 'NO'}</div>
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
              onNext={() => setCurrentStep(3)}
              onBack={() => setCurrentStep(1)}
            />
          )}
          {currentStep === 3 && (
            <MappingStep
              headers={parsedData.length > 0 ? Object.keys(parsedData[0]) : []}
              mapping={fieldMapping}
              onMappingChange={setFieldMapping}
              onNext={handleMappingComplete}
              onBack={() => setCurrentStep(2)}
            />
          )}
          {currentStep === 4 && (
            <ConfigStep
              config={config}
              onConfigChange={setConfig}
              onNext={() => handleConfigComplete(config)}
              onBack={() => setCurrentStep(3)}
            />
          )}
          {currentStep === 5 && (
            <ValidationStep
              results={validationResults || { valid: false, workOrderCount: 0, taskCount: 0, errors: [], warnings: [], serviceAreaGroups: {} }}
              onExecute={() => {
                // Trigger import in next step (Step 6)
                setCurrentStep(6);
              }}
              onBack={() => setCurrentStep(4)}
              isProcessing={false}
              dryRunMode={config.dryRunMode}
            />
          )}
          {currentStep === 6 && (
            <PreviewStep
              data={parsedData}
              mapping={fieldMapping}
              config={config}
              validationResults={validationResults}
              onComplete={handleImportComplete}
              onBack={() => setCurrentStep(5)}
            />
          )}
          {currentStep === 7 && (
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