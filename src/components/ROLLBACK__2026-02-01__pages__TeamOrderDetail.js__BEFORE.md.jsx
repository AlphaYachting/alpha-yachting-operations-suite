# AFTER SNAPSHOT - TeamOrderDetail.js
## Date: 2026-02-01
## Change: Added PDF Viewer preview using PDFExportButton

**Changes Made:**
1. Replaced direct download with PDFExportButton component
2. Added data preparation functions (getPDFDocument, getPDFLineItems)
3. Removed backend PDF generation call (generatePartnerBriefPDF)
4. Loads related entities (job, customer, boat, location) for PDF data
5. Formats Partner Brief data to match PDFExportButton's expected structure

**File now complete below:**

```javascript
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Save, Loader2, AlertCircle, FileText, RefreshCw, Download } from 'lucide-react';
import TeamOrderForm from '@/components/teamorder/TeamOrderForm';
import PDFExportButton from '@/components/pdf/PDFExportButton';

export default function TeamOrderDetail() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const teamOrderId = urlParams.get('id');
  const workOrderId = urlParams.get('workOrderId');
  const isNew = !teamOrderId;

  const [teamOrder, setTeamOrder] = useState({
    work_order_id: workOrderId || '',
    status: 'Draft',
    approved_budget_total: 0,
    currency: 'EUR',
    budget_exceed_requires_approval: true,
    requires_preapproval_over: 500,
    change_log: []
  });
  const [workOrder, setWorkOrder] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [job, setJob] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [boat, setBoat] = useState(null);
  const [location, setLocation] = useState(null);

  useEffect(() => {
    loadData();
  }, [teamOrderId, workOrderId]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load technicians
      const techList = await base44.entities.Technician.list();
      setTechnicians(techList);

      if (teamOrderId) {
        // Load existing team order
        const orders = await base44.entities.TeamOrder.list();
        const order = orders.find(o => o.id === teamOrderId);
        if (order) {
          setTeamOrder(order);
          
          // Load associated work order
          const woList = await base44.entities.WorkOrder.list();
          const wo = woList.find(w => w.id === order.work_order_id);
          setWorkOrder(wo);

          if (wo) {
            const taskList = await base44.entities.Task.filter({ work_order_id: wo.id }, 'sequence_order');
            setTasks(taskList);
            
            // Load related data for PDF generation
            const [jobs, customers, boats, locations] = await Promise.all([
              base44.entities.Job.list(),
              base44.entities.Customer.list(),
              base44.entities.Boat.list(),
              base44.entities.Location.list()
            ]);
            
            const jobData = jobs.find(j => j.id === wo.job_id);
            setJob(jobData);
            setCustomer(customers.find(c => c.id === jobData?.customer_id));
            setBoat(boats.find(b => b.id === jobData?.boat_id));
            setLocation(locations.find(l => l.id === jobData?.location_id));
          }
        }
      } else if (workOrderId) {
        // Creating new team order for existing work order
        const woList = await base44.entities.WorkOrder.list();
        const wo = woList.find(w => w.id === workOrderId);
        setWorkOrder(wo);

        if (wo) {
          const taskList = await base44.entities.Task.filter({ work_order_id: wo.id }, 'sequence_order');
          setTasks(taskList);
        }
      }
    } catch (err) {
      console.error('Load error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      if (!teamOrder.work_order_id) {
        throw new Error('Work Order is required');
      }

      const saveData = {
        ...teamOrder,
        last_workorder_sync_at: new Date().toISOString()
      };

      if (isNew) {
        const created = await base44.entities.TeamOrder.create(saveData);
        navigate(createPageUrl('TeamOrderDetail') + `?id=${created.id}`);
      } else {
        await base44.entities.TeamOrder.update(teamOrderId, saveData);
        await loadData();
      }
    } catch (err) {
      console.error('Save error:', err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const getPDFDocument = () => {
    if (!teamOrder || !workOrder) return null;
    
    const assignedTechs = technicians.filter(t => 
      workOrder.assigned_technicians?.includes(t.id)
    );
    
    const customerName = customer?.company_name || 
      `${customer?.first_name || ''} ${customer?.last_name || ''}`.trim() || 
      'Unknown';
    
    const costPolicies = [];
    if (teamOrder.accommodation_paid) {
      costPolicies.push(`Accommodation: up to €${teamOrder.accommodation_max_per_night || 'TBD'}/night`);
    }
    if (teamOrder.meals_per_diem_paid) {
      costPolicies.push(`Per Diem: €${teamOrder.per_diem_rate_per_day || 'TBD'}/day`);
    }
    if (teamOrder.mileage_paid) {
      costPolicies.push(`Mileage: €${teamOrder.mileage_rate_per_km || '0.35'}/km`);
    }
    if (teamOrder.travel_time_paid) {
      costPolicies.push(`Travel Time: €${teamOrder.travel_time_rate_per_hour || 'TBD'}/hour`);
    }

    return {
      id: workOrder.id,
      document_type: 'PartnerBrief',
      document_number: workOrder.work_order_number || `BRIEF-${workOrder.id.slice(-6)}`,
      status: workOrder.status,
      customer_name: customerName,
      customer_address: '',
      boat_name: boat?.vessel_name,
      boat_details: boat ? [boat.vessel_type, boat.length_m ? boat.length_m + 'm' : ''].filter(Boolean).join(' · ') : '',
      location_name: location?.name,
      issue_date: new Date().toISOString().split('T')[0],
      
      public_notes: [
        workOrder.description || '',
        location?.access_notes ? `\n\nAccess Notes:\n${location.access_notes}` : '',
        teamOrder.partner_notes ? `\n\nPartner Notes:\n${teamOrder.partner_notes}` : '',
        workOrder.safety_notes ? `\n\n⚠️ Safety Notes:\n${workOrder.safety_notes}` : '',
        costPolicies.length > 0 ? `\n\nCovered Costs:\n${costPolicies.map(p => '• ' + p).join('\n')}` : ''
      ].filter(Boolean).join(''),
      
      subtotal: teamOrder.approved_budget_total || 0,
      tax_total: 0,
      total: teamOrder.approved_budget_total || 0,
      currency: 'EUR',
      language: 'English'
    };
  };

  const getPDFLineItems = () => {
    if (!teamOrder || !tasks) return [];
    
    const items = [];
    
    tasks.forEach((task, idx) => {
      items.push({
        sort_order: idx,
        title: task.title,
        description: task.description || '',
        quantity: task.estimated_minutes ? Math.round(task.estimated_minutes / 60) / 10 : 0,
        unit: task.estimated_minutes ? 'Hours' : 'Task',
        unit_price: 0,
        tax_rate: 0,
        total_net: 0,
        total_tax: 0,
        total_gross: 0
      });
    });
    
    if (teamOrder.labor_budget > 0) {
      items.push({
        sort_order: tasks.length,
        title: 'Labor Budget',
        description: '',
        quantity: 1,
        unit: 'Budget',
        unit_price: teamOrder.labor_budget,
        tax_rate: 0,
        total_net: teamOrder.labor_budget,
        total_tax: 0,
        total_gross: teamOrder.labor_budget
      });
    }
    
    return items;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(createPageUrl('WorkOrderDetail') + `?id=${workOrderId}`)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              {isNew ? 'New Team Order' : 'Team Order'}
            </h1>
            {workOrder && (
              <p className="text-slate-600 mt-1">
                For Work Order: {workOrder.title}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {!isNew && workOrder && (
            <PDFExportButton 
              document={getPDFDocument()}
              lineItems={getPDFLineItems()}
              variant="outline"
            />
          )}
          <Button onClick={handleSave} disabled={saving} className="bg-purple-600 hover:bg-purple-700">
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Team Order'}
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form */}
        <div className="lg:col-span-2">
          <TeamOrderForm
            teamOrder={teamOrder}
            setTeamOrder={setTeamOrder}
            technicians={technicians}
          />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Job Definition (Read-only, Synced from Work Order) */}
          {workOrder && (
            <Card className="border-blue-200 bg-blue-50/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Job Definition</CardTitle>
                  <Badge variant="outline" className="bg-white">
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Synced
                  </Badge>
                </div>
                <CardDescription>From Work Order (read-only)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-xs text-slate-600">Title</p>
                  <p className="font-semibold text-sm">{workOrder.title}</p>
                </div>
                {workOrder.description && (
                  <div>
                    <p className="text-xs text-slate-600">Description</p>
                    <p className="text-sm text-slate-700 whitespace-pre-line">{workOrder.description}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-slate-600">Date</p>
                    <p className="text-sm font-medium">{workOrder.scheduled_date}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-600">Status</p>
                    <Badge variant="outline" className="text-xs">{workOrder.status}</Badge>
                  </div>
                </div>
                {tasks.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-600 mb-2">Tasks ({tasks.length})</p>
                    <div className="space-y-1">
                      {tasks.slice(0, 3).map(task => (
                        <p key={task.id} className="text-xs text-slate-700">
                          • {task.title}
                        </p>
                      ))}
                      {tasks.length > 3 && (
                        <p className="text-xs text-slate-500">+{tasks.length - 3} more</p>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Change Log */}
          {!isNew && teamOrder.change_log && teamOrder.change_log.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Change History</CardTitle>
                <CardDescription>Work Order updates</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {teamOrder.change_log.map((log, idx) => (
                    <div key={idx} className="text-xs border-l-2 border-slate-200 pl-3 py-1">
                      <p className="font-medium text-slate-700">{log.changed_field}</p>
                      <p className="text-slate-500">{new Date(log.timestamp).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
``