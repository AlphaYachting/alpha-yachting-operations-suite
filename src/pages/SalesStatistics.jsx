import React, { useMemo, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Users, FileText, Mail, TrendingUp, Download, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';

// ── Date range helper ─────────────────────────────────────────────────────────
function getRangeMonths(rangeKey) {
  const now = new Date();
  const map = {
    'this_month': 1,
    'last_month': 2,
    'last_6': 6,
    'last_12': 12,
  };
  const count = map[rangeKey] || 6;
  return Array.from({ length: count }, (_, i) => {
    const d = subMonths(startOfMonth(now), count - 1 - i);
    return { key: format(d, 'yyyy-MM'), label: format(d, 'MMM yyyy'), start: startOfMonth(d), end: endOfMonth(d) };
  });
}

function inRange(dateStr, start, end) {
  if (!dateStr) return false;
  try {
    const d = typeof dateStr === 'string' ? parseISO(dateStr) : new Date(dateStr);
    return isWithinInterval(d, { start, end });
  } catch { return false; }
}

// ── CSV export ────────────────────────────────────────────────────────────────
function exportCSV(rows, filename) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(','), ...rows.map(r => headers.map(h => `"${r[h] ?? ''}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── KPI card ──────────────────────────────────────────────────────────────────
function KPICard({ icon: Icon, label, value, sub, color = 'text-blue-600' }) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide">{label}</p>
            <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
            {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
          </div>
          <div className="h-10 w-10 rounded-lg bg-slate-50 flex items-center justify-center">
            <Icon className="h-5 w-5 text-slate-400" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Helpers (module-level so they're always available) ────────────────────────
function isSystemAccount(email) {
  return !email || email.startsWith('service+') || email.includes('no-reply.base44.com');
}

function shortName(email) {
  if (!email || email === 'unknown') return 'Unbekannt';
  if (email.startsWith('assigned:')) return 'Zugewiesen (intern)';
  if (isSystemAccount(email)) return '⚙ System-Automation';
  return email.split('@')[0];
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function SalesStatistics() {
  const [range, setRange] = useState('last_6');
  const [userFilter, setUserFilter] = useState('all');
  const queryClient = useQueryClient();

  // Clear stats cache on mount to always get fresh data
  useEffect(() => {
    queryClient.removeQueries({ queryKey: ['stats-offers-all'] });
    queryClient.removeQueries({ queryKey: ['stats-leads'] });
    queryClient.removeQueries({ queryKey: ['stats-emails'] });
  }, []);

  const { data: leads = [], isLoading: leadsLoading, refetch: refetchLeads } = useQuery({
    queryKey: ['stats-leads'],
    queryFn: () => base44.entities.Lead.list('-created_date', 500),
    staleTime: 0,
    gcTime: 0,
  });

  // Load all offers — use backend function which fetches 1000 records with effective_created_by resolved
  const { data: offersRaw = [], isLoading: offersLoading, refetch: refetchOffersP1 } = useQuery({
    queryKey: ['stats-offers-all'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getOffersForStats', {});
      return res.data?.offers || [];
    },
    staleTime: 0,
    gcTime: 0,
  });

  // offersRaw already has effective_created_by resolved by backend
  const offers = offersRaw;
  const refetchOffersP2 = () => {}; // no-op, only one query now

  const { data: emails = [], isLoading: emailsLoading, refetch: refetchEmails } = useQuery({
    queryKey: ['stats-emails'],
    queryFn: () => base44.entities.EmailMessageSandbox.filter({ direction: 'inbound' }, '-created_date', 500),
    staleTime: 0,
    gcTime: 0,
  });

  const handleRefresh = () => {
    refetchLeads();
    refetchOffersP1();
    refetchOffersP2();
    refetchEmails();
  };


  const months = useMemo(() => getRangeMonths(range), [range]);
  const now = new Date();
  const thisMonthStart = startOfMonth(now);
  const thisMonthEnd = endOfMonth(now);
  const lastMonthStart = startOfMonth(subMonths(now, 1));
  const lastMonthEnd = endOfMonth(subMonths(now, 1));

  // ── User activity aggregation (filtered by selected range) ────────────────
  const userStats = useMemo(() => {
    const rangeStart = months[0]?.start;
    const rangeEnd = months[months.length - 1]?.end;
    const map = {};

    const ensure = (email) => {
      if (!email) email = 'unknown';
      if (!map[email]) map[email] = { email, leadsCreated: 0, leadsAssigned: 0, offersCreated: 0 };
      return map[email];
    };

    leads
      .filter(l => inRange(l.created_date, rangeStart, rangeEnd))
      .forEach(l => {
        ensure(l.created_by).leadsCreated++;
        if (l.assigned_to_user_id) {
          const key = `assigned:${l.assigned_to_user_id}`;
          ensure(key).leadsAssigned++;
        }
      });

    offers
      .filter(o => inRange(o.created_date, rangeStart, rangeEnd))
      .forEach(o => {
        // effective_created_by is already resolved by the backend function
        ensure(o.effective_created_by || o.created_by).offersCreated++;
      });

    return Object.values(map)
      .filter(u => u.leadsCreated > 0 || u.offersCreated > 0)
      .sort((a, b) => (b.leadsCreated + b.offersCreated) - (a.leadsCreated + a.offersCreated));
  }, [leads, offers, months]);

  // ── Monthly trend ─────────────────────────────────────────────────────────
  // effective_created_by is pre-resolved by backend
  const effectiveOfferCreator = (o) => o.effective_created_by || o.created_by;

  const monthlyTrend = useMemo(() => months.map(m => ({
    month: m.label,
    Leads: leads.filter(l => inRange(l.created_date, m.start, m.end)).length,
    Angebote: offers.filter(o => inRange(o.created_date, m.start, m.end)).length,
    Emails: emails.filter(e => inRange(e.received_at || e.created_date, m.start, m.end)).length,
  })), [months, leads, offers, emails]);

  // ── KPI numbers ──────────────────────────────────────────────────────────
  const leadsThisMonth = leads.filter(l => inRange(l.created_date, thisMonthStart, thisMonthEnd)).length;
  const leadsLastMonth = leads.filter(l => inRange(l.created_date, lastMonthStart, lastMonthEnd)).length;
  const offersThisMonth = offers.filter(o => inRange(o.created_date, thisMonthStart, thisMonthEnd)).length;
  const offersLastMonth = offers.filter(o => inRange(o.created_date, lastMonthStart, lastMonthEnd)).length;
  const emailsThisMonth = emails.filter(e => inRange(e.received_at || e.created_date, thisMonthStart, thisMonthEnd)).length;
  const emailsLastMonth = emails.filter(e => inRange(e.received_at || e.created_date, lastMonthStart, lastMonthEnd)).length;
  const activeUsers = new Set(
    [...leads.map(l => l.created_by), ...offers.map(o => effectiveOfferCreator(o))]
      .filter(e => e && !isSystemAccount(e))
  ).size;

  // ── Lead source breakdown ─────────────────────────────────────────────────
  const leadSources = useMemo(() => {
    const map = {};
    leads.forEach(l => {
      const s = l.contact_method || 'Other';
      map[s] = (map[s] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [leads]);

  const isLoading = leadsLoading || offersLoading || emailsLoading;

  // Count how many system offers were re-attributed via data.created_by override
  const overriddenOffersCount = offers.filter(o =>
    o.is_system === false && isSystemAccount(o.created_by)
  ).length;

  // ── Split human vs system accounts ───────────────────────────────────────
  // Note: effectiveOfferCreator is defined above monthlyTrend
  const humanUserStats = userStats.filter(u => !isSystemAccount(u.email) && !u.email.startsWith('assigned:'));
  const systemStats = userStats.filter(u => isSystemAccount(u.email));

  // Aggregate all system activity into one row
  const systemTotals = systemStats.reduce((acc, u) => ({
    email: 'system',
    leadsCreated: acc.leadsCreated + u.leadsCreated,
    leadsAssigned: acc.leadsAssigned + u.leadsAssigned,
    offersCreated: acc.offersCreated + u.offersCreated,
  }), { email: 'system', leadsCreated: 0, leadsAssigned: 0, offersCreated: 0 });

  // ── Filtered user rows ────────────────────────────────────────────────────
  const filteredUserStats = (userFilter === 'all' ? humanUserStats : humanUserStats.filter(u => u.email === userFilter));
  const uniqueUsers = humanUserStats.map(u => u.email);

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Sales Statistics</h1>
          <p className="text-slate-500 text-sm mt-0.5">Internes Reporting — read-only, keine Seiteneffekte</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="this_month">Dieser Monat</SelectItem>
              <SelectItem value="last_month">Letzter Monat</SelectItem>
              <SelectItem value="last_6">Letzte 6 Monate</SelectItem>
              <SelectItem value="last_12">Letzte 12 Monate</SelectItem>
            </SelectContent>
          </Select>
          <Select value={userFilter} onValueChange={setUserFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Alle Benutzer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Benutzer</SelectItem>
              {uniqueUsers.map(u => (
                <SelectItem key={u} value={u}>{shortName(u)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
            Aktualisieren
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportCSV(filteredUserStats.map(u => ({
              Benutzer: shortName(u.email),
              Email: u.email,
              LeadsErstellt: u.leadsCreated,
              LeadsZugewiesen: u.leadsAssigned,
              AngeboteErstellt: u.offersCreated,
            })), 'sales-statistics.csv')}
          >
            <Download className="h-3.5 w-3.5 mr-1.5" />
            CSV Export
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard icon={Users} label="Leads — dieser Monat" value={leadsThisMonth}
          sub={`Vormonat: ${leadsLastMonth}`} color="text-blue-600" />
        <KPICard icon={FileText} label="Angebote — dieser Monat" value={offersThisMonth}
          sub={`Vormonat: ${offersLastMonth}`} color="text-green-600" />
        <KPICard icon={Mail} label="Email-Anfragen — dieser Monat" value={emailsThisMonth}
          sub={`Vormonat: ${emailsLastMonth}`} color="text-purple-600" />
        <KPICard icon={TrendingUp} label="Aktive Sales-User" value={activeUsers}
          sub="Benutzer mit Leads oder Angeboten" color="text-slate-700" />
      </div>

      {/* Monthly Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Monatlicher Trend</CardTitle>
          <CardDescription>Leads, Angebote und eingehende E-Mails pro Monat</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={monthlyTrend} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Leads" fill="#3b82f6" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Angebote" fill="#10b981" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Emails" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Monthly Trend Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Monatsübersicht</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-slate-500 text-left">
                <th className="pb-2 font-medium">Monat</th>
                <th className="pb-2 font-medium text-right">Leads</th>
                <th className="pb-2 font-medium text-right">Angebote</th>
                <th className="pb-2 font-medium text-right">Email-Anfragen</th>
              </tr>
            </thead>
            <tbody>
              {[...monthlyTrend].reverse().map(row => (
                <tr key={row.month} className="border-b hover:bg-slate-50">
                  <td className="py-2 font-medium text-slate-700">{row.month}</td>
                  <td className="py-2 text-right text-blue-600 font-semibold">{row.Leads}</td>
                  <td className="py-2 text-right text-green-600 font-semibold">{row.Angebote}</td>
                  <td className="py-2 text-right text-purple-600 font-semibold">{row.Emails}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Per-User Activity Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Aktivität pro Benutzer</CardTitle>
              <CardDescription>Basierend auf created_by und assigned_to_user_id</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {filteredUserStats.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">Keine Daten für diesen Filter.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-slate-500 text-left">
                  <th className="pb-2 font-medium">Benutzer</th>
                  <th className="pb-2 font-medium text-right">Leads erstellt</th>
                  <th className="pb-2 font-medium text-right">Angebote erstellt</th>
                </tr>
              </thead>
              <tbody>
                {filteredUserStats.map(u => (
                  <tr key={u.email} className="border-b hover:bg-slate-50">
                    <td className="py-2">
                      <div className="font-medium text-slate-800">{shortName(u.email)}</div>
                      <div className="text-xs text-slate-400">{u.email}</div>
                    </td>
                    <td className="py-2 text-right">
                      <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">{u.leadsCreated}</Badge>
                    </td>
                    <td className="py-2 text-right">
                      <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">{u.offersCreated}</Badge>
                    </td>
                  </tr>
                ))}
                {/* System automation row — always shown separately */}
                {(systemTotals.leadsCreated > 0 || systemTotals.offersCreated > 0) && (
                  <tr className="bg-amber-50 border-b border-amber-100">
                    <td className="py-2">
                      <div className="font-medium text-amber-700">⚙ System-Automation</div>
                      <div className="text-xs text-amber-500">service+…@no-reply.base44.com — nicht manuell</div>
                      {overriddenOffersCount > 0 && (
                        <div className="text-xs text-green-600 mt-0.5">✓ {overriddenOffersCount} Angebote mit manuellem Ersteller-Override erkannt und umgeleitet</div>
                      )}
                    </td>
                    <td className="py-2 text-right">
                      <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">{systemTotals.leadsCreated}</Badge>
                    </td>
                    <td className="py-2 text-right">
                      <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">{systemTotals.offersCreated}</Badge>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Lead Source Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lead-Quellen</CardTitle>
          <CardDescription>Basierend auf contact_method Feld im Lead-Datensatz</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-slate-500 text-left">
                <th className="pb-2 font-medium">Quelle</th>
                <th className="pb-2 font-medium text-right">Anzahl Leads</th>
                <th className="pb-2 font-medium text-right">Anteil</th>
              </tr>
            </thead>
            <tbody>
              {leadSources.map(([source, count]) => (
                <tr key={source} className="border-b hover:bg-slate-50">
                  <td className="py-2 font-medium text-slate-700">{source}</td>
                  <td className="py-2 text-right font-semibold">{count}</td>
                  <td className="py-2 text-right text-slate-500">
                    {leads.length > 0 ? `${Math.round(count / leads.length * 100)}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Technical Note */}
      <Card className="bg-slate-50 border-slate-200">
        <CardContent className="pt-5 pb-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Implementierungsnotiz</p>
          <div className="text-xs text-slate-500 space-y-1">
            <p>• <strong>Lead-Zuordnung:</strong> Basiert auf <code>created_by</code> (E-Mail) — kein dediziertes Owner-Feld vorhanden.</p>
            <p>• <strong>Angebote zugewiesen:</strong> Kein explizites owner/assigned-Feld im Offer — nur <code>created_by</code> verwendet.</p>
            <p>• <strong>Email-Anfragen:</strong> Basiert auf <code>EmailMessageSandbox</code> Entity, <code>direction=inbound</code>, Datum aus <code>received_at</code>.</p>
            <p>• <strong>System-Automationen:</strong> Einträge mit <code>service+…@no-reply.base44.com</code> werden von echten Usern getrennt und als "⚙ System-Automation" ausgewiesen.</p>
            <p>• <strong>Alle Metriken:</strong> Read-only, keine Schreiboperationen, keine Seiteneffekte.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}