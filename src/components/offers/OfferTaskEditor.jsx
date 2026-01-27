import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Trash2, Edit, GripVertical } from 'lucide-react';
import { Card } from '@/components/ui/card';

export default function OfferTaskEditor({ tasks, setTasks }) {
  const [editingTask, setEditingTask] = useState(null);
  const [showDialog, setShowDialog] = useState(false);

  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    estimated_hours: 1,
    hourly_rate: 50,
  });

  const openNewTask = () => {
    setTaskForm({
      title: '',
      description: '',
      estimated_hours: 1,
      hourly_rate: 50,
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
    const total_amount = taskForm.estimated_hours * taskForm.hourly_rate;
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
                <div className="flex-1">
                  <h4 className="font-semibold text-slate-900">{task.title}</h4>
                  {task.description && (
                    <p className="text-sm text-slate-600 mt-1">{task.description}</p>
                  )}
                  <div className="flex gap-6 mt-2 text-sm text-slate-600">
                    <span>{task.estimated_hours}h</span>
                    <span>€{task.hourly_rate}/h</span>
                    <span className="font-semibold text-slate-900">
                      €{(task.estimated_hours * task.hourly_rate).toFixed(2)}
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Estimated Hours *</Label>
                <Input
                  type="number"
                  step="0.5"
                  min="0"
                  value={taskForm.estimated_hours}
                  onChange={(e) => setTaskForm({ ...taskForm, estimated_hours: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Hourly Rate (€) *</Label>
                <Input
                  type="number"
                  step="1"
                  min="0"
                  value={taskForm.hourly_rate}
                  onChange={(e) => setTaskForm({ ...taskForm, hourly_rate: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="p-4 bg-slate-50 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Task Total</span>
                <span className="text-lg font-bold text-slate-900">
                  €{(taskForm.estimated_hours * taskForm.hourly_rate).toFixed(2)}
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