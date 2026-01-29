import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Sparkles, 
  Plus, 
  CheckCircle2, 
  ShoppingCart, 
  Package, 
  Wrench,
  Truck,
  AlertCircle,
  Edit,
  Trash2
} from 'lucide-react';

const typeIcons = {
  SparePart: Package,
  Material: ShoppingCart,
  Tool: Wrench,
  Vehicle: Truck,
  Other: AlertCircle
};

const typeColors = {
  SparePart: 'bg-purple-100 text-purple-700',
  Material: 'bg-blue-100 text-blue-700',
  Tool: 'bg-amber-100 text-amber-700',
  Vehicle: 'bg-emerald-100 text-emerald-700',
  Other: 'bg-slate-100 text-slate-700'
};

const priorityColors = {
  High: 'bg-red-100 text-red-700',
  Medium: 'bg-amber-100 text-amber-700',
  Low: 'bg-slate-100 text-slate-700'
};

const statusColors = {
  NeedsClarification: 'bg-orange-100 text-orange-700',
  ToOrder: 'bg-red-100 text-red-700',
  Ordered: 'bg-blue-100 text-blue-700',
  Available: 'bg-emerald-100 text-emerald-700',
  Packed: 'bg-purple-100 text-purple-700',
  NotNeeded: 'bg-slate-100 text-slate-500'
};

