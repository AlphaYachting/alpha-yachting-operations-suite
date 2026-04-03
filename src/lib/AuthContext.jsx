import React, { createContext, useState, useContext, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    checkAuth();

    // iOS PWA: visibilitychange fires when switching back from Safari
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkAuth();
      }
    };
    // iOS PWA: pageshow fires after BFCache restore (back/forward navigation)
    // This is critical for iOS PWA — fires even when visibilitychange doesn't
    const handlePageShow = (e) => {
      if (e.persisted) {
        // Page was restored from BFCache — re-check auth
        checkAuth();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pageshow', handlePageShow);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, []);

  const checkAuth = async () => {
    setIsLoadingAuth(true);
    setAuthError(null);
    try {
      // Timeout after 8s — prevents infinite spinner on iOS PWA network issues
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('auth_timeout')), 8000)
      );
      const currentUser = await Promise.race([base44.auth.me(), timeoutPromise]);
      if (currentUser?.email) {
        setUser(currentUser);
        setIsAuthenticated(true);
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('[AuthContext] checkAuth error:', error?.message || error);
      if (error?.data?.extra_data?.reason === 'user_not_registered') {
        setAuthError({ type: 'user_not_registered' });
      } else {
        // All errors (401, timeout, network) → treat as not authenticated → redirect to login
        setUser(null);
        setIsAuthenticated(false);
      }
    } finally {
      setIsLoadingAuth(false);
    }
  };

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
    base44.auth.logout('/');
  };

  const navigateToLogin = () => {
    const returnUrl = window.location.pathname + window.location.search;
    base44.auth.redirectToLogin(returnUrl);
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings: false,
      authError,
      logout,
      navigateToLogin,
      checkAppState: checkAuth
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