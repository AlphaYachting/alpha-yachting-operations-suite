import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { format, parseISO, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';
import { de } from 'date-fns/locale';
import { Clock, MapPin, ArrowLeft, Calendar, Timer, Umbrella, Heart, Pencil } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

function formatDuration(minutes) {
  if (!minutes && minutes !== 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

const RECORD_TYPE_CONFIG = {
  clock_in:     { label: 'Kommen/Gehen', icon: Clock,   color: 'bg-blue-100 text-blue-800' },
  manual_entry: { label: 'Manuell',      icon: Pencil,  color: 'bg-amber-100 text-amber-800' },
  vacation:     { label: 'Urlaub',       icon: Umbrella,color: 'bg-emerald-100 text-emerald-800' },
  sick_leave:   { label: 'Krank',        icon: Heart,   color: 'bg-rose-100 text-rose-800' },
};

export default function TeamAttendance({ onNavigate, technicianId: propTechnicianId }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [technicianId, setTechnicianId] = useState(propTechnicianId || null);

  useEffect(() => {
    const init = async () => {
      let techId = propTechnicianId;
      if (!techId) {
        try {
          const user = await base44.auth.me();
          const techs = await base44.entities.Technician.filter({
            $or: [{ user_id: user?.id }, { email: user?.email }]
          });
          techId = techs?.[0]?.id;
        } catch (e) {
          console.error(e);
        }
      }
      setTechnicianId(techId);
      if (techId) {
        await loadRecords(techId);
      } else {
        setLoading(false);
      }
    };
    init();
  }, [propTechnicianId]);

  const loadRecords = async (techId) => {
    try {
      const data = await base44.entities.AttendanceRecord.filter(
        { technician_id: techId },
        '-work_date',
        200
      );
      setRecords(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Group by work_date
  const grouped = records.reduce((acc, r) => {
    const day = r.work_date || 'unknown';
    if (!acc[day]) acc[day] = [];
    acc[day].push(r);
    return acc;
  }, {});

  // This week stats
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const weekRecords = records.filter(r =>
    r.work_date && isWithinInterval(parseISO(r.work_date), { start: weekStart, end: weekEnd })
  );
  const weekMinutes = weekRecords.reduce((sum, r) => sum + (
    r.record_type === 'vacation' || r.record_type === 'sick_leave' ? (r.duration_minutes || 480) : (r.duration_minutes || 0)
  ), 0);
  const weekVacation = weekRecords
    .filter(r => r.record_type === 'vacation')
    .reduce((sum, r) => sum + (r.duration_minutes || 480), 0);
  const weekSick = weekRecords
    .filter(r => r.record_type === 'sick_leave')
    .reduce((sum, r) => sum + (r.duration_minutes || 480), 0);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
        <button
          onClick={() => onNavigate ? onNavigate('home') : window.history.back()}
          className="p-2 rounded-lg hover:bg-slate-100 active:bg-slate-200 transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-slate-700" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-slate-900">Zeitaufzeichnungen</h1>
          <p className="text-xs text-slate-500">Arbeitszeit, Urlaub & Krankheit</p>
        </div>
      </div>

      {/* This week summary */}
      <div className="px-4 py-3 space-y-3">
        <Card className="bg-blue-600 text-white border-0 shadow-md">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-blue-200 text-xs font-medium">Diese Woche</p>
                <p className="text-white font-bold text-xl">{formatDuration(weekMinutes)}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-blue-200 text-xs">
                {format(weekStart, 'd.M.')} – {format(weekEnd, 'd.M.yyyy')}
              </p>
              <p className="text-white text-sm font-medium mt-0.5">
                {weekRecords.length} Einträge
              </p>
            </div>
          </CardContent>
        </Card>

        {(weekVacation > 0 || weekSick > 0) && (
          <div className="flex gap-3">
            {weekVacation > 0 && (
              <Card className="flex-1 border-emerald-200 bg-emerald-50">
                <CardContent className="p-3 flex items-center gap-2">
                  <Umbrella className="h-5 w-5 text-emerald-600" />
                  <div>
                    <p className="text-xs text-emerald-700 font-medium">Urlaub</p>
                    <p className="text-lg font-bold text-emerald-800">{formatDuration(weekVacation)}</p>
                  </div>
                </CardContent>
              </Card>
            )}
            {weekSick > 0 && (
              <Card className="flex-1 border-rose-200 bg-rose-50">
                <CardContent className="p-3 flex items-center gap-2">
                  <Heart className="h-5 w-5 text-rose-600" />
                  <div>
                    <p className="text-xs text-rose-700 font-medium">Krank</p>
                    <p className="text-lg font-bold text-rose-800">{formatDuration(weekSick)}</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Records */}
      <div className="px-4 pb-8 space-y-4">
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
          </div>
        )}

        {!loading && records.length === 0 && (
          <div className="text-center py-16">
            <Timer className="h-12 w-12 mx-auto text-slate-300 mb-3" />
            <p className="text-slate-600 font-medium">Noch keine Einträge</p>
            <p className="text-slate-400 text-sm mt-1">Stempel dich auf der Startseite ein</p>
          </div>
        )}

        {Object.entries(grouped)
          .sort(([a], [b]) => b.localeCompare(a))
          .map(([day, dayRecords]) => {
            const dayTotal = dayRecords.reduce((sum, r) => sum + (
              r.record_type === 'vacation' || r.record_type === 'sick_leave'
                ? (r.duration_minutes || 480)
                : (r.duration_minutes || 0)
            ), 0);
            const dayDate = parseISO(day);
            return (
              <div key={day}>
                {/* Day header */}
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">
                    {format(dayDate, 'EEEE, d. MMMM', { locale: de })}
                  </h2>
                  {dayTotal > 0 && (
                    <span className="text-sm font-semibold text-slate-600">{formatDuration(dayTotal)}</span>
                  )}
                </div>

                <div className="space-y-2">
                  {dayRecords.map(record => {
                    const typeConfig = RECORD_TYPE_CONFIG[record.record_type] || RECORD_TYPE_CONFIG.clock_in;
                    const TypeIcon = typeConfig.icon;
                    const isAbsence = record.record_type === 'vacation' || record.record_type === 'sick_leave';

                    return (
                      <Card key={record.id} className={`bg-white border-slate-200 shadow-sm ${isAbsence ? 'border-l-4' : ''} ${record.record_type === 'vacation' ? 'border-l-emerald-400' : ''} ${record.record_type === 'sick_leave' ? 'border-l-rose-400' : ''}`}>
                        <CardContent className="p-4">
                          {isAbsence ? (
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${record.record_type === 'vacation' ? 'bg-emerald-100' : 'bg-rose-100'}`}>
                                  <TypeIcon className={`h-5 w-5 ${record.record_type === 'vacation' ? 'text-emerald-600' : 'text-rose-600'}`} />
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-slate-900">{typeConfig.label}</p>
                                  {record.notes && <p className="text-xs text-slate-500">{record.notes}</p>}
                                </div>
                              </div>
                              <Badge className={`font-semibold ${typeConfig.color}`}>
                                {formatDuration(record.duration_minutes || 480)}
                              </Badge>
                            </div>
                          ) : record.record_type === 'manual_entry' ? (
                            <div className="flex items-start justify-between">
                              <div className="space-y-1">
                                <Badge className={`text-xs ${typeConfig.color}`}>
                                  <TypeIcon className="h-3 w-3 mr-1" />{typeConfig.label}
                                </Badge>
                                <div className="flex items-center gap-3 mt-1">
                                  <div className="text-center">
                                    <p className="text-xs text-slate-400">Von</p>
                                    <p className="text-base font-bold text-emerald-600">{record.work_start_time || '—'}</p>
                                  </div>
                                  <div className="text-slate-300 font-light text-lg">→</div>
                                  <div className="text-center">
                                    <p className="text-xs text-slate-400">Bis</p>
                                    <p className="text-base font-bold text-red-500">{record.work_end_time || '—'}</p>
                                  </div>
                                </div>
                                {record.break_minutes > 0 && (
                                  <p className="text-xs text-slate-400">{record.break_minutes} min Pause</p>
                                )}
                                {record.notes && <p className="text-xs text-slate-500 mt-1 italic">{record.notes}</p>}
                              </div>
                              <Badge className="bg-slate-100 text-slate-700 font-semibold">
                                <Clock className="h-3 w-3 mr-1" />
                                {formatDuration(record.duration_minutes)}
                              </Badge>
                            </div>
                          ) : (
                            <div className="flex items-start justify-between">
                              <div className="space-y-1">
                                <div className="flex items-center gap-3">
                                  <div className="text-center">
                                    <p className="text-xs text-slate-400">Kommen</p>
                                    <p className="text-base font-bold text-emerald-600">
                                      {record.clock_in ? format(parseISO(record.clock_in), 'HH:mm') : '—'}
                                    </p>
                                  </div>
                                  <div className="text-slate-300 font-light text-lg">→</div>
                                  <div className="text-center">
                                    <p className="text-xs text-slate-400">Gehen</p>
                                    <p className={`text-base font-bold ${record.clock_out ? 'text-red-500' : 'text-blue-500'}`}>
                                      {record.clock_out ? format(parseISO(record.clock_out), 'HH:mm') : (
                                        <span className="flex items-center gap-1">
                                          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse inline-block" />
                                          Aktiv
                                        </span>
                                      )}
                                    </p>
                                  </div>
                                </div>

                                {record.clock_in_address && (
                                  <div className="flex items-start gap-1 text-xs text-slate-400 mt-1">
                                    <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0 text-emerald-400" />
                                    <span className="line-clamp-1">{record.clock_in_address}</span>
                                  </div>
                                )}
                                {record.clock_out_address && record.clock_out_address !== record.clock_in_address && (
                                  <div className="flex items-start gap-1 text-xs text-slate-400">
                                    <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0 text-red-400" />
                                    <span className="line-clamp-1">{record.clock_out_address}</span>
                                  </div>
                                )}
                                {record.notes && <p className="text-xs text-slate-500 mt-1 italic">{record.notes}</p>}
                              </div>

                              <div className="text-right ml-4">
                                {record.duration_minutes ? (
                                  <Badge className="bg-slate-100 text-slate-700 font-semibold">
                                    <Clock className="h-3 w-3 mr-1" />
                                    {formatDuration(record.duration_minutes)}
                                  </Badge>
                                ) : (
                                  <Badge className="bg-blue-50 text-blue-600">Läuft</Badge>
                                )}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}