import React from 'react';
import { useAuth } from '@/lib/AuthContext';

/**
 * Wrapper für geschützte Seiten:
 * - Wartet bis Auth vollständig ist
 * - Rendert NICHTS wenn nicht authentifiziert
 * - Rendert Kinder nur wenn User authentifiziert & geladen
 */
export default function AuthGuard({ children }) {
  const { isLoadingAuth, isAuthenticated, user } = useAuth();

  // Still loading
  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated || !user) {
    return null;
  }

  // Render children
  return children;
}