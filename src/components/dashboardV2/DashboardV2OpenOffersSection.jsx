/**
 * DASHBOARD V2 — OPEN OFFERS SECTION (isolated)
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { FileText, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default function DashboardV2OpenOffersSection({ offers, getCustomerName, getAge }) {
  const openOffers = offers.filter(o => !['Approved', 'Rejected', 'Expired', 'Converted'].includes(o.status));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-cyan-600" />
          Open Offers ({openOffers.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {openOffers.length === 0 ? (
          <p className="text-sm text-slate-500">No open offers</p>
        ) : (
          <div className="space-y-2">
            {openOffers.slice(0, 5).map(offer => (
              <Link
                key={offer.id}
                to={createPageUrl('OfferDetail') + `?id=${offer.id}`}
                className="block p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-slate-900">{offer.title}</p>
                    <p className="text-sm text-slate-600 mt-1">{getCustomerName(offer.customer_id)}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="bg-cyan-50 text-cyan-700 border-cyan-200">
                        {offer.status}
                      </Badge>
                      <span className="text-xs text-slate-500">{getAge(offer.created_date)} old</span>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-slate-400" />
                </div>
              </Link>
            ))}
            {openOffers.length > 5 && (
              <Button variant="outline" size="sm" asChild className="w-full mt-2">
                <Link to={createPageUrl('Offers')}>View All ({openOffers.length})</Link>
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}