import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, Loader2, TrendingUp } from 'lucide-react';

export default function ConvertLeadModal({ lead, onClose, onConverted }) {
  const [status, setStatus] = useState('idle'); // idle | loading | success | error | already_exists
  const [opportunityId, setOpportunityId] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const handleConvert = async () => {
    setStatus('loading');
    const res = await base44.functions.invoke('convertLeadToOpportunity', { lead_id: lead.id });
    const data = res.data;
    if (data.error && data.opportunity_id) {
      setOpportunityId(data.opportunity_id);
      setStatus('already_exists');
    } else if (data.success) {
      setOpportunityId(data.opportunity_id);
      setStatus('success');
      onConverted?.();
    } else {
      setErrorMsg(data.error || 'Unknown error');
      setStatus('error');
    }
  };

  return (
    <Dialog open={!!lead} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-violet-600" />
            Convert Lead to Opportunity
          </DialogTitle>
        </DialogHeader>

        {status === 'idle' && (
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-700 space-y-1">
              <p><span className="text-slate-500">Lead:</span> <strong>{lead.name}</strong></p>
              {lead.email && <p><span className="text-slate-500">Email:</span> {lead.email}</p>}
              {lead.inquiry_type && <p><span className="text-slate-500">Type:</span> {lead.inquiry_type}</p>}
            </div>
            <p className="text-sm text-slate-600">
              This will create a new <strong>Opportunity</strong> linked to this lead and set the lead status to <Badge className="bg-emerald-100 text-emerald-700 border-none text-xs">Converted</Badge>.
            </p>
            <div className="flex gap-2 justify-end pt-1">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button className="bg-violet-600 hover:bg-violet-700" onClick={handleConvert}>
                Convert
              </Button>
            </div>
          </div>
        )}

        {status === 'loading' && (
          <div className="flex items-center justify-center py-8 gap-3 text-slate-600">
            <Loader2 className="h-5 w-5 animate-spin" />
            Converting…
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-emerald-700 bg-emerald-50 rounded-lg p-3">
              <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
              <p className="text-sm font-medium">Opportunity created successfully!</p>
            </div>
            <Button className="w-full" onClick={onClose}>Close</Button>
          </div>
        )}

        {status === 'already_exists' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-amber-700 bg-amber-50 rounded-lg p-3">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <p className="text-sm">This lead was already converted to an opportunity.</p>
            </div>
            <Button className="w-full" variant="outline" onClick={onClose}>Close</Button>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-red-700 bg-red-50 rounded-lg p-3">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <p className="text-sm">{errorMsg}</p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={onClose}>Close</Button>
              <Button onClick={() => setStatus('idle')}>Try Again</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}