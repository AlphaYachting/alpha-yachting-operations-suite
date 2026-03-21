import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, AlertCircle, Loader2, Smartphone, Ship, LogOut } from 'lucide-react';

export default function InviteAccept() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null); // 'valid' | 'wrong_user' | 'expired' | 'error' | 'accepted'
  const [inviteRole, setInviteRole] = useState(null);
  const [inviteEmail, setInviteEmail] = useState(null);
  const [message, setMessage] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [rawToken, setRawToken] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    setRawToken(token);
    initPage(token);
  }, []);

  const initPage = async (token) => {
    if (!token) {
      setStatus('error');
      setMessage('Ungültiger Einladungslink');
      setLoading(false);
      return;
    }

    // Check who is currently logged in (non-blocking)
    let loggedInUser = null;
    try {
      loggedInUser = await base44.auth.me();
      setCurrentUser(loggedInUser);
    } catch {
      loggedInUser = null;
    }

    // Verify the token
    try {
      const response = await base44.functions.invoke('verifyAppInvite', { token, action: 'open' });
      const result = response.data;

      if (result.already_accepted) {
        setStatus('accepted');
        setInviteRole(result.role);
        setMessage(result.error);
      } else if (result.valid) {
        setInviteEmail(result.invite_email);
        setInviteRole(result.role);

        // If someone else is logged in → show wrong_user state
        if (loggedInUser && result.invite_email && loggedInUser.email.toLowerCase() !== result.invite_email.toLowerCase()) {
          setStatus('wrong_user');
        } else {
          setStatus('valid');
        }
      } else {
        setStatus('error');
        setMessage(result.error || 'Ungültiger Einladungslink');
      }
    } catch (error) {
      console.error('Error verifying token:', error);
      setStatus('error');
      setMessage('Fehler beim Überprüfen des Einladungslinks');
    } finally {
      setLoading(false);
    }
  };

  const handleLogoutAndRelogin = () => {
    // Logout and redirect back to this invite page after login
    base44.auth.logout(window.location.href);
  };

  const handleAccept = async () => {
    if (!currentUser) {
      base44.auth.redirectToLogin(window.location.href);
      return;
    }

    try {
      setProcessing(true);
      const response = await base44.functions.invoke('verifyAppInvite', { token: rawToken, action: 'accept' });
      const result = response.data;

      if (result.success) {
        if (result.role === 'CUSTOMER') {
          window.location.href = '/CustomerPortal';
        } else {
          window.location.href = '/TeamMobileHome';
        }
      } else if (result.valid === false) {
        setStatus('error');
        setMessage(result.error || 'Zugriff verweigert');
        setProcessing(false);
      } else {
        throw new Error(result.error || 'Fehler beim Aktivieren');
      }
    } catch (error) {
      console.error('Error accepting invite:', error);
      setMessage(error.message || 'Fehler beim Aktivieren der Einladung');
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center p-4 z-50">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600 mb-4" />
            <p className="text-slate-600">Einladung wird überprüft...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="w-full max-w-md space-y-4 my-auto">
        {/* Logo */}
        <div className="text-center mb-6">
          <Ship className="h-12 w-12 mx-auto text-blue-600 mb-2" />
          <h1 className="text-2xl font-bold text-slate-900">Alpha Yachting</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-center">
              {status === 'valid' && 'Willkommen bei der Alpha App'}
              {status === 'wrong_user' && 'Falsche Anmeldung'}
              {status === 'accepted' && 'Bereits aktiviert'}
              {status === 'expired' && 'Einladung abgelaufen'}
              {status === 'error' && 'Ungültige Einladung'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">

            {/* Wrong user logged in */}
            {status === 'wrong_user' && (
              <>
                <Alert className="bg-amber-50 border-amber-200">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-800">
                    Sie sind als <strong>{currentUser?.email}</strong> angemeldet, aber diese Einladung gilt für <strong>{inviteEmail}</strong>.
                    <br /><br />
                    Bitte melden Sie sich ab und mit der richtigen E-Mail-Adresse an.
                  </AlertDescription>
                </Alert>
                <Button
                  onClick={handleLogoutAndRelogin}
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Abmelden & neu anmelden
                </Button>
              </>
            )}

            {/* Valid invite */}
            {status === 'valid' && (
              <>
                <Alert className="bg-green-50 border-green-200">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    Ihre Einladung ist gültig und bereit zur Aktivierung
                  </AlertDescription>
                </Alert>

                {inviteRole === 'CUSTOMER' && (
                  <p className="text-slate-600 text-sm">
                    Sie wurden eingeladen, auf Ihre Alpha Yachting Projekte zuzugreifen.
                    Verfolgen Sie den Fortschritt, sehen Sie Updates und kommunizieren Sie mit dem Team.
                  </p>
                )}

                {inviteRole === 'TECHNICIAN' && (
                  <p className="text-slate-600 text-sm">
                    Sie wurden zur Alpha Team App eingeladen.
                    Verwalten Sie Arbeitsaufträge, erfassen Sie Zeit und erledigen Sie Aufgaben unterwegs.
                  </p>
                )}

                {!currentUser && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Sie müssen sich anmelden oder ein Konto erstellen, um fortzufahren
                    </AlertDescription>
                  </Alert>
                )}

                {message && (
                  <Alert className="bg-red-50 border-red-200">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-red-800">{message}</AlertDescription>
                  </Alert>
                )}

                <Button
                  onClick={handleAccept}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  disabled={processing}
                >
                  {processing ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Wird verarbeitet...</>
                  ) : currentUser ? 'Einladung annehmen' : 'Anmelden & Einladung annehmen'}
                </Button>

                {/* Install Instructions */}
                <div className="pt-4 border-t border-slate-200">
                  <div className="flex items-center gap-2 mb-3">
                    <Smartphone className="h-4 w-4 text-slate-500" />
                    <p className="text-sm font-semibold text-slate-700">App auf dem Handy installieren</p>
                  </div>
                  <div className="space-y-2 text-xs text-slate-600">
                    <div>
                      <p className="font-medium">iPhone (Safari):</p>
                      <p>Teilen → „Zum Home-Bildschirm"</p>
                    </div>
                    <div>
                      <p className="font-medium">Android (Chrome):</p>
                      <p>Menü → „App installieren" / „Zum Startbildschirm"</p>
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
                  onClick={() => window.location.href = inviteRole === 'CUSTOMER' ? '/CustomerPortal' : '/TeamMobileHome'}
                  className="w-full"
                >
                  App öffnen
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
                  Bitte kontaktieren Sie Alpha Yachting:{' '}
                  <a href="mailto:info@alpha-jachting.hr" className="text-blue-600 hover:underline">
                    info@alpha-jachting.hr
                  </a>
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-slate-500">
          © 2026 Alpha Yachting • Alle Rechte vorbehalten
        </p>
      </div>
    </div>
  );
}