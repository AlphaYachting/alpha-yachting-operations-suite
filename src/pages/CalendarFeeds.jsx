import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Calendar, 
  Plus, 
  Copy, 
  Trash2, 
  Eye, 
  EyeOff, 
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  Users,
  Globe
} from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

// Generate a UUID v4
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export default function CalendarFeeds() {
  const [feeds, setFeeds] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showInstructionsDialog, setShowInstructionsDialog] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [copiedFeedId, setCopiedFeedId] = useState(null);
  
  // Form state
  const [formData, setFormData] = useState({
    feed_name: '',
    technician_id: '',
    time_window_days: 90,
    include_unassigned: false
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [feedsData, techsData] = await Promise.all([
        base44.entities.CalendarFeedConfig.list('-created_date'),
        base44.entities.Technician.filter({ status: 'Active' })
      ]);
      setFeeds(feedsData);
      setTechnicians(techsData);
    } catch (error) {
      console.error('Error loading feeds:', error);
      toast.error('Failed to load calendar feeds');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFeed = async () => {
    try {
      const token = generateUUID();
      const techName = formData.technician_id 
        ? technicians.find(t => t.id === formData.technician_id)?.first_name + ' ' + technicians.find(t => t.id === formData.technician_id)?.last_name
        : 'All Team';
      
      await base44.entities.CalendarFeedConfig.create({
        ...formData,
        feed_token: token,
        feed_name: formData.feed_name || `${techName} Calendar`,
        enabled: true,
        access_count: 0
      });
      
      toast.success('Calendar feed created');
      setShowCreateDialog(false);
      setFormData({
        feed_name: '',
        technician_id: '',
        time_window_days: 90,
        include_unassigned: false
      });
      await loadData();
    } catch (error) {
      console.error('Error creating feed:', error);
      toast.error('Failed to create calendar feed');
    }
  };

  const handleToggleFeed = async (feed) => {
    try {
      await base44.entities.CalendarFeedConfig.update(feed.id, {
        enabled: !feed.enabled
      });
      toast.success(feed.enabled ? 'Feed disabled' : 'Feed enabled');
      await loadData();
    } catch (error) {
      console.error('Error toggling feed:', error);
      toast.error('Failed to update feed');
    }
  };

  const handleDeleteFeed = async (feedId) => {
    try {
      await base44.entities.CalendarFeedConfig.delete(feedId);
      toast.success('Feed deleted');
      setDeleteConfirm(null);
      await loadData();
    } catch (error) {
      console.error('Error deleting feed:', error);
      toast.error('Failed to delete feed');
    }
  };

  const handleRegenerateToken = async (feed) => {
    try {
      const newToken = generateUUID();
      await base44.entities.CalendarFeedConfig.update(feed.id, {
        feed_token: newToken
      });
      toast.success('Token regenerated - update your calendar subscription');
      await loadData();
    } catch (error) {
      console.error('Error regenerating token:', error);
      toast.error('Failed to regenerate token');
    }
  };

  const getFeedURL = (feed) => {
    const appDomain = window.location.hostname;
    return `https://${appDomain}/functions/calendarFeed?token=${feed.feed_token}`;
  };

  const getWebcalURL = (feed) => {
    const appDomain = window.location.hostname;
    return `webcal://${appDomain}/functions/calendarFeed?token=${feed.feed_token}`;
  };

  const copyToClipboard = (text, feedId) => {
    navigator.clipboard.writeText(text);
    setCopiedFeedId(feedId);
    toast.success('Feed URL copied to clipboard');
    setTimeout(() => setCopiedFeedId(null), 2000);
  };

  const getTechnicianName = (techId) => {
    if (!techId) return 'All Team Members';
    const tech = technicians.find(t => t.id === techId);
    return tech ? `${tech.first_name} ${tech.last_name}` : 'Unknown';
  };

  if (loading) {
    return <div className="p-6">Loading calendar feeds...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Calendar Feeds</h1>
          <p className="text-slate-500 mt-1">Export work order schedules to Google Calendar, Outlook, or iOS Calendar</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowInstructionsDialog(true)}>
            <ExternalLink className="h-4 w-4 mr-2" />
            Setup Instructions
          </Button>
          <Button onClick={() => setShowCreateDialog(true)} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-2" />
            New Feed
          </Button>
        </div>
      </div>

      {/* Feeds List */}
      {feeds.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">No calendar feeds yet</h3>
            <p className="text-slate-500 mb-4">Create a feed to sync work orders with external calendars</p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create First Feed
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {feeds.map(feed => (
            <Card key={feed.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">{feed.feed_name}</CardTitle>
                      <Badge variant={feed.enabled ? 'default' : 'secondary'}>
                        {feed.enabled ? 'Active' : 'Disabled'}
                      </Badge>
                      {feed.technician_id ? (
                        <Badge variant="outline" className="gap-1">
                          <Users className="h-3 w-3" />
                          {getTechnicianName(feed.technician_id)}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1">
                          <Globe className="h-3 w-3" />
                          All Team
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="mt-1">
                      {feed.time_window_days} days • 
                      {feed.access_count > 0 ? ` ${feed.access_count} accesses` : ' Never accessed'}
                      {feed.last_accessed && ` • Last: ${new Date(feed.last_accessed).toLocaleDateString()}`}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleToggleFeed(feed)}
                      title={feed.enabled ? 'Disable feed' : 'Enable feed'}
                    >
                      {feed.enabled ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRegenerateToken(feed)}
                      title="Regenerate token"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteConfirm(feed)}
                      title="Delete feed"
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs text-slate-500 mb-1 block">Feed URL (HTTPS)</Label>
                  <div className="flex gap-2">
                    <Input
                      value={getFeedURL(feed)}
                      readOnly
                      className="font-mono text-xs"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(getFeedURL(feed), feed.id + '-https')}
                    >
                      {copiedFeedId === feed.id + '-https' ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-slate-500 mb-1 block">Webcal URL (iOS/macOS)</Label>
                  <div className="flex gap-2">
                    <Input
                      value={getWebcalURL(feed)}
                      readOnly
                      className="font-mono text-xs"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(getWebcalURL(feed), feed.id + '-webcal')}
                    >
                      {copiedFeedId === feed.id + '-webcal' ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Feed Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Calendar Feed</DialogTitle>
            <DialogDescription>
              Generate a secure feed URL to sync work orders with external calendars
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Feed Name</Label>
              <Input
                placeholder="e.g., John's Calendar"
                value={formData.feed_name}
                onChange={(e) => setFormData({ ...formData, feed_name: e.target.value })}
              />
            </div>
            <div>
              <Label>Technician (optional)</Label>
              <Select
                value={formData.technician_id}
                onValueChange={(value) => setFormData({ ...formData, technician_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All team members" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>All Team Members</SelectItem>
                  {technicians.map(tech => (
                    <SelectItem key={tech.id} value={tech.id}>
                      {tech.first_name} {tech.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Time Window (days)</Label>
              <Select
                value={String(formData.time_window_days)}
                onValueChange={(value) => setFormData({ ...formData, time_window_days: parseInt(value) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="60">60 days</SelectItem>
                  <SelectItem value="90">90 days</SelectItem>
                  <SelectItem value="120">120 days</SelectItem>
                  <SelectItem value="180">180 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label>Include unassigned work orders</Label>
              <Switch
                checked={formData.include_unassigned}
                onCheckedChange={(checked) => setFormData({ ...formData, include_unassigned: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateFeed}>Create Feed</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Instructions Dialog */}
      <Dialog open={showInstructionsDialog} onOpenChange={setShowInstructionsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Calendar Setup Instructions</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div>
              <h3 className="font-semibold text-lg mb-2">Google Calendar</h3>
              <ol className="list-decimal list-inside space-y-1 text-sm text-slate-600">
                <li>Copy the HTTPS feed URL from your calendar feed</li>
                <li>Open Google Calendar → Settings (gear icon) → "Add calendar" → "From URL"</li>
                <li>Paste the feed URL and click "Add calendar"</li>
                <li>Calendar will refresh automatically every few hours</li>
              </ol>
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-2">iOS Calendar / macOS</h3>
              <ol className="list-decimal list-inside space-y-1 text-sm text-slate-600">
                <li>Copy the Webcal URL from your calendar feed</li>
                <li>On iOS: Settings → Calendar → Accounts → Add Account → Other → Add Subscribed Calendar</li>
                <li>On macOS: Calendar app → File → New Calendar Subscription</li>
                <li>Paste the Webcal URL and tap/click Subscribe</li>
              </ol>
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-2">Outlook</h3>
              <ol className="list-decimal list-inside space-y-1 text-sm text-slate-600">
                <li>Copy the HTTPS feed URL from your calendar feed</li>
                <li>Open Outlook → Calendar → Add calendar → Subscribe from web</li>
                <li>Paste the feed URL and enter a calendar name</li>
                <li>Click Import</li>
              </ol>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Calendar Feed?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{deleteConfirm?.feed_name}". 
              Users subscribed to this feed will no longer receive updates.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleDeleteFeed(deleteConfirm.id)}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete Feed
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}