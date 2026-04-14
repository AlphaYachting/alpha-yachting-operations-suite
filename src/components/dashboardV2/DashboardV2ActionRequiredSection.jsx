/**
 * DASHBOARD V2 — ACTION REQUIRED SECTION (isolated)
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { AlertTriangle, Calendar, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format, parseISO, differenceInDays } from 'date-fns';

export default function DashboardV2ActionRequiredSection({
  overdueWorkOrders,
  unplannedWorkOrders,
  openOffers,
  staleLeads,
  getJobInfo,
  getCustomerName,
  getAge,
}) {
  const hasItems =
    overdueWorkOrders.length > 0 ||
    unplannedWorkOrders.length > 0 ||
    openOffers.length > 0 ||
    staleLeads.length > 0;

  if (!hasItems) return null;

  return (
    <Card className="border-red-200 bg-red-50/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-red-900">
          <AlertTriangle className="h-5 w-5" />
          Action Required
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {overdueWorkOrders.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-red-900">
                Overdue Work Orders ({overdueWorkOrders.length})
              </h3>
              <Button variant="outline" size="sm" asChild>
                <Link to={createPageUrl('WorkOrders') + '?filter=overdue'}>View All</Link>
              </Button>
            </div>
            <div className="space-y-2">
              {overdueWorkOrders.slice(0, 3).map(wo => {
                const jobInfo = getJobInfo(wo.job_id);
                return (
                  <Link
                    key={wo.id}
                    to={createPageUrl('WorkOrderDetail') + `?id=${wo.id}`}
                    className="block p-3 bg-white rounded-lg border border-red-200 hover:border-red-300 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-slate-900">{wo.title}</p>
                        <p className="text-sm text-slate-600 mt-1">
                          {jobInfo?.boat} • {jobInfo?.customer}
                        </p>
                        <div className="flex items-center gap-2 mt-2 text-xs text-red-700">
                          <Calendar className="h-3 w-3" />
                          Due: {format(parseISO(wo.scheduled_date), 'MMM d, yyyy')}
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-slate-400" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {unplannedWorkOrders.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-red-900">
                Unplanned Work Orders ({unplannedWorkOrders.length})
              </h3>
              <Button variant="outline" size="sm" asChild>
                <Link to={createPageUrl('WorkOrders') + '?filter=pending'}>View All</Link>
              </Button>
            </div>
            <div className="space-y-2">
              {unplannedWorkOrders.slice(0, 3).map(wo => {
                const jobInfo = getJobInfo(wo.job_id);
                return (
                  <Link
                    key={wo.id}
                    to={createPageUrl('WorkOrderDetail') + `?id=${wo.id}`}
                    className="block p-3 bg-white rounded-lg border border-amber-200 hover:border-amber-300 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-slate-900">{wo.title}</p>
                        <p className="text-sm text-slate-600 mt-1">
                          {jobInfo?.boat} • {jobInfo?.customer}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          {!wo.scheduled_date && (
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                              No date
                            </Badge>
                          )}
                          {(!wo.assigned_technicians || wo.assigned_technicians.length === 0) && (
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                              No technician
                            </Badge>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-slate-400" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {openOffers.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-red-900">Open Offers ({openOffers.length})</h3>
              <Button variant="outline" size="sm" asChild>
                <Link to={createPageUrl('Offers')}>View All</Link>
              </Button>
            </div>
            <div className="space-y-2">
              {openOffers.slice(0, 3).map(offer => (
                <Link
                  key={offer.id}
                  to={createPageUrl('OfferDetail') + `?id=${offer.id}`}
                  className="block p-3 bg-white rounded-lg border border-blue-200 hover:border-blue-300 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-slate-900">{offer.title}</p>
                      <p className="text-sm text-slate-600 mt-1">{getCustomerName(offer.customer_id)}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                          {offer.status}
                        </Badge>
                        <span className="text-xs text-slate-500">{getAge(offer.created_date)} old</span>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-slate-400" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {staleLeads.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-red-900">Stale Leads ({staleLeads.length})</h3>
              <Button variant="outline" size="sm" asChild>
                <Link to={createPageUrl('LeadsV2')}>View All</Link>
              </Button>
            </div>
            <div className="space-y-2">
              {staleLeads.slice(0, 3).map(lead => (
                <Link
                  key={lead.id}
                  to={createPageUrl('LeadDetail') + `?id=${lead.id}`}
                  className="block p-3 bg-white rounded-lg border border-orange-200 hover:border-orange-300 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-slate-900">{lead.name}</p>
                      <p className="text-sm text-slate-600 mt-1">{lead.boat_name || 'No boat specified'}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                          {lead.status}
                        </Badge>
                        <span className="text-xs text-slate-500">
                          No contact for {lead.last_contacted_at ? getAge(lead.last_contacted_at) : 'unknown time'}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-slate-400" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}