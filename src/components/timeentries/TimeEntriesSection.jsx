import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Clock, Plus, Pencil, Trash2, User, Calendar, AlertCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import TimeEntryForm from './TimeEntryForm';

export default function TimeEntriesSection({ workOrderId, workOrder, tasks, technicians }) {
  const [timeEntries, setTimeEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [deletingEntry, setDeletingEntry] = useState(null);
  const [lastSelectedTechId, setLastSelectedTechId] = useState('');
  const [lastSelectedDate, setLastSelectedDate] = useState('');

  useEffect(() => {
    loadTimeEntries();
  }, [workOrderId]);

  const loadTimeEntries = async () => {
    try {
      const entries = await base44.entities.TimeEntry.filter({ work_order_id: workOrderId });
      setTimeEntries(entries);
    } catch (error) {
      console.error('Error loading time entries:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (payload, addAnother) => {
    if (editingEntry) {
      await base44.entities.TimeEntry.update(editingEntry.id, payload);
    } else {
      await base44.entities.TimeEntry.create(payload);
      setLastSelectedTechId(payload.technician_id);
      setLastSelectedDate(payload.entry_date);
    }
    
    await loadTimeEntries();
    
    if (!addAnother) {
      setShowForm(false);
      setEditingEntry(null);
    }
  };

  const handleDelete = async () => {
    if (!deletingEntry) return;
    try {
      await base44.entities.TimeEntry.delete(deletingEntry.id);
      await loadTimeEntries();
      setDeletingEntry(null);
    } catch (error) {
      console.error('Error deleting time entry:', error);
      alert('Failed to delete time entry');
    }
  };

  const getTechnicianName = (techId) => {
    const tech = technicians.find(t => t.id === techId);
    return tech ? `${tech.first_name} ${tech.last_name}` : 'Unknown';
  };

  const getTaskTitle = (taskId) => {
    if (!taskId) return '—';
    const task = tasks.find(t => t.id === taskId);
    return task?.title || 'Unknown Task';
  };

  const formatDuration = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
    if (hours > 0) return `${hours}h`;
    return `${mins}m`;
  };

  // Calculate summary statistics
  const summary = useMemo(() => {
    const totalMinutes = timeEntries.reduce((sum, entry) => sum + (entry.duration_minutes || 0), 0);
    
    const byTechnician = timeEntries.reduce((acc, entry) => {
      const techId = entry.technician_id;
      if (!acc[techId]) {
        acc[techId] = { name: getTechnicianName(techId), minutes: 0 };
      }
      acc[techId].minutes += entry.duration_minutes || 0;
      return acc;
    }, {});

    const byTask = timeEntries.reduce((acc, entry) => {
      if (!entry.task_id) {
        if (!acc['general']) acc['general'] = { title: 'General Work', minutes: 0 };
        acc['general'].minutes += entry.duration_minutes || 0;
      } else {
        if (!acc[entry.task_id]) {
          acc[entry.task_id] = { title: getTaskTitle(entry.task_id), minutes: 0 };
        }
        acc[entry.task_id].minutes += entry.duration_minutes || 0;
      }
      return acc;
    }, {});

    const estimatedMinutes = (workOrder?.estimated_duration_hours || 0) * 60;
    const deltaMinutes = totalMinutes - estimatedMinutes;

    return {
      totalMinutes,
      estimatedMinutes,
      deltaMinutes,
      byTechnician: Object.values(byTechnician),
      byTask: Object.values(byTask),
      technicianCount: Object.keys(byTechnician).length
    };
  }, [timeEntries, workOrder, technicians, tasks]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-600" />
            Time Entries
          </CardTitle>
          <p className="text-sm text-slate-500 mt-1">
            Actual time logged by technicians
          </p>
        </div>
        <Button onClick={() => { setEditingEntry(null); setShowForm(true); }} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4 mr-2" />
          Add Entry
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-slate-50 rounded-lg">
          <div>
            <p className="text-xs text-slate-500 font-medium uppercase">Total Logged</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{formatDuration(summary.totalMinutes)}</p>
            {summary.estimatedMinutes > 0 && (
              <p className="text-xs text-slate-500 mt-1">
                Estimated: {formatDuration(summary.estimatedMinutes)}
                <span className={`ml-2 font-medium ${summary.deltaMinutes > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  ({summary.deltaMinutes > 0 ? '+' : ''}{formatDuration(Math.abs(summary.deltaMinutes))})
                </span>
              </p>
            )}
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium uppercase">Technicians</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{summary.technicianCount}</p>
            <div className="mt-2 space-y-1">
              {summary.byTechnician.slice(0, 3).map((tech, idx) => (
                <p key={idx} className="text-xs text-slate-600">
                  {tech.name}: {formatDuration(tech.minutes)}
                </p>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium uppercase">Breakdown by Task</p>
            <div className="mt-2 space-y-1">
              {summary.byTask.slice(0, 3).map((task, idx) => (
                <p key={idx} className="text-xs text-slate-600">
                  {task.title}: {formatDuration(task.minutes)}
                </p>
              ))}
              {summary.byTask.length > 3 && (
                <p className="text-xs text-slate-500">+{summary.byTask.length - 3} more</p>
              )}
            </div>
          </div>
        </div>

        {/* Time Entries List */}
        {loading ? (
          <div className="text-center py-8 text-slate-500">Loading time entries...</div>
        ) : timeEntries.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <Clock className="h-12 w-12 mx-auto text-slate-300 mb-3" />
            <p className="text-lg font-medium">No time entries yet</p>
            <p className="text-sm mt-1">Add your first time entry to track work performed</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">Date</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">Technician</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">Task</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">Duration</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">Notes</th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-slate-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {timeEntries.map((entry) => (
                  <tr key={entry.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-slate-400" />
                        <span className="text-sm text-slate-900">
                          {format(parseISO(entry.entry_date), 'MMM d, yyyy')}
                        </span>
                        {entry.start_time && (
                          <span className="text-xs text-slate-500">{entry.start_time}</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-slate-400" />
                        <span className="text-sm text-slate-900">{getTechnicianName(entry.technician_id)}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-slate-600">{getTaskTitle(entry.task_id)}</span>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="outline" className="font-mono">
                        {formatDuration(entry.duration_minutes)}
                      </Badge>
                      {!entry.is_billable && (
                        <Badge variant="outline" className="ml-2 text-orange-700 border-orange-300">
                          Non-billable
                        </Badge>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-slate-600 line-clamp-1">
                        {entry.notes || '—'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-2">
                        {entry.is_locked && (
                          <Badge variant="outline" className="text-xs">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Locked
                          </Badge>
                        )}
                        {!entry.is_locked && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => { setEditingEntry(entry); setShowForm(true); }}
                            >
                              <Pencil className="h-4 w-4 text-slate-500" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeletingEntry(entry)}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      {/* Add/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => { setShowForm(open); if (!open) setEditingEntry(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingEntry ? 'Edit Time Entry' : 'Add Time Entry'}</DialogTitle>
          </DialogHeader>
          <TimeEntryForm
            timeEntry={editingEntry}
            workOrderId={workOrderId}
            tasks={tasks}
            technicians={technicians}
            onSave={handleSave}
            onCancel={() => { setShowForm(false); setEditingEntry(null); }}
            lastSelectedTechId={lastSelectedTechId}
            lastSelectedDate={lastSelectedDate}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingEntry} onOpenChange={(open) => !open && setDeletingEntry(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Time Entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this time entry. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}