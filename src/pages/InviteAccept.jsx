import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

// InviteAccept needs its own client WITHOUT requiresAuth
// so the flow works before the user is logged in
const publicClient = createClient({
  appId: appParams.appId,
  token: appParams.token,
  functionsVersion: appParams.functionsVersion,
  serverUrl: '',
  requiresAuth: false,
  appBaseUrl: appParams.appBaseUrl,
});
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, AlertCircle, Loader2, Smartphone, Ship } from 'lucide-react';

/**
 * SECURITY FLOW:
 * 1. User opens invite link → token saved to localStorage
 * 2. If someone is already logged in → immediately logout, return to this page
 * 3. After logout (nobody logged in), token is verified → user sees "Login & Accept"
 * 4. User logs in → platform redirects back here
 * 5. Now logged in + token in localStorage → auto-accept → redirect to app
 *
 * localStorage key 'invite_accepted_flow' = 'true' prevents re-logout after returning from login.
 */
export default function InviteAccept() {
  const [phase, setPhase] = useState('init');
  const [inviteRole, setInviteRole] = useState(null);
  const [message, setMessage] = useState('');
  const [isInAppBrowser, setIsInAppBrowser] = useState(false);

  // Detect in-app browser
  useEffect(() => {
    const ua = navigator.userAgent;
    const inApp = /\b(fban|fbav|gsa|instagram|whatsapp|mail|outlook|gmail|thunderbird|promo_manager)\b/i.test(ua) ||
                 /\b(iphone|ipad|android)\b/i.test(ua) && /\b(mail|inbox|email|message)\b/i.test(ua);
    setIsInAppBrowser(inApp);
  }, []);

  const doAccept = async (token) => {
    try {
      const response = await publicClient.functions.invoke('verifyAppInvite', { token, action: 'accept' });
      const result = response.data;

      if (result.success) {
        localStorage.removeItem('invite_token');
        setInviteRole(result.role);
        setPhase('done');
        setTimeout(() => {
          window.location.href = result.role === 'CUSTOMER' ? '/CustomerPortal' : '/TeamMobileHome';
        }, 1500);
      } else {
        localStorage.removeItem('invite_token');
        setMessage(result.error || 'Zugriff verweigert. Bitte melden Sie sich mit der richtigen E-Mail-Adresse an.');
        setPhase('error');
      }
    } catch (err) {
      setMessage(err.message || 'Fehler beim Aktivieren der Einladung.');
      setPhase('error');
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');

    if (urlToken) {
      localStorage.setItem('invite_token', urlToken);
      localStorage.removeItem('invite_accepted_flow');
    }

    const token = urlToken || localStorage.getItem('invite_token');

    if (!token) {
      setMessage('Ungültiger Einladungslink – kein Token gefunden.');
      setPhase('error');
      return;
    }

    const run = async () => {
      // Always check auth status first
      let currentUser = null;
      try {
        const isAuth = await publicClient.auth.isAuthenticated();
        if (isAuth) currentUser = await publicClient.auth.me();
      } catch {
        currentUser = null;
      }

      const postLoginFlow = localStorage.getItem('invite_accepted_flow') === 'true';

      if (currentUser?.email && !postLoginFlow) {
        // Someone is logged in → force logout, stay on loading screen until redirect
        localStorage.setItem('invite_token', token);
        setPhase('init'); // keep showing spinner
        publicClient.auth.logout(window.location.href);
        return; // page will reload after logout
      }

      if (currentUser && postLoginFlow) {
        // User just logged in as part of the invite flow → auto-accept
        localStorage.removeItem('invite_accepted_flow');
        setPhase('accepting');
        await doAccept(token);
        return;
      }

      // Nobody logged in → verify token and show UI
      setPhase('verifying');
      try {
        const response = await publicClient.functions.invoke('verifyAppInvite', { token, action: 'open' });
        const result = response.data;

        if (result.already_accepted) {
          setInviteRole(result.role);
          setPhase('already_accepted');
        } else if (result.valid) {
          setInviteRole(result.role);
          setPhase('ready');
        } else {
          setMessage(result.error || 'Ungültiger oder abgelaufener Einladungslink.');
          setPhase('error');
        }
      } catch {
        setMessage('Fehler beim Überprüfen des Einladungslinks.');
        setPhase('error');
      }
    };

    run();
  }, []);

  const handleLoginAndAccept = () => {
    // Mark that after login we should auto-accept
    localStorage.setItem('invite_accepted_flow', 'true');
    publicClient.auth.redirectToLogin(window.location.href);
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
              {(phase === 'init' || phase === 'verifying') && 'Einladung wird überprüft...'}
              {phase === 'ready' && 'Willkommen bei der Alpha App'}
              {phase === 'accepting' && 'Einladung wird aktiviert...'}
              {phase === 'done' && 'Erfolgreich aktiviert!'}
              {phase === 'already_accepted' && 'Bereits aktiviert'}
              {phase === 'error' && 'Einladung ungültig'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">

            {/* Loading states */}
            {(phase === 'init' || phase === 'verifying' || phase === 'accepting') && (
              <div className="text-center py-6">
                <Loader2 className="h-10 w-10 animate-spin mx-auto text-blue-600 mb-3" />
                <p className="text-slate-500 text-sm">
                  {phase === 'accepting' ? 'Einladung wird aktiviert...' : 'Sicherheitsüberprüfung läuft...'}
                </p>
              </div>
            )}

            {/* Ready to accept — user is NOT logged in */}
            {phase === 'ready' && (
              <>
                {isInAppBrowser && (
                  <Alert className="bg-amber-50 border-amber-200">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-amber-800">
                      <strong>Wichtig:</strong> Öffnen Sie diesen Link bitte in Ihrem Standard-Browser (Chrome, Safari, Firefox), nicht im E-Mail-Programm.
                      Tippen Sie auf die drei Punkte ⋮ und wählen Sie „In Browser öffnen".
                    </AlertDescription>
                  </Alert>
                )}
                <Alert className="bg-green-50 border-green-200">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    Ihre Einladung ist gültig. Bitte melden Sie sich an, um fortzufahren.
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
                  <div className="flex items-center gap-2 mb-2">
                    <Smartphone className="h-4 w-4 text-slate-500" />
                    <p className="text-sm font-semibold text-slate-700">App auf dem Handy installieren</p>
                  </div>
                  <div className="space-y-1 text-xs text-slate-600">
                    <p><strong>iPhone:</strong> Teilen → „Zum Home-Bildschirm"</p>
                    <p><strong>Android:</strong> Menü → „App installieren"</p>
                  </div>
                </div>
              </>
            )}

            {/* Success */}
            {phase === 'done' && (
              <div className="text-center py-4">
                <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-3" />
                <p className="text-slate-700 font-medium">
                  {inviteRole === 'CUSTOMER'
                    ? 'Ihr Kundenportal-Zugang wurde aktiviert.'
                    : 'Ihr Team App-Zugang wurde aktiviert.'}
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
                  onClick={() => base44.auth.redirectToLogin(inviteRole === 'CUSTOMER' ? '/CustomerPortal' : '/TeamMobileHome')}
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