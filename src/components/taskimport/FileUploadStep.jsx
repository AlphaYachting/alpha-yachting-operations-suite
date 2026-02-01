import React, { useRef, useState } from 'react';
import { Upload, FileSpreadsheet, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function FileUploadStep({ onComplete }) {
  const fileInputRef = useRef(null);
  const [error, setError] = useState(null);

  const parseExcelFile = async (file) => {
    try {
      setError(null);
      const arrayBuffer = await file.arrayBuffer();
      
      // Import xlsx dynamically
      const { read, utils } = await import('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm');
      const workbook = read(arrayBuffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = utils.sheet_to_json(worksheet);
      
      if (data.length === 0) {
        throw new Error('No data found in Excel file');
      }
      
      onComplete(file, data);
    } catch (err) {
      setError(err.message || 'Failed to parse Excel file');
      console.error('Parse error:', err);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      parseExcelFile(file);
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Step 1: Upload Excel File</CardTitle>
          <CardDescription>
            Upload your tasklist Excel file (.xlsx format)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all"
          >
            <FileSpreadsheet className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <p className="text-lg font-medium text-gray-700 mb-2">
            Click to upload or drag and drop
          </p>
          <p className="text-sm text-gray-500">
            Excel files (.xlsx) with your task list structure
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            className="hidden"
          />
          </div>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h4 className="font-semibold text-sm text-blue-900 mb-2">Expected Columns:</h4>
            <div className="grid grid-cols-2 gap-2 text-xs text-blue-800">
              <div>• Project Name</div>
              <div>• Customer Type</div>
              <div>• Customer Name</div>
              <div>• Boat Type / Yacht Model</div>
              <div>• Location / Marina</div>
              <div>• Service Area</div>
              <div>• Task ID</div>
              <div>• Task Title</div>
              <div>• Task Description</div>
              <div>• Priority</div>
              <div>• Time Required (hrs)</div>
              <div>• Assigned Person</div>
              <div>...and more</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}