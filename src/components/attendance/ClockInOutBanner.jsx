import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { format, differenceInMinutes, parseISO } from 'date-fns';
import { Clock, MapPin, LogIn, LogOut, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { t } from '@/lib/mobileTranslations';

// Module-level watcher — starts once, keeps position fresh silently
let _cachedPosition = null;
let _watchId = null;

function startPositionWatch() {
  if (!navigator.geolocation || _watchId !== null) return;
  _watchId = navigator.geolocation.watchPosition(
    (pos) => { _cachedPosition = { lat: pos.coords.latitude, lng: pos.coords.longitude }; },
    (err) => { console.warn('GPS watch error:', err.code, err.message); },
    { enableHighAccuracy: true, maximumAge: 30000, timeout: 15000 }
  );
}

async function getGpsPosition() {
  if (_cachedPosition) return _cachedPosition;
  // Fallback: one-time request if cache empty
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => { console.warn('GPS error:', err.code, err.message); resolve(null); },
      { timeout: 10000, maximumAge: 30000, enableHighAccuracy: true }
    );
  });
}

async function reverseGeocode(lat, lng, lang = 'de') {
try {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
    { headers: { 'Accept-Language': lang === 'en' ? 'en' : 'de' } }
  );
  const data = await res.json();
  return data.display_name?.split(',').slice(0, 3).join(', ') || null;
} catch {
  return null;
}
}

export default function ClockInOutBanner({ technicianId, technicianName, lang = 'de', onNavigateToHistory }) {
  const [activeRecord, setActiveRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [elapsed, setElapsed] = useState('');

  // Start background position watcher on mount
  useEffect(() => { startPositionWatch(); }, []);

  const loadActiveRecord = useCallback(async () => {
    if (!technicianId) { setLoading(false); return; }
    try {
      // Fetch recent records and filter client-side for open ones (null clock_out)
      const records = await base44.entities.AttendanceRecord.filter(
        { technician_id: technicianId },
        '-clock_in',
        20
      );
      // Find the most recent record with no clock_out
      const open = (records || []).filter(r => !r.clock_out).sort((a, b) =>
        new Date(b.clock_in) - new Date(a.clock_in)
      );
      setActiveRecord(open[0] || null);
    } catch (e) {
      console.error('AttendanceRecord load error:', e);
    } finally {
      setLoading(false);
    }
  }, [technicianId]);

  useEffect(() => {
    loadActiveRecord();
  }, [loadActiveRecord]);

  // Live elapsed timer
  useEffect(() => {
    if (!activeRecord) return;
    const tick = () => {
      const mins = differenceInMinutes(new Date(), parseISO(activeRecord.clock_in));
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      setElapsed(h > 0 ? `${h}h ${m}min` : `${m}min`);
    };
    tick();
    const interval = setInterval(tick, 60000);
    return () => clearInterval(interval);
  }, [activeRecord]);

  const handleClockIn = async () => {
    setProcessing(true);
    try {
      const gps = await getGpsPosition();
      let address = null;
      if (gps) {
        address = await reverseGeocode(gps.lat, gps.lng, lang);
      }
      const now = new Date().toISOString();
      const record = await base44.entities.AttendanceRecord.create({
        technician_id: technicianId,
        technician_name: technicianName || '',
        clock_in: now,
        work_date: format(new Date(), 'yyyy-MM-dd'),
        clock_in_lat: gps?.lat || null,
        clock_in_lng: gps?.lng || null,
        clock_in_address: address || null,
        clock_out: null
      });
      setActiveRecord(record);
      if (gps) {
        toast.success(`${t('clockedInAt', lang)} ${format(new Date(), 'HH:mm')} 📍`);
      } else {
        toast.warning(`${t('clockInSuccess', lang)} ${format(new Date(), 'HH:mm')} — ${t('noGps', lang)}`);
      }
    } catch (e) {
      toast.error(t('clockInError', lang));
    } finally {
      setProcessing(false);
    }
  };

  const handleClockOut = async () => {
    if (!activeRecord) return;
    setProcessing(true);
    try {
      const gps = await getGpsPosition();
      let address = null;
      if (gps) {
        address = await reverseGeocode(gps.lat, gps.lng, lang);
      }
      const nowo = new Date().toISOString();
      const duration = differenceInMinutes(new Date(), parseISO(activeRecord.clock_in));
      await base44.entities.AttendanceRecord.update(activeRecord.id, {
        clock_out: nowo,
        duration_minutes: duration,
        clock_out_lat: gps?.lat || null,
        clock_out_lng: gps?.lng || null,
        clock_out_address: address || null,
      });
      setActiveRecord(null);
      setElapsed('');
      toast.success(`${t('clockedOut', lang)} ${Math.floor(duration / 60)}h ${duration % 60}min`);
    } catch (e) {
      toast.error(t('clockOutError', lang));
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return null;

  if (!activeRecord) {
    return (
      <div className="mx-4 mt-3 mb-1">
        <button
          onClick={handleClockIn}
          disabled={processing}
          className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-emerald-500 active:bg-emerald-600 text-white font-bold text-base shadow-md transition-colors disabled:opacity-60"
          style={{ boxShadow: '0 4px 16px rgba(16,185,129,0.35)' }}
        >
          {processing ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogIn className="h-5 w-5" />}
          {processing ? t('clockingIn', lang) : t('clockIn', lang)}
        </button>
        {onNavigateToHistory && (
          <button onClick={onNavigateToHistory} className="w-full text-center text-xs text-slate-400 mt-2 py-1">
            {t('viewTimeRecords', lang)}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mx-4 mt-3 mb-1">
      <div className="rounded-2xl bg-blue-600 text-white shadow-md overflow-hidden"
        style={{ boxShadow: '0 4px 16px rgba(37,99,235,0.35)' }}>
        <div className="px-4 pt-3 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-300 animate-pulse" />
            <span className="text-sm font-semibold">{t('activeSince', lang)} {format(parseISO(activeRecord.clock_in), 'HH:mm')}</span>
          </div>
          <div className="flex items-center gap-1 text-blue-200 text-sm font-mono">
            <Clock className="h-4 w-4" />
            {elapsed}
          </div>
        </div>
        {activeRecord.clock_in_address && (
          <div className="px-4 pb-2 flex items-center gap-1 text-blue-200 text-xs">
            <MapPin className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{activeRecord.clock_in_address}</span>
          </div>
        )}
        <div className="px-4 pb-3 flex gap-2">
          <button
            onClick={handleClockOut}
            disabled={processing}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500 active:bg-red-600 font-bold text-base transition-colors disabled:opacity-60"
          >
            {processing ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogOut className="h-5 w-5" />}
            {processing ? t('clockingOut', lang) : t('clockOut', lang)}
          </button>
          {onNavigateToHistory && (
            <button onClick={onNavigateToHistory} className="px-3 py-3 rounded-xl bg-blue-500 active:bg-blue-700 text-white text-xs font-medium">
              {t('history', lang)}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}