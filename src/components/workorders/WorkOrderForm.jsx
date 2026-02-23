import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Plus, Check, ChevronsUpDown } from 'lucide-react';
import TemplateFromCreation from './TemplateFromCreation';
import AITaskSuggestions from './AITaskSuggestions';

export default function WorkOrderForm({ workOrder, jobs, technicians, customers, boats, preselectedJobId, preselectedCustomerId, onSave, onCancel }) {
  const [formData, setFormData] = useState({
     job_id: workOrder?.job_id || preselectedJobId || '',
     title: workOrder?.title || '',
     description: workOrder?.description || '',
     service_area: workOrder?.service_area || '',
     scheduled_date: workOrder?.scheduled_date || '',
     scheduled_end_date: workOrder?.scheduled_end_date || '',
     scheduled_start_time: workOrder?.scheduled_start_time || '08:00',
     scheduled_end_time: workOrder?.scheduled_end_time || '',
    estimated_duration_hours: workOrder?.estimated_duration_hours || '',
    assigned_technicians: workOrder?.assigned_technicians || [],
    status: workOrder?.status || 'Draft',
    safety_notes: workOrder?.safety_notes || '',
    internal_notes: workOrder?.internal_notes || '',
    billable: workOrder?.billable !== false
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [suggestedTasks, setSuggestedTasks] = useState([]);
  const [suggestedOrgTasks, setSuggestedOrgTasks] = useState([]);
  const [suggestedExecTasks, setSuggestedExecTasks] = useState([]);
  const [splitWorkOrdersEnabled, setSplitWorkOrdersEnabled] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState(() => {
    if (preselectedCustomerId) return preselectedCustomerId;
    if (preselectedJobId) {
      const job = jobs.find(j => j.id === preselectedJobId);
      return job?.customer_id || '';
    }
    return '';
  });
  const [selectedBoatId, setSelectedBoatId] = useState(() => {
    if (preselectedJobId) {
      const job = jobs.find(j => j.id === preselectedJobId);
      return job?.boat_id || '';
    }
    return '';
  });
  const [showNewProjectForm, setShowNewProjectForm] = useState(false);
  const [newProjectData, setNewProjectData] = useState({ title: '', description: '' });
  const [customerPopoverOpen, setCustomerPopoverOpen] = useState(false);

  const getProjectLabel = (project) => {
    const customer = customers.find(c => c.id === project.customer_id);
    const boat = boats.find(b => b.id === project.boat_id);
    const customerName = customer?.company_name || `${customer?.first_name || ''} ${customer?.last_name || ''}`.trim();
    return `${project.title} (${customerName} - ${boat?.vessel_name || 'Unknown'})`;
  };

  const getCustomerDisplayName = (customer) => {
    if (!customer) return 'Unknown';
    if (customer.company_name) return customer.company_name;
    return `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || 'Unknown';
  };

  const activeTechnicians = technicians.filter(t => t.status === 'Active');

  const customerBoats = useMemo(() => {
    if (!selectedCustomerId) return [];
    return boats.filter(b => b.customer_id === selectedCustomerId);
  }, [selectedCustomerId, boats]);

  const customerProjects = useMemo(() => {
    if (!selectedCustomerId) return [];
    return jobs.filter(j => j.customer_id === selectedCustomerId && !['Completed', 'Invoiced', 'Cancelled'].includes(j.status));
  }, [selectedCustomerId, jobs]);



  const isProjectPrefilled = !!preselectedJobId;

  const handleCreateNewProject = async () => {
    if (!newProjectData.title?.trim()) {
      toast.error('Project title is required');
      return;
    }
    if (!selectedCustomerId) {
      toast.error('Customer must be selected');
      return;
    }
    if (!selectedBoatId) {
      toast.error('Boat must be selected');
      return;
    }

    try {
      const projectNumber = `P${Date.now().toString().slice(-6)}`;
      const newProject = await base44.entities.Job.create({
        customer_id: selectedCustomerId,
        boat_id: selectedBoatId,
        title: newProjectData.title,
        description: newProjectData.description || '',
        job_number: projectNumber,
        job_type: 'Mobile Service',
        service_category: 'General Service',
        priority: 'Normal',
        status: 'New',
        intake_source: 'Website',
        intake_date: new Date().toISOString()
      });
      
      setFormData(prev => ({ ...prev, job_id: newProject.id }));
      setShowNewProjectForm(false);
      setNewProjectData({ title: '', description: '' });
      toast.success('Project created');
    } catch (err) {
      console.error('Error creating project:', err);
      toast.error('Failed to create project');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setSaving(true);
    
    try {
      // Validate required fields
      const errors = {};
      if (!formData.job_id) {
        errors.job_id = 'Required';
      }
      if (!formData.title?.trim()) {
        errors.title = 'Required';
      }
      if (!formData.scheduled_date) {
        errors.scheduled_date = 'Required';
      }

      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        setError('Please fill all required fields.');
        setSaving(false);
        return;
      }

      // Clean numeric fields - convert empty strings to null
      const cleanedData = { ...formData };
      const numericFields = ['estimated_duration_hours', 'travel_time_minutes', 'work_time_minutes', 'break_time_minutes', 'mileage_km', 'sort_index'];
      numericFields.forEach(field => {
        if (cleanedData[field] === '' || cleanedData[field] === undefined) {
          cleanedData[field] = null;
        }
      });
      
      console.log('Submitting work order:', { cleanedData, selectedTemplateId, suggestedTasks, splitWorkOrdersEnabled });
      
      await onSave(cleanedData, selectedTemplateId, suggestedTasks, {
        splitMode: splitWorkOrdersEnabled,
        orgTasks: suggestedOrgTasks,
        execTasks: suggestedExecTasks
      });
      // Success toast and navigation handled by parent
      } catch (err) {
       console.error('Work order save error:', err);
       const errorMsg = err.message || 'Failed to save work order. Please check all required fields.';
       setError(errorMsg);
       toast.error(errorMsg);
       setSaving(false);
      }
  };

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAddSuggestedTasks = (taskData) => {
    // Handle both old format (array) and new format (object with org/exec split)
    if (Array.isArray(taskData)) {
      setSuggestedTasks(taskData);
      setSuggestedOrgTasks([]);
      setSuggestedExecTasks([]);
      setSplitWorkOrdersEnabled(false);
    } else {
      const orgTasks = taskData.organizationTasks || [];
      const execTasks = taskData.executionTasks || [];
      setSuggestedOrgTasks(orgTasks);
      setSuggestedExecTasks(execTasks);
      setSuggestedTasks([...orgTasks, ...execTasks]);
      // Auto-enable split if both streams exist
      setSplitWorkOrdersEnabled(orgTasks.length > 0 && execTasks.length > 0);
    }
  };

  const handleNotesUpdate = (field, value) => {
    updateField(field, value);
  };

  const toggleTechnician = (techId) => {
    setFormData(prev => {
      const current = prev.assigned_technicians || [];
      if (current.includes(techId)) {
        return { ...prev, assigned_technicians: current.filter(id => id !== techId) };
      } else {
        return { ...prev, assigned_technicians: [...current, techId] };
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Creation Mode - Only show for new work orders */}
      {!workOrder && (
        <div className="pb-2">
          <TemplateFromCreation
            onTemplateChange={setSelectedTemplateId}
            selectedTemplateId={selectedTemplateId}
            setTitle={(title) => updateField('title', title)}
          />
        </div>
      )}

      {/* Customer Selection - Only if not prefilled */}
      {!isProjectPrefilled && (
        <div className="space-y-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
          <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wide">Customer Context</h3>
          
          <div className="space-y-2">
            <Label className="text-sm font-semibold">
              Customer <span className="text-red-600">*</span>
            </Label>
            <Popover open={customerPopoverOpen} onOpenChange={setCustomerPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={customerPopoverOpen}
                  className="w-full justify-between h-9"
                >
                  {selectedCustomerId
                    ? getCustomerDisplayName(customers.find((c) => c.id === selectedCustomerId))
                    : "Search customer by name or email..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent 
                className="w-[400px] p-0" 
                side="bottom" 
                align="start" 
                sideOffset={4}
                avoidCollisions={false}
              >
                <Command>
                  <CommandInput placeholder="Search customer..." />
                  <CommandEmpty>No customer found.</CommandEmpty>
                  <CommandGroup className="max-h-[300px] overflow-auto">
                    {customers.map((customer) => (
                      <CommandItem
                        key={customer.id}
                        value={`${getCustomerDisplayName(customer)} ${customer.email || ''}`}
                        onSelect={() => {
                          setSelectedCustomerId(customer.id);
                          setSelectedBoatId('');
                          setFormData(prev => ({ ...prev, job_id: '' }));
                          setCustomerPopoverOpen(false);
                        }}
                      >
                        <Check
                          className={`mr-2 h-4 w-4 ${
                            selectedCustomerId === customer.id ? "opacity-100" : "opacity-0"
                          }`}
                        />
                        <div className="flex flex-col">
                          <span className="font-medium">{getCustomerDisplayName(customer)}</span>
                          {customer.email && (
                            <span className="text-xs text-slate-500">{customer.email}</span>
                          )}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {selectedCustomerId && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold">
                Boat <span className="text-red-600">*</span>
              </Label>
              <Select value={selectedBoatId} onValueChange={setSelectedBoatId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select boat (required)" />
                </SelectTrigger>
                <SelectContent>
                  {customerBoats.map(boat => (
                    <SelectItem key={boat.id} value={boat.id}>
                      {boat.vessel_name} {boat.model && `(${boat.model})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {selectedCustomerId && selectedBoatId && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold">
                Project <span className="text-red-600">*</span>
              </Label>
              {customerProjects.length > 0 ? (
                <Select value={formData.job_id} onValueChange={(v) => updateField('job_id', v)}>
                  <SelectTrigger className={fieldErrors.job_id ? 'border-red-300 bg-red-50' : ''}>
                    <SelectValue placeholder="Select existing project (required)" />
                  </SelectTrigger>
                  <SelectContent>
                    {customerProjects.map(project => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-xs text-slate-500 italic">No active projects for this customer</p>
              )}
              
              <Button 
                type="button"
                variant="outline" 
                onClick={() => setShowNewProjectForm(true)}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create New Project
              </Button>
              {fieldErrors.job_id && <p className="text-xs text-red-600">{fieldErrors.job_id}</p>}
            </div>
          )}
        </div>
      )}

      {/* Project Selection - Read-only if prefilled */}
      {isProjectPrefilled && (
        <div className="space-y-2 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <Label>Parent Project (Pre-selected)</Label>
          <div className="text-sm font-medium text-slate-900">
            {jobs.find(j => j.id === preselectedJobId)?.title || 'Unknown Project'}
          </div>
        </div>
      )}

      {/* Title */}
      <div className="space-y-2">
        <Label className="text-sm font-semibold">
          Work Order Title <span className="text-red-600">*</span>
        </Label>
        <Input
          value={formData.title}
          onChange={(e) => updateField('title', e.target.value)}
          placeholder="What work will be done in this visit (required)"
          className={fieldErrors.title ? 'border-red-300 bg-red-50' : ''}
        />
        {fieldErrors.title && <p className="text-xs text-red-600">{fieldErrors.title}</p>}
      </div>

      {/* Service Area */}
      <div className="space-y-2">
        <Label>Service Area *</Label>
        <Select value={formData.service_area} onValueChange={(v) => updateField('service_area', v)}>
          <SelectTrigger>
            <SelectValue placeholder="Select service area" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="General Service">General Service</SelectItem>
            <SelectItem value="Mechanical">Mechanical</SelectItem>
            <SelectItem value="Electrical">Electrical</SelectItem>
            <SelectItem value="Electronics">Electronics</SelectItem>
            <SelectItem value="GRP/Bodywork">GRP/Bodywork</SelectItem>
            <SelectItem value="Sealing">Sealing</SelectItem>
            <SelectItem value="HVAC">HVAC</SelectItem>
            <SelectItem value="Rigging">Rigging</SelectItem>
            <SelectItem value="Plumbing">Plumbing</SelectItem>
            <SelectItem value="Installation">Installation</SelectItem>
            <SelectItem value="Diagnostics">Diagnostics</SelectItem>
            <SelectItem value="Other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Description & AI Suggestions */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Description</Label>
          {!workOrder && formData.job_id && (
            <AITaskSuggestions
              formData={formData}
              jobs={jobs}
              boats={boats}
              customers={customers}
              onTasksAdd={handleAddSuggestedTasks}
              onNotesUpdate={handleNotesUpdate}
            />
          )}
        </div>
        <Textarea
          value={formData.description}
          onChange={(e) => updateField('description', e.target.value)}
          placeholder="Detailed instructions for technicians..."
          rows={3}
        />
        {!workOrder && formData.job_id && (!formData.description || formData.description.split(/\s+/).filter(word => word.length > 0).length < 5) && (
          <p className="text-xs text-slate-500">💡 Add at least 5 words in description to enable AI task suggestions</p>
        )}
      </div>

      {/* Schedule - Compact Single Row */}
      <div className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr_1.5fr_1fr_1.2fr] gap-2">
        <div className="space-y-1">
          <Label className="text-xs font-semibold">
            Start Date <span className="text-red-600">*</span>
          </Label>
          <Input
            type="date"
            value={formData.scheduled_date}
            onChange={(e) => updateField('scheduled_date', e.target.value)}
            className={fieldErrors.scheduled_date ? 'border-red-300 bg-red-50 h-9' : 'h-9'}
          />
          {fieldErrors.scheduled_date && <p className="text-xs text-red-600">{fieldErrors.scheduled_date}</p>}
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Start Time</Label>
          <Input
            type="time"
            step="900"
            value={formData.scheduled_start_time}
            onChange={(e) => updateField('scheduled_start_time', e.target.value)}
            className="h-9"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">End Date</Label>
          <Input
            type="date"
            value={formData.scheduled_end_date}
            onChange={(e) => updateField('scheduled_end_date', e.target.value)}
            min={formData.scheduled_date}
            className="h-9"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">End Time</Label>
          <Input
            type="time"
            step="900"
            value={formData.scheduled_end_time}
            onChange={(e) => updateField('scheduled_end_time', e.target.value)}
            className="h-9"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs whitespace-nowrap">Est. Duration (h)</Label>
          <Input
            type="number"
            step="0.25"
            value={formData.estimated_duration_hours}
            onChange={(e) => updateField('estimated_duration_hours', parseFloat(e.target.value) || '')}
            placeholder="0"
            className="h-9"
          />
        </div>
      </div>

      {/* Status */}
      <div className="space-y-2">
        <Label>Status</Label>
        <Select value={formData.status} onValueChange={(v) => updateField('status', v)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Draft">Draft</SelectItem>
            <SelectItem value="Scheduled">Scheduled</SelectItem>
            <SelectItem value="Dispatched">Dispatched</SelectItem>
            <SelectItem value="In Transit">In Transit</SelectItem>
            <SelectItem value="In Progress">In Progress</SelectItem>
            <SelectItem value="Paused">Paused</SelectItem>
            <SelectItem value="Waiting for Parts">Waiting for Parts</SelectItem>
            <SelectItem value="Waiting for Approval">Waiting for Approval</SelectItem>
            <SelectItem value="Completed">Completed</SelectItem>
            <SelectItem value="Cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Technician Assignment */}
      <div className="space-y-3">
        <Label>Assigned Technicians</Label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {activeTechnicians.map(tech => (
            <label 
              key={tech.id}
              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                formData.assigned_technicians?.includes(tech.id) 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <Checkbox
                checked={formData.assigned_technicians?.includes(tech.id)}
                onCheckedChange={() => toggleTechnician(tech.id)}
              />
              <div>
                <p className="font-medium text-sm">{tech.first_name} {tech.last_name}</p>
                <p className="text-xs text-slate-500">{tech.role}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Safety Notes</Label>
          <Textarea
            value={formData.safety_notes}
            onChange={(e) => updateField('safety_notes', e.target.value)}
            placeholder="Safety considerations for this work..."
            rows={3}
          />
        </div>
        <div className="space-y-2">
          <Label>Internal Notes</Label>
          <Textarea
            value={formData.internal_notes}
            onChange={(e) => updateField('internal_notes', e.target.value)}
            placeholder="Internal notes for technicians..."
            rows={3}
          />
        </div>
      </div>

      {/* Suggested Tasks Preview */}
      {suggestedTasks.length > 0 && (
        <div className="space-y-3">
          {/* Split WorkOrders Toggle */}
          {suggestedOrgTasks.length > 0 && suggestedExecTasks.length > 0 && (
            <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <Checkbox
                id="split-workorders"
                checked={splitWorkOrdersEnabled}
                onCheckedChange={(v) => setSplitWorkOrdersEnabled(v)}
                className="mt-1"
              />
              <div className="flex-1">
                <label htmlFor="split-workorders" className="font-medium text-blue-900 cursor-pointer">
                  Create separate Organization + Execution WorkOrders
                </label>
                <p className="text-sm text-blue-700 mt-1">
                  {splitWorkOrdersEnabled 
                    ? `Will create 2 linked WorkOrders: ORG (${suggestedOrgTasks.length} tasks) + EXEC (${suggestedExecTasks.length} tasks)`
                    : `Will create 1 WorkOrder with ${suggestedTasks.length} mixed tasks`
                  }
                </p>
              </div>
            </div>
          )}
          
          <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
            <p className="font-medium text-purple-900 mb-2">
              📋 {suggestedTasks.length} tasks will be added after creation
            </p>
            {splitWorkOrdersEnabled && suggestedOrgTasks.length > 0 && (
              <div className="mb-3">
                <p className="text-sm font-medium text-blue-800 mb-1">Organization Tasks:</p>
                <ul className="space-y-1">
                  {suggestedOrgTasks.map((task, idx) => (
                    <li key={idx} className="text-sm text-purple-800">
                      • {task.title}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {splitWorkOrdersEnabled && suggestedExecTasks.length > 0 && (
              <div>
                <p className="text-sm font-medium text-purple-800 mb-1">Execution Tasks:</p>
                <ul className="space-y-1">
                  {suggestedExecTasks.map((task, idx) => (
                    <li key={idx} className="text-sm text-purple-800">
                      • {task.title}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {!splitWorkOrdersEnabled && (
              <ul className="space-y-1">
                {suggestedTasks.map((task, idx) => (
                  <li key={idx} className="text-sm text-purple-800">
                    • {task.title}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Billable */}
      <div className="flex items-center gap-3">
        <Checkbox
          checked={formData.billable}
          onCheckedChange={(v) => updateField('billable', v)}
        />
        <Label>Billable work order</Label>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700">
          {saving ? 'Saving...' : (workOrder ? 'Update Work Order' : 'Create Work Order')}
        </Button>
      </div>

      {/* Inline New Project Form */}
      <Dialog open={showNewProjectForm} onOpenChange={setShowNewProjectForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Project Title *</Label>
              <Input
                value={newProjectData.title}
                onChange={(e) => setNewProjectData({ ...newProjectData, title: e.target.value })}
                placeholder="e.g., Annual Service, Engine Repair..."
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={newProjectData.description}
                onChange={(e) => setNewProjectData({ ...newProjectData, description: e.target.value })}
                placeholder="Optional project description..."
                rows={3}
              />
            </div>
            <div className="text-xs text-slate-500 space-y-1">
              <p>Will be created for:</p>
              <p>• Customer: {getCustomerDisplayName(customers.find(c => c.id === selectedCustomerId))}</p>
              <p>• Boat: {boats.find(b => b.id === selectedBoatId)?.vessel_name}</p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowNewProjectForm(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateNewProject}>
              Create & Select
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </form>
  );
}