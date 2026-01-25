import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, CheckCircle2, Circle } from 'lucide-react';

export default function TemplateFromCreation({ onTemplateChange, selectedTemplateId, setTitle }) {
  const [templates, setTemplates] = useState([]);
  const [templateItems, setTemplateItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creationMode, setCreationMode] = useState('empty'); // 'empty' or 'template'
  const [localSelectedId, setLocalSelectedId] = useState('');

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const active = await base44.entities.TaskTemplateList.filter({ is_active: true });
      setTemplates(active);
      setLoading(false);
    } catch (error) {
      console.error('Error loading templates:', error);
      setLoading(false);
    }
  };

  const loadTemplateItems = async (templateId) => {
    try {
      const items = await base44.entities.TaskTemplateItem.filter(
        { template_list_id: templateId },
        'sort_order'
      );
      setTemplateItems(items);
    } catch (error) {
      console.error('Error loading template items:', error);
      setTemplateItems([]);
    }
  };

  const handleTemplateSelect = (templateId) => {
    setLocalSelectedId(templateId);
    if (templateId) {
      const template = templates.find(t => t.id === templateId);
      if (template) {
        setTitle(template.name);
      }
      loadTemplateItems(templateId);
    } else {
      setTemplateItems([]);
    }
    onTemplateChange(templateId);
  };

  const handleModeChange = (mode) => {
    setCreationMode(mode);
    if (mode === 'empty') {
      setLocalSelectedId('');
      setTemplateItems([]);
      setTitle('');
      onTemplateChange(null);
    }
  };

  if (loading) {
    return <Skeleton className="h-32 w-full" />;
  }

  return (
    <div className="space-y-4 p-4 bg-slate-50 border border-slate-200 rounded-lg">
      <div>
        <Label className="text-base font-semibold mb-3 block">Creation Mode</Label>
        <RadioGroup value={creationMode} onValueChange={handleModeChange}>
          <div className="flex items-center gap-3 p-3 rounded border border-slate-200 cursor-pointer hover:bg-white transition-colors">
            <RadioGroupItem value="empty" id="mode-empty" />
            <label htmlFor="mode-empty" className="flex-1 cursor-pointer">
              <p className="font-medium text-slate-900">Create Empty Work Order</p>
              <p className="text-sm text-slate-500">Add tasks manually or apply templates later</p>
            </label>
          </div>
          <div className="flex items-center gap-3 p-3 rounded border border-slate-200 cursor-pointer hover:bg-white transition-colors">
            <RadioGroupItem value="template" id="mode-template" />
            <label htmlFor="mode-template" className="flex-1 cursor-pointer">
              <p className="font-medium text-slate-900">Create from Task Template</p>
              <p className="text-sm text-slate-500">Auto-create title and tasks from a template</p>
            </label>
          </div>
        </RadioGroup>
      </div>

      {creationMode === 'template' && (
        <div className="space-y-4 pt-2 border-t border-slate-200">
          {templates.length === 0 ? (
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              No active templates available. Create one first.
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Select Template</Label>
                <Select value={localSelectedId} onValueChange={handleTemplateSelect}>
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
                <div className="space-y-2">
                  <Label className="text-sm">
                    Template Preview ({templateItems.length} tasks)
                  </Label>
                  <div className="space-y-2 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded p-3">
                    {templateItems.map((item, idx) => (
                      <div key={item.id} className="flex items-start gap-2 text-sm pb-2 border-b border-slate-100 last:border-b-0">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-900">{item.title}</p>
                          {item.default_estimated_hours && (
                            <p className="text-xs text-slate-500">
                              Est: {item.default_estimated_hours}h
                              {item.default_role && ` • ${item.default_role}`}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}