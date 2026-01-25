import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Circle, AlertTriangle } from 'lucide-react';

export default function TemplateSelector({ workOrderId, onApplied, onCancel }) {
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [templateItems, setTemplateItems] = useState([]);
  const [selectedItemIds, setSelectedItemIds] = useState([]);
  const [applying, setApplying] = useState(false);
  const [alreadyApplied, setAlreadyApplied] = useState(false);

  useEffect(() => {
    loadTemplates();
    checkExistingUsage();
  }, []);

  const loadTemplates = async () => {
    try {
      const templatesData = await base44.entities.TaskTemplateList.filter({ is_active: true });
      setTemplates(templatesData);
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  };

  const checkExistingUsage = async () => {
    try {
      const usage = await base44.entities.WorkOrderTemplateUsage.filter({ work_order_id: workOrderId });
      setAlreadyApplied(usage.length > 0);
    } catch (error) {
      console.error('Error checking usage:', error);
    }
  };

  const loadTemplateItems = async (templateId) => {
    try {
      const items = await base44.entities.TaskTemplateItem.filter(
        { template_list_id: templateId },
        'sort_order'
      );
      setTemplateItems(items);
      setSelectedItemIds(items.map(item => item.id));
    } catch (error) {
      console.error('Error loading template items:', error);
    }
  };

  const handleTemplateSelect = (templateId) => {
    setSelectedTemplateId(templateId);
    if (templateId) {
      loadTemplateItems(templateId);
    } else {
      setTemplateItems([]);
      setSelectedItemIds([]);
    }
  };

  const toggleItem = (itemId) => {
    setSelectedItemIds(prev =>
      prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]
    );
  };

  const handleApply = async () => {
    if (!selectedTemplateId || selectedItemIds.length === 0) return;

    if (alreadyApplied && !window.confirm('This work order already has tasks from a template. Add more tasks anyway?')) {
      return;
    }

    setApplying(true);

    try {
      const user = await base44.auth.me();
      const itemsToApply = templateItems.filter(item => selectedItemIds.includes(item.id));

      const tasks = await Promise.all(
        itemsToApply.map((item, index) =>
          base44.entities.Task.create({
            work_order_id: workOrderId,
            title: item.title,
            description: item.description,
            estimated_minutes: item.default_estimated_hours ? Math.round(item.default_estimated_hours * 60) : null,
            sequence_order: item.sort_order,
            status: 'Not Started',
            notes: item.required_tools_note || '',
            requires_approval: item.requires_customer_approval
          })
        )
      );

      await base44.entities.WorkOrderTemplateUsage.create({
        work_order_id: workOrderId,
        template_list_id: selectedTemplateId,
        applied_at: new Date().toISOString(),
        applied_by: user.email,
        mode: selectedItemIds.length === templateItems.length ? 'full' : 'selected_items',
        selected_item_ids: selectedItemIds
      });

      onApplied();
    } catch (error) {
      console.error('Error applying template:', error);
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="space-y-6">
      {alreadyApplied && (
        <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-900">Template Already Applied</p>
            <p className="text-sm text-amber-700">This work order already has tasks from a template. You can still add more.</p>
          </div>
        </div>
      )}

      <div>
        <Label>Select Template</Label>
        <Select value={selectedTemplateId} onValueChange={handleTemplateSelect}>
          <SelectTrigger>
            <SelectValue placeholder="Choose a task template" />
          </SelectTrigger>
          <SelectContent>
            {templates.map(template => (
              <SelectItem key={template.id} value={template.id}>
                {template.name} ({template.category})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {templateItems.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <Label>Select Tasks to Add ({selectedItemIds.length}/{templateItems.length})</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                if (selectedItemIds.length === templateItems.length) {
                  setSelectedItemIds([]);
                } else {
                  setSelectedItemIds(templateItems.map(item => item.id));
                }
              }}
            >
              {selectedItemIds.length === templateItems.length ? 'Deselect All' : 'Select All'}
            </Button>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {templateItems.map((item, index) => {
              const isSelected = selectedItemIds.includes(item.id);
              return (
                <Card
                  key={item.id}
                  className={`cursor-pointer transition-colors ${
                    isSelected ? 'border-blue-300 bg-blue-50' : 'hover:border-slate-300'
                  }`}
                  onClick={() => toggleItem(item.id)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        {isSelected ? (
                          <CheckCircle2 className="h-5 w-5 text-blue-600" />
                        ) : (
                          <Circle className="h-5 w-5 text-slate-300" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">#{index + 1}</Badge>
                          <p className="font-medium text-slate-900">{item.title}</p>
                          {item.is_optional && (
                            <Badge className="bg-slate-100 text-slate-600 text-xs">Optional</Badge>
                          )}
                        </div>
                        {item.description && (
                          <p className="text-sm text-slate-600 mt-1">{item.description}</p>
                        )}
                        <div className="flex flex-wrap gap-2 mt-2 text-xs text-slate-500">
                          {item.default_estimated_hours && (
                            <span>Est: {item.default_estimated_hours}h</span>
                          )}
                          {item.default_role && (
                            <span>• {item.default_role}</span>
                          )}
                          {item.default_required_vehicle && (
                            <span>• Vehicle required</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel} disabled={applying}>
          Cancel
        </Button>
        <Button
          onClick={handleApply}
          disabled={applying || !selectedTemplateId || selectedItemIds.length === 0}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {applying ? 'Adding Tasks...' : `Add ${selectedItemIds.length} Task${selectedItemIds.length !== 1 ? 's' : ''}`}
        </Button>
      </div>
    </div>
  );
}