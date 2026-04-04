import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);
  const isCheckingRef = useRef(false);

  useEffect(() => {
    checkAuth(true); // initial load

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkAuth(false); // re-check, but keep state on timeout
      }
    };
    // iOS PWA: pageshow fires after BFCache restore (back/forward navigation)
    // This is critical for iOS PWA — fires even when visibilitychange doesn't
    const handlePageShow = (e) => {
      if (e.persisted) {
        checkAuth(false);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pageshow', handlePageShow);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, []);

  const checkAuth = async (isInitial = false) => {
    if (isCheckingRef.current) return; // prevent parallel calls
    isCheckingRef.current = true;
    // Only show global loading spinner on initial check OR if not yet authenticated
    if (isInitial || !isAuthenticated) {
      setIsLoadingAuth(true);
    }
    setAuthError(null);
    try {
      const timeoutMs = isInitial ? 10000 : 5000;
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('auth_timeout')), timeoutMs)
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
      } else if (error?.message === 'auth_timeout') {
        setIsLoadingAuth(false);
        isCheckingRef.current = false;
        return;
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    } finally {
      isCheckingRef.current = false;
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