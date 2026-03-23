import React, { createContext, useState, useContext, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { appParams } from '@/lib/app-params';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [appPublicSettings, setAppPublicSettings] = useState(null); // Contains only { id, public_settings }

  useEffect(() => {
    checkAppState();
  }, []);

  const checkAppState = async () => {
    try {
      setIsLoadingPublicSettings(true);
      setIsLoadingAuth(true);
      setAuthError(null);
      setIsAuthenticated(false);
      
      console.log('🔍 AUTH CHECK START:', { hasToken: !!appParams.token });
      
      // First, check app public settings (with token if available)
      try {
        const headers = { 'X-App-Id': appParams.appId };
        if (appParams.token) headers['Authorization'] = `Bearer ${appParams.token}`;
        const res = await fetch(`/api/apps/public/prod/public-settings/by-id/${appParams.appId}`, { headers });
        const publicSettings = res.ok ? await res.json() : null;
        setAppPublicSettings(publicSettings);
        
        console.log('✓ App settings loaded');
        
        // Always verify user auth (token present or not — public app can still have anonymous session)
        console.log('📋 Checking user auth...');
        await checkUserAuth();
        setIsLoadingPublicSettings(false);
      } catch (appError) {
        console.error('❌ App state check failed:', appError);
        setIsLoadingPublicSettings(false);
        setIsLoadingAuth(false);
        setIsAuthenticated(false);
        
        if (appError.status === 403 && appError.data?.extra_data?.reason) {
          const reason = appError.data.extra_data.reason;
          setAuthError({
            type: reason,
            message: appError.message
          });
        } else {
          setAuthError({
            type: 'unknown',
            message: appError.message || 'Failed to load app'
          });
        }
      }
    } catch (error) {
      console.error('❌ Unexpected error:', error);
      setAuthError({
        type: 'unknown',
        message: error.message || 'An unexpected error occurred'
      });
      setIsLoadingPublicSettings(false);
      setIsLoadingAuth(false);
      setIsAuthenticated(false);
    }
  };

  const checkUserAuth = async () => {
    try {
      console.log('🔐 Checking user auth with token...');
      const currentUser = await base44.auth.me();
      
      // CRITICAL: A public app returns an anonymous user without email — treat as not authenticated
      if (!currentUser?.email) {
        console.error('❌ No authenticated user (anonymous/empty) → redirecting to login');
        setUser(null);
        setIsAuthenticated(false);
        setIsLoadingAuth(false);
        localStorage.removeItem('base44_access_token');
        const returnUrl = window.location.pathname + window.location.search;
        base44.auth.redirectToLogin(returnUrl);
        return;
      }

      console.log('✅ User authenticated:', currentUser?.email);
      setUser(currentUser);
      setIsAuthenticated(true);
      setIsLoadingAuth(false);
    } catch (error) {
      console.error('❌ User auth check failed → redirecting to login');
      setUser(null);
      setIsAuthenticated(false);
      setIsLoadingAuth(false);
      localStorage.removeItem('base44_access_token');
      const returnUrl = window.location.pathname + window.location.search;
      base44.auth.redirectToLogin(returnUrl);
    }
  };

  const logout = (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    setAuthError(null);
    
    // Clear app state completely
    setAppPublicSettings(null);
    
    if (shouldRedirect) {
      // Logout and redirect to root (will trigger fresh auth check)
      base44.auth.logout('/');
    } else {
      // Just remove the token without redirect
      base44.auth.logout();
    }
  };

  const navigateToLogin = () => {
    // Use the SDK's redirectToLogin method
    // Pass current URL so we return here after login
    const returnUrl = window.location.pathname + window.location.search;
    base44.auth.redirectToLogin(returnUrl);
  };

  return (
    <AuthContext.Provider value={{ 
      user,
      isAuthenticated, 
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      logout,
      navigateToLogin,
      checkAppState
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};