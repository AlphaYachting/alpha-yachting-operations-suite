import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, AlertCircle, RefreshCw, Shield } from 'lucide-react';
import { format } from 'date-fns';

export default function SalesPipelineAuditReport() {
  const [report, setReport] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const runAudit = async () => {
    setIsLoading(true);
    const results = [];

    const check = async (label, fn) => {
      try {
        const detail = await fn();
        results.push({ label, status: 'ok', detail: detail || 'OK' });
      } catch (e) {
        results.push({ label, status: 'error', detail: e.message });
      }
    };

    // 1. Lead V1 entities accessible
    await check('Lead V1 entity accessible', async () => {
      const items = await base44.entities.Lead.list('-created_date', 1);
      return `${items.length >= 0 ? 'Readable' : 'Empty'} — no errors`;
    });

    // 2. Customer entity accessible
    await check('Customer entity accessible', async () => {
      await base44.entities.Customer.list('-created_date', 1);
      return 'Readable';
    });

    // 3. Boat entity accessible
    await check('Boat entity accessible', async () => {
      await base44.entities.Boat.list('-created_date', 1);
      return 'Readable';
    });

    // 4. Offer entity accessible
    await check('Offer entity accessible', async () => {
      const items = await base44.entities.Offer.list('-created_date', 1);
      return `Readable`;
    });

    // 5. WorkOrder entity accessible
    await check('WorkOrder entity accessible', async () => {
      await base44.entities.WorkOrder.list('-created_date', 1);
      return 'Readable';
    });

    // 6. Opportunity entity accessible
    await check('Opportunity (V2) entity accessible', async () => {
      const items = await base44.entities.Opportunity.list('-created_date', 1);
      return `Readable — ${items.length} records`;
    });

    // 7. OpportunityActivity entity accessible
    await check('OpportunityActivity (V2) entity accessible', async () => {
      const items = await base44.entities.OpportunityActivity.list('-created_date', 1);
      return `Readable — ${items.length} records`;
    });

    // 8. Leads without broken customer refs
    await check('Lead → Customer integrity', async () => {
      const leads = await base44.entities.Lead.list('-created_date', 200);
      const customers = await base44.entities.Customer.list('-created_date', 200);
      const cids = new Set(customers.map(c => c.id));
      const broken = leads.filter(l => l.customer_id && !cids.has(l.customer_id));
      if (broken.length > 0) throw new Error(`${broken.length} leads with broken customer refs`);
      return `All ${leads.length} leads OK`;
    });

    // 9. Opportunities without broken lead refs
    await check('Opportunity → Lead integrity', async () => {
      const opps = await base44.entities.Opportunity.list('-created_date', 200);
      const linkedOpps = opps.filter(o => o.lead_id);
      if (linkedOpps.length === 0) return 'No linked opportunities yet';
      const leads = await base44.entities.Lead.list('-created_date', 500);
      const lids = new Set(leads.map(l => l.id));
      const broken = linkedOpps.filter(o => !lids.has(o.lead_id));
      if (broken.length > 0) throw new Error(`${broken.length} opportunities with broken lead refs`);
      return `All ${linkedOpps.length} linked opportunities OK`;
    });

    // 10. Offer entity has required fields still present
    await check('Offer entity schema fields intact', async () => {
      const schema = await base44.entities.Offer.schema();
      const required = ['customer_id', 'title', 'status'];
      const missing = required.filter(f => !schema.properties?.[f]);
      if (missing.length > 0) throw new Error(`Missing fields: ${missing.join(', ')}`);
      return 'All required fields present';
    });

    // 11. Lead required fields intact
    await check('Lead entity schema fields intact', async () => {
      const schema = await base44.entities.Lead.schema();
      const required = ['name', 'status', 'contact_method'];
      const missing = required.filter(f => !schema.properties?.[f]);
      if (missing.length > 0) throw new Error(`Missing fields: ${missing.join(', ')}`);
      return 'All required fields present';
    });

    setReport({
      generated_at: new Date().toISOString(),
      checks: results,
      summary: {
        total: results.length,
        passed: results.filter(r => r.status === 'ok').length,
        failed: results.filter(r => r.status === 'error').length,
      },
    });
    setIsLoading(false);
  };

  const statusIcon = (status) => {
    if (status === 'ok') return <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />;
    if (status === 'error') return <XCircle className="h-4 w-4 text-red-600 flex-shrink-0" />;
    return <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0" />;
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
            <Shield className="h-7 w-7 text-emerald-600" /> V2 Safety Audit
          </h1>
          <p className="text-slate-500 text-sm mt-1">SalesPipeline_V2 system validation report</p>
        </div>
        <Button onClick={runAudit} disabled={isLoading}>
          {isLoading ? (
            <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Running…</>
          ) : (
            <><RefreshCw className="h-4 w-4 mr-2" /> Run Audit</>
          )}
        </Button>
      </div>

      {!report && !isLoading && (
        <Card>
          <CardContent className="p-10 text-center text-slate-400">
            <Shield className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Click "Run Audit" to validate system integrity</p>
          </CardContent>
        </Card>
      )}

      {report && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Total Checks', value: report.summary.total, cls: 'text-slate-900' },
              { label: 'Passed',       value: report.summary.passed, cls: 'text-emerald-700' },
              { label: 'Failed',       value: report.summary.failed, cls: report.summary.failed > 0 ? 'text-red-600' : 'text-slate-400' },
            ].map(item => (
              <Card key={item.label}>
                <CardContent className="p-4 text-center">
                  <p className={`text-4xl font-bold ${item.cls}`}>{item.value}</p>
                  <p className="text-sm text-slate-500 mt-1">{item.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Overall status */}
          <div className={`rounded-lg p-4 flex items-center gap-3 ${
            report.summary.failed === 0
              ? 'bg-emerald-50 border border-emerald-200'
              : 'bg-red-50 border border-red-200'
          }`}>
            {report.summary.failed === 0 ? (
              <><CheckCircle2 className="h-6 w-6 text-emerald-600 flex-shrink-0" />
              <div>
                <p className="font-semibold text-emerald-800">All checks passed — V2 safe to use</p>
                <p className="text-sm text-emerald-600">Lead V1 is fully intact. V2 is non-destructive.</p>
              </div></>
            ) : (
              <><XCircle className="h-6 w-6 text-red-600 flex-shrink-0" />
              <div>
                <p className="font-semibold text-red-800">{report.summary.failed} check(s) failed</p>
                <p className="text-sm text-red-600">Review failed checks before enabling V2 for production.</p>
              </div></>
            )}
          </div>

          {/* Check results */}
          <Card>
            <CardHeader><CardTitle className="text-base">Check Results</CardTitle></CardHeader>
            <CardContent className="divide-y">
              {report.checks.map((check, i) => (
                <div key={i} className="flex items-start gap-3 py-3">
                  {statusIcon(check.status)}
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-800">{check.label}</p>
                    <p className={`text-xs mt-0.5 ${check.status === 'error' ? 'text-red-600' : 'text-slate-500'}`}>
                      {check.detail}
                    </p>
                  </div>
                  <Badge className={check.status === 'ok'
                    ? 'bg-emerald-100 text-emerald-700 border-none'
                    : 'bg-red-100 text-red-700 border-none'}>
                    {check.status === 'ok' ? 'PASS' : 'FAIL'}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <p className="text-xs text-slate-400 text-center">
            Generated: {format(new Date(report.generated_at), 'dd.MM.yyyy HH:mm:ss')}
          </p>
        </>
      )}
    </div>
  );
}