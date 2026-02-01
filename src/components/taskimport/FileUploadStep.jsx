import React, { useRef } from 'react';
import { Upload, FileSpreadsheet } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function FileUploadStep({ onComplete, onUpload }) {
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const callback = onComplete || onUpload;
      if (callback) callback(file);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 1: Upload Excel File</CardTitle>
        <CardDescription>
          Upload your tasklist Excel file (.xlsx format). Expected sheet: "Tabelle1"
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
  );
}