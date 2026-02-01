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

  // Auto-map on component mount or when headers change
  useEffect(() => {
    if (headers && headers.length > 0 && Object.keys(mapping).length === 0) {
      const debugEnabled = new URLSearchParams(window.location.search).get('debugImporter') === '1';
      setDebugMode(debugEnabled);

      const { mapping: suggested, debug } = autoMapHeaders(headers, debugEnabled);
      setAutoMapping(debug);
      onMappingChange(suggested);
      
      if (debugEnabled) {
        console.log('[MAPPING STEP] Auto-mapping completed:', suggested);
        console.log('[MAPPING STEP] Service Area in mapping?', Object.entries(suggested).find(([_, v]) => v === 'serviceArea'));
      }
    }
  }, [headers]);

  const handleMappingChange = (header, targetField) => {
    const newMapping = { ...mapping };
    Object.keys(newMapping).forEach(key => {
      if (newMapping[key] === targetField && key !== header) delete newMapping[key];
    });
    if (targetField) {
      newMapping[header] = targetField;
    }
    onMappingChange(newMapping);
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
        {debugMode && autoMapping && (
           <div className="mb-6 p-4 bg-blue-50 border border-blue-300 rounded-lg text-xs">
             <h4 className="font-bold text-blue-900 mb-3">🔍 IMPORTER DIAGNOSTIC SUMMARY</h4>
             <div className="space-y-2 text-blue-800">
               <div><strong>Headers detected:</strong> {autoMapping.headerCount}</div>
               <div><strong>Target fields registry:</strong> {autoMapping.targetFieldsCount}</div>
               <div><strong>Auto-mapped:</strong> {autoMapping.mappedCount}</div>
               <div><strong>Current mapping passed to next step:</strong> {Object.keys(mapping || {}).length}</div>
               <div className="text-green-700"><strong>✓ Service Area mapped?</strong> {Object.values(mapping || {}).includes('serviceArea') ? 'YES' : 'NO'}</div>
               {autoMapping.missingRequired.length > 0 && (
                 <div className="text-red-600">
                   <strong>❌ Missing required:</strong> {autoMapping.missingRequired.join(', ')}
                 </div>
               )}
               <div className="mt-2 bg-white p-2 rounded max-h-32 overflow-y-auto">
                 <strong>All Mappings:</strong>
                 {Object.entries(mapping || {}).map(([header, target], i) => (
                   <div key={i}>{header} → {target}</div>
                 ))}
               </div>
             </div>
           </div>
        )}

        <div className="space-y-3 max-h-96 overflow-y-auto">
           {(headers || []).map((header, idx) => (
            <div key={idx} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <div className="font-medium text-sm">{header}</div>
              </div>
              <div className="flex-1">
                <Select
                  value={mapping[header] || ''}
                  onValueChange={(value) => handleMappingChange(header, value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select target field..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>-- Do not import --</SelectItem>
                    {TARGET_FIELDS.map(field => (
                      <SelectItem key={field.value} value={field.value}>
                        {field.label} {field.required && <span className="text-red-600">*</span>}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {mapping[header] && (
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 p-4 bg-amber-50 rounded-lg">
          <h4 className="font-semibold text-sm text-amber-900 mb-2">Required Fields:</h4>
          <div className="text-xs text-amber-800 space-y-1">
            {requiredFields.map(field => {
              const isMapped = Object.values(mapping).includes(field.value);
              return (
                <div key={field.value} className="flex items-center gap-2">
                  {isMapped ? (
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-amber-600" />
                  )}
                  {field.label}
                </div>
              );
            })}
          </div>
        </div>

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