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

  const steps = [
    { number: 1, title: 'Upload File', icon: Upload },
    { number: 2, title: 'Map Fields', icon: FileText },
    { number: 3, title: 'Configure', icon: FileText },
    { number: 4, title: 'Validate', icon: CheckCircle },
    { number: 5, title: 'Preview & Import', icon: CheckCircle },
    { number: 6, title: 'Summary', icon: CheckCircle }
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
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Task List Import</h1>
        <p className="text-slate-500 mt-1">Import tasks from Excel or CSV files</p>
      </div>

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
            <MappingStep
              data={parsedData}
              onComplete={handleMappingComplete}
              onBack={() => setCurrentStep(1)}
            />
          )}
          {currentStep === 3 && (
            <ConfigStep
              mapping={fieldMapping}
              onComplete={handleConfigComplete}
              onBack={() => setCurrentStep(2)}
            />
          )}
          {currentStep === 4 && (
            <ValidationStep
              data={parsedData}
              mapping={fieldMapping}
              config={config}
              onComplete={handleValidationComplete}
              onBack={() => setCurrentStep(3)}
            />
          )}
          {currentStep === 5 && (
            <PreviewStep
              data={parsedData}
              mapping={fieldMapping}
              config={config}
              validationResults={validationResults}
              onComplete={handleImportComplete}
              onBack={() => setCurrentStep(4)}
            />
          )}
          {currentStep === 6 && (
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