import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import * as XLSX from 'xlsx';
import FileUploadStep from '../components/taskimport/FileUploadStep';
import PreviewStep from '../components/taskimport/PreviewStep';
import MappingStep from '../components/taskimport/MappingStep';
import ConfigStep from '../components/taskimport/ConfigStep';
import ValidationStep from '../components/taskimport/ValidationStep';
import ImportSummary from '../components/taskimport/ImportSummary';

const STEPS = [
  { id: 1, name: 'Upload', description: 'Upload Excel file' },
  { id: 2, name: 'Preview', description: 'Review data' },
  { id: 3, name: 'Mapping', description: 'Map columns' },
  { id: 4, name: 'Configure', description: 'Set defaults' },
  { id: 5, name: 'Validate', description: 'Dry run check' },
  { id: 6, name: 'Import', description: 'Execute import' },
  { id: 7, name: 'Summary', description: 'Review results' }
];

export default function TasklistImport() {
  const [currentStep, setCurrentStep] = useState(1);
  const [excelData, setExcelData] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [columnMapping, setColumnMapping] = useState({});
  const [config, setConfig] = useState({
    importMode: 'single-job', // 'grouped-jobs' or 'single-job'
    parentJobId: null,
    newJobTitle: 'Winter Service',
    jobStatus: 'Imported – Review Required',
    taskStatus: 'Draft',
    workOrderDateMode: 'column', // 'single', 'priority-based', 'column' - for scheduled_date
    workOrderBaseDate: null,
    workOrderOffsets: { High: 2, Medium: 5, Low: 10 },
    dryRunOnly: false
  });
  const [validationResults, setValidationResults] = useState(null);
  const [importResults, setImportResults] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);

  const handleFileUpload = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
      
      if (jsonData.length > 0) {
        const detectedHeaders = Object.keys(jsonData[0]);
        setHeaders(detectedHeaders);
        setExcelData(jsonData);
        
        // Auto-map columns based on expected names
        const autoMapping = autoMapColumns(detectedHeaders);
        setColumnMapping(autoMapping);
        
        setCurrentStep(2);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const autoMapColumns = (detectedHeaders) => {
    const mapping = {};
    const expectedColumns = {
      'Project Name': 'projectName',
      'Customer Type': 'customerType',
      'Customer Name': 'customerName',
      'Boat Type / Yacht Model': 'boatModel',
      'Boat Length (m)': 'boatLength',
      'Location / Marina': 'locationMarina',
      'Service Area': 'serviceArea',
      'Subproject / Module': 'module',
      'Task ID': 'taskId',
      'Task Title': 'taskTitle',
      'Task Description': 'taskDescription',
      'Category': 'category',
      'Required Qualification': 'requiredQualification',
      'Time Required (hrs)': 'estimatedHours',
      'Material Required': 'materialRequired',
      'Material Description': 'materialDescription',
      'Dependencies': 'dependencies',
      'Priority': 'priority',
      'Work Location': 'workLocation',
      'Risk / Special Notes': 'riskNotes',
      'Acceptance Required': 'acceptanceRequired',
      'Acceptance By': 'acceptanceBy',
      'Billing Type': 'billingType',
      'Assumption / Uncertainty': 'assumptionUncertainty',
      'Assigned Person': 'assignedPerson',
      'Due Date': 'dueDate'
    };

    detectedHeaders.forEach(header => {
      if (expectedColumns[header]) {
        mapping[header] = expectedColumns[header];
      }
    });

    return mapping;
  };

  const runValidation = async () => {
    setIsProcessing(true);
    try {
      const results = await validateImportData(excelData, columnMapping, config);
      setValidationResults(results);
      setCurrentStep(5);
    } catch (error) {
      console.error('Validation error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const validateImportData = async (data, mapping, cfg) => {
    const errors = [];
    const warnings = [];
    const jobGroups = {};
    
    // Load existing data for deduplication
    const [customers, boats, locations, technicians] = await Promise.all([
      base44.entities.Customer.list(),
      base44.entities.Boat.list(),
      base44.entities.Location.list(),
      base44.entities.Technician.list()
    ]);

    data.forEach((row, idx) => {
      const rowNum = idx + 2; // Excel row (1-indexed + header)
      
      // Hard STOP validations
      const customerName = row[getHeaderByMapping(mapping, 'customerName')]?.trim();
      const taskTitle = row[getHeaderByMapping(mapping, 'taskTitle')]?.trim();
      const taskDesc = row[getHeaderByMapping(mapping, 'taskDescription')]?.trim();
      
      if (!customerName) {
        errors.push({ row: rowNum, field: 'Customer Name', message: 'Required field is empty' });
      }
      
      if (!taskTitle && !taskDesc) {
        errors.push({ row: rowNum, field: 'Task Title/Description', message: 'Both title and description are empty' });
      }

      // Group jobs
      const projectName = row[getHeaderByMapping(mapping, 'projectName')]?.trim() || '';
      const boatModel = row[getHeaderByMapping(mapping, 'boatModel')]?.trim() || '';
      const locationMarina = row[getHeaderByMapping(mapping, 'locationMarina')]?.trim() || '';
      const serviceArea = row[getHeaderByMapping(mapping, 'serviceArea')]?.trim() || '';
      const module = row[getHeaderByMapping(mapping, 'module')]?.trim() || '';
      
      const groupKey = `${projectName}|${customerName}|${boatModel}|${locationMarina}|${serviceArea}|${module}`;
      
      if (!jobGroups[groupKey]) {
        jobGroups[groupKey] = {
          projectName,
          customerName,
          customerType: row[getHeaderByMapping(mapping, 'customerType')]?.trim() || 'Private',
          boatModel,
          boatLength: row[getHeaderByMapping(mapping, 'boatLength')],
          locationMarina,
          serviceArea,
          module,
          tasks: []
        };
      }
      
      jobGroups[groupKey].tasks.push({ rowNum, data: row });

      // Soft validations (warnings) - these don't block import
      if (!locationMarina || locationMarina.toLowerCase() === 'unknown') {
        warnings.push({ row: rowNum, field: 'Location', message: 'Location is empty or unknown - will be left blank' });
      }

      const assignedPerson = row[getHeaderByMapping(mapping, 'assignedPerson')]?.trim();
      if (assignedPerson && !technicians.find(t => 
        `${t.first_name} ${t.last_name}`.toLowerCase() === assignedPerson.toLowerCase()
      )) {
        warnings.push({ row: rowNum, field: 'Assigned Person', message: `Person "${assignedPerson}" not found - task will be unassigned` });
      }

      const priority = row[getHeaderByMapping(mapping, 'priority')]?.trim();
      if (priority && !['High', 'Medium', 'Low'].includes(priority)) {
        warnings.push({ row: rowNum, field: 'Priority', message: `Invalid priority "${priority}", will default to Medium` });
      }

      const estimatedHours = row[getHeaderByMapping(mapping, 'estimatedHours')];
      if (estimatedHours && isNaN(parseFloat(estimatedHours))) {
        warnings.push({ row: rowNum, field: 'Time Required', message: `Non-numeric value "${estimatedHours}"` });
      }
    });

    // Check for duplicate Task IDs within same job group
    Object.values(jobGroups).forEach(group => {
      const taskIds = {};
      group.tasks.forEach(({ rowNum, data }) => {
        const taskId = data[getHeaderByMapping(mapping, 'taskId')]?.trim();
        if (taskId) {
          if (taskIds[taskId]) {
            errors.push({ 
              row: rowNum, 
              field: 'Task ID', 
              message: `Duplicate Task ID "${taskId}" in same job group (also on row ${taskIds[taskId]})` 
            });
          }
          taskIds[taskId] = rowNum;
        }
      });
    });

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      jobCount: Object.keys(jobGroups).length,
      taskCount: data.length,
      jobGroups
    };
  };

  const getHeaderByMapping = (mapping, targetField) => {
    return Object.keys(mapping).find(key => mapping[key] === targetField) || '';
  };

  const executeImport = async () => {
    if (!validationResults || !validationResults.valid) {
      return;
    }

    if (config.dryRunOnly) {
      setError('Dry Run Mode is enabled. Please disable it in Step 4 to perform actual import.');
      return;
    }

    setIsProcessing(true);
    setCurrentStep(6);
    setError(null);

    try {
      const results = await performImport(validationResults.jobGroups, columnMapping, config);
      setImportResults(results);
      setCurrentStep(7);
    } catch (error) {
      console.error('Import error:', error);
      setError(error.message || 'Import failed. Please check console for details.');
      setCurrentStep(5);
    } finally {
      setIsProcessing(false);
    }
  };

  const performImport = async (jobGroups, mapping, cfg) => {
    const createdCustomers = [];
    const createdBoats = [];
    const createdLocations = [];
    const createdJobs = [];
    const createdTasks = [];
    const reviewList = [];

    // Load existing data
    const [existingCustomers, existingBoats, existingLocations, technicians, existingJobs] = await Promise.all([
      base44.entities.Customer.list(),
      base44.entities.Boat.list(),
      base44.entities.Location.list(),
      base44.entities.Technician.list(),
      base44.entities.Job.list()
    ]);

    // SINGLE JOB MODE: Create or use one parent job for all tasks
    if (cfg.importMode === 'single-job') {
      let parentJob;
      
      if (cfg.parentJobId) {
        // Use existing job
        parentJob = existingJobs.find(j => j.id === cfg.parentJobId);
        if (!parentJob) {
          throw new Error('Selected parent job not found');
        }
      } else {
        // Create new parent job - need to ensure we have customer and boat
        // Get first customer from the data
        const firstGroup = Object.values(jobGroups)[0];
        let customer = existingCustomers.find(c => 
          c.last_name?.toLowerCase() === firstGroup.customerName?.toLowerCase() ||
          c.company_name?.toLowerCase() === firstGroup.customerName?.toLowerCase()
        );

        if (!customer && firstGroup.customerName) {
          const isCompany = firstGroup.customerType === 'Business' || firstGroup.customerType === 'Charter Company';
          const nameParts = firstGroup.customerName.split(' ');
          customer = await base44.entities.Customer.create({
            [isCompany ? 'company_name' : 'last_name']: firstGroup.customerName,
            first_name: !isCompany && nameParts.length > 1 ? nameParts.slice(0, -1).join(' ') : '',
            email: `import-${Date.now()}-${Math.random().toString(36).substr(2, 9)}@temp.placeholder`,
            customer_type: firstGroup.customerType || 'Private',
            status: 'Active'
          });
          createdCustomers.push(customer);
        }

        // Create a placeholder boat for the parent job
        let boat = null;
        if (customer) {
          boat = await base44.entities.Boat.create({
            customer_id: customer.id,
            vessel_name: 'Multiple Boats - See Tasks',
            model: 'Various',
            status: 'Active'
          });
          createdBoats.push(boat);
        }

        if (!customer || !boat) {
          throw new Error('Failed to create customer or boat for parent job');
        }

        parentJob = await base44.entities.Job.create({
          customer_id: customer.id,
          boat_id: boat.id,
          location_id: null,
          title: cfg.newJobTitle || 'Imported Service',
          description: 'Excel import - tasks grouped under main job',
          job_type: 'Mobile Service',
          service_category: 'General Service',
          status: cfg.jobStatus,
          priority: 'Normal',
          internal_notes: 'Created via Excel import'
        });
        createdJobs.push(parentJob);
      }

      // Import all rows as tasks under this parent job
      for (const [groupKey, group] of Object.entries(jobGroups)) {
        for (const { rowNum, data } of group.tasks) {
          const taskTitle = data[getHeaderByMapping(mapping, 'taskTitle')]?.trim();
          const taskDesc = data[getHeaderByMapping(mapping, 'taskDescription')]?.trim();
          const taskId = data[getHeaderByMapping(mapping, 'taskId')]?.trim();
          const priority = data[getHeaderByMapping(mapping, 'priority')]?.trim() || 'Medium';
          const estimatedHours = parseFloat(data[getHeaderByMapping(mapping, 'estimatedHours')]) || null;
          const assignedPerson = data[getHeaderByMapping(mapping, 'assignedPerson')]?.trim();

          // Build context information
          const contextInfo = [
            group.customerName ? `Customer: ${group.customerName}` : '',
            group.boatModel ? `Boat: ${group.boatModel}` : '',
            group.locationMarina ? `Location: ${group.locationMarina}` : '',
            group.serviceArea ? `Service Area: ${group.serviceArea}` : '',
            group.module ? `Module: ${group.module}` : '',
            taskId ? `Task ID: ${taskId}` : ''
          ].filter(Boolean).join(' | ');

          // Calculate due date
          let dueDate = null;
          if (cfg.dueDateMode === 'column') {
            const dueDateStr = data[getHeaderByMapping(mapping, 'dueDate')];
            if (dueDateStr) dueDate = new Date(dueDateStr).toISOString().split('T')[0];
          } else if (cfg.dueDateMode === 'single' && cfg.baseDueDate) {
            dueDate = cfg.baseDueDate;
          } else if (cfg.dueDateMode === 'priority-based' && cfg.baseDueDate) {
            const baseDate = new Date(cfg.baseDueDate);
            const offset = cfg.priorityOffsets[priority] || 5;
            baseDate.setDate(baseDate.getDate() + offset);
            dueDate = baseDate.toISOString().split('T')[0];
          }

          // Find assigned technician
          let assignedTechId = null;
          if (assignedPerson) {
            const tech = technicians.find(t => 
              `${t.first_name} ${t.last_name}`.toLowerCase() === assignedPerson.toLowerCase()
            );
            if (tech) {
              assignedTechId = tech.id;
            } else {
              reviewList.push({
                jobId: parentJob.id,
                taskTitle: taskTitle || taskDesc,
                issue: `Assigned person "${assignedPerson}" not found`,
                rowNum
              });
            }
          }

          // Build full description with context
          const fullDescription = [
            `[${contextInfo}]`,
            '',
            taskDesc || '',
            '',
            data[getHeaderByMapping(mapping, 'category')] ? `Category: ${data[getHeaderByMapping(mapping, 'category')]}` : '',
            data[getHeaderByMapping(mapping, 'requiredQualification')] ? `Qualification: ${data[getHeaderByMapping(mapping, 'requiredQualification')]}` : '',
            data[getHeaderByMapping(mapping, 'materialRequired')] ? `Materials: ${data[getHeaderByMapping(mapping, 'materialRequired')]}` : '',
            data[getHeaderByMapping(mapping, 'materialDescription')] ? `Material Details: ${data[getHeaderByMapping(mapping, 'materialDescription')]}` : '',
            data[getHeaderByMapping(mapping, 'dependencies')] ? `Dependencies: ${data[getHeaderByMapping(mapping, 'dependencies')]}` : '',
            data[getHeaderByMapping(mapping, 'workLocation')] ? `Work Location: ${data[getHeaderByMapping(mapping, 'workLocation')]}` : '',
            data[getHeaderByMapping(mapping, 'riskNotes')] ? `Risk Notes: ${data[getHeaderByMapping(mapping, 'riskNotes')]}` : '',
            data[getHeaderByMapping(mapping, 'billingType')] ? `Billing: ${data[getHeaderByMapping(mapping, 'billingType')]}` : '',
            data[getHeaderByMapping(mapping, 'assumptionUncertainty')] ? `Assumptions: ${data[getHeaderByMapping(mapping, 'assumptionUncertainty')]}` : ''
          ].filter(Boolean).join('\n');

          // Create work order
          const workOrder = await base44.entities.WorkOrder.create({
            job_id: parentJob.id,
            title: taskTitle || taskDesc || `Task from row ${rowNum}`,
            description: fullDescription,
            status: cfg.taskStatus,
            assigned_technicians: assignedTechId ? [assignedTechId] : [],
            estimated_duration_hours: estimatedHours,
            scheduled_date: dueDate
          });

          const task = await base44.entities.Task.create({
            work_order_id: workOrder.id,
            title: taskTitle || taskDesc || `Task from row ${rowNum}`,
            description: fullDescription,
            status: 'Not Started',
            estimated_minutes: estimatedHours ? Math.round(estimatedHours * 60) : null,
            notes: data[getHeaderByMapping(mapping, 'riskNotes')] || ''
          });
          
          createdTasks.push(task);
        }
      }

      return {
        createdCustomers,
        createdBoats,
        createdLocations,
        createdJobs,
        createdTasks,
        reviewList,
        parentJobId: parentJob.id
      };
    }

    // GROUPED JOBS MODE: Original behavior
    for (const [groupKey, group] of Object.entries(jobGroups)) {
      // Find or create customer
      let customer = existingCustomers.find(c => 
        c.last_name?.toLowerCase() === group.customerName?.toLowerCase() ||
        c.company_name?.toLowerCase() === group.customerName?.toLowerCase()
      );

      if (!customer && group.customerName) {
        const isCompany = group.customerType === 'Business' || group.customerType === 'Charter Company';
        const nameParts = group.customerName.split(' ');
        customer = await base44.entities.Customer.create({
          [isCompany ? 'company_name' : 'last_name']: group.customerName,
          first_name: !isCompany && nameParts.length > 1 ? nameParts.slice(0, -1).join(' ') : '',
          email: `import-${Date.now()}-${Math.random().toString(36).substr(2, 9)}@temp.placeholder`,
          customer_type: group.customerType || 'Private',
          status: 'Active'
        });
        createdCustomers.push(customer);
      }

      // Find or create location - only if name exists
      let location = null;
      if (group.locationMarina && group.locationMarina.toLowerCase() !== 'unknown') {
        location = existingLocations.find(l => 
          l.name?.toLowerCase() === group.locationMarina?.toLowerCase()
        );

        if (!location) {
          location = await base44.entities.Location.create({
            name: group.locationMarina,
            location_type: 'Marina',
            status: 'Active'
          });
          createdLocations.push(location);
        }
      }

      // Find or create boat - only if model exists
      let boat = null;
      if (customer && group.boatModel) {
        boat = existingBoats.find(b => 
          b.customer_id === customer.id && 
          b.model?.toLowerCase() === group.boatModel?.toLowerCase()
        );

        if (!boat) {
          boat = await base44.entities.Boat.create({
            customer_id: customer.id,
            vessel_name: group.boatModel,
            model: group.boatModel,
            length_m: parseFloat(group.boatLength) || null,
            current_location_id: location?.id || null,
            status: 'Active'
          });
          createdBoats.push(boat);
        }
      }

      // Create Job - skip if no customer
      if (!customer) {
        continue;
      }

      const jobTitleParts = [
        'Service',
        group.projectName || '',
        group.boatModel || '',
        group.serviceArea || '',
        group.module || ''
      ].filter(Boolean);
      const jobTitle = jobTitleParts.join(' – ');
      
      const jobNotes = [
        group.serviceArea ? `Service Area: ${group.serviceArea}` : '',
        group.module ? `Module: ${group.module}` : ''
      ].filter(Boolean).join('\n');

      const job = await base44.entities.Job.create({
        customer_id: customer.id,
        boat_id: boat?.id || null,
        location_id: location?.id || null,
        title: jobTitle || 'Imported Service',
        description: jobNotes || '',
        job_type: 'Mobile Service',
        service_category: 'General Service',
        status: cfg.jobStatus,
        priority: 'Normal',
        internal_notes: jobNotes
      });
      createdJobs.push(job);

      // Create Tasks for this job
      for (const { rowNum, data } of group.tasks) {
        const taskTitle = data[getHeaderByMapping(mapping, 'taskTitle')]?.trim();
        const taskDesc = data[getHeaderByMapping(mapping, 'taskDescription')]?.trim();
        const taskId = data[getHeaderByMapping(mapping, 'taskId')]?.trim();
        const priority = data[getHeaderByMapping(mapping, 'priority')]?.trim() || 'Medium';
        const estimatedHours = parseFloat(data[getHeaderByMapping(mapping, 'estimatedHours')]) || null;
        const assignedPerson = data[getHeaderByMapping(mapping, 'assignedPerson')]?.trim();

        // Calculate due date
        let dueDate = null;
        if (cfg.dueDateMode === 'column') {
          const dueDateStr = data[getHeaderByMapping(mapping, 'dueDate')];
          if (dueDateStr) dueDate = new Date(dueDateStr).toISOString().split('T')[0];
        } else if (cfg.dueDateMode === 'single' && cfg.baseDueDate) {
          dueDate = cfg.baseDueDate;
        } else if (cfg.dueDateMode === 'priority-based' && cfg.baseDueDate) {
          const baseDate = new Date(cfg.baseDueDate);
          const offset = cfg.priorityOffsets[priority] || 5;
          baseDate.setDate(baseDate.getDate() + offset);
          dueDate = baseDate.toISOString().split('T')[0];
        }

        // Find assigned technician
        let assignedTechId = null;
        if (assignedPerson) {
          const tech = technicians.find(t => 
            `${t.first_name} ${t.last_name}`.toLowerCase() === assignedPerson.toLowerCase()
          );
          if (tech) {
            assignedTechId = tech.id;
          } else {
            reviewList.push({
              jobId: job.id,
              taskTitle: taskTitle || taskDesc,
              issue: `Assigned person "${assignedPerson}" not found`,
              rowNum
            });
          }
        }

        // Create work order first (required for Task)
        const workOrder = await base44.entities.WorkOrder.create({
          job_id: job.id,
          title: taskTitle || taskDesc || `Task from row ${rowNum}`,
          description: taskDesc || '',
          status: cfg.taskStatus,
          assigned_technicians: assignedTechId ? [assignedTechId] : [],
          estimated_duration_hours: estimatedHours,
          scheduled_date: dueDate
        });

        const task = await base44.entities.Task.create({
          work_order_id: workOrder.id,
          title: taskTitle || taskDesc || `Task from row ${rowNum}`,
          description: [
            taskDesc,
            taskId ? `Task ID: ${taskId}` : '',
            data[getHeaderByMapping(mapping, 'category')] ? `Category: ${data[getHeaderByMapping(mapping, 'category')]}` : '',
            data[getHeaderByMapping(mapping, 'requiredQualification')] ? `Qualification: ${data[getHeaderByMapping(mapping, 'requiredQualification')]}` : '',
            data[getHeaderByMapping(mapping, 'materialRequired')] ? `Materials: ${data[getHeaderByMapping(mapping, 'materialRequired')]}` : '',
            data[getHeaderByMapping(mapping, 'materialDescription')] ? `Material Details: ${data[getHeaderByMapping(mapping, 'materialDescription')]}` : '',
            data[getHeaderByMapping(mapping, 'dependencies')] ? `Dependencies: ${data[getHeaderByMapping(mapping, 'dependencies')]}` : '',
            data[getHeaderByMapping(mapping, 'workLocation')] ? `Work Location: ${data[getHeaderByMapping(mapping, 'workLocation')]}` : '',
            data[getHeaderByMapping(mapping, 'riskNotes')] ? `Risk Notes: ${data[getHeaderByMapping(mapping, 'riskNotes')]}` : '',
            data[getHeaderByMapping(mapping, 'billingType')] ? `Billing: ${data[getHeaderByMapping(mapping, 'billingType')]}` : '',
            data[getHeaderByMapping(mapping, 'assumptionUncertainty')] ? `Assumptions: ${data[getHeaderByMapping(mapping, 'assumptionUncertainty')]}` : ''
          ].filter(Boolean).join('\n\n'),
          status: 'Not Started',
          estimated_minutes: estimatedHours ? Math.round(estimatedHours * 60) : null,
          notes: data[getHeaderByMapping(mapping, 'riskNotes')] || ''
        });
        
        createdTasks.push(task);
      }
    }

    return {
      createdCustomers,
      createdBoats,
      createdLocations,
      createdJobs,
      createdTasks,
      reviewList,
      parentJobId: null
    };
  };

  const resetImport = () => {
    setCurrentStep(1);
    setExcelData(null);
    setHeaders([]);
    setColumnMapping({});
    setValidationResults(null);
    setImportResults(null);
    setConfig({
      importMode: 'single-job',
      parentJobId: null,
      newJobTitle: 'Winter Service',
      jobStatus: 'Imported – Review Required',
      taskStatus: 'Draft',
      dueDateMode: 'single',
      baseDueDate: null,
      priorityOffsets: { High: 2, Medium: 5, Low: 10 },
      dryRunOnly: false
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <FileSpreadsheet className="w-8 h-8 text-blue-600" />
            Tasklist Import (Jobs & Tasks)
          </h1>
          <p className="text-gray-600 mt-2">
            Import structured task lists from Excel to create Jobs and Tasks
          </p>
        </div>

        {/* Progress Steps */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              {STEPS.map((step, idx) => (
                <div key={step.id} className="flex items-center flex-1">
                  <div className="flex flex-col items-center flex-1">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                      currentStep > step.id ? 'bg-green-500 text-white' :
                      currentStep === step.id ? 'bg-blue-600 text-white' :
                      'bg-gray-200 text-gray-500'
                    }`}>
                      {currentStep > step.id ? <CheckCircle2 className="w-5 h-5" /> : step.id}
                    </div>
                    <div className="text-xs font-medium mt-2 text-center">{step.name}</div>
                  </div>
                  {idx < STEPS.length - 1 && (
                    <div className={`h-1 flex-1 mx-2 ${
                      currentStep > step.id ? 'bg-green-500' : 'bg-gray-200'
                    }`} />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Step Content */}
        {currentStep === 1 && (
          <FileUploadStep onUpload={handleFileUpload} />
        )}

        {currentStep === 2 && (
          <PreviewStep 
            data={excelData} 
            headers={headers}
            onNext={() => setCurrentStep(3)}
            onBack={() => setCurrentStep(1)}
          />
        )}

        {currentStep === 3 && (
          <MappingStep 
            headers={headers}
            mapping={columnMapping}
            onMappingChange={setColumnMapping}
            onNext={() => setCurrentStep(4)}
            onBack={() => setCurrentStep(2)}
          />
        )}

        {currentStep === 4 && (
          <ConfigStep 
            config={config}
            onConfigChange={setConfig}
            onNext={runValidation}
            onBack={() => setCurrentStep(3)}
            isProcessing={isProcessing}
          />
        )}

        {currentStep === 5 && validationResults && (
          <>
            {error && (
              <Alert className="mb-4 bg-red-50 border-red-200">
                <AlertCircle className="w-4 h-4 text-red-600" />
                <AlertDescription className="text-red-800">{error}</AlertDescription>
              </Alert>
            )}
            <ValidationStep 
              results={validationResults}
              onExecute={executeImport}
              onBack={() => setCurrentStep(4)}
              isProcessing={isProcessing}
              dryRunMode={config.dryRunOnly}
            />
          </>
        )}

        {currentStep === 6 && (
          <Card>
            <CardHeader>
              <CardTitle>Importing...</CardTitle>
              <CardDescription>Creating jobs and tasks, please wait</CardDescription>
            </CardHeader>
            <CardContent>
              <Progress value={undefined} className="w-full" />
            </CardContent>
          </Card>
        )}

        {currentStep === 7 && importResults && (
          <ImportSummary 
            results={importResults}
            onStartNew={resetImport}
          />
        )}
      </div>
    </div>
  );
}