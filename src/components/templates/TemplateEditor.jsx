import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
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
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, GripVertical, Edit, Trash2 } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import TemplateItemForm from './TemplateItemForm';

export default function TemplateEditor({ template, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'General Service',
    is_active: true,
    default_priority: 'Normal',
    tags: [],
    ...template
  });
  const [items, setItems] = useState([]);
  const [showItemForm, setShowItemForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (template?.id) {
      loadItems();
    }
  }, [template?.id]);

  const loadItems = async () => {
    try {
      const itemsData = await base44.entities.TaskTemplateItem.filter(
        { template_list_id: template.id },
        'sort_order'
      );
      setItems(itemsData);
    } catch (error) {
      console.error('Error loading items:', error);
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
    if (!template?.id) {
      alert('Please save the template first before adding tasks.');
      return;
    }

    try {
      if (editingItem) {
        await base44.entities.TaskTemplateItem.update(editingItem.id, itemData);
      } else {
        await base44.entities.TaskTemplateItem.create({
          ...itemData,
          template_list_id: template.id,
          sort_order: items.length
        });
      }
      await loadItems();
      setShowItemForm(false);
      setEditingItem(null);
    } catch (error) {
      console.error('Error saving item:', error);
      alert('Failed to save task: ' + error.message);
    }
  };

  const handleDeleteItem = async (itemId) => {
    if (window.confirm('Delete this task item?')) {
      try {
        await base44.entities.TaskTemplateItem.delete(itemId);
        await loadItems();
      } catch (error) {
        console.error('Error deleting item:', error);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    
    setSaving(true);

    try {
      if (template?.id) {
        await base44.entities.TaskTemplateList.update(template.id, formData);
      } else {
        await base44.entities.TaskTemplateList.create(formData);
      }
      await onSave();
    } catch (error) {
      console.error('Error saving template:', error);
      alert('Failed to save template: ' + error.message);
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Template Metadata */}
      <div className="space-y-4">
        <div>
          <Label htmlFor="name">Template Name *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., Annual Service Outboard"
            required
          />
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={formData.description || ''}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="What is this template for?"
            rows={2}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="category">Category</Label>
            <Select
              value={formData.category}
              onValueChange={(v) => setFormData({ ...formData, category: v })}
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
              onValueChange={(v) => setFormData({ ...formData, default_priority: v })}
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
        </div>

        <div className="flex items-center gap-3">
          <Checkbox
            checked={formData.is_active}
            onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
          />
          <Label>Active (visible for use)</Label>
        </div>
      </div>

      {/* Template Items (only shown when editing existing template) */}
      {template?.id && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-900">Template Tasks ({items.length})</h3>
              <p className="text-sm text-slate-500">Drag to reorder</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setEditingItem(null);
                setShowItemForm(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Task
            </Button>
          </div>

          {showItemForm ? (
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
          ) : null}

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
                          <CardContent className="p-3">
                            <div className="flex items-start gap-3">
                              <div
                                {...provided.dragHandleProps}
                                className="mt-1 cursor-grab active:cursor-grabbing"
                              >
                                <GripVertical className="h-5 w-5 text-slate-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-xs">
                                    #{index + 1}
                                  </Badge>
                                  <p className="font-medium text-slate-900">{item.title}</p>
                                  {item.is_optional && (
                                    <Badge className="bg-slate-100 text-slate-600 text-xs">
                                      Optional
                                    </Badge>
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
                              <div className="flex items-center gap-1">
                                <Button
                                  type="button"
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
                                  type="button"
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
            <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-lg">
              <p className="text-slate-500">No tasks yet. Add your first task to the template.</p>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700">
          {saving ? 'Saving...' : template ? 'Update Template' : 'Create Template'}
        </Button>
      </div>
    </form>
  );
}