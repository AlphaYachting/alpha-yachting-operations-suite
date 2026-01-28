import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Phone, ArrowRight } from 'lucide-react';

export default function LeadsWidget() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLeads();
  }, []);

  const loadLeads = async () => {
    try {
      const pendingLeads = await base44.entities.Lead.filter(
        { status: 'Pending' },
        '-created_date',
        5
      );
      setLeads(pendingLeads);
    } catch (error) {
      console.error('Error loading leads:', error);
    } finally {
      setLoading(false);
    }
  };

  const priorityColors = {
    'Low': 'bg-slate-100 text-slate-700',
    'Medium': 'bg-blue-100 text-blue-700',
    'High': 'bg-amber-100 text-amber-700',
    'Urgent': 'bg-red-100 text-red-700'
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-blue-600" />
            Pending Leads
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-slate-500">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  if (leads.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-slate-400" />
            Pending Leads
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500">No pending leads at the moment</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-amber-200 bg-amber-50/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-600" />
            {leads.length} Pending Lead{leads.length !== 1 ? 's' : ''}
          </CardTitle>
          <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
            Action needed
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {leads.map((lead) => (
          <div key={lead.id} className="p-3 bg-white rounded-lg border border-amber-100 hover:border-amber-300 transition-colors">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-slate-900">{lead.name}</p>
                <p className="text-xs text-slate-500 truncate">{lead.phone}</p>
                {lead.boat_name && (
                  <p className="text-xs text-slate-600 mt-1">🚤 {lead.boat_name}</p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Badge className={priorityColors[lead.priority]}>
                  {lead.priority}
                </Badge>
              </div>
            </div>
          </div>
        ))}
        <Button asChild className="w-full mt-3" variant="outline">
          <Link to={createPageUrl('Leads')}>
            View all leads
            <ArrowRight className="h-4 w-4 ml-2" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}