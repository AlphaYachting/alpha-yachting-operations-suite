import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { 
  FileSpreadsheet, 
  AlertCircle,
  CheckCircle2,
  XCircle,
  Info,
  Download
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default function ImportDiagnostics() {
  const [file, setFile] = useState(null);
  const [analysis, setAnalysis] = useState(null);

  const handleFileUpload = (e) => {
    const uploadedFile = e.target.files[0];
    if (uploadedFile) {
      setFile(uploadedFile);
      analyzeFile(uploadedFile);
    }
  };

  const analyzeFile = (file) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        
        const firstSheetName = workbook.SheetNames[0];
        const firstSheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
        
        if (jsonData.length === 0) {
          setAnalysis({
            error: 'No data rows found in Excel file',
            sheets: workbook.SheetNames
          });
          return;
        }

        // Extract column headers
        const headers = Object.keys(jsonData[0]);
        
        // Analyze customer name detection
        const customerNameVariations = [
          'customer', 'customer name', 'customername', 'Customer Name', 'Customer',
          'kunde', 'Kunde', 'client', 'Client', 'name', 'Name',
          'account', 'Account', 'account name', 'Account Name'
        ];

        const detectedCustomerColumn = headers.find(h => 
          customerNameVariations.some(v => h.toLowerCase().trim() === v.toLowerCase())
        );

        // Check for common issues
        const issues = [];
        const checks = [];

        // Check 1: Customer column exists
        if (detectedCustomerColumn) {
          checks.push({
            name: 'Customer column detected',
            status: 'pass',
            detail: `Found column: "${detectedCustomerColumn}"`
          });
        } else {
          checks.push({
            name: 'Customer column detected',
            status: 'fail',
            detail: 'No customer name column found'
          });
          issues.push({
            severity: 'critical',
            issue: 'Customer Name Column Not Found',
            detail: `Expected one of: ${customerNameVariations.slice(0, 6).join(', ')}...`,
            solution: 'Rename your customer column to "Customer Name" or "Customer"'
          });
        }

        // Check 2: Empty customer values
        let emptyCustomerCount = 0;
        if (detectedCustomerColumn) {
          emptyCustomerCount = jsonData.filter(row => 
            !row[detectedCustomerColumn] || row[detectedCustomerColumn].toString().trim() === ''
          ).length;

          if (emptyCustomerCount > 0) {
            checks.push({
              name: 'All customer names filled',
              status: 'warning',
              detail: `${emptyCustomerCount} rows have empty customer names`
            });
            issues.push({
              severity: 'warning',
              issue: `${emptyCustomerCount} Empty Customer Names`,
              detail: 'Some rows have no customer name',
              solution: 'Fill in customer names for all rows, or remove empty rows'
            });
          } else {
            checks.push({
              name: 'All customer names filled',
              status: 'pass',
              detail: 'All rows have customer names'
            });
          }
        }

        // Check 3: Merged cells warning
        checks.push({
          name: 'No merged cells (manual check required)',
          status: 'info',
          detail: 'Please ensure no merged cells in Excel'
        });

        // Check 4: Data format
        const sampleValue = detectedCustomerColumn ? jsonData[0][detectedCustomerColumn] : null;
        if (sampleValue && typeof sampleValue === 'string') {
          checks.push({
            name: 'Customer name is plain text',
            status: 'pass',
            detail: `Sample: "${sampleValue}"`
          });
        } else if (sampleValue) {
          checks.push({
            name: 'Customer name is plain text',
            status: 'warning',
            detail: `Value type: ${typeof sampleValue}`
          });
        }

        // Check 5: Boat column
        const boatColumns = ['boat', 'boat name', 'vessel', 'vessel name', 'schiff'];
        const detectedBoatColumn = headers.find(h => 
          boatColumns.some(v => h.toLowerCase().trim() === v.toLowerCase())
        );

        if (detectedBoatColumn) {
          checks.push({
            name: 'Boat column detected',
            status: 'pass',
            detail: `Found column: "${detectedBoatColumn}"`
          });
        } else {
          checks.push({
            name: 'Boat column detected',
            status: 'info',
            detail: 'Optional - boats can be created automatically'
          });
        }

        // Check 6: Service description
        const serviceColumns = ['service', 'description', 'work', 'job', 'arbeit'];
        const detectedServiceColumn = headers.find(h => 
          serviceColumns.some(v => h.toLowerCase().trim() === v.toLowerCase())
        );

        if (detectedServiceColumn) {
          checks.push({
            name: 'Service description detected',
            status: 'pass',
            detail: `Found column: "${detectedServiceColumn}"`
          });
        } else {
          checks.push({
            name: 'Service description detected',
            status: 'warning',
            detail: 'No service/description column found'
          });
          issues.push({
            severity: 'warning',
            issue: 'No Service Description Column',
            detail: 'Jobs will be created with generic descriptions',
            solution: 'Add a "Service" or "Description" column with work details'
          });
        }

        setAnalysis({
          fileName: file.name,
          sheets: workbook.SheetNames,
          activeSheet: firstSheetName,
          totalRows: jsonData.length,
          columns: headers,
          detectedCustomerColumn,
          detectedBoatColumn,
          detectedServiceColumn,
          emptyCustomerCount,
          checks,
          issues,
          sampleRows: jsonData.slice(0, 3)
        });

      } catch (error) {
        setAnalysis({
          error: `Failed to analyze file: ${error.message}`
        });
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const downloadTemplate = () => {
    const template = [
      {
        'Customer Name': 'John Doe',
        'Email': 'john@example.com',
        'Phone': '+43 123 456789',
        'Boat Name': 'Sea Breeze',
        'Boat Type': 'Sailboat',
        'Location': 'Marina Novigrad',
        'Service': 'Engine inspection and maintenance',
        'Priority': 'Normal'
      },
      {
        'Customer Name': 'Jane Smith',
        'Email': 'jane@example.com',
        'Phone': '+43 987 654321',
        'Boat Name': 'Ocean Dream',
        'Boat Type': 'Yacht',
        'Location': 'Pula Marina',
        'Service': 'Hull cleaning and antifouling',
        'Priority': 'High'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Import Template');
    XLSX.writeFile(wb, 'AlphaYachting_Import_Template.xlsx');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Import Diagnostics</h1>
        <p className="text-slate-500 mt-1">Analyze Excel file structure and detect issues before importing</p>
      </div>

      {/* Template Download */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Info className="h-5 w-5 text-blue-600" />
              <div>
                <p className="font-medium text-blue-900">Need a template?</p>
                <p className="text-sm text-blue-700">Download our Excel template with correct column names</p>
              </div>
            </div>
            <Button onClick={downloadTemplate} variant="outline" className="border-blue-300">
              <Download className="h-4 w-4 mr-2" />
              Download Template
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Upload File for Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center hover:border-blue-400 transition-colors">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              className="hidden"
              id="diagnostic-upload"
            />
            <label htmlFor="diagnostic-upload" className="cursor-pointer">
              <FileSpreadsheet className="h-12 w-12 mx-auto text-slate-400 mb-4" />
              <p className="text-lg font-medium text-slate-700">
                {file ? file.name : 'Click to upload Excel file'}
              </p>
              <p className="text-sm text-slate-500 mt-2">
                File will be analyzed without importing data
              </p>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Analysis Results */}
      {analysis && (
        <div className="space-y-6">
          {analysis.error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{analysis.error}</AlertDescription>
            </Alert>
          ) : (
            <>
              {/* File Info */}
              <Card>
                <CardHeader>
                  <CardTitle>File Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-slate-500">File Name</p>
                      <p className="font-medium">{analysis.fileName}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Active Sheet</p>
                      <p className="font-medium">{analysis.activeSheet}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Total Rows</p>
                      <p className="font-medium">{analysis.totalRows}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Columns</p>
                      <p className="font-medium">{analysis.columns.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Validation Checks */}
              <Card>
                <CardHeader>
                  <CardTitle>Validation Checks</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {analysis.checks.map((check, idx) => (
                      <div key={idx} className="flex items-start gap-3 p-3 rounded-lg border">
                        {check.status === 'pass' && <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />}
                        {check.status === 'fail' && <XCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />}
                        {check.status === 'warning' && <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />}
                        {check.status === 'info' && <Info className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />}
                        <div className="flex-1">
                          <p className="font-medium text-slate-900">{check.name}</p>
                          <p className="text-sm text-slate-600 mt-1">{check.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Issues Found */}
              {analysis.issues.length > 0 && (
                <Card className="border-amber-200">
                  <CardHeader>
                    <CardTitle className="text-amber-800">Issues Detected ({analysis.issues.length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {analysis.issues.map((issue, idx) => (
                        <div key={idx} className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                          <div className="flex items-start gap-3">
                            <Badge className={
                              issue.severity === 'critical' ? 'bg-red-100 text-red-800' :
                              'bg-amber-100 text-amber-800'
                            }>
                              {issue.severity}
                            </Badge>
                            <div className="flex-1">
                              <p className="font-semibold text-amber-900">{issue.issue}</p>
                              <p className="text-sm text-amber-700 mt-1">{issue.detail}</p>
                              <p className="text-sm text-amber-800 mt-2 font-medium">
                                ✓ Solution: {issue.solution}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Detected Columns */}
              <Card>
                <CardHeader>
                  <CardTitle>Detected Columns</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {analysis.columns.map((col, idx) => (
                      <Badge 
                        key={idx} 
                        variant="outline"
                        className={
                          col === analysis.detectedCustomerColumn ? 'border-emerald-500 bg-emerald-50 text-emerald-700' :
                          col === analysis.detectedBoatColumn ? 'border-blue-500 bg-blue-50 text-blue-700' :
                          col === analysis.detectedServiceColumn ? 'border-purple-500 bg-purple-50 text-purple-700' :
                          ''
                        }
                      >
                        {col}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Sample Data */}
              <Card>
                <CardHeader>
                  <CardTitle>Sample Rows (Preview)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {analysis.columns.slice(0, 6).map((col, idx) => (
                            <TableHead key={idx}>{col}</TableHead>
                          ))}
                          {analysis.columns.length > 6 && <TableHead>...</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {analysis.sampleRows.map((row, rowIdx) => (
                          <TableRow key={rowIdx}>
                            {analysis.columns.slice(0, 6).map((col, colIdx) => (
                              <TableCell key={colIdx} className="max-w-xs truncate">
                                {row[col]?.toString() || '(empty)'}
                              </TableCell>
                            ))}
                            {analysis.columns.length > 6 && <TableCell>...</TableCell>}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* Ready to Import */}
              {analysis.issues.filter(i => i.severity === 'critical').length === 0 && (
                <Alert className="border-emerald-200 bg-emerald-50">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <AlertDescription className="text-emerald-800">
                    <strong>File Ready for Import!</strong> No critical issues detected. You can proceed with the import.
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}