import React, { useState, useEffect } from 'react';
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ErrorBoundary from '@/components/ErrorBoundary';
// Add page imports here
import PlanningAgent from './pages/PlanningAgent';
import AIAssistantSettings from './pages/AIAssistantSettings';
import PlanningReadiness from './pages/PlanningReadiness';
import InviteAccept from './pages/InviteAccept';
import MaterialImport from './pages/MaterialImport';
import MaterialImportDetail from './pages/MaterialImportDetail';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <ErrorBoundary key={currentPageName}>
    <Layout currentPageName={currentPageName}>{children}</Layout>
  </ErrorBoundary>
  : <ErrorBoundary key={currentPageName}>{children}</ErrorBoundary>;

const DebugOverlay = ({ isLoadingAuth, isAuthenticated, authError, user }) => {
  const [log, setLog] = useState([]);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const entry = `[${new Date().toISOString().substring(11,19)}] loading=${isLoadingAuth} auth=${isAuthenticated} error=${authError?.type || 'none'} user=${user?.email || 'none'}`;
    setLog(prev => [...prev.slice(-20), entry]);
  }, [isLoadingAuth, isAuthenticated, authError, user]);

  if (!visible) return <button onClick={() => setVisible(true)} className="fixed bottom-2 right-2 z-[9999] bg-black text-white text-xs px-2 py-1 rounded opacity-50">DEBUG</button>;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9999] bg-black/90 text-green-400 text-xs font-mono p-2 max-h-48 overflow-y-auto">
      <div className="flex justify-between mb-1">
        <span className="text-yellow-400 font-bold">🔍 AUTH DEBUG (temp)</span>
        <button onClick={() => setVisible(false)} className="text-white">✕</button>
      </div>
      {log.map((l, i) => <div key={i}>{l}</div>)}
    </div>
  );
};

const AuthenticatedApp = () => {
  const { isLoadingAuth, authError, navigateToLogin, user, isAuthenticated } = useAuth();

  // Loading
  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-white gap-6">
        <img
          src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6972766f1bd9af32693610c1/a2e80b763_Bildschirmfoto2026-01-28um222024.png"
          alt="Alpha Yachting"
          className="h-16 object-contain"
        />
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
        <p className="text-xs text-slate-400">Authentifizierung... (max. 8s)</p>
        <div className="fixed bottom-2 left-2 right-2 bg-black/80 text-green-400 text-xs font-mono p-2 rounded z-[9999]">
          🔍 DEBUG: isLoadingAuth=true | auth={String(isAuthenticated)} | error={authError?.type || 'none'} | user={user?.email || 'none'}
        </div>
      </div>
    );
  }

  // Auth error
  if (authError?.type === 'user_not_registered') {
    return <UserNotRegisteredError />;
  }

  if (authError?.type === 'auth_error') {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-white gap-4">
        <p className="text-slate-600 text-sm">Authentifizierung fehlgeschlagen. Bitte Seite neu laden.</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-slate-800 text-white rounded-md text-sm"
        >
          Neu laden
        </button>
      </div>
    );
  }


  if (!isAuthenticated || !user) {
    navigateToLogin();
    // Show loading screen instead of null/white during redirect
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-white gap-6">
        <img
          src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6972766f1bd9af32693610c1/a2e80b763_Bildschirmfoto2026-01-28um222024.png"
          alt="Alpha Yachting"
          className="h-16 object-contain"
        />
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      </div>
    );
  }
  
  const getRoleLandingPage = () => {
    const role = user.role;
    if (role === 'technician') return 'TeamMobileHome';
    if (role === 'customer') return 'CustomerPortal';
    return 'Dashboard';
  };

  const landingPageName = getRoleLandingPage();
  const LandingPage = Pages[landingPageName] || MainPage;

  return (
    <>
      <DebugOverlay isLoadingAuth={isLoadingAuth} isAuthenticated={isAuthenticated} authError={authError} user={user} />
      <Routes>
        <Route path="/" element={
          <LayoutWrapper currentPageName={landingPageName}>
            <LandingPage />
          </LayoutWrapper>
        } />
        <Route path="/MaterialImport" element={<LayoutWrapper currentPageName="MaterialImport"><MaterialImport /></LayoutWrapper>} />
        <Route path="/MaterialImportDetail" element={<LayoutWrapper currentPageName="MaterialImportDetail"><MaterialImportDetail /></LayoutWrapper>} />
        <Route path="/PlanningAgent" element={<LayoutWrapper currentPageName="PlanningAgent"><PlanningAgent /></LayoutWrapper>} />
        <Route path="/PlanningReadiness" element={<LayoutWrapper currentPageName="PlanningReadiness"><PlanningReadiness /></LayoutWrapper>} />
        {/* Mobile / Technician routes */}
        <Route path="/TeamMobileHome" element={<LayoutWrapper currentPageName="TeamMobileHome"><Pages.TeamMobileHome /></LayoutWrapper>} />
        <Route path="/TeamWorkOrderDetail" element={<LayoutWrapper currentPageName="TeamWorkOrderDetail"><Pages.TeamWorkOrderDetail /></LayoutWrapper>} />
        <Route path="/TeamCalendar" element={<LayoutWrapper currentPageName="TeamCalendar"><Pages.TeamCalendar /></LayoutWrapper>} />
        <Route path="/TeamTaskDetail" element={<LayoutWrapper currentPageName="TeamTaskDetail"><Pages.TeamTaskDetail /></LayoutWrapper>} />

        <Route path="/MyTasks" element={<LayoutWrapper currentPageName="MyTasks"><Pages.MyTasks /></LayoutWrapper>} />
        {/* Customer routes */}
        <Route path="/CustomerPortal" element={<LayoutWrapper currentPageName="CustomerPortal"><Pages.CustomerPortal /></LayoutWrapper>} />
        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </>
  );
};


function App() {
  return (
    <Router>
      <QueryClientProvider client={queryClientInstance}>
        <Routes>
          {/* Public route: InviteAccept (OUTSIDE AuthProvider entirely) */}
          <Route path="/InviteAccept" element={<InviteAccept />} />
          
          {/* ALL other routes: wrapped with AuthProvider FIRST, then auth checks */}
          <Route path="*" element={
            <AuthProvider>
              <NavigationTracker />
              <AuthenticatedApp />
            </AuthProvider>
          } />
        </Routes>
        <Toaster />
      </QueryClientProvider>
    </Router>
  );
}

export default App