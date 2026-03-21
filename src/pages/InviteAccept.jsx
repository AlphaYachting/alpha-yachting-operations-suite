import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, AlertCircle, Loader2, Smartphone, Ship } from 'lucide-react';

/**
 * SECURITY: This page forces logout of any existing session when opened.
 * The invite token is preserved in localStorage so after fresh login
 * the user lands back here and can accept with the correct account.
 */
export default function InviteAccept() {
  const [phase, setPhase] = useState('init'); // 'init' | 'ready' | 'done' | 'error'
  const [inviteRole, setInviteRole] = useState(null);
  const [message, setMessage] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (!token) {
      setMessage('Ungültiger Einladungslink – kein Token gefunden.');
      setPhase('error');
      return;
    }

    // Always store token so it survives logout/login redirect
    localStorage.setItem('invite_token', token);

    const run = async () => {
      // Step 1: Is anyone logged in? → Force logout immediately
      let isLoggedIn = false;
      try {
        await base44.auth.me();
        isLoggedIn = true;
      } catch {
        isLoggedIn = false;
      }

      if (isLoggedIn) {
        // Log out silently, then redirect back to this page (token is in localStorage)
        // Use window.location to clear the session properly
        base44.auth.logout(window.location.href);
        return; // page will reload after logout
      }

      // Step 2: No one logged in → verify token
      try {
        const response = await base44.functions.invoke('verifyAppInvite', { token, action: 'open' });
        const result = response.data;

        if (result.already_accepted) {
          setPhase('already_accepted');
          setInviteRole(result.role);
        } else if (result.valid) {
          setInviteRole(result.role);
          setPhase('ready');
        } else {
          setMessage(result.error || 'Ungültiger oder abgelaufener Einladungslink.');
          setPhase('error');
        }
      } catch (err) {
        setMessage('Fehler beim Überprüfen des Einladungslinks.');
        setPhase('error');
      }
    };

    run();
  }, []);

  const handleLoginAndAccept = () => {
    // Redirect to login; after login the platform returns here (token still in localStorage)
    base44.auth.redirectToLogin(window.location.href);
  };

  const handleAcceptAfterLogin = async () => {
    const token = localStorage.getItem('invite_token');
    if (!token) {
      setMessage('Token nicht gefunden. Bitte öffnen Sie den Einladungslink erneut.');
      setPhase('error');
      return;
    }

    try {
      setProcessing(true);
      const response = await base44.functions.invoke('verifyAppInvite', { token, action: 'accept' });
      const result = response.data;

      if (result.success) {
        localStorage.removeItem('invite_token');
        setPhase('done');
        setInviteRole(result.role);
        // Redirect after short delay
        setTimeout(() => {
          window.location.href = result.role === 'CUSTOMER' ? '/CustomerPortal' : '/TeamMobileHome';
        }, 1500);
      } else {
        setMessage(result.error || 'Zugriff verweigert. Bitte melden Sie sich mit der richtigen E-Mail-Adresse an.');
        setPhase('error');
      }
    } catch (err) {
      setMessage(err.message || 'Fehler beim Aktivieren der Einladung.');
      setPhase('error');
    } finally {
      setProcessing(false);
    }
  };

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
            <CardTitle className="text-center text-lg">
              {phase === 'init' && 'Einladung wird geladen...'}
              {phase === 'ready' && 'Willkommen bei der Alpha App'}
              {phase === 'done' && 'Erfolgreich aktiviert!'}
              {phase === 'already_accepted' && 'Bereits aktiviert'}
              {phase === 'error' && 'Fehler'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">

            {/* Loading / logging out */}
            {phase === 'init' && (
              <div className="text-center py-4">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600 mb-3" />
                <p className="text-slate-600 text-sm">Sicherheitsüberprüfung läuft...</p>
              </div>
            )}

            {/* Ready to accept — user is logged out */}
            {phase === 'ready' && (
              <>
                <Alert className="bg-green-50 border-green-200">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    Ihre Einladung ist gültig. Bitte melden Sie sich an (oder registrieren Sie sich),
                    um die Einladung anzunehmen.
                  </AlertDescription>
                </Alert>

                {inviteRole === 'CUSTOMER' && (
                  <p className="text-slate-600 text-sm">
                    Sie wurden eingeladen, auf Ihre Alpha Yachting Projekte zuzugreifen –
                    Fortschritt verfolgen, Updates sehen und mit dem Team kommunizieren.
                  </p>
                )}
                {inviteRole === 'TECHNICIAN' && (
                  <p className="text-slate-600 text-sm">
                    Sie wurden zur Alpha Team App eingeladen –
                    Arbeitsaufträge verwalten, Zeit erfassen und Aufgaben unterwegs erledigen.
                  </p>
                )}

                <Button
                  onClick={handleLoginAndAccept}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  Anmelden & Einladung annehmen
                </Button>

                {/* Install instructions */}
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

            {/* After returning from login — accept button */}
            {/* NOTE: This state is reached when user comes back after login redirect */}
            {/* The page reloads → if now logged in AND token in localStorage, we show accept */}

            {/* Success */}
            {phase === 'done' && (
              <div className="text-center py-4">
                <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-3" />
                <p className="text-slate-700">
                  {inviteRole === 'CUSTOMER'
                    ? 'Ihr Zugang zum Kundenportal wurde aktiviert.'
                    : 'Ihr Zugang zur Team App wurde aktiviert.'}
                </p>
                <p className="text-slate-500 text-sm mt-2">Sie werden weitergeleitet...</p>
              </div>
            )}

            {/* Already accepted */}
            {phase === 'already_accepted' && (
              <>
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Diese Einladung wurde bereits verwendet. Sie können sich direkt anmelden.
                  </AlertDescription>
                </Alert>
                <Button
                  className="w-full"
                  onClick={() => window.location.href = inviteRole === 'CUSTOMER' ? '/CustomerPortal' : '/TeamMobileHome'}
                >
                  Zur App
                </Button>
              </>
            )}

            {/* Error */}
            {phase === 'error' && (
              <>
                <Alert className="bg-red-50 border-red-200">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800">{message}</AlertDescription>
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