import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle2, 
  Circle, 
  AlertCircle, 
  Edit2, 
  Trash2, 
  Wand2,
  Loader2
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const statusColors = {
  'Pending': 'bg-slate-100 text-slate-700',
  'In Progress': 'bg-blue-100 text-blue-700',
  'Completed': 'bg-emerald-100 text-emerald-700',
  'Blocked': 'bg-red-100 text-red-700'
};

const categoryColors = {
  'Information': 'bg-cyan-100 text-cyan-700',
  'Inspection': 'bg-purple-100 text-purple-700',
  'Quote': 'bg-amber-100 text-amber-700',
  'Follow-up': 'bg-blue-100 text-blue-700',
  'Documentation': 'bg-slate-100 text-slate-700',
  'Other': 'bg-gray-100 text-gray-700'
};

const statusIcons = {
  'Pending': Circle,
  'In Progress': AlertCircle,
  'Completed': CheckCircle2,
  'Blocked': AlertCircle
};

export default function LeadTaskList({ leadId, leadDescription, onTasksGenerated }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generatingTasks, setGeneratingTasks] = useState(false);

  React.useEffect(() => {
    loadTasks();
  }, [leadId]);

  const loadTasks = async () => {
    try {
      setLoading(true);
      const leadTasks = await base44.entities.LeadTask.filter({ lead_id: leadId }, '-created_date');
      setTasks(leadTasks);
    } catch (error) {
      console.error('Error loading tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateTasks = async () => {
    if (!leadDescription?.trim()) {
      alert('Please add a description/email/transcript to the lead first');
      return;
    }

    try {
      setGeneratingTasks(true);
      const response = await base44.functions.invoke('generateLeadTasks', {
        lead_id: leadId,
        description: leadDescription
      });

      if (response.data.success) {
        await loadTasks();
        if (onTasksGenerated) {
          onTasksGenerated(response.data.tasks_generated);
        }
      }
    } catch (error) {
      console.error('Error generating tasks:', error);
      alert('Failed to generate tasks');
    } finally {
      setGeneratingTasks(false);
    }
  };

  const handleStatusChange = async (taskId, newStatus) => {
    try {
      await base44.entities.LeadTask.update(taskId, { status: newStatus });
      setTasks(tasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (window.confirm('Delete this task?')) {
      try {
        await base44.entities.LeadTask.delete(taskId);
        setTasks(tasks.filter(t => t.id !== taskId));
      } catch (error) {
        console.error('Error deleting task:', error);
      }
    }
  };

  const completedCount = tasks.filter(t => t.status === 'Completed').length;
  const blockedCount = tasks.filter(t => t.status === 'Blocked').length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle>Tasks & Checklist</CardTitle>
          {tasks.length > 0 && (
            <p className="text-sm text-slate-500 mt-1">
              {completedCount}/{tasks.length} completed
              {blockedCount > 0 && ` • ${blockedCount} blocked`}
            </p>
          )}
        </div>
        <Button
          onClick={handleGenerateTasks}
          disabled={generatingTasks}
          variant="outline"
          size="sm"
          className="gap-2"
        >
          {generatingTasks ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Wand2 className="h-4 w-4" />
          )}
          {generatingTasks ? 'Generating...' : 'AI Generate'}
        </Button>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-slate-500">Loading tasks...</div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-slate-500 mb-4">No tasks yet. Paste an email/transcript above and generate tasks.</p>
            <Button
              onClick={handleGenerateTasks}
              disabled={generatingTasks || !leadDescription?.trim()}
              size="sm"
            >
              {generatingTasks ? 'Generating...' : 'Generate Tasks from Description'}
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {tasks.map(task => {
              const StatusIcon = statusIcons[task.status];
              return (
                <div
                  key={task.id}
                  className="p-3 rounded-lg border border-slate-200 hover:border-slate-300 bg-slate-50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="pt-0.5">
                      <StatusIcon className={`h-5 w-5 ${
                        task.status === 'Completed' ? 'text-emerald-600' :
                        task.status === 'Blocked' ? 'text-red-600' :
                        task.status === 'In Progress' ? 'text-blue-600' :
                        'text-slate-400'
                      }`} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2 flex-wrap">
                        <h4 className="font-medium text-slate-900 flex-1">{task.title}</h4>
                        <Badge className={categoryColors[task.category]} variant="secondary">
                          {task.category}
                        </Badge>
                      </div>

                      {task.description && (
                        <p className="text-sm text-slate-600 mt-1">{task.description}</p>
                      )}

                      {task.notes && (
                        <div className="bg-white p-2 rounded mt-2 border border-slate-200">
                          <p className="text-xs text-slate-600"><strong>Notes:</strong> {task.notes}</p>
                        </div>
                      )}
                    </div>

                    <Select value={task.status} onValueChange={(val) => handleStatusChange(task.id, val)}>
                      <SelectTrigger className="w-32 ml-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Pending">Pending</SelectItem>
                        <SelectItem value="In Progress">In Progress</SelectItem>
                        <SelectItem value="Completed">Completed</SelectItem>
                        <SelectItem value="Blocked">Blocked</SelectItem>
                      </SelectContent>
                    </Select>

                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDeleteTask(task.id)}
                      className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Progress Bar */}
        {tasks.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-200">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-slate-600">Overall Progress</span>
              <span className="font-medium text-slate-900">
                {Math.round((completedCount / tasks.length) * 100)}%
              </span>
            </div>
            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-600 transition-all"
                style={{ width: `${(completedCount / tasks.length) * 100}%` }}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}