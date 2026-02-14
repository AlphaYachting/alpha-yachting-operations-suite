import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Save } from 'lucide-react';
import OfferTaskEditor from '@/components/offers/OfferTaskEditor';

export default function OfferTemplateDetail() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const templateId = urlParams.get('id');
  const isNew = !templateId;

  const [formData, setFormData] = useState({
    template_name: '',
    title: '',
    description: '',
    customer_notes: '',
    language: 'German',
    vat_rate: 0,
    payment_terms_type: 'Full',
    downpayment_percent: null,
    payment_schedule: '',
  });
  const [lineItems, setLineItems] = useState([]);
  const [saving, setSaving] = useState(false);

  const { data: template } = useQuery({
    queryKey: ['offerTemplate', templateId],
    queryFn: () => base44.entities.OfferTemplate.list().then(templates => templates.find(t => t.id === templateId)),
    enabled: !!templateId,
  });

  const { data: existingLineItems = [] } = useQuery({
    queryKey: ['offerTemplateLineItems', templateId],
    queryFn: () => base44.entities.OfferTemplateLineItem.filter({ template_id: templateId }, 'sequence_order'),
    enabled: !!templateId,
  });

  useEffect(() => {
    if (template) {
      setFormData({
        template_name: template.template_name || '',
        title: template.title || '',
        description: template.description || '',
        customer_notes: template.customer_notes || '',
        language: template.language || 'German',
        vat_rate: template.vat_rate || 0,
        payment_terms_type: template.payment_terms_type || 'Full',
        downpayment_percent: template.downpayment_percent || null,
        payment_schedule: template.payment_schedule || '',
      });
    }
  }, [template]);

  useEffect(() => {
    if (existingLineItems.length > 0) {
      setLineItems(existingLineItems);
    }
  }, [existingLineItems]);

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!formData.template_name || !formData.title) {
      toast.error('Template name and title are required');
      return;
    }

    setSaving(true);
    try {
      let savedTemplateId = templateId;

      if (isNew) {
        const newTemplate = await base44.entities.OfferTemplate.create(formData);
        savedTemplateId = newTemplate.id;

        if (lineItems.length > 0) {
          await base44.entities.OfferTemplateLineItem.bulkCreate(
            lineItems.map((item, idx) => ({
              template_id: savedTemplateId,
              sequence_order: item.sequence_order ?? idx,
              title: item.title,
              description: item.description || '',
              unit_type: item.unit_type || 'Hour',
              quantity: item.quantity || 1,
              unit_price: item.unit_price || 0,
              is_optional: item.is_optional || false,
              notes: item.notes || '',
            }))
          );
        }

        queryClient.invalidateQueries(['offerTemplates']);
        toast.success('Template created');
        navigate(createPageUrl('OfferTemplateDetail') + `?id=${savedTemplateId}`);
      } else {
        await base44.entities.OfferTemplate.update(templateId, formData);

        const existingItems = await base44.entities.OfferTemplateLineItem.filter({ template_id: templateId });
        for (const item of existingItems) {
          await base44.entities.OfferTemplateLineItem.delete(item.id);
        }

        if (lineItems.length > 0) {
          await base44.entities.OfferTemplateLineItem.bulkCreate(
            lineItems.map((item, idx) => ({
              template_id: templateId,
              sequence_order: item.sequence_order ?? idx,
              title: item.title,
              description: item.description || '',
              unit_type: item.unit_type || 'Hour',
              quantity: item.quantity || 1,
              unit_price: item.unit_price || 0,
              is_optional: item.is_optional || false,
              notes: item.notes || '',
            }))
          );
        }

        queryClient.invalidateQueries(['offerTemplate', templateId]);
        queryClient.invalidateQueries(['offerTemplateLineItems', templateId]);
        queryClient.invalidateQueries(['offerTemplates']);
        toast.success('Template updated');
      }
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(createPageUrl('OfferTemplates'))}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              {isNew ? 'New Offer Template' : formData.template_name}
            </h1>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving...' : 'Save Template'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Template Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Template Name *</Label>
                <Input
                  value={formData.template_name}
                  onChange={(e) => updateField('template_name', e.target.value)}
                  placeholder="e.g., Standard Engine Service"
                />
              </div>

              <div className="space-y-2">
                <Label>Offer Title *</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => updateField('title', e.target.value)}
                  placeholder="Title that will appear on offers"
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

              <div className="space-y-2">
                <Label>Customer Notes</Label>
                <Textarea
                  value={formData.customer_notes}
                  onChange={(e) => updateField('customer_notes', e.target.value)}
                  placeholder="Notes visible to customer"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
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
                  <Label>VAT Rate (%)</Label>
                  <Select value={String(formData.vat_rate)} onValueChange={(v) => updateField('vat_rate', parseFloat(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0% (No VAT)</SelectItem>
                      <SelectItem value="5">5%</SelectItem>
                      <SelectItem value="10">10%</SelectItem>
                      <SelectItem value="13">13%</SelectItem>
                      <SelectItem value="19">19%</SelectItem>
                      <SelectItem value="20">20%</SelectItem>
                      <SelectItem value="25">25%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Payment Terms Type</Label>
                <Select value={formData.payment_terms_type} onValueChange={(v) => updateField('payment_terms_type', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Full">Full Payment</SelectItem>
                    <SelectItem value="Downpayment">Downpayment</SelectItem>
                    <SelectItem value="Installments">Installments</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.payment_terms_type === 'Downpayment' && (
                <div className="space-y-2">
                  <Label>Downpayment Percentage</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.downpayment_percent || ''}
                    onChange={(e) => updateField('downpayment_percent', parseFloat(e.target.value) || null)}
                    placeholder="e.g., 30"
                  />
                </div>
              )}

              {formData.payment_terms_type !== 'Full' && (
                <div className="space-y-2">
                  <Label>Payment Schedule</Label>
                  <Textarea
                    value={formData.payment_schedule}
                    onChange={(e) => updateField('payment_schedule', e.target.value)}
                    placeholder="e.g., 50% upon order, 50% upon completion"
                    rows={2}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Line Items</CardTitle>
            </CardHeader>
            <CardContent>
              <OfferTaskEditor tasks={lineItems} setTasks={setLineItems} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center py-3 border-b">
                <span className="text-slate-600">Line Items</span>
                <span className="font-semibold">{lineItems.length}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b">
                <span className="text-slate-600">Total Units</span>
                <span className="font-semibold">
                  {lineItems.reduce((sum, item) => sum + (item.quantity || 0), 0).toFixed(1)}
                </span>
              </div>
              <div className="flex justify-between items-center py-3">
                <span className="text-slate-600">Est. Subtotal</span>
                <span className="font-semibold">
                  €{lineItems.reduce((sum, item) => sum + ((item.quantity || 0) * (item.unit_price || 0)), 0).toFixed(2)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}