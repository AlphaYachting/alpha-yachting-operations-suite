import React, { useState } from 'react';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Trash2, Edit, GripVertical } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { UNIT_OPTIONS, getUnitDisplay } from './unitMapping';

export default function OfferTaskEditor({ tasks, setTasks }) {
  const [editingTask, setEditingTask] = useState(null);
  const [showDialog, setShowDialog] = useState(false);

  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    unit_type: 'Hour',
    quantity: 1,
    unit_price: 50,
  });

  const openNewTask = () => {
    setTaskForm({
      title: '',
      description: '',
      unit_type: 'Hour',
      quantity: 1,
      unit_price: 50,
    });
    setEditingTask(null);
    setShowDialog(true);
  };

  const openEditTask = (task, index) => {
    setTaskForm(task);
    setEditingTask(index);
    setShowDialog(true);
  };

  const handleSaveTask = () => {
    const total_amount = taskForm.quantity * taskForm.unit_price;
    const taskToSave = { ...taskForm, total_amount };

    if (editingTask !== null) {
      const updated = [...tasks];
      updated[editingTask] = taskToSave;
      setTasks(updated);
    } else {
      setTasks([...tasks, taskToSave]);
    }

    setShowDialog(false);
  };

  const handleDeleteTask = (index) => {
    setTasks(tasks.filter((_, i) => i !== index));
  };

  const updateTaskField = (index, field, value) => {
    const updated = [...tasks];
    updated[index] = { ...updated[index], [field]: value };
    
    // Recalculate total if quantity or unit_price changes
    if (field === 'quantity' || field === 'unit_price') {
      updated[index].total_amount = updated[index].quantity * updated[index].unit_price;
    }
    
    setTasks(updated);
  };

  const moveTask = (index, direction) => {
    const newTasks = [...tasks];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (targetIndex >= 0 && targetIndex < tasks.length) {
      [newTasks[index], newTasks[targetIndex]] = [newTasks[targetIndex], newTasks[index]];
      setTasks(newTasks);
    }
  };

  return (
    <div className="space-y-4">
      {tasks.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-lg">
          <p className="text-slate-600 mb-4">No tasks added yet</p>
          <Button onClick={openNewTask} variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Add First Task
          </Button>
        </div>
      ) : (
        <>
          {tasks.map((task, index) => (
            <Card key={index} className="p-4">
              <div className="flex items-start gap-4">
                <div className="flex flex-col gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => moveTask(index, 'up')}
                    disabled={index === 0}
                  >
                    <GripVertical className="h-4 w-4 text-slate-400" />
                  </Button>
                </div>
                <div className="flex-1 space-y-3">
                  <div>
                    <h4 className="font-semibold text-slate-900">{task.title}</h4>
                    {task.description && (
                      <p className="text-sm text-slate-600 mt-1 whitespace-pre-line">{task.description}</p>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs text-slate-500">Quantity</Label>
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        value={task.quantity || 0}
                        onChange={(e) => updateTaskField(index, 'quantity', parseFloat(e.target.value) || 0)}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">Unit</Label>
                      <Select 
                        value={task.unit_type || 'Hour'} 
                        onValueChange={(v) => updateTaskField(index, 'unit_type', v)}
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {UNIT_OPTIONS.map(unit => (
                            <SelectItem key={unit.value} value={unit.value}>
                              {unit.display}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">Price/Unit (€)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={task.unit_price || 0}
                        onChange={(e) => updateTaskField(index, 'unit_price', parseFloat(e.target.value) || 0)}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t">
                    <span className="text-sm text-slate-600">Total</span>
                    <span className="text-lg font-bold text-slate-900">
                      €{((task.quantity || 0) * (task.unit_price || 0)).toFixed(2)}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEditTask(task, index)}
                  >
                    <Edit className="h-4 w-4 text-slate-600" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteTask(index)}
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
          <Button onClick={openNewTask} variant="outline" className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Add Task
          </Button>
        </>
      )}

      {/* Task Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTask !== null ? 'Edit Task' : 'New Task'}</DialogTitle>
            <DialogDescription>
              Define the task details, hours, and rate
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Task Title *</Label>
              <Input
                value={taskForm.title}
                onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                placeholder="e.g., Engine Service"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={taskForm.description}
                onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                placeholder="Detailed task description"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Charging Method *</Label>
              <Select 
                value={taskForm.unit_type} 
                onValueChange={(v) => setTaskForm({ ...taskForm, unit_type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Hour">hrs</SelectItem>
                  <SelectItem value="Piece">pcs</SelectItem>
                  <SelectItem value="Square Meter">m²</SelectItem>
                  <SelectItem value="Linear Meter">m</SelectItem>
                  <SelectItem value="Liter">L</SelectItem>
                  <SelectItem value="Kilogram">kg</SelectItem>
                  <SelectItem value="Set">set</SelectItem>
                  <SelectItem value="Lump Sum">job</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Quantity *</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  value={taskForm.quantity}
                  onChange={(e) => setTaskForm({ ...taskForm, quantity: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Unit Price (€) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={taskForm.unit_price}
                  onChange={(e) => setTaskForm({ ...taskForm, unit_price: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="p-4 bg-slate-50 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Task Total</span>
                <span className="text-lg font-bold text-slate-900">
                  €{((taskForm.quantity || 0) * (taskForm.unit_price || 0)).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveTask}
              disabled={!taskForm.title}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {editingTask !== null ? 'Update Task' : 'Add Task'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}