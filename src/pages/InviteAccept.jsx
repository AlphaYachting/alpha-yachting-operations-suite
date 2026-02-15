import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, AlertCircle, Loader2, Smartphone, Ship } from 'lucide-react';

export default function InviteAccept() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null); // 'valid' | 'expired' | 'error' | 'accepted'
  const [inviteRole, setInviteRole] = useState(null);
  const [message, setMessage] = useState('');
  const [user, setUser] = useState(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    verifyToken();
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const userData = await base44.auth.me();
      setUser(userData);
    } catch (error) {
      // Not authenticated
      setUser(null);
    }
  };

  const verifyToken = async () => {
    try {
      const params = new URLSearchParams(window.location.search);
      const rawToken = params.get('token');

      if (!rawToken) {
        setStatus('error');
        setMessage('Invalid invite link');
        setLoading(false);
        return;
      }

      // Hash the token
      const encoder = new TextEncoder();
      const data = encoder.encode(rawToken);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const token_hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      // Find invite by token hash
      const invites = await base44.entities.AppInvite.filter({ token_hash });

      if (!invites || invites.length === 0) {
        setStatus('error');
        setMessage('Invalid or expired invite link');
        setLoading(false);
        return;
      }

      const invite = invites[0];

      // Check status
      if (invite.status === 'REVOKED') {
        setStatus('error');
        setMessage('This invite has been revoked');
        setLoading(false);
        return;
      }

      if (invite.status === 'ACCEPTED') {
        setStatus('accepted');
        setInviteRole(invite.role);
        setMessage('This invite has already been used');
        setLoading(false);
        return;
      }

      // Check expiration
      if (new Date(invite.expires_at) < new Date()) {
        await base44.entities.AppInvite.update(invite.id, { status: 'EXPIRED' });
        setStatus('expired');
        setMessage('This invite link has expired');
        setLoading(false);
        return;
      }

      // Mark as opened
      if (invite.status !== 'OPENED') {
        await base44.entities.AppInvite.update(invite.id, {
          status: 'OPENED',
          opened_at: new Date().toISOString()
        });
      }

      setStatus('valid');
      setInviteRole(invite.role);
      setLoading(false);

      // Store invite ID for acceptance
      sessionStorage.setItem('pending_invite_id', invite.id);
      sessionStorage.setItem('pending_invite_token', rawToken);
    } catch (error) {
      console.error('Error verifying token:', error);
      setStatus('error');
      setMessage('Error verifying invite link');
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!user) {
      // Redirect to login with return URL
      const returnUrl = window.location.href;
      base44.auth.redirectToLogin(returnUrl);
      return;
    }

    try {
      setProcessing(true);
      const inviteId = sessionStorage.getItem('pending_invite_id');
      const rawToken = sessionStorage.getItem('pending_invite_token');

      if (!inviteId || !rawToken) {
        throw new Error('Session expired. Please use the invite link again.');
      }

      // Hash token again to verify
      const encoder = new TextEncoder();
      const data = encoder.encode(rawToken);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const token_hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      const invites = await base44.entities.AppInvite.filter({ token_hash });
      if (!invites || invites.length === 0) {
        throw new Error('Invalid invite');
      }

      const invite = invites[0];

      // Mark as accepted
      await base44.entities.AppInvite.update(inviteId, {
        status: 'ACCEPTED',
        accepted_at: new Date().toISOString()
      });

      // Clear session
      sessionStorage.removeItem('pending_invite_id');
      sessionStorage.removeItem('pending_invite_token');

      // Redirect based on role
      if (invite.role === 'CUSTOMER') {
        navigate(createPageUrl('CustomerPortal'));
      } else if (invite.role === 'TECHNICIAN') {
        navigate(createPageUrl('TeamMobileHome'));
      }
    } catch (error) {
      console.error('Error accepting invite:', error);
      setMessage(error.message || 'Error accepting invite');
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600 mb-4" />
            <p className="text-slate-600">Verifying your invite...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        {/* Logo */}
        <div className="text-center mb-6">
          <Ship className="h-12 w-12 mx-auto text-blue-600 mb-2" />
          <h1 className="text-2xl font-bold text-slate-900">Alpha Yachting</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-center">
              {status === 'valid' && 'Welcome to Alpha App'}
              {status === 'accepted' && 'Already Activated'}
              {status === 'expired' && 'Invite Expired'}
              {status === 'error' && 'Invalid Invite'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {status === 'valid' && (
              <>
                <Alert className="bg-green-50 border-green-200">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    Your invite is valid and ready to activate
                  </AlertDescription>
                </Alert>

                {inviteRole === 'CUSTOMER' && (
                  <p className="text-slate-600 text-sm">
                    You've been invited to access your Alpha Yachting projects. 
                    Track progress, view updates, and communicate with the team.
                  </p>
                )}

                {inviteRole === 'TECHNICIAN' && (
                  <p className="text-slate-600 text-sm">
                    You've been invited to the Alpha Team App. 
                    Manage work orders, track time, and complete tasks on the go.
                  </p>
                )}

                {!user && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      You'll need to log in or create an account to continue
                    </AlertDescription>
                  </Alert>
                )}

                <Button 
                  onClick={handleAccept} 
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  disabled={processing}
                >
                  {processing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>Continue</>
                  )}
                </Button>

                {/* Install Instructions */}
                <div className="pt-4 border-t border-slate-200">
                  <div className="flex items-center gap-2 mb-3">
                    <Smartphone className="h-4 w-4 text-slate-500" />
                    <p className="text-sm font-semibold text-slate-700">Install on Your Phone</p>
                  </div>
                  <div className="space-y-2 text-xs text-slate-600">
                    <div>
                      <p className="font-medium">iPhone (Safari):</p>
                      <p>Share → "Add to Home Screen"</p>
                    </div>
                    <div>
                      <p className="font-medium">Android (Chrome):</p>
                      <p>Menu → "Install app" / "Add to Home Screen"</p>
                    </div>
                  </div>
                </div>
              </>
            )}

            {status === 'accepted' && (
              <>
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{message}</AlertDescription>
                </Alert>
                <Button 
                  onClick={() => navigate(inviteRole === 'CUSTOMER' ? createPageUrl('CustomerPortal') : createPageUrl('TeamMobileHome'))}
                  className="w-full"
                >
                  Open App
                </Button>
              </>
            )}

            {(status === 'expired' || status === 'error') && (
              <>
                <Alert className="bg-red-50 border-red-200">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800">
                    {message}
                  </AlertDescription>
                </Alert>
                <p className="text-sm text-slate-600 text-center">
                  Please contact Alpha Yachting at{' '}
                  <a href="mailto:info@alpha-jachting.hr" className="text-blue-600 hover:underline">
                    info@alpha-jachting.hr
                  </a>{' '}
                  for a new invite link.
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-slate-500">
          © 2026 Alpha Yachting • All rights reserved
        </p>
      </div>
    </div>
  );
}