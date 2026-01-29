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
import { jsPDF } from 'jspdf';

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
  const [pdfTemplate, setPdfTemplate] = useState(null);

  useEffect(() => {
    loadData();
  }, [teamOrderId, workOrderId]);

  useEffect(() => {
    const loadTemplate = async () => {
      try {
        const templates = await base44.entities.PDFTemplate.list();
        const teamOrderTemplate = templates.find(t => t.template_name === 'Alpha Yachting - Team Order Template' || t.template_type === 'TeamOrder');
        if (teamOrderTemplate) {
          setPdfTemplate(teamOrderTemplate);
        }
      } catch (err) {
        console.error('Error loading PDF template:', err);
      }
    };
    loadTemplate();
  }, []);

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

  const handlePrintPDF = async () => {
    if (!pdfTemplate || !teamOrder) return;

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      let yPos = margin;

      // Add letterhead background if available
      if (pdfTemplate.letterhead_enabled && pdfTemplate.letterhead_url) {
        const img = new Image();
        img.onload = () => {
          doc.addImage(img, 'PNG', 0, 0, pageWidth, pageHeight);
        };
        img.src = pdfTemplate.letterhead_url;
      }

      // Header
      if (pdfTemplate.logo_url) {
        doc.addImage(pdfTemplate.logo_url, 'PNG', margin, yPos, pdfTemplate.logo_height_mm || 20, pdfTemplate.logo_height_mm || 20);
      }

      yPos += 35;
      doc.setFontSize(pdfTemplate.font_size_heading || 18);
      doc.text('TEAM ORDER', margin, yPos);
      yPos += 15;

      // Order Info
      doc.setFontSize(pdfTemplate.font_size_body || 11);
      doc.text(`Date: ${new Date().toLocaleDateString()}`, margin, yPos);
      yPos += 7;
      doc.text(`Order ID: ${teamOrderId || 'Draft'}`, margin, yPos);
      yPos += 12;

      // Partner Information
      doc.setFontSize(12);
      doc.text('Partner Information', margin, yPos);
      yPos += 8;
      doc.setFontSize(pdfTemplate.font_size_body || 11);
      doc.text(`Status: ${teamOrder.status}`, margin, yPos);
      yPos += 7;
      if (teamOrder.partner_name) {
        doc.text(`Partner: ${teamOrder.partner_name}`, margin, yPos);
        yPos += 7;
      }
      if (teamOrder.partner_contact) {
        doc.text(`Contact: ${teamOrder.partner_contact}`, margin, yPos);
        yPos += 7;
      }
      yPos += 5;

      // Budget Information
      doc.setFontSize(12);
      doc.text('Budget Summary', margin, yPos);
      yPos += 8;
      doc.setFontSize(pdfTemplate.font_size_body || 11);
      doc.text(`Approved Budget: €${teamOrder.approved_budget_total?.toFixed(2) || '0.00'}`, margin, yPos);
      yPos += 7;

      if (teamOrder.labor_budget) {
        doc.text(`Labor Budget: €${teamOrder.labor_budget.toFixed(2)}`, margin, yPos);
        yPos += 7;
      }
      if (teamOrder.travel_budget) {
        doc.text(`Travel Budget: €${teamOrder.travel_budget.toFixed(2)}`, margin, yPos);
        yPos += 7;
      }
      if (teamOrder.accommodation_budget) {
        doc.text(`Accommodation Budget: €${teamOrder.accommodation_budget.toFixed(2)}`, margin, yPos);
        yPos += 7;
      }
      if (teamOrder.per_diem_budget) {
        doc.text(`Per Diem Budget: €${teamOrder.per_diem_budget.toFixed(2)}`, margin, yPos);
        yPos += 7;
      }
      yPos += 10;

      // Terms
      if (teamOrder.mileage_paid) {
        doc.setFontSize(10);
        doc.text(`Mileage Rate: €${teamOrder.mileage_rate_per_km || '0.35'}/km`, margin, yPos);
        yPos += 6;
      }

      // Footer
      if (pdfTemplate.footer_text) {
        doc.setFontSize(8);
        doc.text(pdfTemplate.footer_text, margin, pageHeight - 15);
      }

      // Download
      doc.save(`Team-Order-${teamOrderId || 'Draft'}.pdf`);
    } catch (err) {
      console.error('Error generating PDF:', err);
      setError('Failed to generate PDF');
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
          {pdfTemplate && !isNew && (
            <Button onClick={handlePrintPDF} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
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