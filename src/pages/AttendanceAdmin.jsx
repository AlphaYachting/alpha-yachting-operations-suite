import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { format, parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { de } from 'date-fns/locale';
import { Clock, MapPin, Users, Download, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

function formatDuration(minutes) {
  if (!minutes) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

export default function AttendanceAdmin() {
  const [records, setRecords] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterTech, setFilterTech] = useState('all');
  const [filterPeriod, setFilterPeriod] = useState('week');

  useEffect(() => {
    Promise.all([
      base44.entities.AttendanceRecord.list('-clock_in', 500),
      base44.entities.Technician.list('-created_date', 100)
    ]).then(([recs, techs]) => {
      setRecords(recs || []);
      setTechnicians(techs || []);
    }).finally(() => setLoading(false));
  }, []);

  const getFilteredRecords = () => {
    let filtered = records;

    if (filterTech !== 'all') {
      filtered = filtered.filter(r => r.technician_id === filterTech);
    }

    const now = new Date();
    if (filterPeriod === 'week') {
      const start = startOfWeek(now, { weekStartsOn: 1 });
      const end = endOfWeek(now, { weekStartsOn: 1 });
      filtered = filtered.filter(r => {
        const d = parseISO(r.clock_in);
        return d >= start && d <= end;
      });
    } else if (filterPeriod === 'month') {
      const start = startOfMonth(now);
      const end = endOfMonth(now);
      filtered = filtered.filter(r => {
        const d = parseISO(r.clock_in);
        return d >= start && d <= end;
      });
    }

    return filtered;
  };

  const filtered = getFilteredRecords();

  // Group by technician_name or technician_id
  const grouped = filtered.reduce((acc, r) => {
    const key = r.technician_name || r.technician_id || 'Unbekannt';
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  const totalMinutes = filtered.reduce((sum, r) => sum + (r.duration_minutes || 0), 0);
  const openSessions = filtered.filter(r => !r.clock_out).length;

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500">Lädt...</div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Clock className="h-6 w-6 text-blue-600" />
          Arbeitszeiterfassung
        </h1>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <Select value={filterPeriod} onValueChange={setFilterPeriod}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="week">Diese Woche</SelectItem>
            <SelectItem value="month">Dieser Monat</SelectItem>
            <SelectItem value="all">Alle</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterTech} onValueChange={setFilterTech}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Alle Techniker" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Techniker</SelectItem>
            {technicians.map(t => (
              <SelectItem key={t.id} value={t.id}>{t.first_name} {t.last_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-slate-900">{formatDuration(totalMinutes)}</div>
            <div className="text-xs text-slate-500 mt-1">Gesamtstunden</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-slate-900">{filtered.length}</div>
            <div className="text-xs text-slate-500 mt-1">Einträge</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className={`text-2xl font-bold ${openSessions > 0 ? 'text-green-600' : 'text-slate-900'}`}>{openSessions}</div>
            <div className="text-xs text-slate-500 mt-1">Aktive Sessions</div>
          </CardContent>
        </Card>
      </div>

      {/* Records by Technician */}
      {Object.keys(grouped).length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-slate-500">
            Keine Einträge für den gewählten Zeitraum.
          </CardContent>
        </Card>
      ) : (
        Object.entries(grouped).map(([techName, techRecords]) => {
          const techTotal = techRecords.reduce((sum, r) => sum + (r.duration_minutes || 0), 0);
          return (
            <Card key={techName}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-slate-400" />
                    {techName}
                  </span>
                  <span className="text-sm font-normal text-slate-600">{formatDuration(techTotal)} gesamt</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {techRecords.map(r => (
                    <div key={r.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-800">
                            {format(parseISO(r.clock_in), 'EEE dd.MM.', { locale: de })}
                          </span>
                          <span className="text-sm text-slate-600">
                            {format(parseISO(r.clock_in), 'HH:mm')}
                            {r.clock_out ? ` – ${format(parseISO(r.clock_out), 'HH:mm')}` : ''}
                          </span>
                          {!r.clock_out && (
                            <Badge className="bg-green-100 text-green-700 text-xs">Aktiv</Badge>
                          )}
                        </div>
                        {r.clock_in_address && (
                          <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                            <MapPin className="h-3 w-3" />
                            <span className="truncate">{r.clock_in_address}</span>
                          </div>
                        )}
                        {r.notes && <p className="text-xs text-slate-500 mt-0.5">{r.notes}</p>}
                      </div>
                      <div className="text-sm font-semibold text-slate-700 ml-4 whitespace-nowrap">
                        {formatDuration(r.duration_minutes)}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}