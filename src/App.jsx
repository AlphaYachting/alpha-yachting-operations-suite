import React, { useState, useEffect, useRef } from 'react';
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
import DashboardV2 from './pages/DashboardV2';
import PlanningAgent from './pages/PlanningAgent';
import ProjectHealth from './pages/ProjectHealth';
import QuickCaptureReview from './pages/QuickCaptureReview';
import AIAssistantSettings from './pages/AIAssistantSettings';
import PlanningReadiness from './pages/PlanningReadiness';
import InviteAccept from './pages/InviteAccept';
import PartnerKalkulatorPublic from './pages/PartnerKalkulatorPublic';
import MaterialImport from './pages/MaterialImport';
import BillingReview from './pages/BillingReview';
import MaterialImportDetail from './pages/MaterialImportDetail';
import ProductCatalog from './pages/ProductCatalog';
import ProductCatalogImport from './pages/ProductCatalogImport';
import LeadsV3 from './pages/LeadsV3';
import PartnerKalkulator from './pages/PartnerKalkulator';
import SalesStatistics from './pages/SalesStatistics';
import OperationsResetExport from './pages/OperationsResetExport';
import ActivityLogPage from './pages/ActivityLogPage';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <ErrorBoundary key={currentPageName}>
    <Layout currentPageName={currentPageName}>{children}</Layout>
  </ErrorBoundary>
  : <ErrorBoundary key={currentPageName}>{children}</ErrorBoundary>;

const AuthenticatedApp = () => {
  const { isLoadingAuth, authError, navigateToLogin, user, isAuthenticated } = useAuth();
  const isIosStandalone = window.navigator.standalone === true;
  const [showStandaloneRecovery, setShowStandaloneRecovery] = useState(false);
  const loginRedirectFiredRef = useRef(false);

  // After 5s stuck unauthenticated (any mode: standalone, bookmark, browser), show recovery screen
  useEffect(() => {
    if (isAuthenticated || isLoadingAuth) return;
    const timer = setTimeout(() => setShowStandaloneRecovery(true), 5000);
    return () => clearTimeout(timer);
  }, [isAuthenticated, isLoadingAuth]);

  // Reset redirect guard when user becomes authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loginRedirectFiredRef.current = false;
      setShowStandaloneRecovery(false);
    }
  }, [isAuthenticated]);

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
    // Show recovery screen if stuck after login redirect (any mode)
    if (showStandaloneRecovery) {
      return (
        <div className="fixed inset-0 flex flex-col items-center justify-center bg-white gap-6 p-8">
          <img
            src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6972766f1bd9af32693610c1/a2e80b763_Bildschirmfoto2026-01-28um222024.png"
            alt="Alpha Yachting"
            className="h-16 object-contain"
          />
          <div className="text-center space-y-2">
            <p className="text-slate-700 font-medium">Login erforderlich</p>
            <p className="text-slate-500 text-sm">Bitte im Browser anmelden, dann die App neu öffnen.</p>
          </div>
          <button
            onClick={() => { setShowStandaloneRecovery(false); loginRedirectFiredRef.current = false; navigateToLogin(); }}
            className="px-6 py-3 bg-slate-800 text-white rounded-lg text-sm font-medium"
          >
            Jetzt anmelden
          </button>
          <button
            onClick={() => { setShowStandaloneRecovery(false); window.location.reload(); }}
            className="px-6 py-3 border border-slate-300 text-slate-700 rounded-lg text-sm"
          >
            App neu laden
          </button>
        </div>
      );
    }

    // Guarded redirect: only fire once per unauthenticated state, not on every render
    if (!loginRedirectFiredRef.current) {
      loginRedirectFiredRef.current = true;
      navigateToLogin();
    }

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
    return 'DashboardV2';
  };

  const landingPageName = getRoleLandingPage();
  const LandingPage = Pages[landingPageName] || MainPage;

  return (
    <>
      <Routes>
        <Route path="/" element={
          <LayoutWrapper currentPageName={landingPageName}>
            <LandingPage />
          </LayoutWrapper>
        } />
        {/* All pages from pagesConfig */}
        {Object.entries(Pages).map(([pageName, PageComponent]) => (
          <Route
            key={pageName}
            path={`/${pageName}`}
            element={
              <LayoutWrapper currentPageName={pageName}>
                <PageComponent />
              </LayoutWrapper>
            }
          />
        ))}
        {/* Extra pages not in pagesConfig */}
        <Route path="/MaterialImport" element={<LayoutWrapper currentPageName="MaterialImport"><MaterialImport /></LayoutWrapper>} />
        <Route path="/BillingReview" element={<LayoutWrapper currentPageName="BillingReview"><BillingReview /></LayoutWrapper>} />
        <Route path="/MaterialImportDetail" element={<LayoutWrapper currentPageName="MaterialImportDetail"><MaterialImportDetail /></LayoutWrapper>} />
        <Route path="/DashboardV2" element={<LayoutWrapper currentPageName="DashboardV2"><DashboardV2 /></LayoutWrapper>} />
        <Route path="/PlanningAgent" element={<LayoutWrapper currentPageName="PlanningAgent"><PlanningAgent /></LayoutWrapper>} />
        <Route path="/PlanningReadiness" element={<LayoutWrapper currentPageName="PlanningReadiness"><PlanningReadiness /></LayoutWrapper>} />
        <Route path="/QuickCaptureReview" element={<LayoutWrapper currentPageName="QuickCaptureReview"><QuickCaptureReview /></LayoutWrapper>} />
        <Route path="/ProjectHealth" element={<LayoutWrapper currentPageName="ProjectHealth"><ProjectHealth /></LayoutWrapper>} />
        <Route path="/ProductCatalog" element={<LayoutWrapper currentPageName="ProductCatalog"><ProductCatalog /></LayoutWrapper>} />
        <Route path="/ProductCatalogImport" element={<LayoutWrapper currentPageName="ProductCatalogImport"><ProductCatalogImport /></LayoutWrapper>} />
        <Route path="/LeadsV3" element={<LayoutWrapper currentPageName="LeadsV3"><LeadsV3 /></LayoutWrapper>} />
        <Route path="/PartnerKalkulator" element={<LayoutWrapper currentPageName="PartnerKalkulator"><PartnerKalkulator /></LayoutWrapper>} />
        <Route path="/SalesStatistics" element={<LayoutWrapper currentPageName="SalesStatistics"><SalesStatistics /></LayoutWrapper>} />
        <Route path="/OperationsResetExport" element={<LayoutWrapper currentPageName="OperationsResetExport"><OperationsResetExport /></LayoutWrapper>} />
        <Route path="/ActivityLog" element={<LayoutWrapper currentPageName="ActivityLog"><ActivityLogPage /></LayoutWrapper>} />
        <Route path="/AIAssistantSettings" element={<LayoutWrapper currentPageName="AIAssistantSettings"><AIAssistantSettings /></LayoutWrapper>} />
        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </>
  );
};


function App() {
  return (
    <Router>
      <QueryClientProvider client={queryClientInstance}>
        <AuthProvider>
          <Routes>
            <Route path="/InviteAccept" element={<InviteAccept />} />
            <Route path="/kalkulator" element={<PartnerKalkulatorPublic />} />
            <Route path="*" element={<>
              <NavigationTracker />
              <AuthenticatedApp />
            </>} />
          </Routes>
          <Toaster />
        </AuthProvider>
      </QueryClientProvider>
    </Router>
  );
}

export default App