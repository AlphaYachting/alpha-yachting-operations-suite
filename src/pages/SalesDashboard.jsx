import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { TrendingUp, Target, CheckCircle2, XCircle, Users, AlertCircle, ArrowRight, DollarSign } from 'lucide-react';
import { STAGES } from '@/components/salesPipeline/stageConfig';

export default function SalesDashboard() {
  const [leads, setLeads] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [offers, setOffers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      base44.entities.Lead.list('-created_date', 500),
      base44.entities.Opportunity.list('-created_date', 500),
      base44.entities.Offer.list('-created_date', 500),
    ]).then(([ls, ops, ofs]) => {
      setLeads(ls);
      setOpportunities(ops);
      setOffers(ofs);
      setIsLoading(false);
    });
  }, []);

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-r-transparent" />
    </div>
  );

  const wonOpps   = opportunities.filter(o => o.stage === 'Won');
  const lostOpps  = opportunities.filter(o => o.stage === 'Lost');
  const activeOpps = opportunities.filter(o => !['Won', 'Lost', 'Archived'].includes(o.stage));
  const sentOffers = offers.filter(o => o.status === 'Sent');
  const convertedLeads = leads.filter(l => l.status === 'Converted');

  const totalPipelineValue = activeOpps.reduce((s, o) => s + (o.expected_value || 0), 0);
  const weightedForecast   = activeOpps.reduce((s, o) => s + ((o.expected_value || 0) * (o.probability || 50) / 100), 0);
  const avgDealSize = wonOpps.length > 0
    ? wonOpps.reduce((s, o) => s + (o.expected_value || 0), 0) / wonOpps.length
    : 0;

  const leadToOppRate  = leads.length > 0 ? Math.round((convertedLeads.length / leads.length) * 100) : 0;
  const oppToOfferRate = opportunities.length > 0 ? Math.round((sentOffers.length / opportunities.length) * 100) : 0;
  const offerToWonRate = offers.length > 0 ? Math.round((wonOpps.length / offers.length) * 100) : 0;

  const stageChartData = STAGES
    .filter(s => !['Won', 'Lost', 'Archived'].includes(s.id))
    .map(s => ({
      name: s.id.length > 14 ? s.id.slice(0, 13) + '…' : s.id,
      count: opportunities.filter(o => o.stage === s.id).length,
      color: s.color,
    }))
    .filter(d => d.count > 0);

  const sourceData = ['Phone', 'Email', 'Website', 'Referral', 'Other'].map(src => ({
    name: src,
    total: opportunities.filter(o => o.source === src).length,
    won: opportunities.filter(o => o.source === src && o.stage === 'Won').length,
  })).filter(d => d.total > 0);

  const metrics = [
    { label: 'Active Leads',     value: leads.filter(l => ['Pending','Contacted'].includes(l.status)).length, Icon: Users,       color: 'text-blue-600',   bg: 'bg-blue-50' },
    { label: 'Opportunities',    value: opportunities.length,   Icon: Target,       color: 'text-violet-600', bg: 'bg-violet-50' },
    { label: 'Offers Sent',      value: sentOffers.length,      Icon: ArrowRight,   color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Deals Won',        value: wonOpps.length,         Icon: CheckCircle2, color: 'text-emerald-600',bg: 'bg-emerald-50' },
    { label: 'Deals Lost',       value: lostOpps.length,        Icon: XCircle,      color: 'text-red-600',    bg: 'bg-red-50' },
    { label: 'Follow-up Needed', value: opportunities.filter(o => o.follow_up_required).length, Icon: AlertCircle, color: 'text-orange-600', bg: 'bg-orange-50' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
          <TrendingUp className="h-7 w-7 text-blue-600" /> Sales Dashboard
        </h1>
        <p className="text-slate-500 text-sm mt-1">Pipeline performance overview</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {metrics.map(m => (
          <Card key={m.label} className="shadow-sm">
            <CardContent className="p-4">
              <div className={`w-9 h-9 ${m.bg} rounded-lg flex items-center justify-center mb-2`}>
                <m.Icon className={`h-5 w-5 ${m.color}`} />
              </div>
              <p className="text-2xl font-bold text-slate-900">{m.value}</p>
              <p className="text-xs text-slate-500 mt-0.5 leading-tight">{m.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pipeline Value */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Total Pipeline Value', value: `€${totalPipelineValue.toLocaleString()}`,        sub: 'All active opportunities' },
          { label: 'Weighted Forecast',    value: `€${Math.round(weightedForecast).toLocaleString()}`, sub: 'Adjusted by probability' },
          { label: 'Avg. Deal Size (Won)', value: avgDealSize > 0 ? `€${Math.round(avgDealSize).toLocaleString()}` : '—', sub: 'Based on won deals' },
        ].map(item => (
          <Card key={item.label} className="shadow-sm border-blue-100">
            <CardContent className="p-5">
              <p className="text-slate-500 text-sm">{item.label}</p>
              <p className="text-3xl font-bold text-slate-900 mt-1">{item.value}</p>
              <p className="text-xs text-slate-400 mt-1">{item.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Conversion Funnel */}
      <Card className="shadow-sm">
        <CardHeader><CardTitle className="text-base">Conversion Funnel</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center gap-6 flex-wrap">
            {[
              { label: 'Lead → Opportunity', rate: leadToOppRate, from: leads.length, to: convertedLeads.length },
              { label: 'Opportunity → Offer', rate: oppToOfferRate, from: opportunities.length, to: sentOffers.length },
              { label: 'Offer → Won', rate: offerToWonRate, from: offers.length, to: wonOpps.length },
            ].map((item, i) => (
              <React.Fragment key={i}>
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-700">{item.rate}%</p>
                  <p className="text-xs text-slate-500 mt-0.5">{item.label}</p>
                  <p className="text-xs text-slate-400">{item.to} / {item.from}</p>
                </div>
                {i < 2 && <ArrowRight className="h-5 w-5 text-slate-300 flex-shrink-0" />}
              </React.Fragment>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-sm">
          <CardHeader><CardTitle className="text-base">Active Pipeline by Stage</CardTitle></CardHeader>
          <CardContent>
            {stageChartData.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-10">No active opportunities</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={stageChartData} margin={{ top: 4, right: 4, left: -16, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-30} textAnchor="end" interval={0} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip formatter={(v) => [`${v} deals`]} />
                  <Bar dataKey="count" name="Deals" radius={[4, 4, 0, 0]}>
                    {stageChartData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader><CardTitle className="text-base">Source Performance</CardTitle></CardHeader>
          <CardContent>
            {sourceData.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-10">No data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={sourceData} layout="vertical" margin={{ top: 4, right: 4, left: 10, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={65} />
                  <Tooltip />
                  <Bar dataKey="total" name="Total" fill="#6366f1" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="won"   name="Won"   fill="#22c55e" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}