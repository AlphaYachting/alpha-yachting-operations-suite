import React, { useState, useEffect } from 'react';
import { connectionMonitor } from '@/components/offline/connectionMonitor';
import { syncQueue } from '@/components/offline/syncQueue';
import { WifiOff, Wifi, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { t } from '@/lib/mobileTranslations';
import { base44 } from '@/api/base44Client';

export default function SyncStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResults, setSyncResults] = useState([]);
  const [lang, setLang] = useState('de');

  useEffect(() => {
    const unsubscribe = connectionMonitor.subscribe((status) => {
      setIsOnline(status.isOnline);
      if (status.isOnline) {
        checkPendingItems();
      }
    });

    // Load user language
    base44.auth.me().then(u => setLang(u?.preferred_language || 'de')).catch(() => {});
    checkPendingItems();
    return unsubscribe;
  }, []);

  const checkPendingItems = async () => {
    const pending = await syncQueue.getPendingItems();
    setPendingCount(pending.length);
  };

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncResults([]);

    await syncQueue.processQueue((result) => {
      setSyncResults((prev) => [...prev, result]);
    });

    await syncQueue.clearCompletedItems();
    await checkPendingItems();
    setIsSyncing(false);
  };

  if (isOnline && pendingCount === 0) {
    return null;
  }

  return (
    <div className="sticky bottom-4 right-4 z-40 max-w-xs">
      {!isOnline && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex items-start gap-2 shadow-md">
          <WifiOff className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-orange-900">{t('youAreOffline', lang)}</p>
            <p className="text-xs text-orange-700 mt-0.5">{t('changesWillSync', lang)}</p>
          </div>
        </div>
      )}

      {isOnline && pendingCount > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2 shadow-md">
          <Wifi className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <p className="text-sm font-semibold text-blue-900">
                {pendingCount} {t('pendingChanges', lang)}
              </p>
              <Badge className="bg-blue-600 text-white text-xs">{t('readyToSync', lang)}</Badge>
            </div>
            <Button
              onClick={handleSync}
              disabled={isSyncing}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs"
            >
              <RefreshCw className={`h-3 w-3 mr-1 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? t('syncing', lang) : t('syncNow', lang)}
            </Button>
          </div>
        </div>
      )}

      {syncResults.length > 0 && (
        <div className="mt-2 bg-white border border-slate-200 rounded-lg p-3 shadow-md">
          <p className="text-xs font-semibold text-slate-700 mb-2">{t('syncResults', lang)}</p>
          <div className="space-y-1">
            {syncResults.map((result, idx) => (
              <div key={idx} className="flex items-center gap-2 text-xs">
                {result.success ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-600" />
                )}
                <span className={result.success ? 'text-green-700' : 'text-red-700'}>
                  {result.entity} {result.action} {result.success ? t('synced', lang) : t('failed', lang)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}