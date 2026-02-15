import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Mail, CheckCircle2, AlertCircle, RefreshCw, Ban } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

export default function SendInviteButton({ 
  email, 
  role, 
  customerId, 
  technicianId, 
  jobId, 
  workOrderId,
  variant = 'default',
  size = 'default',
  className = ''
}) {
  const [open, setOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState(email || '');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [message, setMessage] = useState('');
  const [existingInvite, setExistingInvite] = useState(null);
  const [loadingExisting, setLoadingExisting] = useState(false);

  const loadExistingInvite = async () => {
    if (!email) return;
    
    setLoadingExisting(true);
    try {
      const invites = await base44.entities.AppInvite.filter({ 
        email,
        role: role.toUpperCase()
      });
      
      if (invites && invites.length > 0) {
        // Get most recent
        const sorted = invites.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
        setExistingInvite(sorted[0]);
      }
    } catch (error) {
      console.error('Error loading existing invite:', error);
    } finally {
      setLoadingExisting(false);
    }
  };

  const handleOpen = () => {
    setOpen(true);
    setInviteEmail(email || '');
    setStatus(null);
    setMessage('');
    setExistingInvite(null);
    if (email) {
      loadExistingInvite();
    }
  };

  const handleSend = async () => {
    if (!inviteEmail) {
      setStatus('error');
      setMessage('Email is required');
      return;
    }

    setLoading(true);
    setStatus(null);
    setMessage('');

    try {
      const response = await base44.functions.invoke('createAppInvite', {
        email: inviteEmail,
        role: role.toUpperCase(),
        customer_id: customerId,
        technician_id: technicianId,
        job_id: jobId,
        work_order_id: workOrderId
      });

      if (response.data.success) {
        setStatus('success');
        setMessage(response.data.warning || response.data.message || 'Invite sent successfully!');
        if (!response.data.warning) {
          setTimeout(() => {
            setOpen(false);
          }, 2000);
        }
      } else {
        throw new Error(response.data.error || 'Failed to send invite');
      }
    } catch (error) {
      setStatus('error');
      setMessage(error.message || 'Failed to send invite');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!existingInvite) return;

    setLoading(true);
    try {
      const response = await base44.functions.invoke('resendAppInvite', {
        invite_id: existingInvite.id
      });

      if (response.data.success) {
        setStatus('success');
        setMessage('Invite resent successfully!');
        loadExistingInvite();
      } else {
        throw new Error(response.data.error || 'Failed to resend invite');
      }
    } catch (error) {
      setStatus('error');
      setMessage(error.message || 'Failed to resend invite');
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async () => {
    if (!existingInvite) return;

    setLoading(true);
    try {
      const response = await base44.functions.invoke('revokeAppInvite', {
        invite_id: existingInvite.id
      });

      if (response.data.success) {
        setStatus('success');
        setMessage('Invite revoked successfully');
        loadExistingInvite();
      } else {
        throw new Error(response.data.error || 'Failed to revoke invite');
      }
    } catch (error) {
      setStatus('error');
      setMessage(error.message || 'Failed to revoke invite');
    } finally {
      setLoading(false);
    }
  };

  const statusColors = {
    CREATED: 'bg-slate-100 text-slate-800',
    SENT: 'bg-blue-100 text-blue-800',
    OPENED: 'bg-purple-100 text-purple-800',
    ACCEPTED: 'bg-green-100 text-green-800',
    EXPIRED: 'bg-orange-100 text-orange-800',
    REVOKED: 'bg-red-100 text-red-800'
  };

  return (
    <>
      <Button 
        variant={variant} 
        size={size}
        onClick={handleOpen}
        className={className}
      >
        <Mail className="h-4 w-4 mr-2" />
        Invite to App
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite to Alpha App</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="email@example.com"
                disabled={!!email}
              />
            </div>

            <div>
              <Label>Role</Label>
              <div className="mt-2">
                <Badge className="bg-blue-100 text-blue-800">
                  {role === 'CUSTOMER' ? 'Customer Access' : 'Technician Access'}
                </Badge>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {role === 'CUSTOMER' 
                  ? 'Customer can view their projects and communicate with the team'
                  : 'Technician can manage work orders and complete tasks'}
              </p>
            </div>

            {loadingExisting && (
              <div className="text-sm text-slate-500 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Checking existing invites...
              </div>
            )}

            {existingInvite && !loadingExisting && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Existing invite:</span>
                      <Badge className={statusColors[existingInvite.status]}>
                        {existingInvite.status}
                      </Badge>
                    </div>
                    {existingInvite.last_sent_at && (
                      <p className="text-xs">
                        Last sent: {format(new Date(existingInvite.last_sent_at), 'MMM d, yyyy HH:mm')}
                      </p>
                    )}
                    {existingInvite.expires_at && existingInvite.status !== 'ACCEPTED' && (
                      <p className="text-xs">
                        Expires: {format(new Date(existingInvite.expires_at), 'MMM d, yyyy')}
                      </p>
                    )}
                    <div className="flex gap-2 pt-2">
                      {existingInvite.status !== 'ACCEPTED' && existingInvite.status !== 'REVOKED' && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleResend}
                            disabled={loading}
                          >
                            <RefreshCw className="h-3 w-3 mr-1" />
                            Resend
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleRevoke}
                            disabled={loading}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Ban className="h-3 w-3 mr-1" />
                            Revoke
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {status === 'success' && (
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">{message}</AlertDescription>
              </Alert>
            )}

            {status === 'error' && (
              <Alert className="bg-red-50 border-red-200">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800">{message}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSend} disabled={loading || !inviteEmail}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  Send Invite
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}