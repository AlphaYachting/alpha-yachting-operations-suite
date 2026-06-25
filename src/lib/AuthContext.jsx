import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';

// Admin access cache — skips redundant checkUserAccess calls for admins (TTL: 1 hour)
const ADMIN_CACHE_KEY = '_auth_admin_checked';
const ADMIN_CACHE_TTL = 60 * 60 * 1000; // 1 hour

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
    // Only show global loading spinner on the true initial cold boot
    if (isInitial) {
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
        // SECURITY GATE: verify user has a valid accepted invite (or is admin)
        // Skip check on the InviteAccept page so the flow can complete
        const isInvitePage = window.location.pathname === '/InviteAccept';
        const isAdmin = currentUser.role === 'admin';
        if (!isInvitePage) {
          // Admin cache: skip redundant backend call within TTL window
          const cachedEntry = isAdmin ? localStorage.getItem(ADMIN_CACHE_KEY) : null;
          const cachedData = cachedEntry ? JSON.parse(cachedEntry) : null;
          const cacheValid = cachedData && (Date.now() - cachedData.ts) < ADMIN_CACHE_TTL;

          if (isAdmin && cacheValid) {
            // Admin already verified — skip backend roundtrip
            setUser(currentUser);
            setIsAuthenticated(true);
            isCheckingRef.current = false;
            setIsLoadingAuth(false);
            return;
          }

          try {
            const accessRes = await base44.functions.invoke('checkUserAccess', {});
            if (!accessRes.data?.allowed) {
              // User authenticated but not authorized — show error and force logout
              console.warn('[AuthContext] Access denied for', currentUser.email, '— logging out');
              setUser(null);
              setIsAuthenticated(false);
              setAuthError({ type: 'user_not_registered' });
              // Delay logout so the error screen renders first
              setTimeout(() => base44.auth.logout('/'), 3000);
              return;
            }
          } catch (accessErr) {
            // If the check itself fails, fail closed for non-admins
            console.error('[AuthContext] checkUserAccess failed:', accessErr?.message);
            if (currentUser.role !== 'admin') {
              setUser(null);
              setIsAuthenticated(false);
              setAuthError({ type: 'user_not_registered' });
              setTimeout(() => base44.auth.logout('/'), 3000);
              return;
            }
          }
        }
        // Cache admin access result to avoid future roundtrips
        if (isAdmin) {
          try { localStorage.setItem(ADMIN_CACHE_KEY, JSON.stringify({ ts: Date.now() })); } catch {}
        }
        // Auto-fix: if full_name has no space (e.g. email username), fix it silently
        if (currentUser.full_name && !currentUser.full_name.includes(' ')) {
          base44.functions.invoke('fixUserFullName', {}).catch(() => {});
        }
        setUser(currentUser);
        setIsAuthenticated(true);
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('[AuthContext] checkAuth error:', error?.message || error);
      if (error?.message === 'auth_timeout') {
        // On timeout: keep existing auth state intact (user stays logged in if already was)
        // Do NOT reset isAuthenticated — just unblock the loading spinner
        setIsLoadingAuth(false);
        isCheckingRef.current = false;
        return; // skip finally
      } else if (error?.data?.extra_data?.reason === 'user_not_registered') {
        setAuthError({ type: 'user_not_registered' });
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