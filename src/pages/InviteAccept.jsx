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
  const [rawToken, setRawToken] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    setRawToken(token);

    // Check auth state (non-blocking)
    base44.auth.me().then(setUser).catch(() => setUser(null));

    verifyToken(token);
  }, []);

  const verifyToken = async (token) => {
    if (!token) {
      setStatus('error');
      setMessage('Ungültiger Einladungslink');
      setLoading(false);
      return;
    }

    try {
      const response = await base44.functions.invoke('verifyAppInvite', { token, action: 'open' });
      const result = response.data;

      if (result.already_accepted) {
        setStatus('accepted');
        setInviteRole(result.role);
        setMessage(result.error);
      } else if (result.valid) {
        setStatus('valid');
        setInviteRole(result.role);
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

  const handleAccept = async () => {
    if (!user) {
      // Redirect to login with return URL
      base44.auth.redirectToLogin(window.location.href);
      return;
    }

    try {
      setProcessing(true);
      const response = await base44.functions.invoke('verifyAppInvite', { token: rawToken, action: 'accept' });
      const result = response.data;

      if (result.success) {
        if (result.role === 'CUSTOMER') {
          navigate(createPageUrl('CustomerPortal'));
        } else {
          navigate(createPageUrl('TeamMobileHome'));
        }
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center p-4">
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
              {status === 'valid' && 'Willkommen bei der Alpha App'}
              {status === 'accepted' && 'Bereits aktiviert'}
              {status === 'expired' && 'Einladung abgelaufen'}
              {status === 'error' && 'Ungültige Einladung'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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

                {!user && (
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
                  ) : user ? 'Einladung annehmen' : 'Anmelden & Einladung annehmen'}
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
                  onClick={() => navigate(inviteRole === 'CUSTOMER' ? createPageUrl('CustomerPortal') : createPageUrl('TeamMobileHome'))}
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