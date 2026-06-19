import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { format, parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { de } from 'date-fns/locale';
import { Clock, MapPin, Users, Plus, Umbrella, Pencil, Heart, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AttendanceEditDialog from '@/components/attendance/AttendanceEditDialog';

function formatDuration(minutes) {
  if (!minutes && minutes !== 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

const RECORD_TYPE_CONFIG = {
  clock_in:     { label: 'Kommen/Gehen', icon: Clock,   color: 'bg-blue-100 text-blue-800 border-blue-200' },
  manual_entry: { label: 'Manuell',      icon: Pencil,  color: 'bg-amber-100 text-amber-800 border-amber-200' },
  vacation:     { label: 'Urlaub',       icon: Umbrella,color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  sick_leave:   { label: 'Krank',        icon: Heart,   color: 'bg-rose-100 text-rose-800 border-rose-200' },
};

export default function AttendanceAdmin() {
  const [records, setRecords] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterTech, setFilterTech] = useState('all');
  const [filterPeriod, setFilterPeriod] = useState('week');
  const [filterType, setFilterType] = useState('all');
  const [editRecord, setEditRecord] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const loadData = useCallback(async () => {
    const [recs, techs] = await Promise.all([
      base44.entities.AttendanceRecord.list('-work_date', 1000),
      base44.entities.Technician.list('-created_date', 100)
    ]);
    setRecords(recs || []);
    setTechnicians(techs || []);
  }, []);

  useEffect(() => {
    loadData().finally(() => setLoading(false));
  }, [loadData]);

  const openNewEntry = (type = 'manual_entry') => {
    const defaultTech = filterTech !== 'all' ? filterTech : (technicians[0]?.id || '');
    setEditRecord({
      record_type: type,
      technician_id: defaultTech,
      work_date: format(new Date(), 'yyyy-MM-dd'),
      work_start_time: type === 'manual_entry' ? '07:00' : '',
      work_end_time: type === 'manual_entry' ? '15:00' : '',
      break_minutes: 30,
      duration_minutes: type === 'vacation' ? 480 : 0,
      notes: '',
    });
    setDialogOpen(true);
  };

  const openEditRecord = (r) => {
    setEditRecord(r);
    setDialogOpen(true);
  };

  const handleSaved = () => {
    loadData();
  };

  const handleDeleted = () => {
    loadData();
  };

  const getFilteredRecords = () => {
    let filtered = records;

    if (filterTech !== 'all') {
      filtered = filtered.filter(r => r.technician_id === filterTech);
    }

    if (filterType !== 'all') {
      filtered = filtered.filter(r => (r.record_type || 'clock_in') === filterType);
    }

    const now = new Date();
    if (filterPeriod === 'week') {
      const start = startOfWeek(now, { weekStartsOn: 1 });
      const end = endOfWeek(now, { weekStartsOn: 1 });
      filtered = filtered.filter(r => {
        const d = r.work_date ? parseISO(r.work_date) : null;
        return d && d >= start && d <= end;
      });
    } else if (filterPeriod === 'month') {
      const start = startOfMonth(now);
      const end = endOfMonth(now);
      filtered = filtered.filter(r => {
        const d = r.work_date ? parseISO(r.work_date) : null;
        return d && d >= start && d <= end;
      });
    }

    return filtered;
  };

  const filtered = getFilteredRecords();

  // Group by technician_name
  const grouped = filtered.reduce((acc, r) => {
    const key = r.technician_name || r.technician_id || 'Unbekannt';
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  const totalMinutes = filtered.reduce((sum, r) => sum + (r.record_type === 'vacation' || r.record_type === 'sick_leave'
    ? (r.duration_minutes || 480)
    : (r.duration_minutes || 0)), 0);
  const vacationMinutes = filtered
    .filter(r => r.record_type === 'vacation')
    .reduce((sum, r) => sum + (r.duration_minutes || 480), 0);
  const sickMinutes = filtered
    .filter(r => r.record_type === 'sick_leave')
    .reduce((sum, r) => sum + (r.duration_minutes || 480), 0);

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Lädt...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Clock className="h-6 w-6 text-blue-600" />
          Arbeitszeiterfassung
        </h1>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => openNewEntry('manual_entry')}>
            <Plus className="h-4 w-4 mr-1" /> Manuelle Eingabe
          </Button>
          <Button size="sm" variant="outline" onClick={() => openNewEntry('vacation')}>
            <Umbrella className="h-4 w-4 mr-1" /> Urlaub
          </Button>
          <Button size="sm" variant="outline" onClick={() => openNewEntry('sick_leave')}>
            <Heart className="h-4 w-4 mr-1" /> Krankheit
          </Button>
        </div>
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
            <SelectItem value="all">Alle Mitarbeiter</SelectItem>
            {technicians.map(t => (
              <SelectItem key={t.id} value={t.id}>{t.first_name} {t.last_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Alle Typen" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Typen</SelectItem>
            <SelectItem value="clock_in">Kommen/Gehen</SelectItem>
            <SelectItem value="manual_entry">Manuell</SelectItem>
            <SelectItem value="vacation">Urlaub</SelectItem>
            <SelectItem value="sick_leave">Krankheit</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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
        <Card className="border-emerald-200">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-emerald-700">{formatDuration(vacationMinutes)}</div>
            <div className="text-xs text-slate-500 mt-1">Urlaub</div>
          </CardContent>
        </Card>
        <Card className="border-rose-200">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-rose-700">{formatDuration(sickMinutes)}</div>
            <div className="text-xs text-slate-500 mt-1">Krankheit</div>
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
          const techTotal = techRecords.reduce((sum, r) => sum + (
            r.record_type === 'vacation' || r.record_type === 'sick_leave'
              ? (r.duration_minutes || 480)
              : (r.duration_minutes || 0)
          ), 0);
          const techVacation = techRecords
            .filter(r => r.record_type === 'vacation')
            .reduce((sum, r) => sum + (r.duration_minutes || 480), 0);

          return (
            <Card key={techName}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-slate-400" />
                    {techName}
                  </span>
                  <span className="text-sm font-normal text-slate-600">
                    {formatDuration(techTotal)} gesamt
                    {techVacation > 0 && (
                      <span className="ml-3 text-emerald-600">{formatDuration(techVacation)} Urlaub</span>
                    )}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-1">
                  {techRecords.sort((a, b) => new Date(b.work_date || 0) - new Date(a.work_date || 0)).map(r => {
                    const typeConfig = RECORD_TYPE_CONFIG[r.record_type] || RECORD_TYPE_CONFIG.clock_in;
                    const TypeIcon = typeConfig.icon;

                    return (
                      <div
                        key={r.id}
                        onClick={() => openEditRecord(r)}
                        className="flex items-center justify-between py-2.5 px-2 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors border-b border-slate-50 last:border-0"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge className={`text-xs border ${typeConfig.color}`}>
                              <TypeIcon className="h-3 w-3 mr-1" />
                              {typeConfig.label}
                            </Badge>
                            <span className="text-sm font-medium text-slate-800">
                              {r.work_date ? format(parseISO(r.work_date), 'EEE dd.MM.', { locale: de }) : '—'}
                            </span>
                            {r.record_type === 'manual_entry' && r.work_start_time && (
                              <span className="text-sm text-slate-600">
                                {r.work_start_time}{r.work_end_time ? ` – ${r.work_end_time}` : ''}
                              </span>
                            )}
                            {r.record_type === 'clock_in' && (
                              <span className="text-sm text-slate-600">
                                {r.clock_in ? format(parseISO(r.clock_in), 'HH:mm') : ''}
                                {r.clock_out ? ` – ${format(parseISO(r.clock_out), 'HH:mm')}` : ''}
                              </span>
                            )}
                            {!r.clock_out && r.record_type === 'clock_in' && (
                              <Badge className="bg-green-100 text-green-700 text-xs">Aktiv</Badge>
                            )}
                          </div>
                          {r.clock_in_address && r.record_type === 'clock_in' && (
                            <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5 ml-1">
                              <MapPin className="h-3 w-3" />
                              <span className="truncate">{r.clock_in_address}</span>
                            </div>
                          )}
                          {r.notes && <p className="text-xs text-slate-500 mt-0.5 ml-1 italic">{r.notes}</p>}
                        </div>
                        <div className="flex items-center gap-3 ml-4">
                          <div className="text-sm font-semibold text-slate-700 whitespace-nowrap">
                            {r.record_type === 'vacation' || r.record_type === 'sick_leave'
                              ? formatDuration(r.duration_minutes || 480)
                              : formatDuration(r.duration_minutes)}
                          </div>
                          <Pencil className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })
      )}

      {/* Edit / Create Dialog */}
      <AttendanceEditDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        record={editRecord}
        technicians={technicians}
        onSaved={handleSaved}
        onDeleted={handleDeleted}
      />
    </div>
  );
}