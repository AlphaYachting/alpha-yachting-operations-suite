import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
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
  FileText,
  UserCheck,
  UserX
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
import LeadFormV2 from '@/components/leadsV2/LeadForm';
import LeadIntelligencePanel from '@/components/leads/LeadIntelligencePanel';
import { toast } from 'sonner';
import { RefreshCw } from 'lucide-react';

const statusColors = {
  'New Incoming': 'bg-amber-100 text-amber-700',
  'Needs Clarification': 'bg-orange-100 text-orange-700',
  'Ready to Offer': 'bg-blue-100 text-blue-700',
  'Offered': 'bg-indigo-100 text-indigo-700',
  'Ordered / Confirmed': 'bg-emerald-100 text-emerald-800',
  'Rejected': 'bg-red-100 text-red-700'
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
  const navigate = useNavigate();
  const leadId = searchParams.get('id');
  const fromV2 = searchParams.get('from') === 'v2';

  const [lead, setLead] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [taskComments, setTaskComments] = useState({});
  const [location, setLocation] = useState(null);
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [assignedUser, setAssignedUser] = useState(null);
  const [savingAssignment, setSavingAssignment] = useState(false);
  const [savingAcceptance, setSavingAcceptance] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [selectedTaskForComment, setSelectedTaskForComment] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [generatingTasks, setGeneratingTasks] = useState(false);
  const [creatingOffer, setCreatingOffer] = useState(false);
  const [convertingToCustomer, setConvertingToCustomer] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editCustomers, setEditCustomers] = useState([]);
  const [editLocations, setEditLocations] = useState([]);
  const [editBoats, setEditBoats] = useState([]);
  const [linkedEmail, setLinkedEmail] = useState(null);
  const [retryingEmail, setRetryingEmail] = useState(false);

  useEffect(() => {
    loadCurrentUser();
    loadAllUsers();
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

  const loadAllUsers = async () => {
    try {
      const users = await base44.entities.User.list();
      setAllUsers(users);
    } catch (error) {
      console.error('Error loading users:', error);
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

      // Load assigned user if present
      if (leadRecord.assigned_to_user_id) {
        const users = await base44.entities.User.list();
        const assignee = users.find(u => u.id === leadRecord.assigned_to_user_id);
        setAssignedUser(assignee);
      } else {
        setAssignedUser(null);
      }

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

      // Load linked email if created from email
      if (leadRecord.notes && leadRecord.notes.includes('Message-ID:')) {
        const msgIdMatch = leadRecord.notes.match(/Message-ID:\s*<([^>]+)>/);
        if (msgIdMatch) {
          const msgId = `<${msgIdMatch[1]}>`;
          const emails = await base44.entities.EmailMessageSandbox.filter({ message_id: msgId });
          if (emails?.[0]) setLinkedEmail(emails[0]);
        }
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

  const handleConvertToCustomer = async () => {
    if (!lead) return;
    if (lead.converted_customer_id) {
      alert('Dieser Lead wurde bereits als Kunde angelegt.');
      return;
    }
    if (!window.confirm(`Lead "${lead.name}" als Kunden anlegen?`)) return;

    try {
      setConvertingToCustomer(true);
      const result = await base44.functions.invoke('convertLeadToCustomer', { leadId: lead.id });
      if (result.data?.success) {
        alert(`Kunde erfolgreich angelegt: ${lead.name}`);
        await loadLeadDetails();
      } else {
        alert('Fehler: ' + (result.data?.error || 'Unbekannter Fehler'));
      }
    } catch (error) {
      console.error('Error converting lead:', error);
      alert('Fehler beim Anlegen des Kunden: ' + error.message);
    } finally {
      setConvertingToCustomer(false);
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

  const handleEditOpen = async () => {
    const [customers, locations, boats] = await Promise.all([
      base44.entities.Customer.list(),
      base44.entities.Location.list(),
      base44.entities.Boat.list(),
    ]);
    setEditCustomers(customers);
    setEditLocations(locations);
    setEditBoats(boats);
    setShowEditForm(true);
  };

  const handleLeadSave = async (data) => {
    await base44.entities.Lead.update(lead.id, data);
    await loadLeadDetails();
    setShowEditForm(false);
  };

  const handleToggleAcceptance = async () => {
    if (!lead) return;
    const isAssignee = currentUser?.id === lead.assigned_to_user_id;
    const isAdmin = currentUser?.role === 'admin';
    if (!isAssignee && !isAdmin) return;

    try {
      setSavingAcceptance(true);
      await base44.entities.Lead.update(lead.id, {
        accepted_by_assignee: !lead.accepted_by_assignee
      });
      await loadLeadDetails();
    } catch (error) {
      console.error('Error toggling acceptance:', error);
    } finally {
      setSavingAcceptance(false);
    }
  };

  const handleRetryEmailBody = async () => {
    if (!linkedEmail) return;
    setRetryingEmail(true);
    try {
      const res = await base44.functions.invoke('emailRetryAndProcess', {
        sandbox_record_id: linkedEmail.id,
        create_lead: false,
      });
      if (res.data?.body_fetched) {
        toast.success(`E-Mail Body geladen (${res.data.body_length} Zeichen)`);
        // Reload email to show updated body
        const emails = await base44.entities.EmailMessageSandbox.filter({ id: linkedEmail.id });
        if (emails?.[0]) setLinkedEmail(emails[0]);
      } else {
        toast.warning('Body konnte nicht geladen werden — IMAP Timeout. Später erneut versuchen.');
      }
    } catch (err) {
      toast.error(`Fehler: ${err.message}`);
    } finally {
      setRetryingEmail(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    if (!lead || newStatus === lead.status) return;
    try {
      setSavingStatus(true);
      await base44.entities.Lead.update(lead.id, { status: newStatus });
      await loadLeadDetails();
    } catch (error) {
      console.error('Error updating status:', error);
    } finally {
      setSavingStatus(false);
    }
  };

  const handleAssignmentChange = async (newUserId) => {
    if (!lead) return;
    
    const previousUserId = lead.assigned_to_user_id;
    
    // Don't do anything if assignment hasn't changed
    if (previousUserId === newUserId) return;
    
    try {
      setSavingAssignment(true);
      
      // Update lead
      await base44.entities.Lead.update(lead.id, {
        assigned_to_user_id: newUserId || null
      });
      
      // Send notification only if assigned to a new user (not unassigned)
      if (newUserId) {
        const { notifyLeadAssignment } = await import('@/components/notifications/notificationUtils');
        const assignee = allUsers.find(u => u.id === newUserId);
        if (assignee) {
          await notifyLeadAssignment(lead, assignee);
        }
      }
      
      // Reload lead details
      await loadLeadDetails();
    } catch (error) {
      console.error('Error updating assignment:', error);
      alert('Failed to update assignment');
    } finally {
      setSavingAssignment(false);
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
          <Link to={createPageUrl('LeadsV2')}>
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
          <Button variant="ghost" size="sm" className="mb-3" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Zurück
          </Button>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-900">{lead.name}</h1>
            <Badge className={statusColors[lead.status]}>{lead.status}</Badge>
            <Badge className={priorityColors[lead.priority]}>{lead.priority}</Badge>
          </div>
          <p className="text-slate-500 mt-1">{lead.inquiry_type}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleEditOpen}
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit Lead
          </Button>
          {lead.converted_customer_id ? (
            <Button
              asChild
              variant="outline"
              className="border-emerald-500 text-emerald-700"
            >
              <Link to={createPageUrl('CustomerDetail') + `?id=${lead.converted_customer_id}`}>
                <UserCheck className="h-4 w-4 mr-2" />
                Kunde anzeigen
              </Link>
            </Button>
          ) : (
            <Button
              onClick={handleConvertToCustomer}
              disabled={convertingToCustomer}
              variant="outline"
              className="border-blue-500 text-blue-700 hover:bg-blue-50"
            >
              <User className="h-4 w-4 mr-2" />
              {convertingToCustomer ? 'Anlegen...' : 'Als Kunde anlegen'}
            </Button>
          )}
          <Button
            onClick={handleCreateOffer}
            disabled={creatingOffer}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <FileText className="h-4 w-4 mr-2" />
            {creatingOffer ? 'Creating...' : 'Create Offer'}
          </Button>
        </div>
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
          {/* Status + Assignee Section */}
          <div className="pb-4 border-b border-slate-200 space-y-4">
            {/* Lead Status */}
            <div>
              <Label className="text-sm font-medium text-slate-700 mb-2 block">Lead Status</Label>
              <Select value={lead.status} onValueChange={handleStatusChange} disabled={savingStatus}>
                <SelectTrigger className="w-full max-w-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="New Incoming">New Incoming</SelectItem>
                  <SelectItem value="Needs Clarification">Needs Clarification</SelectItem>
                  <SelectItem value="Ready to Offer">Ready to Offer</SelectItem>
                  <SelectItem value="Offered">Offered</SelectItem>
                  <SelectItem value="Ordered / Confirmed">Ordered / Confirmed</SelectItem>
                  <SelectItem value="Rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <Label className="text-sm font-medium text-slate-700 mb-2 block">Assigned To</Label>
                <Select
                  value={lead.assigned_to_user_id || ''}
                  onValueChange={handleAssignmentChange}
                  disabled={savingAssignment}
                >
                  <SelectTrigger className="w-full max-w-xs">
                    <SelectValue placeholder="Unassigned - select user...">
                      {assignedUser ? assignedUser.full_name || assignedUser.email : 'Unassigned'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>Unassigned</SelectItem>
                    {allUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.full_name || user.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Accept / Reject Button – only visible when lead is assigned */}
              {lead.assigned_to_user_id && (
                <div className="flex flex-col items-end gap-1">
                  <Label className="text-sm font-medium text-slate-700">Übernahme-Status</Label>
                  {lead.accepted_by_assignee ? (
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1.5 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg font-medium">
                        <UserCheck className="h-4 w-4" />
                        Übernommen
                      </span>
                      {(currentUser?.id === lead.assigned_to_user_id || currentUser?.role === 'admin') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleToggleAcceptance}
                          disabled={savingAcceptance}
                          className="text-slate-400 hover:text-red-500 text-xs h-7"
                        >
                          Zurücksetzen
                        </Button>
                      )}
                    </div>
                  ) : (
                    (currentUser?.id === lead.assigned_to_user_id || currentUser?.role === 'admin') ? (
                      <Button
                        onClick={handleToggleAcceptance}
                        disabled={savingAcceptance}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 px-4 text-sm gap-2"
                      >
                        <UserCheck className="h-4 w-4" />
                        {savingAcceptance ? 'Speichern...' : 'Lead übernehmen'}
                      </Button>
                    ) : (
                      <span className="flex items-center gap-1.5 text-sm text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">
                        <UserX className="h-4 w-4" />
                        Noch nicht übernommen
                      </span>
                    )
                  )}
                </div>
              )}
            </div>
          </div>

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

          {/* Linked Email Body */}
          {linkedEmail && (
            <div className="border-t border-slate-200 pt-4">
              <p className="text-sm font-medium text-slate-700 mb-2">Verknüpfte E-Mail: {linkedEmail.subject}</p>
              {linkedEmail.body_text && linkedEmail.body_text.trim() ? (
                <pre className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 rounded-lg p-3 max-h-64 overflow-y-auto font-sans leading-relaxed">
                  {linkedEmail.body_text}
                </pre>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex flex-col gap-2">
                  <p className="text-sm text-amber-800 font-medium">E-Mail Body fehlt — wurde beim Abrufen nicht geladen.</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleRetryEmailBody}
                    disabled={retryingEmail}
                    className="w-fit text-xs border-amber-300 text-amber-800 hover:bg-amber-100"
                  >
                    <RefreshCw className={`h-3 w-3 mr-1 ${retryingEmail ? 'animate-spin' : ''}`} />
                    {retryingEmail ? 'Lädt...' : 'E-Mail Body neu laden'}
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lead Intelligence Panel — detachable AI module */}
      <LeadIntelligencePanel lead={lead} />

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

      {/* Edit Lead Dialog */}
      <Dialog open={showEditForm} onOpenChange={setShowEditForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Lead</DialogTitle>
          </DialogHeader>
          {showEditForm && (
            <LeadFormV2
              lead={lead}
              customers={editCustomers}
              locations={editLocations}
              users={allUsers}
              boats={editBoats}
              onSave={handleLeadSave}
              onCancel={() => setShowEditForm(false)}
            />
          )}
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