/**
 * DASHBOARD V2 — KPI SECTION (isolated)
 * Displays 5 KPI cards: Active Projects, Open Work Orders, Open Offers, Active Leads, Capacity Today.
 * Receives kpis object and onCapacityClick callback from parent.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Briefcase, Clock, FileText, Phone, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export default function DashboardV2KPISection({ kpis, onCapacityClick }) {
  if (!kpis) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      <Link to={createPageUrl('Jobs')} className="block">
        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">Active Projects</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{kpis.active_projects}</p>
              </div>
              <Briefcase className="h-8 w-8 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </Link>

      <Link to={createPageUrl('WorkOrders')} className="block">
        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">Open Work Orders</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{kpis.open_work_orders}</p>
              </div>
              <Clock className="h-8 w-8 text-indigo-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </Link>

      <Link to={createPageUrl('Offers')} className="block">
        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">Open Offers</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{kpis.open_offers}</p>
              </div>
              <FileText className="h-8 w-8 text-cyan-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </Link>

      <Link to={createPageUrl('LeadsV2')} className="block">
        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">Active Leads</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{kpis.active_leads}</p>
              </div>
              <Phone className="h-8 w-8 text-purple-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </Link>

      <div onClick={onCapacityClick} className="cursor-pointer">
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">Capacity Today</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{kpis.capacity_today}%</p>
              </div>
              <Users className="h-8 w-8 text-emerald-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}