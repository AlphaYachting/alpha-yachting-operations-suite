import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Loader2, Upload, CheckCircle2, AlertCircle, RefreshCw, Languages } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function FiraExportButton({ offer, tasks, customer, userRole, onExported, onTasksTranslated }) {
  const [exporting, setExporting] = useState(false);
  const [translatingAll, setTranslatingAll] = useState(false);
  const [translateProgress, setTranslateProgress] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [translatedCount, setTranslatedCount] = useState(null);

  const hasLineItems = tasks && tasks.filter(t => !t.is_optional).length > 0;
  const hasCustomer = !!customer;
  const status = offer?.fira_export_status;
  const alreadyExported = status === 'exported';
  const exportFailed = status === 'failed';
  const currentlyExporting = status === 'exporting' || exporting;
  const isAdmin = userRole === 'admin';

  // Don't render if offer not saved, no line items, or no customer
  if (!offer?.id || !hasLineItems || !hasCustomer) return null;

  // Tasks that still need Croatian translation
  const untranslatedTasks = (tasks || []).filter(t => !t.is_optional && t.item_type !== 'Chapter' && !(t.title_hr && t.title_hr.trim()));

  const handleBulkTranslate = async () => {
    if (translatingAll || !offer?.id) return;
    setTranslatingAll(true);
    try {
      // Backend fetches tasks directly from DB — immune to frontend state/auto-save race conditions
      const res = await base44.functions.invoke('bulkTranslateOfferTasks', { offer_id: offer.id });
      const data = res.data;
      if (data?.translated === 0) {
        toast.info(data.message || 'Alle Positionen sind bereits übersetzt');
      } else {
        toast.success(`${data.translated} von ${data.total} Positionen übersetzt`);
        if (onTasksTranslated) onTasksTranslated();
      }
    } catch (e) {
      toast.error('Übersetzung fehlgeschlagen: ' + e.message);
    } finally {
      setTranslatingAll(false);
    }
  };

  const handleExport = async (forceReexport = false) => {
    if (exporting || currentlyExporting) return;
    setExporting(true);
    setLastResult(null);
    try {
      const res = await base44.functions.invoke('firaExportOffer', {
        offer_id: offer.id,
        force_reexport: forceReexport,
      });
      const data = res.data;
      setLastResult(data);

      if (data?.success) {
        toast.success('Offer exported to FIRA as PONUDA');
        if (onExported) onExported();
      } else if (data?.already_exported) {
        toast.info('Already exported to FIRA. Admins can use Re-export.');
        setShowDetails(true);
      } else if (data?.validation_errors?.length > 0) {
        toast.error(`Validation: ${data.validation_errors[0]}`);
        if (onExported) onExported();
      } else {
        toast.error(data?.error || 'Export to FIRA failed');
        if (onExported) onExported();
      }
    } catch (err) {
      toast.error('Export request failed');
      setLastResult({ success: false, error: err.message });
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-1.5">
        {/* Bulk translate button — only show when there are untranslated tasks */}
        {untranslatedTasks.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleBulkTranslate}
            disabled={translatingAll || exporting}
            className="border-blue-300 text-blue-600 hover:bg-blue-50 h-8 px-2 text-xs"
            title="Alle Positionen ins Kroatische übersetzen (für FIRA Export)"
          >
            {translatingAll ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                Übersetze...
              </>
            ) : (
              <>
                <Languages className="h-3 w-3 mr-1" />
                🇭🇷 {untranslatedTasks.length} übersetzen
              </>
            )}
          </Button>
        )}
        {alreadyExported ? (
          <>
            <button
              onClick={() => setShowDetails(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-emerald-300 bg-emerald-50 text-emerald-700 text-sm font-medium hover:bg-emerald-100 transition-colors"
            >
              <CheckCircle2 className="h-4 w-4" />
              FIRA: Exported
              {offer.fira_exported_at && (
                <span className="text-xs opacity-70 ml-1">
                  {format(new Date(offer.fira_exported_at), 'dd.MM.yy')}
                </span>
              )}
            </button>
            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport(true)}
                disabled={exporting}
                className="border-orange-400 text-orange-600 hover:bg-orange-50 h-8 px-2 text-xs"
              >
                {exporting ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                <span className="ml-1">Re-export</span>
              </Button>
            )}
          </>
        ) : exportFailed ? (
          <>
            <button
              onClick={() => setShowDetails(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-red-300 bg-red-50 text-red-700 text-sm font-medium hover:bg-red-100 transition-colors"
            >
              <AlertCircle className="h-4 w-4" />
              FIRA: Failed
            </button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport(false)}
              disabled={exporting}
              className="border-red-400 text-red-600 hover:bg-red-50"
            >
              {exporting ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              <span className="ml-1">Retry</span>
            </Button>
          </>
        ) : (
          <Button
            variant="outline"
            onClick={() => handleExport(false)}
            disabled={currentlyExporting}
            className="border-emerald-500 text-emerald-700 hover:bg-emerald-50"
          >
            {currentlyExporting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            {currentlyExporting ? 'Exporting...' : 'Export to FIRA'}
          </Button>
        )}
      </div>

      {/* FIRA Export Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>FIRA Export Details</DialogTitle>
            <DialogDescription>
              Export audit log for offer {offer.offer_number}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Status</span>
              <Badge className={
                alreadyExported ? 'bg-emerald-100 text-emerald-700' :
                exportFailed ? 'bg-red-100 text-red-700' :
                'bg-slate-100 text-slate-700'
              }>
                {offer.fira_export_status || 'not_exported'}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Invoice Type</span>
              <span className="font-mono font-semibold">{offer.fira_invoice_type || 'PONUDA'}</span>
            </div>
            {offer.fira_exported_at && (
              <div className="flex justify-between">
                <span className="text-slate-500">Exported At</span>
                <span>{format(new Date(offer.fira_exported_at), 'dd.MM.yyyy HH:mm')}</span>
              </div>
            )}
            {offer.fira_exported_by && (
              <div className="flex justify-between">
                <span className="text-slate-500">Exported By</span>
                <span className="truncate max-w-[200px]">{offer.fira_exported_by}</span>
              </div>
            )}
            {offer.fira_webshop_order_id && (
              <div className="flex justify-between">
                <span className="text-slate-500">FIRA Order ID</span>
                <span className="font-mono">{offer.fira_webshop_order_id}</span>
              </div>
            )}
            {offer.fira_external_reference && (
              <div className="flex justify-between">
                <span className="text-slate-500">FIRA Reference</span>
                <span className="font-mono">{offer.fira_external_reference}</span>
              </div>
            )}
            {(offer.fira_export_attempt_count > 0) && (
              <div className="flex justify-between">
                <span className="text-slate-500">Attempts</span>
                <span>{offer.fira_export_attempt_count}</span>
              </div>
            )}
            {offer.fira_last_attempt_at && (
              <div className="flex justify-between">
                <span className="text-slate-500">Last Attempt</span>
                <span>{format(new Date(offer.fira_last_attempt_at), 'dd.MM.yyyy HH:mm')}</span>
              </div>
            )}
            {offer.fira_last_error_message && (
              <Alert variant="destructive" className="mt-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">{offer.fira_last_error_message}</AlertDescription>
              </Alert>
            )}
            {lastResult && !lastResult.success && lastResult.error && !offer.fira_last_error_message && (
              <Alert variant="destructive" className="mt-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">Last attempt: {lastResult.error}</AlertDescription>
              </Alert>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}