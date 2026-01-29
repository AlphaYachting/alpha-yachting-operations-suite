import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import * as XLSX from 'npm:xlsx';
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertTriangle,
  Users,
  Ship,
  MapPin,
  Briefcase,
  ListChecks,
  Download,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function ExcelImport() {
  const [file, setFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');

  const handleFileUpload = (e) => {
    const uploadedFile = e.target.files[0];
    if (uploadedFile) {
      setFile(uploadedFile);
      setImportResult(null);
    }
  };

  const normalizeString = (str) => {
    if (!str) return '';
    return str.toString().trim().toLowerCase();
  };

  const findOrCreateCustomer = async (customerData, existingCustomers) => {
    const normalizedName = normalizeString(customerData.name);
    
    // Try to find existing customer by name
    const existing = existingCustomers.find(c => {
      const cName = normalizeString(c.company_name || `${c.first_name} ${c.last_name}`);
      return cName === normalizedName;
    });

    if (existing) {
      return existing;
    }

    // Create new customer
    const newCustomer = await base44.entities.Customer.create({
      company_name: customerData.company_name || '',
      first_name: customerData.first_name || '',
      last_name: customerData.last_name || customerData.name || '',
      email: customerData.email || '',
      phone: customerData.phone || '',
      status: 'Active'
    });

    existingCustomers.push(newCustomer);
    return newCustomer;
  };

  const findOrCreateLocation = async (locationData, existingLocations) => {
    if (!locationData || !locationData.name) return null;

    const normalizedName = normalizeString(locationData.name);
    
    // Try to find existing location
    const existing = existingLocations.find(l => 
      normalizeString(l.name) === normalizedName
    );

    if (existing) {
      return existing;
    }

    // Create new location
    const newLocation = await base44.entities.Location.create({
      name: locationData.name,
      location_type: locationData.type || 'Marina',
      region: locationData.region || 'Istria',
      city: locationData.city || '',
      status: 'Active'
    });

    existingLocations.push(newLocation);
    return newLocation;
  };

  const findOrCreateBoat = async (boatData, customerId, existingBoats) => {
    if (!boatData || !boatData.name) {
      // Create generic boat
      const genericBoat = await base44.entities.Boat.create({
        customer_id: customerId,
        vessel_name: 'Customer Boat',
        vessel_type: 'Sailboat',
        status: 'Active'
      });
      existingBoats.push(genericBoat);
      return genericBoat;
    }

    const normalizedName = normalizeString(boatData.name);
    
    // Try to find existing boat for this customer
    const existing = existingBoats.find(b => 
      b.customer_id === customerId && 
      normalizeString(b.vessel_name) === normalizedName
    );

    if (existing) {
      return existing;
    }

    // Create new boat
    const newBoat = await base44.entities.Boat.create({
      customer_id: customerId,
      vessel_name: boatData.name,
      vessel_type: boatData.type || 'Sailboat',
      manufacturer: boatData.manufacturer || '',
      model: boatData.model || '',
      length_m: boatData.length || '',
      status: 'Active'
    });

    existingBoats.push(newBoat);
    return newBoat;
  };

  const splitIntoTasks = (description) => {
    if (!description) return [];
    
    const text = description.toString().trim();
    
    // Try to split by common delimiters
    const lines = text.split(/[\n\r]+|[;•\-–—]/g)
      .map(line => line.trim())
      .filter(line => line.length > 3);
    
    if (lines.length > 1) {
      return lines;
    }
    
    // Single task
    return [text];
  };

  const normalizeRowKeys = (row) => {
    const normalized = {};
    Object.keys(row).forEach(key => {
      const normalizedKey = key.toString().trim().toLowerCase().replace(/\s+/g, '_');
      normalized[normalizedKey] = row[key];
    });
    return normalized;
  };

  const processExcelData = async (data) => {
    const summary = {
      customersCreated: 0,
      boatsCreated: 0,
      locationsCreated: 0,
      jobsCreated: 0,
      tasksCreated: 0
    };

    const reviewList = [];
    const existingCustomers = await base44.entities.Customer.list();
    const existingBoats = await base44.entities.Boat.list();
    const existingLocations = await base44.entities.Location.list();

    const initialCustomerCount = existingCustomers.length;
    const initialBoatCount = existingBoats.length;
    const initialLocationCount = existingLocations.length;

    // Detect available columns from first row
    if (data.length > 0) {
      const detectedColumns = Object.keys(data[0]).join(', ');
      console.log('📋 Detected Excel columns:', detectedColumns);
    }

    for (let i = 0; i < data.length; i++) {
      const originalRow = data[i];
      const row = normalizeRowKeys(originalRow);
      
      setProgress(((i + 1) / data.length) * 100);
      setCurrentStep(`Processing row ${i + 1} of ${data.length}`);

      try {
        // Extract customer info (normalized keys)
        const customerName = row.customer || row.customer_name || row.kunde || row.client || row.name || 
                            row.customername || row.account || row.account_name;
        
        if (!customerName) {
          reviewList.push({
            row: i + 1,
            problem: 'Missing customer name',
            data: row,
            suggestion: 'Please provide a customer name for this record'
          });
          continue;
        }

        // Parse customer data (normalized keys)
        const customerData = {
          name: customerName,
          company_name: row.company_name || row.firma || row.company || '',
          first_name: row.first_name || row.vorname || row.firstname || '',
          last_name: row.last_name || row.nachname || row.lastname || customerName,
          email: row.email || row.e_mail || row.mail || '',
          phone: row.phone || row.telefon || row.tel || row.mobile || ''
        };

        const customer = await findOrCreateCustomer(customerData, existingCustomers);

        // Extract boat info (normalized keys)
        const boatData = {
          name: row.boat || row.boat_name || row.schiff || row.vessel || row.vessel_name || '',
          type: row.boat_type || row.vessel_type || row.typ || row.type || 'Sailboat',
          manufacturer: row.manufacturer || row.hersteller || row.make || '',
          model: row.model || row.modell || '',
          length: row.length || row.length_m || row.laenge || ''
        };

        const boat = await findOrCreateBoat(boatData, customer.id, existingBoats);

        // Extract location info (normalized keys)
        const locationData = {
          name: row.location || row.marina || row.ort || row.hafen || row.port || '',
          type: row.location_type || row.type || 'Marina',
          city: row.city || row.stadt || '',
          region: row.region || 'Istria'
        };

        const location = await findOrCreateLocation(locationData, existingLocations);

        // Extract job info (normalized keys)
        const jobTitle = row.service || row.arbeit || row.job || row.work || row.description || row.beschreibung || 'Imported Service';
        const jobDescription = row.details || row.service_details || row.notes || row.notizen || row.remarks || '';

        // Create Job
        const jobNumber = `IMP${Date.now().toString().slice(-6)}${i}`;
        const job = await base44.entities.Job.create({
          job_number: jobNumber,
          customer_id: customer.id,
          boat_id: boat.id,
          location_id: location?.id || '',
          title: `${jobTitle} – ${boat.vessel_name} – Imported`,
          description: jobDescription,
          job_type: row.job_type || row.service_type || 'Mobile Service',
          service_category: row.category || row.service_category || 'General Service',
          priority: row.priority || 'Normal',
          status: 'New',
          intake_source: 'Excel Import',
          intake_date: new Date().toISOString(),
          internal_notes: 'Imported from Excel – Review Required'
        });

        summary.jobsCreated++;

        // Create tasks from description
        const taskDescriptions = splitIntoTasks(jobDescription || jobTitle);
        
        for (const taskDesc of taskDescriptions) {
          if (taskDesc && taskDesc.length > 3) {
            // Create a work order with this task
            const woNumber = `WO${Date.now().toString().slice(-6)}${i}`;
            const workOrder = await base44.entities.WorkOrder.create({
              work_order_number: woNumber,
              job_id: job.id,
              title: taskDesc.slice(0, 100),
              description: taskDesc,
              status: 'Draft',
              billable: true
            });

            // Create task
            await base44.entities.Task.create({
              work_order_id: workOrder.id,
              title: taskDesc.slice(0, 100),
              description: taskDesc,
              status: 'Not Started',
              sequence_order: summary.tasksCreated
            });

            summary.tasksCreated++;
          }
        }

      } catch (error) {
        console.error(`Row ${i + 1} error:`, error);
        reviewList.push({
          row: i + 1,
          problem: `Import error: ${error.message}`,
          data: originalRow,
          suggestion: 'Please review this record manually'
        });
      }
    }

    console.log('✅ Import complete:', summary);
    console.log('⚠️ Review required:', reviewList.length, 'items');

    summary.customersCreated = existingCustomers.length - initialCustomerCount;
    summary.boatsCreated = existingBoats.length - initialBoatCount;
    summary.locationsCreated = existingLocations.length - initialLocationCount;

    return { summary, reviewList };
  };

  const executeImport = async () => {
    if (!file) return;

    setImporting(true);
    setProgress(0);
    setCurrentStep('Reading Excel file...');

    try {
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          
          // Get first sheet
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet);

          console.log('📊 Excel file loaded:', jsonData.length, 'rows');
          if (jsonData.length > 0) {
            console.log('📋 Column headers detected:', Object.keys(jsonData[0]));
            console.log('📝 Sample row 1:', jsonData[0]);
          }

          setCurrentStep('Processing data...');
          
          const result = await processExcelData(jsonData);
          
          setImportResult(result);
          setCurrentStep('Import complete!');
          setProgress(100);
        } catch (error) {
          console.error('Import error:', error);
          setImportResult({
            summary: { customersCreated: 0, boatsCreated: 0, locationsCreated: 0, jobsCreated: 0, tasksCreated: 0 },
            reviewList: [{ row: 0, problem: `Fatal error: ${error.message}`, data: {}, suggestion: 'Check file format' }]
          });
        } finally {
          setImporting(false);
        }
      };

      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error('File reading error:', error);
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Excel Data Import</h1>
        <p className="text-slate-500 mt-1">Import customers, boats, locations, jobs and tasks from Excel</p>
      </div>

      {/* Upload Section */}
      {!importResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Upload Excel File
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Import Rules:</strong> Customers are deduplicated by name. Missing customer names will be flagged for review. 
                Tasks will be created from service descriptions. All imported jobs are marked for review.
              </AlertDescription>
            </Alert>

            <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center hover:border-blue-400 transition-colors">
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                className="hidden"
                id="excel-upload"
              />
              <label htmlFor="excel-upload" className="cursor-pointer">
                <Upload className="h-12 w-12 mx-auto text-slate-400 mb-4" />
                <p className="text-lg font-medium text-slate-700">
                  {file ? file.name : 'Click to upload Excel file'}
                </p>
                <p className="text-sm text-slate-500 mt-2">
                  Supports .xlsx and .xls formats
                </p>
              </label>
            </div>

            {file && (
              <Button 
                onClick={executeImport}
                disabled={importing}
                className="w-full bg-blue-600 hover:bg-blue-700"
                size="lg"
              >
                {importing ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Start Import
                  </>
                )}
              </Button>
            )}

            {importing && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-slate-600">
                  <span>{currentStep}</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Import Results */}
      {importResult && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card>
              <CardContent className="p-6 text-center">
                <Users className="h-8 w-8 mx-auto text-blue-500 mb-2" />
                <p className="text-2xl font-bold text-slate-900">{importResult.summary.customersCreated}</p>
                <p className="text-sm text-slate-500">Customers</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 text-center">
                <Ship className="h-8 w-8 mx-auto text-cyan-500 mb-2" />
                <p className="text-2xl font-bold text-slate-900">{importResult.summary.boatsCreated}</p>
                <p className="text-sm text-slate-500">Boats</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 text-center">
                <MapPin className="h-8 w-8 mx-auto text-emerald-500 mb-2" />
                <p className="text-2xl font-bold text-slate-900">{importResult.summary.locationsCreated}</p>
                <p className="text-sm text-slate-500">Locations</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 text-center">
                <Briefcase className="h-8 w-8 mx-auto text-amber-500 mb-2" />
                <p className="text-2xl font-bold text-slate-900">{importResult.summary.jobsCreated}</p>
                <p className="text-sm text-slate-500">Jobs</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 text-center">
                <ListChecks className="h-8 w-8 mx-auto text-purple-500 mb-2" />
                <p className="text-2xl font-bold text-slate-900">{importResult.summary.tasksCreated}</p>
                <p className="text-sm text-slate-500">Tasks</p>
              </CardContent>
            </Card>
          </div>

          {/* Review List */}
          {importResult.reviewList.length > 0 && (
            <Card className="border-amber-200 bg-amber-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-800">
                  <AlertTriangle className="h-5 w-5" />
                  Review Required ({importResult.reviewList.length} items)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-white rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Row</TableHead>
                        <TableHead>Problem</TableHead>
                        <TableHead>Suggestion</TableHead>
                        <TableHead>Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importResult.reviewList.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">#{item.row}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-amber-100 text-amber-800">
                              {item.problem}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-slate-600">{item.suggestion}</TableCell>
                          <TableCell className="text-xs text-slate-500 max-w-xs truncate">
                            {JSON.stringify(item.data).slice(0, 50)}...
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Success Message */}
          <Alert className="border-emerald-200 bg-emerald-50">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <AlertDescription className="text-emerald-800">
              <strong>Import Complete!</strong> Data has been successfully imported and is ready for review. 
              All imported jobs are marked as "New" and ready to be scheduled.
            </AlertDescription>
          </Alert>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <Button onClick={() => { setImportResult(null); setFile(null); }} variant="outline">
              Import Another File
            </Button>
            <Button asChild className="bg-blue-600 hover:bg-blue-700">
              <Link to={createPageUrl('Jobs')}>
                View Imported Jobs
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}