export default function RequirementsSection({ workOrderId, workOrder, currentUser, isAdmin }) {
  const [requirementList, setRequirementList] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [showAll, setShowAll] = useState(true);

  useEffect(() => {
    loadRequirements();
  }, [workOrderId]);

  const loadRequirements = async () => {
    try {
      setLoading(true);
      const [lists, allItems] = await Promise.all([
        base44.entities.WorkOrderRequirementList.filter({ work_order_id: workOrderId }),
        base44.entities.WorkOrderRequirementItem.filter({ work_order_id: workOrderId })
      ]);

      if (lists && lists.length > 0) {
        setRequirementList(lists[0]);
      }
      setItems(allItems || []);
    } catch (error) {
      console.error('Error loading requirements:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateRequirements = async () => {
    try {
      setGenerating(true);
      const result = await base44.functions.invoke('generateWorkOrderRequirements', {
        work_order_id: workOrderId
      });

      if (result.data.success) {
        await loadRequirements();
      } else if (result.data.insufficient_detail) {
        alert(result.data.error);
      } else {
        alert('Failed to generate requirements: ' + result.data.error);
      }
    } catch (error) {
      console.error('Error generating requirements:', error);
      alert('Error generating requirements');
    } finally {
      setGenerating(false);
    }
  };

  const handleHaveItem = async (item) => {
    try {
      await base44.entities.WorkOrderRequirementItem.update(item.id, {
        checklist_state: 'ConfirmedAvailable'
      });
      await loadRequirements();
    } catch (error) {
      console.error('Error updating item:', error);
    }
  };

  const handlePackItem = async (item) => {
    try {
      await base44.entities.WorkOrderRequirementItem.update(item.id, {
        checklist_state: 'Packed'
      });
      await loadRequirements();
    } catch (error) {
      console.error('Error updating item:', error);
    }
  };

  const handleResetItem = async (itemId) => {
    try {
      await base44.entities.WorkOrderRequirementItem.update(itemId, {
        checklist_state: 'Missing'
      });
      await loadRequirements();
    } catch (error) {
      console.error('Error resetting item:', error);
    }
  };

  const handleDeleteItem = async (itemId) => {
    if (!window.confirm('Delete this requirement item?')) return;
    try {
      await base44.entities.WorkOrderRequirementItem.delete(itemId);
      await loadRequirements();
    } catch (error) {
      console.error('Error deleting item:', error);
    }
  };

  const handleMarkReviewed = async () => {
    if (!requirementList) return;
    try {
      await base44.entities.WorkOrderRequirementList.update(requirementList.id, {
        status: 'Active',
        reviewed_by_user_id: currentUser?.id,
        reviewed_at: new Date().toISOString()
      });
      await loadRequirements();
    } catch (error) {
      console.error('Error marking as reviewed:', error);
    }
  };

  // Sort items: unchecked first, then SparePart first, then by priority
  const sortedItems = [...items].sort((a, b) => {
    // Unchecked items always come first
    if (a.checked !== b.checked) {
      return a.checked ? 1 : -1;
    }

    // Type priority (SparePart first)
    const typeOrder = { SparePart: 0, Material: 1, Tool: 2, Vehicle: 3, Other: 4 };
    const typeCompare = (typeOrder[a.type] || 5) - (typeOrder[b.type] || 5);
    if (typeCompare !== 0) return typeCompare;

    // Priority
    const priorityOrder = { High: 0, Medium: 1, Low: 2 };
    const priorityCompare = (priorityOrder[a.priority] || 3) - (priorityOrder[b.priority] || 3);
    if (priorityCompare !== 0) return priorityCompare;

    return 0;
  });

  const displayItems = sortedItems;

  const checkedCount = items.filter(i => i.checked).length;
  const totalCount = items.length;

  if (loading) {
    return <div className="py-4 text-slate-500">Loading requirements...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Requirements / Shopping List
            </CardTitle>
            {totalCount > 0 && (
              <p className="text-sm text-slate-500 mt-1">
                {checkedCount}/{totalCount} checked {requirementList?.status && `• ${requirementList.status}`}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            {isAdmin && (
              <>
                <Button
                  onClick={handleGenerateRequirements}
                  disabled={generating}
                  variant="outline"
                  size="sm"
                  className="bg-purple-50 hover:bg-purple-100"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  {generating ? 'Generating...' : 'AI Suggest'}
                </Button>
                {requirementList?.status === 'Draft' && items.length > 0 && (
                  <Button onClick={handleMarkReviewed} size="sm" variant="outline">
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Mark as Reviewed
                  </Button>
                )}
                <Button onClick={() => setShowAddDialog(true)} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <ShoppingCart className="h-12 w-12 mx-auto mb-3 text-slate-300" />
            <p>No requirements yet</p>
            {isAdmin && (
              <p className="text-sm mt-2">
                Click "AI Suggest" to generate a checklist or "Add Item" to add manually
              </p>
            )}
          </div>
        ) : (
          <>


            <div className="space-y-2">
              {displayItems.map((item) => {
                const TypeIcon = typeIcons[item.type] || AlertCircle;
                return (
                  <div
                     key={item.id}
                     className={`flex items-start gap-3 p-3 border rounded-lg transition-colors ${
                       item.checklist_state === 'Packed' 
                         ? 'bg-green-50 border-green-500 border-2' 
                         : item.checklist_state === 'ConfirmedAvailable'
                         ? 'bg-white border-green-300 border-2'
                         : 'bg-white hover:bg-slate-50'
                     }`}
                   >
                     <div className="flex-1 min-w-0">
                       <div className="flex items-start gap-2 mb-2">
                         <TypeIcon className="h-4 w-4 mt-0.5 text-slate-400 flex-shrink-0" />
                         <div className="flex-1">
                           <p className={`font-medium ${item.checklist_state === 'Packed' ? 'text-green-700 line-through' : 'text-slate-900'}`}>{item.name}</p>
                           {item.notes && (
                             <p className={`text-xs mt-1 ${item.checklist_state === 'Packed' ? 'text-green-600' : 'text-slate-500'}`}>{item.notes}</p>
                           )}
                         </div>
                       </div>

                       <div className="flex flex-wrap gap-2">
                         <Badge className={typeColors[item.type]}>{item.type}</Badge>
                         <Badge className={priorityColors[item.priority]}>{item.priority}</Badge>
                         <Badge className={statusColors[item.procurement_status]}>
                           {item.procurement_status}
                         </Badge>
                         {item.quantity && (
                           <Badge variant="outline">
                             {item.quantity} {item.unit}
                           </Badge>
                         )}
                         {item.origin === 'AI' && (
                           <Badge variant="outline" className="bg-purple-50">
                             <Sparkles className="h-3 w-3 mr-1" />
                             AI
                           </Badge>
                         )}
                       </div>
                     </div>

                     <div className="flex gap-1 flex-shrink-0">
                       {item.checklist_state !== 'Packed' && (
                         <>
                           {isAdmin && item.checklist_state !== 'ConfirmedAvailable' && (
                             <Button
                               variant="outline"
                               size="sm"
                               onClick={() => handleHaveItem(item)}
                               className="text-xs border-green-300 hover:bg-green-50"
                             >
                               Have it
                             </Button>
                           )}
                           <Button
                             variant="outline"
                             size="sm"
                             onClick={() => handlePackItem(item)}
                             className="text-xs border-blue-300 hover:bg-blue-50"
                           >
                             Packed
                           </Button>
                         </>
                       )}
                       {item.checklist_state !== 'Missing' && (
                         <Button
                           variant="ghost"
                           size="sm"
                           onClick={() => handleResetItem(item.id)}
                           className="text-xs text-slate-500"
                         >
                           Reset
                         </Button>
                       )}
                     </div>

                     {isAdmin && (
                       <div className="flex gap-1">
                         <Button
                           variant="ghost"
                           size="icon"
                           onClick={() => setEditingItem(item)}
                         >
                           <Edit className="h-4 w-4" />
                         </Button>
                         <Button
                           variant="ghost"
                           size="icon"
                           onClick={() => handleDeleteItem(item.id)}
                           className="text-red-600"
                         >
                           <Trash2 className="h-4 w-4" />
                         </Button>
                       </div>
                     )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>

      {/* Add/Edit Dialog */}
      <RequirementItemDialog
        open={showAddDialog || !!editingItem}
        onOpenChange={(open) => {
          if (!open) {
            setShowAddDialog(false);
            setEditingItem(null);
          }
        }}
        item={editingItem}
        workOrderId={workOrderId}
        requirementListId={requirementList?.id}
        onSave={async () => {
          await loadRequirements();
          setShowAddDialog(false);
          setEditingItem(null);
        }}
      />
    </Card>
  );
}

function RequirementItemDialog({ open, onOpenChange, item, workOrderId, requirementListId, onSave }) {
  const [formData, setFormData] = useState({
    type: 'Material',
    name: '',
    quantity: 1,
    unit: 'pcs',
    priority: 'Medium',
    procurement_status: 'ToOrder',
    notes: ''
  });

  useEffect(() => {
    if (item) {
      setFormData({
        type: item.type,
        name: item.name,
        quantity: item.quantity || 1,
        unit: item.unit || 'pcs',
        priority: item.priority,
        procurement_status: item.procurement_status,
        notes: item.notes || ''
      });
    } else {
      setFormData({
        type: 'Material',
        name: '',
        quantity: 1,
        unit: 'pcs',
        priority: 'Medium',
        procurement_status: 'ToOrder',
        notes: ''
      });
    }
  }, [item, open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (item) {
        await base44.entities.WorkOrderRequirementItem.update(item.id, formData);
      } else {
        // Create list if doesn't exist
        let listId = requirementListId;
        if (!listId) {
          const newList = await base44.entities.WorkOrderRequirementList.create({
            work_order_id: workOrderId,
            status: 'Draft'
          });
          listId = newList.id;
        }

        await base44.entities.WorkOrderRequirementItem.create({
          ...formData,
          requirement_list_id: listId,
          work_order_id: workOrderId,
          origin: 'Manual',
          checked: false,
          checklist_state: 'Missing'
        });
      }
      onSave();
    } catch (error) {
      console.error('Error saving requirement item:', error);
      alert('Error saving item');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{item ? 'Edit Requirement' : 'Add Requirement'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type *</Label>
              <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SparePart">Spare Part</SelectItem>
                  <SelectItem value="Material">Material</SelectItem>
                  <SelectItem value="Tool">Tool</SelectItem>
                  <SelectItem value="Vehicle">Vehicle</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={formData.priority} onValueChange={(v) => setFormData({ ...formData, priority: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="High">High</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="Low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Name *</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Oil filter, Impeller, Sealant"
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input
                type="number"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) })}
                min="0"
                step="0.1"
              />
            </div>

            <div className="space-y-2">
              <Label>Unit</Label>
              <Select value={formData.unit} onValueChange={(v) => setFormData({ ...formData, unit: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pcs">pcs</SelectItem>
                  <SelectItem value="l">liters</SelectItem>
                  <SelectItem value="m">meters</SelectItem>
                  <SelectItem value="kg">kg</SelectItem>
                  <SelectItem value="set">set</SelectItem>
                  <SelectItem value="box">box</SelectItem>
                  <SelectItem value="roll">roll</SelectItem>
                  <SelectItem value="meter">meter</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={formData.procurement_status} onValueChange={(v) => setFormData({ ...formData, procurement_status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ToOrder">To Order</SelectItem>
                  <SelectItem value="Ordered">Ordered</SelectItem>
                  <SelectItem value="Available">Available</SelectItem>
                  <SelectItem value="Packed">Packed</SelectItem>
                  <SelectItem value="NeedsClarification">Needs Clarification</SelectItem>
                  <SelectItem value="NotNeeded">Not Needed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional details, specifications, or clarifications..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">
              {item ? 'Update' : 'Add'} Requirement
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}