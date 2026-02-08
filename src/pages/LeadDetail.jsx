import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link, useSearchParams } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  ArrowLeft, 
  Calendar,
  User,
  Mail,
  Phone,
  Ship,
  MapPin,
  CheckCircle2,
  Circle,
  Clock,
  Plus,
  Edit,
  Trash2,
  Send,
  MessageSquare,
  Sparkles,
  FileText
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { format, parseISO } from 'date-fns';

const statusColors = {
  Pending: 'bg-slate-100 text-slate-700',
  Contacted: 'bg-blue-100 text-blue-700',
  Converted: 'bg-emerald-100 text-emerald-700',
  Rejected: 'bg-red-100 text-red-700',
  Lost: 'bg-slate-100 text-slate-500'
};

const taskStatusColors = {
  Pending: 'bg-slate-100 text-slate-700',
  'In Progress': 'bg-blue-100 text-blue-700',
  Completed: 'bg-emerald-100 text-emerald-700',
  Blocked: 'bg-red-100 text-red-700'
};

const priorityColors = {
  Low: 'bg-blue-100 text-blue-700',
  Medium: 'bg-amber-100 text-amber-700',
  High: 'bg-red-100 text-red-700',
  Urgent: 'bg-purple-100 text-purple-700'
};

export default function LeadDetail() {
  const [searchParams] = useSearchParams();
  const leadId = searchParams.get('id');

  const [lead, setLead] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [taskComments, setTaskComments] = useState({});
  const [location, setLocation] = useState(null);
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [selectedTaskForComment, setSelectedTaskForComment] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [generatingTasks, setGeneratingTasks] = useState(false);
  const [creatingOffer, setCreatingOffer] = useState(false);

  useEffect(() => {
    loadCurrentUser();
    if (leadId) {
      loadLeadDetails();
    }
  }, [leadId]);

  const loadCurrentUser = async () => {
    try {
      const user = await base44.auth.me();
      setCurrentUser(user);
    } catch (error) {
      console.error('Error loading user:', error);
    }
  };

  const loadLeadDetails = async () => {
    try {
      const [leadData, allTasks, allComments] = await Promise.all([
        base44.entities.Lead.filter({ id: leadId }),
        base44.entities.LeadTask.filter({ lead_id: leadId }),
        base44.entities.LeadTaskComment.list()
      ]);

      if (leadData.length === 0) {
        setLoading(false);
        return;
      }

      const leadRecord = leadData[0];
      setLead(leadRecord);
      setTasks(allTasks);

      // Group comments by task
      const commentsByTask = {};
      allComments.forEach(comment => {
        if (!commentsByTask[comment.lead_task_id]) {
          commentsByTask[comment.lead_task_id] = [];
        }
        commentsByTask[comment.lead_task_id].push(comment);
      });
      setTaskComments(commentsByTask);

      // Load created offers
      if (leadRecord.created_offer_ids && leadRecord.created_offer_ids.length > 0) {
        const offerPromises = leadRecord.created_offer_ids.map(offerId =>
          base44.entities.Offer.filter({ id: offerId })
        );
        const offerResults = await Promise.all(offerPromises);
        setOffers(offerResults.flat().filter(o => o));
      }

      if (leadRecord.location_id) {
        const [locData] = await base44.entities.Location.filter({ id: leadRecord.location_id });
        if (locData) setLocation(locData);
      }
    } catch (error) {
      console.error('Error loading lead details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!commentText.trim() || !selectedTaskForComment) return;

    try {
      const newComment = {
        lead_task_id: selectedTaskForComment.id,
        author_name: currentUser?.full_name || 'Unknown',
        author_email: currentUser?.email || '',
        content: commentText
      };

      await base44.entities.LeadTaskComment.create(newComment);
      await loadLeadDetails();
      setCommentText('');
      setSelectedTaskForComment(null);
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (window.confirm('Are you sure you want to delete this comment?')) {
      try {
        await base44.entities.LeadTaskComment.delete(commentId);
        await loadLeadDetails();
      } catch (error) {
        console.error('Error deleting comment:', error);
      }
    }
  };

  const handleTaskSave = async (taskData) => {
    try {
      if (editingTask) {
        await base44.entities.LeadTask.update(editingTask.id, taskData);
      } else {
        await base44.entities.LeadTask.create({ ...taskData, lead_id: leadId });
      }
      await loadLeadDetails();
      setShowTaskForm(false);
      setEditingTask(null);
    } catch (error) {
      console.error('Error saving task:', error);
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (window.confirm('Are you sure you want to delete this task?')) {
      try {
        await base44.entities.LeadTask.delete(taskId);
        await loadLeadDetails();
      } catch (error) {
        console.error('Error deleting task:', error);
      }
    }
  };

  const handleGenerateTasks = async () => {
    if (!lead.description) {
      alert('Lead must have a description to generate tasks');
      return;
    }

    try {
      setGeneratingTasks(true);
      const result = await base44.functions.invoke('generateLeadTasks', {
        lead_id: lead.id,
        lead_description: lead.description
      });

      if (result.data.success) {
        await loadLeadDetails();
      } else {
        alert('Failed to generate tasks: ' + result.data.error);
      }
    } catch (error) {
      console.error('Error generating tasks:', error);
      alert('Error generating tasks');
    } finally {
      setGeneratingTasks(false);
    }
  };

  const handleCreateOffer = async () => {
    try {
      setCreatingOffer(true);
      const result = await base44.functions.invoke('createOfferFromLead', {
        lead_id: lead.id
      });

      if (result.data.success) {
        window.location.href = createPageUrl('OfferDetail') + `?id=${result.data.offer_id}`;
      } else {
        alert('Failed to create offer: ' + result.data.error);
      }
    } catch (error) {
      console.error('Error creating offer:', error);
      alert('Error creating offer');
    } finally {
      setCreatingOffer(false);
    }
  };

  const completedTasks = tasks.filter(t => t.status === 'Completed').length;
  const totalTasks = tasks.length;
  const taskProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-slate-900">Lead not found</h3>
        <Button asChild className="mt-4">
          <Link to={createPageUrl('Leads')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Leads
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <Button asChild variant="ghost" size="sm" className="mb-3">
            <Link to={createPageUrl('Leads')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Leads
            </Link>
          </Button>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-900">{lead.name}</h1>
            <Badge className={statusColors[lead.status]}>{lead.status}</Badge>
            <Badge className={priorityColors[lead.priority]}>{lead.priority}</Badge>
          </div>
          <p className="text-slate-500 mt-1">{lead.inquiry_type}</p>
        </div>
        <Button
          onClick={handleCreateOffer}
          disabled={creatingOffer}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          <FileText className="h-4 w-4 mr-2" />
          {creatingOffer ? 'Creating...' : 'Create Offer'}
        </Button>
      </div>

      {/* Overview Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <Phone className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Phone</p>
                <p className="text-sm font-semibold text-slate-900">{lead.phone}</p>
                {lead.email && <p className="text-xs text-slate-500">{lead.email}</p>}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-100">
                <Ship className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Boat</p>
                <p className="text-sm font-semibold text-slate-900">{lead.boat_name || 'Not specified'}</p>
                {lead.boat_details && <p className="text-xs text-slate-500 truncate">{lead.boat_details}</p>}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100">
                <CheckCircle2 className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Progress</p>
                <p className="text-sm font-semibold text-slate-900">
                  {completedTasks}/{totalTasks} tasks
                </p>
                <p className="text-xs text-slate-500">{taskProgress}% complete</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Created Offers */}
      {offers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Created Offers ({offers.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {offers.map((offer) => (
                <Link
                  key={offer.id}
                  to={createPageUrl('OfferDetail') + `?id=${offer.id}`}
                  className="block p-3 border border-slate-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-slate-900">{offer.title}</p>
                      <p className="text-xs text-slate-500">{offer.offer_number}</p>
                    </div>
                    <Badge className={
                      offer.status === 'Draft' ? 'bg-slate-100 text-slate-700' :
                      offer.status === 'Sent' ? 'bg-blue-100 text-blue-700' :
                      offer.status === 'Approved' ? 'bg-emerald-100 text-emerald-700' :
                      'bg-slate-100 text-slate-500'
                    }>
                      {offer.status}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lead Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Lead Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {lead.description && (
            <div>
              <p className="text-sm font-medium text-slate-700 mb-1">Description</p>
              <p className="text-sm text-slate-600 whitespace-pre-wrap">{lead.description}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {location && (
              <div>
                <p className="text-sm font-medium text-slate-700 mb-1">Location</p>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <MapPin className="h-4 w-4 text-slate-400" />
                  {location.name}
                </div>
              </div>
            )}

            <div>
              <p className="text-sm font-medium text-slate-700 mb-1">Contact Method</p>
              <p className="text-sm text-slate-600">{lead.contact_method}</p>
            </div>

            {lead.last_contacted_at && (
              <div>
                <p className="text-sm font-medium text-slate-700 mb-1">Last Contacted</p>
                <p className="text-sm text-slate-600">{format(parseISO(lead.last_contacted_at), 'MMM d, yyyy')}</p>
              </div>
            )}
          </div>

          {lead.notes && (
            <div>
              <p className="text-sm font-medium text-slate-700 mb-1">Notes</p>
              <p className="text-sm text-slate-600 whitespace-pre-wrap">{lead.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tasks Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold">Tasks ({tasks.length})</CardTitle>
          <div className="flex gap-2">
            {lead.description && (
              <Button
                onClick={handleGenerateTasks}
                disabled={generatingTasks}
                className="bg-purple-600 hover:bg-purple-700"
                size="sm"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                {generatingTasks ? 'Generating...' : 'AI Generate'}
              </Button>
            )}
            <Button
              onClick={() => {
                setEditingTask(null);
                setShowTaskForm(true);
              }}
              className="bg-blue-600 hover:bg-blue-700"
              size="sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Task
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <p>No tasks yet. Click "Add Task" to create one.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {tasks.map((task) => {
                const taskCommentsForThis = taskComments[task.id] || [];
                return (
                  <div key={task.id} className="p-4 border border-slate-200 rounded-lg">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="mt-0.5">
                          {task.status === 'Completed' ? (
                            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                          ) : task.status === 'In Progress' ? (
                            <Clock className="h-5 w-5 text-blue-500" />
                          ) : (
                            <Circle className="h-5 w-5 text-slate-300" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-slate-900">{task.title}</p>
                            <Badge className={taskStatusColors[task.status]}>{task.status}</Badge>
                            {task.category && <Badge variant="outline">{task.category}</Badge>}
                          </div>
                          {task.description && (
                            <p className="text-sm text-slate-600 mt-1">{task.description}</p>
                          )}
                          {task.due_date && (
                            <div className="flex items-center gap-2 mt-2">
                              <Calendar className="h-3 w-3 text-slate-400" />
                              <span className="text-xs text-slate-500">
                                Due: {format(parseISO(task.due_date), 'MMM d, yyyy')}
                              </span>
                            </div>
                          )}
                          {task.assigned_to && (
                            <div className="flex items-center gap-2 mt-1">
                              <User className="h-3 w-3 text-slate-400" />
                              <span className="text-xs text-slate-500">{task.assigned_to}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedTaskForComment(task)}
                        >
                          <MessageSquare className="h-4 w-4 mr-1" />
                          {taskCommentsForThis.length > 0 && `(${taskCommentsForThis.length})`}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditingTask(task);
                            setShowTaskForm(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteTask(task.id)}
                          className="text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Task Comments */}
                    {taskCommentsForThis.length > 0 && (
                      <div className="mt-3 pl-8 space-y-2 border-l-2 border-slate-200">
                        {taskCommentsForThis.map((comment) => (
                          <div key={comment.id} className="bg-slate-50 rounded-lg p-3">
                            <div className="flex justify-between items-start gap-2 mb-1">
                              <div>
                                <p className="font-semibold text-xs text-slate-900">{comment.author_name}</p>
                                <p className="text-xs text-slate-500">{format(parseISO(comment.created_date), 'MMM d, HH:mm')}</p>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteComment(comment.id)}
                                className="h-6 w-6 text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                            <p className="text-sm text-slate-700">{comment.content}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Task Form Dialog */}
      <Dialog open={showTaskForm} onOpenChange={setShowTaskForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingTask ? 'Edit Task' : 'Add New Task'}</DialogTitle>
          </DialogHeader>
          <TaskForm
            task={editingTask}
            onSave={handleTaskSave}
            onCancel={() => {
              setShowTaskForm(false);
              setEditingTask(null);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Comment Dialog */}
      <Dialog open={!!selectedTaskForComment} onOpenChange={(open) => !open && setSelectedTaskForComment(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Comment</DialogTitle>
          </DialogHeader>
          {selectedTaskForComment && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-slate-700 mb-1">Task</p>
                <p className="text-sm text-slate-600">{selectedTaskForComment.title}</p>
              </div>
              <div className="space-y-2">
                <Label>Comment</Label>
                <Textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Add a comment..."
                  rows={4}
                />
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setSelectedTaskForComment(null)}>
                  Cancel
                </Button>
                <Button onClick={handleAddComment} disabled={!commentText.trim()}>
                  <Send className="h-4 w-4 mr-2" />
                  Add Comment
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TaskForm({ task, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    title: task?.title || '',
    description: task?.description || '',
    status: task?.status || 'Pending',
    category: task?.category || 'Information',
    assigned_to: task?.assigned_to || '',
    due_date: task?.due_date || '',
    notes: task?.notes || ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Title *</Label>
        <Input
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          required
        />
      </div>

      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Pending">Pending</SelectItem>
              <SelectItem value="In Progress">In Progress</SelectItem>
              <SelectItem value="Completed">Completed</SelectItem>
              <SelectItem value="Blocked">Blocked</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Category</Label>
          <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Information">Information</SelectItem>
              <SelectItem value="Inspection">Inspection</SelectItem>
              <SelectItem value="Quote">Quote</SelectItem>
              <SelectItem value="Follow-up">Follow-up</SelectItem>
              <SelectItem value="Documentation">Documentation</SelectItem>
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Assigned To</Label>
          <Input
            value={formData.assigned_to}
            onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
            placeholder="Email or name"
          />
        </div>

        <div className="space-y-2">
          <Label>Due Date</Label>
          <Input
            type="date"
            value={formData.due_date}
            onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Notes</Label>
        <Textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          rows={2}
        />
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">
          {task ? 'Update Task' : 'Create Task'}
        </Button>
      </div>
    </form>
  );
}