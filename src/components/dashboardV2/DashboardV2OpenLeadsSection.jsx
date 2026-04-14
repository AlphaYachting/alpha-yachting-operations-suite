/**
 * DASHBOARD V2 — OPEN LEADS SECTION (isolated)
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Phone, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default function DashboardV2OpenLeadsSection({ leads, getAge }) {
  const openLeads = leads.filter(l => !['Converted', 'Rejected', 'Lost'].includes(l.status));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="h-5 w-5 text-purple-600" />
          Open Leads ({openLeads.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {openLeads.length === 0 ? (
          <p className="text-sm text-slate-500">No open leads</p>
        ) : (
          <div className="space-y-2">
            {openLeads.slice(0, 5).map(lead => (
              <Link
                key={lead.id}
                to={createPageUrl('LeadDetail') + `?id=${lead.id}`}
                className="block p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-slate-900">{lead.name}</p>
                    <p className="text-sm text-slate-600 mt-1">{lead.boat_name || 'No boat specified'}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                        {lead.status}
                      </Badge>
                      <span className="text-xs text-slate-500">{getAge(lead.created_date)} old</span>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-slate-400" />
                </div>
              </Link>
            ))}
            {openLeads.length > 5 && (
              <Button variant="outline" size="sm" asChild className="w-full mt-2">
                <Link to={createPageUrl('LeadsV2')}>View All ({openLeads.length})</Link>
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}