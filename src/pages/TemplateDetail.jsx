import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { createPageUrl } from '@/utils';
import { 
  ArrowLeft, 
  Plus, 
  GripVertical, 
  Edit, 
  Trash2,
  Save,
  Copy,
  Archive,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import TemplateItemForm from '@/components/templates/TemplateItemForm';
import AITaskGenerator from '@/components/templates/AITaskGenerator';

export default function TemplateDetail() {
  const [searchParams] = useSearchParams();
  const templateId = searchParams.get('id');
  const navigate = useNavigate();
  const [template, setTemplate] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [showItemForm, setShowItemForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [error, setError] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'General Service',
    is_active: true,
    default_priority: 'Normal',
    tags: []
  });

  useEffect(() => {
    loadCurrentUser();
    if (templateId) {
      loadTemplate();
      loadItems();
    } else {
      // Restore draft from localStorage if creating new template
      const savedDraft = localStorage.getItem('template_draft');
      if (savedDraft) {
        try {
          setFormData(JSON.parse(savedDraft));
        } catch (e) {
          console.error('Failed to restore draft:', e);
        }
      }
      setLoading(false);
    }
  }, [templateId]);

  const loadCurrentUser = async () => {
    try {
      const user = await base44.auth.me();
      setCurrentUser(user);
    } catch (error) {
      console.error('Error loading user:', error);
    }
  };

  const loadTemplate = async () => {
    try {
      const templateData = await base44.entities.TaskTemplateList.filter({ id: templateId });
      if (templateData.length === 0) {
        setError('Template not found');
        setLoading(false);
        return;
      }
      const tmpl = templateData[0];
      setTemplate(tmpl);
      setFormData({
        name: tmpl.name || '',
        description: tmpl.description || '',
        category: tmpl.category || 'General Service',
        is_active: tmpl.is_active !== false,
        default_priority: tmpl.default_priority || 'Normal',
        tags: tmpl.tags || []
      });
      setLoading(false);
    } catch (error) {
      console.error('Error loading template:', error);
      setError('Failed to load template');
      setLoading(false);
    }
  };

  const loadItems = async () => {
    try {
      const itemsData = await base44.entities.TaskTemplateItem.filter(
        { template_list_id: templateId },
        'sort_order'
      );
      setItems(itemsData);
    } catch (error) {
      console.error('Error loading items:', error);
    }
  };

  const handleFormChange = (field, value) => {
    const updated = { ...formData, [field]: value };
    setFormData(updated);
    setHasChanges(true);
    // Auto-save draft for new templates
    if (!templateId) {
      localStorage.setItem('template_draft', JSON.stringify(updated));
    }
  };

  const handleSaveTemplate = async () => {
    setSaving(true);
    setError(null);
    
    try {
      if (templateId) {
        await base44.entities.TaskTemplateList.update(templateId, formData);
        await loadTemplate();
      } else {
        const newTemplate = await base44.entities.TaskTemplateList.create(formData);
        localStorage.removeItem('template_draft');
        navigate(`${createPageUrl('TemplateDetail')}?id=${newTemplate.id}`);
      }
      setHasChanges(false);
    } catch (error) {
      console.error('Error saving template:', error);
      setError('Failed to save template: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDragEnd = async (result) => {
    if (!result.destination) return;

    const reorderedItems = Array.from(items);
    const [removed] = reorderedItems.splice(result.source.index, 1);
    reorderedItems.splice(result.destination.index, 0, removed);

    setItems(reorderedItems);

    try {
      await Promise.all(
        reorderedItems.map((item, index) =>
          base44.entities.TaskTemplateItem.update(item.id, { sort_order: index })
        )
      );
    } catch (error) {
      console.error('Error reordering items:', error);
      await loadItems();
    }
  };

  const handleSaveItem = async (itemData) => {
    setError(null);
    
    try {
      if (editingItem) {
        await base44.entities.TaskTemplateItem.update(editingItem.id, itemData);
      } else {
        await base44.entities.TaskTemplateItem.create({
          ...itemData,
          template_list_id: templateId,
          sort_order: items.length
        });
      }
      await loadItems();
      setShowItemForm(false);
      setEditingItem(null);
    } catch (error) {
      console.error('Error saving item:', error);
      setError('Failed to save task: ' + error.message);
      throw error; // Re-throw so form doesn't close
    }
  };

  const handleTasksGenerated = async (generatedTasks) => {
    setError(null);
    try {
      const nextSortOrder = items.length;
      await Promise.all(
        generatedTasks.map((task, index) =>
          base44.entities.TaskTemplateItem.create({
            ...task,
            template_list_id: templateId,
            sort_order: nextSortOrder + index
          })
        )
      );
      await loadItems();
      toast.success(`${generatedTasks.length} Task${generatedTasks.length !== 1 ? 's' : ''} gespeichert`);
    } catch (error) {
      console.error('Error adding AI generated tasks:', error);
      setError('Failed to add tasks: ' + error.message);
      toast.error('Fehler beim Speichern: ' + error.message);
      throw error;
    }
  };

  const handleDeleteItem = async (itemId) => {
    if (window.confirm('Delete this task item?')) {
      try {
        await base44.entities.TaskTemplateItem.delete(itemId);
        await loadItems();
      } catch (error) {
        console.error('Error deleting item:', error);
        setError('Failed to delete task');
      }
    }
  };

  const handleDuplicate = async () => {
    try {
      const newTemplate = await base44.entities.TaskTemplateList.create({
        name: `${formData.name} (Copy)`,
        description: formData.description,
        category: formData.category,
        is_active: formData.is_active,
        default_priority: formData.default_priority,
        tags: formData.tags
      });

      for (const item of items) {
        await base44.entities.TaskTemplateItem.create({
          template_list_id: newTemplate.id,
          sort_order: item.sort_order,
          title: item.title,
          description: item.description,
          default_estimated_hours: item.default_estimated_hours,
          default_role: item.default_role,
          default_required_vehicle: item.default_required_vehicle,
          required_tools_note: item.required_tools_note,
          is_optional: item.is_optional,
          requires_customer_approval: item.requires_customer_approval
        });
      }

      navigate(`${createPageUrl('TemplateDetail')}?id=${newTemplate.id}`);
    } catch (error) {
      console.error('Error duplicating template:', error);
      setError('Failed to duplicate template');
    }
  };

  const handleArchive = async () => {
    try {
      await base44.entities.TaskTemplateList.update(templateId, {
        is_active: !formData.is_active
      });
      await loadTemplate();
    } catch (error) {
      console.error('Error archiving template:', error);
      setError('Failed to archive template');
    }
  };

  const isAdmin = currentUser?.role === 'admin';

  if (!isAdmin && currentUser) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 mx-auto text-red-300 mb-4" />
        <h3 className="text-lg font-medium text-slate-900">Access Denied</h3>
        <p className="text-slate-500 mt-1">Only administrators can manage task templates</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error && !template) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 mx-auto text-red-300 mb-4" />
        <h3 className="text-lg font-medium text-slate-900">{error}</h3>
        <Button onClick={() => navigate(createPageUrl('TaskTemplates'))} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Templates
        </Button>
      </div>
    );
  }

  const isNewTemplate = !templateId || !template;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(createPageUrl('TaskTemplates'))}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {isNewTemplate ? 'Create Template' : formData.name}
            </h1>
            {hasChanges && (
              <p className="text-sm text-amber-600 flex items-center gap-1 mt-1">
                <AlertCircle className="h-3 w-3" />
                Unsaved changes
              </p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {!isNewTemplate && (
            <>
              <Button variant="outline" size="sm" onClick={handleDuplicate}>
                <Copy className="h-4 w-4 mr-2" />
                Duplicate
              </Button>
              <Button variant="outline" size="sm" onClick={handleArchive}>
                <Archive className="h-4 w-4 mr-2" />
                {formData.is_active ? 'Archive' : 'Restore'}
              </Button>
            </>
          )}
          <Button onClick={handleSaveTemplate} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Template'}
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
          <div>
            <p className="font-medium text-red-900">Error</p>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Template Metadata */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <div>
            <Label htmlFor="name">Template Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleFormChange('name', e.target.value)}
              placeholder="e.g., Annual Service Outboard"
              required
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleFormChange('description', e.target.value)}
              placeholder="What is this template for?"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="category">Category</Label>
              <Select
                value={formData.category}
                onValueChange={(v) => handleFormChange('category', v)}
              >
                <SelectTrigger id="category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Engine">Engine</SelectItem>
                  <SelectItem value="Electrical">Electrical</SelectItem>
                  <SelectItem value="Hull">Hull</SelectItem>
                  <SelectItem value="Commissioning">Commissioning</SelectItem>
                  <SelectItem value="Winterization">Winterization</SelectItem>
                  <SelectItem value="Electronics">Electronics</SelectItem>
                  <SelectItem value="Plumbing">Plumbing</SelectItem>
                  <SelectItem value="Rigging">Rigging</SelectItem>
                  <SelectItem value="General Service">General Service</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="priority">Default Priority</Label>
              <Select
                value={formData.default_priority}
                onValueChange={(v) => handleFormChange('default_priority', v)}
              >
                <SelectTrigger id="priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Low">Low</SelectItem>
                  <SelectItem value="Normal">Normal</SelectItem>
                  <SelectItem value="High">High</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <div className="flex items-center gap-3 pb-2">
                <Checkbox
                  checked={formData.is_active}
                  onCheckedChange={(v) => handleFormChange('is_active', v)}
                />
                <Label>Active</Label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Template Items Section */}
      {!isNewTemplate && (
        <div className="space-y-4">
          {/* AI Task Generator */}
          <Card>
            <CardContent className="p-6">
              <AITaskGenerator onTasksGenerated={handleTasksGenerated} />
            </CardContent>
          </Card>

          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Template Tasks ({items.length})</h2>
              <p className="text-sm text-slate-500">Drag to reorder tasks</p>
            </div>
            <Button
              onClick={() => {
                setEditingItem(null);
                setShowItemForm(true);
              }}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Task
            </Button>
          </div>

          {showItemForm && (
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="p-4">
                <TemplateItemForm
                  item={editingItem}
                  onSave={handleSaveItem}
                  onCancel={() => {
                    setShowItemForm(false);
                    setEditingItem(null);
                  }}
                />
              </CardContent>
            </Card>
          )}

          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="items">
              {(provided) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className="space-y-2"
                >
                  {items.map((item, index) => (
                    <Draggable key={item.id} draggableId={item.id} index={index}>
                      {(provided) => (
                        <Card
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className="hover:shadow-md transition-shadow"
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <div
                                {...provided.dragHandleProps}
                                className="mt-1 cursor-grab active:cursor-grabbing"
                              >
                                <GripVertical className="h-5 w-5 text-slate-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Badge variant="outline" className="text-xs">
                                    #{index + 1}
                                  </Badge>
                                  <p className="font-medium text-slate-900">{item.title}</p>
                                  {item.is_optional && (
                                    <Badge className="bg-slate-100 text-slate-600 text-xs">
                                      Optional
                                    </Badge>
                                  )}
                                  {item.requires_customer_approval && (
                                    <Badge className="bg-amber-100 text-amber-700 text-xs">
                                      Requires Approval
                                    </Badge>
                                  )}
                                </div>
                                {item.description && (
                                  <p className="text-sm text-slate-600 mt-1">{item.description}</p>
                                )}
                                <div className="flex flex-wrap gap-3 mt-2 text-xs text-slate-500">
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
                                {item.required_tools_note && (
                                  <p className="text-xs text-slate-500 mt-2">
                                    🔧 {item.required_tools_note}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    setEditingItem(item);
                                    setShowItemForm(true);
                                  }}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteItem(item.id)}
                                >
                                  <Trash2 className="h-4 w-4 text-red-600" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>

          {items.length === 0 && !showItemForm && (
            <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-lg">
              <p className="text-slate-500">No tasks yet. Add your first task to the template.</p>
            </div>
          )}
        </div>
      )}

      {isNewTemplate && (
        <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-lg">
          <CheckCircle2 className="h-12 w-12 mx-auto text-slate-300 mb-4" />
          <p className="text-slate-600 font-medium">Save the template first</p>
          <p className="text-sm text-slate-500 mt-1">Then you can add tasks to it</p>
        </div>
      )}
    </div>
  );
}