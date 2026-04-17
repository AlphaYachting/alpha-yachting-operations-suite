import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Save, Loader2, AlertCircle, RefreshCw, FileText } from 'lucide-react';
import TeamOrderForm from '@/components/teamorder/TeamOrderForm';
import PDFExportButton from '@/components/pdf/PDFExportButton';
import BriefingContextPreview from '@/components/teamorder/BriefingContextPreview';
import { generateWorkerBriefPDF } from '@/components/pdf/WorkerBriefTemplate';

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
  const [jobDescriptionEn, setJobDescriptionEn] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [generatingWorkerBrief, setGeneratingWorkerBrief] = useState(false);
  const [pdfTemplate, setPdfTemplate] = useState(null);

  useEffect(() => {
    base44.auth.me().then(user => setCurrentUser(user)).catch(() => {});
    loadPdfTemplate();
  }, []);
  
  const loadPdfTemplate = async () => {
    try {
      const templates = await base44.entities.PDFTemplate.list();
      const defaultTemplate = templates.find(t => t.is_default) || templates[0];
      if (defaultTemplate) {
        setPdfTemplate(defaultTemplate);
      }
    } catch (err) {
      console.error('Error loading PDF template:', err);
    }
  };


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

            // Translate job description to English for Partner Brief
            if (jobData?.description) {
              base44.integrations.Core.InvokeLLM({
                prompt: `Translate the following German text to professional English. Return only the translated text, no additional explanation:\n\n${jobData.description}`
              }).then(translated => setJobDescriptionEn(translated)).catch(() => setJobDescriptionEn(jobData.description));
            }
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

  const getPartnerBriefPDFDocument = () => {
    if (!teamOrder || !workOrder) return null;
    
    const assignedTechs = technicians.filter(t => 
      workOrder.assigned_technicians?.includes(t.id)
    );
    
    const customerName = customer?.company_name || 
      `${customer?.first_name || ''} ${customer?.last_name || ''}`.trim() || 
      'Unknown';
    
    return {
      document_type: 'PartnerBrief',
      document_title: 'PARTNER BRIEFING',
      work_order_number: workOrder.work_order_number || `WO${workOrder.id.slice(-6)}`,
      work_order_title: workOrder.title,
      work_order_status: workOrder.status,
      scheduled_date: workOrder.scheduled_date,
      customer_name: customerName,
      boat_name: boat?.vessel_name || 'Unknown',
      boat_type: boat?.vessel_type || 'Unknown',
      boat_length: boat?.length_m ? `${boat.length_m}m` : 'Unknown',
      location_name: location?.name || 'Unknown',
      location_address: location?.address || '',
      location_access_notes: location?.access_notes || 'None',
      work_description: workOrder.description || '',
      job_description: job?.description || '',
      job_description_de: job?.description || '',
      job_description_en: jobDescriptionEn || job?.description || '',
      approved_budget_total: teamOrder.approved_budget_total || 0,
      labor_budget: teamOrder.labor_budget || 0,
      travel_budget: teamOrder.travel_budget || 0,
      accommodation_budget: teamOrder.accommodation_budget || 0,
      per_diem_budget: teamOrder.per_diem_budget || 0,
      covered_costs: {
        accommodation: teamOrder.accommodation_paid ? { enabled: true, max_per_night: teamOrder.accommodation_max_per_night || 'TBD' } : null,
        per_diem: teamOrder.meals_per_diem_paid ? { enabled: true, rate_per_day: teamOrder.per_diem_rate_per_day || 'TBD' } : null,
        mileage: teamOrder.mileage_paid ? { enabled: true, rate_per_km: teamOrder.mileage_rate_per_km || 0.35, cap_total: teamOrder.mileage_cap_total || 'TBD' } : null,
        travel_time: teamOrder.travel_time_paid ? { enabled: true, rate_per_hour: teamOrder.travel_time_rate_per_hour || 'TBD' } : null
      },
      approval_requirements: {
        preapproval_over: teamOrder.requires_preapproval_over || 500,
        budget_exceed_requires_approval: teamOrder.budget_exceed_requires_approval !== false
      },
      assigned_team: assignedTechs.map(t => ({
        name: `${t.first_name} ${t.last_name}`,
        role: t.role || '-',
        phone: t.phone || '-'
      })),
      partner_notes: teamOrder.partner_notes || '',
      safety_notes: workOrder.safety_notes || '',
      id: workOrder.id,
      document_number: workOrder.work_order_number || `BRIEF-${workOrder.id.slice(-6)}`,
      issue_date: new Date().toISOString().split('T')[0],
      currency: 'EUR',
      language: 'English'
    };
  };

  const getPartnerBriefPDFLineItems = () => {
    if (!tasks) return [];
    return tasks
      .sort((a, b) => (a.sequence_order || 0) - (b.sequence_order || 0))
      .map((task, idx) => ({
        sort_order: idx + 1,
        title: task.title,
        description: task.description || '',
        estimated_time: task.estimated_minutes ? `${Math.floor(task.estimated_minutes / 60)}h` : '-',
        quantity: 1,
        unit: 'Task',
        unit_price: 0,
        tax_rate: 0,
        total_net: 0,
        total_tax: 0,
        total_gross: 0
      }));
  };

  const handleGenerateWorkerBrief = async () => {
    setGeneratingWorkerBrief(true);
    setError(null);
    
    try {
      // Build briefing context via backend function
      const briefingContextResponse = await base44.functions.invoke('buildBriefingContext', {
        teamOrderId
      });
      
      const briefingContext = briefingContextResponse.data;
      
      // Generate PDF from context
      const pdfTemplate_ = pdfTemplate || {
        company_name: 'Alpha Yachting',
        company_address: 'Novigrad, Croatia',
        contact_email: 'info@alphayachting.com',
        contact_phone: '+385 52 700 700',
        logo_url: 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6972766f1bd9af32693610c1/a2e80b763_Bildschirmfoto2026-01-28um222024.png'
      };
      
      const pdfDoc = await generateWorkerBriefPDF(briefingContext, pdfTemplate_);
      
      // Download PDF
      const fileName = `worker-brief-${workOrder?.work_order_number || 'WO'}-${new Date().getTime()}.pdf`;
      pdfDoc.save(fileName);
    } catch (err) {
      console.error('Error generating worker brief:', err);
      setError(`Failed to generate worker brief: ${err.message}`);
    } finally {
      setGeneratingWorkerBrief(false);
    }
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
          {!isNew && workOrder && teamOrder.id && (
            <>
              <Button 
                onClick={handleGenerateWorkerBrief} 
                disabled={generatingWorkerBrief}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <FileText className="h-4 w-4 mr-2" />
                {generatingWorkerBrief ? 'Generating...' : 'Generate Worker Brief PDF'}
              </Button>
              <PDFExportButton
                document={getPartnerBriefPDFDocument()}
                lineItems={getPartnerBriefPDFLineItems()}
                templateId="PartnerBrief"
                variant="default"
              />
            </>
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

          {/* Briefing Context Preview */}
          {!isNew && teamOrderId && (
            <BriefingContextPreview 
              teamOrderId={teamOrderId}
              isAdmin={currentUser?.role === 'admin'}
            />
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