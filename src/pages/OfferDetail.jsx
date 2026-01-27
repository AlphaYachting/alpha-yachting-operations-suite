import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  ArrowLeft,
  Save,
  Sparkles,
  Plus,
  Trash2,
  CheckCircle2,
  Send,
  FileText,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import OfferTaskEditor from '@/components/offers/OfferTaskEditor';
import AIOfferGenerator from '@/components/offers/AIOfferGenerator';

export default function OfferDetail() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const offerId = urlParams.get('id');
  const isNewOffer = !offerId;

  const [formData, setFormData] = useState({
    customer_id: '',
    boat_id: '',
    job_id: '',
    title: '',
    description: '',
    language: 'German',
    status: 'Draft',
    valid_until: '',
    notes: '',
    customer_notes: '',
    total_amount: 0,
  });
  const [tasks, setTasks] = useState([]);
  const [showAIDialog, setShowAIDialog] = useState(false);
  const [showConvertDialog, setShowConvertDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const { data: offer } = useQuery({
    queryKey: ['offer', offerId],
    queryFn: () => base44.entities.Offer.list().then(offers => offers.find(o => o.id === offerId)),
    enabled: !!offerId,
  });

  const { data: offerTasks = [] } = useQuery({
    queryKey: ['offerTasks', offerId],
    queryFn: () => base44.entities.OfferTask.filter({ offer_id: offerId }, 'sequence_order'),
    enabled: !!offerId,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  });

  const { data: boats = [] } = useQuery({
    queryKey: ['boats'],
    queryFn: () => base44.entities.Boat.list(),
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => base44.entities.Job.list(),
  });

  useEffect(() => {
    if (offer) {
      setFormData(offer);
    }
  }, [offer]);

  useEffect(() => {
    if (offerTasks.length > 0) {
      setTasks(offerTasks);
    }
  }, [offerTasks]);

  useEffect(() => {
    // Recalculate total whenever tasks change
    const total = tasks.reduce((sum, task) => sum + (task.total_amount || 0), 0);
    setFormData(prev => ({ ...prev, total_amount: total }));
  }, [tasks]);

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      if (!formData.customer_id || !formData.title) {
        throw new Error('Customer and title are required');
      }

      let savedOfferId = offerId;

      if (isNewOffer) {
        // Generate offer number
        const offerCount = await base44.entities.Offer.list().then(offers => offers.length);
        const offerNumber = `OFF-${String(offerCount + 1).padStart(5, '0')}`;
        
        const newOffer = await base44.entities.Offer.create({
          ...formData,
          offer_number: offerNumber,
        });
        savedOfferId = newOffer.id;

        // Create tasks
        if (tasks.length > 0) {
          await base44.entities.OfferTask.bulkCreate(
            tasks.map((task, idx) => ({
              ...task,
              offer_id: savedOfferId,
              sequence_order: idx,
              total_amount: task.quantity * task.unit_price,
            }))
          );
        }

        queryClient.invalidateQueries(['offers']);
        navigate(createPageUrl('OfferDetail') + `?id=${savedOfferId}`);
      } else {
        // Update existing offer
        await base44.entities.Offer.update(offerId, formData);

        // Delete existing tasks and recreate
        const existingTasks = await base44.entities.OfferTask.filter({ offer_id: offerId });
        for (const task of existingTasks) {
          await base44.entities.OfferTask.delete(task.id);
        }

        if (tasks.length > 0) {
          await base44.entities.OfferTask.bulkCreate(
            tasks.map((task, idx) => ({
              ...task,
              offer_id: offerId,
              sequence_order: idx,
              total_amount: task.quantity * task.unit_price,
            }))
          );
        }

        queryClient.invalidateQueries(['offer', offerId]);
        queryClient.invalidateQueries(['offerTasks', offerId]);
        queryClient.invalidateQueries(['offers']);
      }
    } catch (err) {
      console.error('Save error:', err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleConvertToWorkOrder = async () => {
    if (!offerId || formData.status !== 'Approved') return;

    setSaving(true);
    setError(null);

    try {
      // Generate work order number
      const workOrders = await base44.entities.WorkOrder.list();
      const woNumber = `WO-${String(workOrders.length + 1).padStart(5, '0')}`;

      // Create work order
      const workOrder = await base44.entities.WorkOrder.create({
        job_id: formData.job_id,
        title: formData.title,
        description: formData.description,
        work_order_number: woNumber,
        status: 'Draft',
        scheduled_date: new Date().toISOString().split('T')[0],
        internal_notes: `Converted from offer ${formData.offer_number}`,
      });

      // Create tasks from offer tasks
      if (tasks.length > 0) {
        await base44.entities.Task.bulkCreate(
          tasks.map((task, idx) => ({
            work_order_id: workOrder.id,
            title: task.title,
            description: `${task.description || ''}\n${task.quantity} ${task.unit_type} @ €${task.unit_price}`,
            sequence_order: idx,
            estimated_minutes: task.unit_type === 'Hour' ? task.quantity * 60 : 0,
            status: 'Not Started',
          }))
        );
      }

      // Update offer status
      await base44.entities.Offer.update(offerId, {
        status: 'Converted',
        converted_work_order_id: workOrder.id,
      });

      queryClient.invalidateQueries(['offer', offerId]);
      queryClient.invalidateQueries(['offers']);
      
      setShowConvertDialog(false);
      navigate(createPageUrl('WorkOrderDetail') + `?id=${workOrder.id}`);
    } catch (err) {
      console.error('Convert error:', err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const filteredBoats = boats.filter(b => b.customer_id === formData.customer_id);
  const filteredJobs = jobs.filter(j => j.customer_id === formData.customer_id);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(createPageUrl('Offers'))}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              {isNewOffer ? 'New Offer' : formData.title}
            </h1>
            {!isNewOffer && formData.offer_number && (
              <p className="text-slate-600 mt-1">#{formData.offer_number}</p>
            )}
          </div>
          {!isNewOffer && (
            <Badge className={
              formData.status === 'Approved' ? 'bg-green-100 text-green-700' :
              formData.status === 'Sent' ? 'bg-blue-100 text-blue-700' :
              'bg-slate-100 text-slate-700'
            }>
              {formData.status}
            </Badge>
          )}
        </div>
        <div className="flex gap-2">
          {formData.status === 'Approved' && !formData.converted_work_order_id && formData.job_id && (
            <Button
              onClick={() => setShowConvertDialog(true)}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <FileText className="h-4 w-4 mr-2" />
              Convert to Work Order
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Offer'}
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Main Form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Offer Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Customer *</Label>
                  <Select value={formData.customer_id} onValueChange={(v) => updateField('customer_id', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.company_name || `${c.first_name} ${c.last_name}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Boat</Label>
                  <Select value={formData.boat_id} onValueChange={(v) => updateField('boat_id', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select boat" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredBoats.map(b => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.vessel_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Related Job</Label>
                <Select value={formData.job_id} onValueChange={(v) => updateField('job_id', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select job (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredJobs.map(j => (
                      <SelectItem key={j.id} value={j.id}>
                        {j.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Title *</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => updateField('title', e.target.value)}
                  placeholder="Offer title"
                />
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => updateField('description', e.target.value)}
                  placeholder="Offer description"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Language</Label>
                  <Select value={formData.language} onValueChange={(v) => updateField('language', v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="German">German</SelectItem>
                      <SelectItem value="English">English</SelectItem>
                      <SelectItem value="Italian">Italian</SelectItem>
                      <SelectItem value="Slovenian">Slovenian</SelectItem>
                      <SelectItem value="Croatian">Croatian</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={formData.status} onValueChange={(v) => updateField('status', v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Draft">Draft</SelectItem>
                      <SelectItem value="Sent">Sent</SelectItem>
                      <SelectItem value="Approved">Approved</SelectItem>
                      <SelectItem value="Rejected">Rejected</SelectItem>
                      <SelectItem value="Expired">Expired</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Valid Until</Label>
                  <Input
                    type="date"
                    value={formData.valid_until}
                    onChange={(e) => updateField('valid_until', e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Customer Notes</Label>
                <Textarea
                  value={formData.customer_notes}
                  onChange={(e) => updateField('customer_notes', e.target.value)}
                  placeholder="Notes visible to customer"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label>Internal Notes</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => updateField('notes', e.target.value)}
                  placeholder="Internal notes"
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          {/* Tasks Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Tasks</CardTitle>
                  <CardDescription>Define the work items for this offer</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAIDialog(true)}
                  className="text-purple-600 border-purple-300 hover:bg-purple-50"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  AI Generate
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <OfferTaskEditor tasks={tasks} setTasks={setTasks} />
            </CardContent>
          </Card>
        </div>

        {/* Summary Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center py-3 border-b">
                <span className="text-slate-600">Tasks</span>
                <span className="font-semibold">{tasks.length}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b">
                <span className="text-slate-600">Total Items</span>
                <span className="font-semibold">
                  {tasks.reduce((sum, t) => sum + (t.quantity || 0), 0).toFixed(1)}
                </span>
              </div>
              <div className="flex justify-between items-center py-4 bg-blue-50 px-4 rounded-lg">
                <span className="text-lg font-semibold text-slate-900">Total Amount</span>
                <span className="text-2xl font-bold text-blue-600">
                  €{formData.total_amount.toFixed(2)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* AI Generator Dialog */}
      <Dialog open={showAIDialog} onOpenChange={setShowAIDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>AI Task Generator</DialogTitle>
            <DialogDescription>
              Describe the work needed and let AI generate task suggestions
            </DialogDescription>
          </DialogHeader>
          <AIOfferGenerator
            formData={formData}
            customers={customers}
            boats={boats}
            jobs={jobs}
            onTasksGenerated={(generatedTasks) => {
              setTasks(generatedTasks);
              setShowAIDialog(false);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Convert Confirmation Dialog */}
      <Dialog open={showConvertDialog} onOpenChange={setShowConvertDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convert to Work Order?</DialogTitle>
            <DialogDescription>
              This will create a new work order with all tasks from this offer.
              The offer status will be updated to "Converted".
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setShowConvertDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleConvertToWorkOrder}
              disabled={saving}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Converting...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Convert to Work Order
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}