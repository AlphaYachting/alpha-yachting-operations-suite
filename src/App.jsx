import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
// Add page imports here
import AIAssistantSettings from './pages/AIAssistantSettings';
import InviteAccept from './pages/InviteAccept';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin, user, isAuthenticated } = useAuth();

  console.log('📊 AuthenticatedApp state:', { 
    isLoadingAuth, 
    isLoadingPublicSettings, 
    isAuthenticated, 
    hasUser: !!user,
    authError: authError?.type 
  });

  // Phase 1: Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    console.log('⏳ Still loading auth...');
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Phase 2: If auth errors exist, handle them first
  if (authError) {
    console.log('⚠️ Auth error detected:', authError.type);
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    }
    // For any auth error, redirect to login
    navigateToLogin();
    return (
      <div className="fixed inset-0 bg-white flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Phase 3: CRITICAL - If not authenticated, redirect immediately
  if (!isAuthenticated || !user) {
    console.log('🔴 NOT AUTHENTICATED - Redirecting to login');
    navigateToLogin();
    return (
      <div className="fixed inset-0 bg-white flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Phase 4: Only render app if 100% authenticated with no errors
  console.log('✅ AUTHENTICATED - Rendering app');
  
  const getRoleLandingPage = () => {
    const role = user.role;
    if (role === 'technician') return 'MyTasks';
    if (role === 'customer') return 'CustomerPortal';
    return 'Dashboard';
  };

  const LandingPage = Pages[getRoleLandingPage()] || MainPage;
  const landingPageName = getRoleLandingPage();

  return (
    <Routes>
      <Route path="/" element={
        <LayoutWrapper currentPageName={landingPageName}>
          <LandingPage />
        </LayoutWrapper>
      } />
      {Object.entries(Pages).map(([path, Page]) => (
        <Route
          key={path}
          path={`/${path}`}
          element={
            <LayoutWrapper currentPageName={path}>
              <Page />
            </LayoutWrapper>
          }
        />
      ))}
      <Route path="/AIAssistantSettings" element={<LayoutWrapper currentPageName="AIAssistantSettings"><AIAssistantSettings /></LayoutWrapper>} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
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