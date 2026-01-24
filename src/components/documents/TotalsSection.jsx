import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function TotalsSection({ lineItems, currency = 'EUR' }) {
  const subtotal = lineItems.reduce((sum, item) => sum + (item.total_net || 0), 0);
  const taxTotal = lineItems.reduce((sum, item) => sum + (item.total_tax || 0), 0);
  const total = lineItems.reduce((sum, item) => sum + (item.total_gross || 0), 0);

  // Group by tax rate
  const taxBreakdown = lineItems.reduce((acc, item) => {
    const rate = item.tax_rate || 0;
    if (!acc[rate]) acc[rate] = 0;
    acc[rate] += item.total_tax || 0;
    return acc;
  }, {});

  const currencySymbol = currency === 'EUR' ? '€' : currency === 'USD' ? '$' : '£';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Totals</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">Subtotal (Net):</span>
            <span className="font-semibold">{currencySymbol}{subtotal.toFixed(2)}</span>
          </div>

          {Object.entries(taxBreakdown).map(([rate, amount]) => (
            <div key={rate} className="flex justify-between text-sm">
              <span className="text-slate-600">Tax ({rate}%):</span>
              <span className="font-semibold">{currencySymbol}{amount.toFixed(2)}</span>
            </div>
          ))}

          <div className="border-t pt-3 flex justify-between text-lg font-bold">
            <span>Total:</span>
            <span className="text-blue-600">{currencySymbol}{total.toFixed(2)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}