import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Zap, CheckCircle2, XCircle, Clock, User, MapPin, Ship, ArrowRight, ExternalLink, Pencil, Save, X, Wrench, Receipt, Loader2 } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import QuickCaptureModal from '@/components/quickcapture/QuickCaptureModal';
import ConversionDialog from '@/components/quickcapture/ConversionDialog.jsx';
import InvoiceScanModal from '@/components/quickcapture/InvoiceScanModal';

const TYPE_CONFIG = {
  material_entry:   { label: 'Material / Parts',   color: 'bg-amber-100 text-amber-800',   border: 'border-amber-200' },
  tool_tracking:    { label: 'Tool / Equipment',   color: 'bg-blue-100 text-blue-800',     border: 'border-blue-200' },
  task_candidate:   { label: 'Task Candidate',     color: 'bg-orange-100 text-orange-800', border: 'border-orange-200' },
  customer_request: { label: 'Customer Request',   color: 'bg-purple-100 text-purple-800', border: 'border-purple-200' },
  project_intake:   { label: 'Project Intake',     color: 'bg-green-100 text-green-800',   border: 'border-green-200' },
  internal_note:    { label: 'Internal Note',      color: 'bg-slate-100 text-slate-700',   border: 'border-slate-200' },
};

const STATUS_CONFIG = {
  new:      { label: 'New',      color: 'bg-red-100 text-red-700' },
  reviewed: { label: 'Reviewed', color: 'bg-blue-100 text-blue-700' },
  routed:   { label: 'Routed',   color: 'bg-green-100 text-green-700' },
  dismissed:{ label: 'Dismissed',color: 'bg-slate-100 text-slate-500' },
};

// Map routed_record_type to a navigable page
function getRoutedLink(recordType, recordId) {
  if (!recordType || !recordId) return null;
  const map = {
    Lead:       'LeadDetail',
    Offer:      'OfferDetail',
    WorkOrder:  'WorkOrderDetail',
    CustomerMaterialEntry: null,
    Note:       null,
    Task:       null, // no standalone Task detail page — label only
  };
  const page = map[recordType];
  if (!page) return null;
  return createPageUrl(page) + `?id=${recordId}`;
}

const CONVERSION_LABEL = {
  CustomerMaterialEntry: 'Material Entry',
  Lead:  'Lead',
  Note:  'Customer Note',
  Offer: 'Offer Draft',
  Task:  'Task',
};

export default function QuickCaptureReview() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [boats, setBoats] = useState([]);
  const [workOrders, setWorkOrders] = useState({}); // id → WO object
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('new');
  const [showCaptureModal, setShowCaptureModal] = useState(false);
  const [showInvoiceScanModal, setShowInvoiceScanModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [convertingEntry, setConvertingEntry] = useState(null);
  const [forcedTarget, setForcedTarget] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [importingEntryId, setImportingEntryId] = useState(null);

  const startEdit = (entry) => { setEditingId(entry.id); setEditText(entry.raw_input); };
  const cancelEdit = () => { setEditingId(null); setEditText(''); };
  const saveEdit = async (entry) => {
    if (!editText.trim()) return;
    await base44.entities.QuickCaptureEntry.update(entry.id, { raw_input: editText.trim() });
    setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, raw_input: editText.trim() } : e));
    setEditingId(null);
    toast.success('Text updated');
  };

  const openConvert = (entry, target = null) => {
    setConvertingEntry(entry);
    setForcedTarget(target);
  };

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [entriesData, customersData, boatsData] = await Promise.all([
      base44.entities.QuickCaptureEntry.list('-created_date', 200),
      base44.entities.Customer.list('-created_date', 1000),
      base44.entities.Boat.list('-created_date', 1000),
    ]);
    setEntries(entriesData);
    setCustomers(customersData);
    setBoats(boatsData);

    // Fetch Work Orders for any entries that have a work_order_id (deduplicated)
    const woIds = [...new Set(entriesData.map(e => e.work_order_id).filter(Boolean))];
    if (woIds.length > 0) {
      base44.entities.WorkOrder.filter({ id: { $in: woIds } })
        .then(wos => {
          const map = {};
          (wos || []).forEach(wo => { map[wo.id] = wo; });
          setWorkOrders(map);
        })
        .catch(() => {}); // non-blocking, safe fallback
    }

    setLoading(false);
  };

  const getCustomerName = (id) => {
    const c = customers.find(x => x.id === id);
    return c ? (c.company_name || `${c.first_name || ''} ${c.last_name || ''}`.trim()) : null;
  };

  const getBoatName = (id) => {
    const b = boats.find(x => x.id === id);
    return b?.vessel_name || null;
  };

  const updateStatus = async (entry, status) => {
    setActionLoading(entry.id + status);
    try {
      const user = await base44.auth.me();
      const updates = {
        review_status: status,
        reviewed_by: user?.email,
        reviewed_at: new Date().toISOString(),
      };
      await base44.entities.QuickCaptureEntry.update(entry.id, updates);
      setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, ...updates } : e));
      toast.success(`Entry marked as ${status}`);
    } catch {
      toast.error('Failed to update status');
    } finally {
      setActionLoading(null);
    }
  };

  const handleConversionSuccess = ({ recordType, recordId }) => {
    // DB write already happened inside ConversionDialog.writeTraceability()
    // Update local state to reflect the routed status immediately
    setEntries(prev => prev.map(e =>
      e.id === convertingEntry.id
        ? { ...e, review_status: 'routed', routed_record_type: recordType, routed_record_id: recordId, routed_at: new Date().toISOString() }
        : e
    ));
    setConvertingEntry(null);
    setForcedTarget(null);
  };

  // Convert a receipt entry → ImportDocument + Lines via KI, then navigate
  const handleSendToMaterialImport = async (entry) => {
    const photoUrl = entry.photo_urls?.[0];
    if (!photoUrl) { toast.error('Kein Foto vorhanden'); return; }
    setImportingEntryId(entry.id);
    try {
      // KI-Extraktion: Header + Lines aus dem Foto
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a document parser. Extract structured data from this supplier invoice or delivery note.
Return a JSON object with these exact fields:
{
  "document_type": "Invoice" or "Delivery Note" or "Other",
  "supplier_name": "string or null",
  "document_number": "string or null",
  "document_date": "YYYY-MM-DD or null",
  "lines": [{ "item_title": "string", "item_description": "string or null", "quantity": number or null, "unit": "string or null", "unit_purchase_price": number or null, "total_purchase_price": number or null, "sku": "string or null" }]
}
Leave fields null if not clearly visible. Do not invent or guess values. Extract all line items in their original order.`,
        file_urls: [photoUrl],
        model: 'gemini_3_flash',
        response_json_schema: {
          type: 'object',
          properties: {
            document_type: { type: 'string' },
            supplier_name: { type: 'string' },
            document_number: { type: 'string' },
            document_date: { type: 'string' },
            lines: { type: 'array', items: { type: 'object', properties: { item_title: { type: 'string' }, item_description: { type: 'string' }, quantity: { type: 'number' }, unit: { type: 'string' }, unit_purchase_price: { type: 'number' }, total_purchase_price: { type: 'number' }, sku: { type: 'string' } } } }
          }
        }
      });

      // ImportDocument anlegen
      const doc = await base44.entities.ImportDocument.create({
        document_type: result.document_type || 'Invoice',
        supplier_name: result.supplier_name || '',
        document_number: result.document_number || '',
        document_date: result.document_date || '',
        original_file_url: photoUrl,
        extraction_status: 'needs_review',
      });

      // Lines speichern
      if (result.lines?.length > 0) {
        await Promise.all(result.lines.map((l, i) =>
          base44.entities.ImportDocumentLine.create({
            import_document_id: doc.id,
            line_order: i,
            item_title: l.item_title || '',
            item_description: l.item_description || '',
            quantity: l.quantity ?? null,
            unit: l.unit || '',
            unit_purchase_price: l.unit_purchase_price ?? null,
            total_purchase_price: l.total_purchase_price ?? null,
            sku: l.sku || '',
            is_manually_edited: false,
          })
        ));
      }

      // QuickCaptureEntry als "routed" markieren
      const user = await base44.auth.me();
      await base44.entities.QuickCaptureEntry.update(entry.id, {
        review_status: 'routed',
        routed_record_type: 'ImportDocument',
        routed_record_id: doc.id,
        routed_at: new Date().toISOString(),
        routed_by: user?.email || '',
      });
      setEntries(prev => prev.map(e => e.id === entry.id
        ? { ...e, review_status: 'routed', routed_record_type: 'ImportDocument', routed_record_id: doc.id, routed_at: new Date().toISOString() }
        : e
      ));

      toast.success('Rechnung extrahiert — wird jetzt in Materialimport geöffnet');
      navigate(`/MaterialImportDetail?id=${doc.id}`);
    } catch (err) {
      toast.error('Fehler: ' + err.message);
    } finally {
      setImportingEntryId(null);
    }
  };

  const filteredEntries = filterStatus === 'all'
    ? entries
    : entries.filter(e => e.review_status === filterStatus);

  const counts = {
    new: entries.filter(e => e.review_status === 'new').length,
    reviewed: entries.filter(e => e.review_status === 'reviewed').length,
    routed: entries.filter(e => e.review_status === 'routed').length,
    dismissed: entries.filter(e => e.review_status === 'dismissed').length,
    all: entries.length,
  };

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        <div className="h-8 bg-slate-100 animate-pulse rounded w-48" />
        {[1,2,3].map(i => <div key={i} className="h-32 bg-slate-100 animate-pulse rounded" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Zap className="h-6 w-6 text-amber-500" />
            Quick Capture Review
          </h1>
          <p className="text-slate-500 mt-1">Review and route field captures before they become operational records</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowInvoiceScanModal(true)} variant="outline" className="border-emerald-500 text-emerald-700 hover:bg-emerald-50">
            <Receipt className="h-4 w-4 mr-1" />
            Rechnung scannen
          </Button>
          <Button onClick={() => setShowCaptureModal(true)} className="bg-amber-500 hover:bg-amber-600 text-white">
            <Zap className="h-4 w-4 mr-1" />
            New Capture
          </Button>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {[
          { key: 'new', label: 'Needs Review' },
          { key: 'reviewed', label: 'Reviewed' },
          { key: 'routed', label: 'Routed' },
          { key: 'dismissed', label: 'Dismissed' },
          { key: 'all', label: 'All' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilterStatus(key)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filterStatus === key
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {label}
            {counts[key] > 0 && (
              <span className="ml-1.5 bg-white/20 text-inherit rounded-full px-1.5 py-0.5 text-xs">
                {counts[key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Entries list */}
      {filteredEntries.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Zap className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No entries in this category</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredEntries.map(entry => {
            const typeConf = TYPE_CONFIG[entry.suggested_type] || TYPE_CONFIG.internal_note;
            const statusConf = STATUS_CONFIG[entry.review_status] || STATUS_CONFIG.new;
            const customerName = getCustomerName(entry.customer_id) || entry.ai_extracted_customer_name;
            const boatName = getBoatName(entry.boat_id) || entry.ai_extracted_boat_name;
            const isActing = actionLoading?.startsWith(entry.id);
            const linkedWO = entry.work_order_id ? workOrders[entry.work_order_id] : null;
            const woLabel = linkedWO
              ? `${linkedWO.work_order_number ? '#' + linkedWO.work_order_number : ''} ${linkedWO.title || ''}`.trim()
              : entry.work_order_id ? `WO …${entry.work_order_id.slice(-6)}` : null;

            return (
              <Card key={entry.id} className={`border ${typeConf.border}`}>
                <CardContent className="p-4 space-y-3">
                  {/* Top row: type badge + status + timestamp */}
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      {entry.suggested_type && (
                        <Badge className={typeConf.color}>{typeConf.label}</Badge>
                      )}
                      <Badge className={statusConf.color}>{statusConf.label}</Badge>
                      {entry.ai_urgency_hint && entry.ai_urgency_hint !== 'normal' && (
                        <Badge className="bg-red-100 text-red-700">{entry.ai_urgency_hint}</Badge>
                      )}
                      {entry.ai_billable_hint && (
                        <Badge className="bg-green-100 text-green-700">billable</Badge>
                      )}
                      {entry.input_method === 'voice' && (
                        <Badge className="bg-indigo-100 text-indigo-700">voice</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-slate-400">
                      <Clock className="h-3 w-3" />
                      {entry.created_date ? format(parseISO(entry.created_date), 'MMM d, HH:mm') : '—'}
                    </div>
                  </div>

                  {/* Raw input */}
                  {editingId === entry.id ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editText}
                        onChange={e => setEditText(e.target.value)}
                        className="text-sm min-h-[80px]"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => saveEdit(entry)} className="text-xs">
                          <Save className="h-3 w-3 mr-1" />Speichern
                        </Button>
                        <Button size="sm" variant="ghost" onClick={cancelEdit} className="text-xs">
                          <X className="h-3 w-3 mr-1" />Abbrechen
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2 group">
                      <p className="text-sm text-slate-900 font-medium leading-relaxed flex-1">
                        "{entry.raw_input}"
                      </p>
                      {entry.review_status !== 'routed' && entry.review_status !== 'dismissed' && (
                        <button
                          onClick={() => startEdit(entry)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex-shrink-0"
                          title="Text bearbeiten"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  )}

                  {/* AI Summary */}
                  {entry.suggested_summary && (
                    <p className="text-sm text-slate-600 italic">{entry.suggested_summary}</p>
                  )}

                  {/* Suggested routing */}
                  {entry.suggested_target && (
                    <p className="text-xs text-slate-500">→ {entry.suggested_target}</p>
                  )}

                  {/* Context chips */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {customerName && (
                      <div className="flex items-center gap-1 text-xs text-slate-600 bg-slate-100 rounded px-2 py-0.5">
                        <User className="h-3 w-3" />
                        {customerName}
                      </div>
                    )}
                    {boatName && (
                      <div className="flex items-center gap-1 text-xs text-slate-600 bg-slate-100 rounded px-2 py-0.5">
                        <Ship className="h-3 w-3" />
                        {boatName}
                      </div>
                    )}
                    {entry.location_text && (
                      <div className="flex items-center gap-1 text-xs text-slate-600 bg-slate-100 rounded px-2 py-0.5">
                        <MapPin className="h-3 w-3" />
                        {entry.location_text}
                      </div>
                    )}
                    {woLabel && (
                      <div className="flex items-center gap-1 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded px-2 py-0.5">
                        <Wrench className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate max-w-[180px]" title={woLabel}>{woLabel}</span>
                      </div>
                    )}
                    {entry.created_by && (
                      <div className="flex items-center gap-1 text-xs text-slate-400">
                        by {entry.created_by}
                      </div>
                    )}
                  </div>

                  {/* Photo thumbnails */}
                  {entry.photo_urls?.length > 0 && (
                    <div className="flex gap-2 flex-wrap">
                      {entry.photo_urls.map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                          <img src={url} alt="" className="h-14 w-14 object-cover rounded border" />
                        </a>
                      ))}
                    </div>
                  )}

                  {/* Review notes */}
                  {entry.review_notes && (
                    <p className="text-xs text-slate-500 italic border-t pt-2">{entry.review_notes}</p>
                  )}

                  {/* Routed destination */}
                  {entry.review_status === 'routed' && entry.routed_record_type && (
                    <div className="flex items-center gap-2 pt-2 border-t">
                      <span className="text-xs text-green-700 font-medium">
                        → Routed to: {CONVERSION_LABEL[entry.routed_record_type] || entry.routed_record_type}
                      </span>
                      {getRoutedLink(entry.routed_record_type, entry.routed_record_id) && (
                        <Link
                          to={getRoutedLink(entry.routed_record_type, entry.routed_record_id)}
                          className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" /> Open
                        </Link>
                      )}
                      {entry.routed_at && (
                        <span className="text-xs text-slate-400">
                          · {format(parseISO(entry.routed_at), 'MMM d, HH:mm')}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Type-specific conversion actions — spec-correct mapping */}
                  {(entry.review_status === 'new' || entry.review_status === 'reviewed') && (
                    <div className="pt-2 border-t space-y-2">
                      <div className="flex items-center flex-wrap gap-1.5">

                        {/* task_candidate → Task under WO, OR new WorkOrder */}
                        {entry.suggested_type === 'task_candidate' && (<>
                          <Button size="sm" onClick={() => openConvert(entry, 'Task')}
                            className="bg-orange-500 hover:bg-orange-600 text-white text-xs">
                            <ArrowRight className="h-3 w-3 mr-1" />Add Task to WO
                          </Button>
                          <Button size="sm" onClick={() => openConvert(entry, 'Note')}
                            className="bg-slate-600 hover:bg-slate-700 text-white text-xs">
                            <ArrowRight className="h-3 w-3 mr-1" />Note
                          </Button>
                        </>)}

                        {/* material_entry → Customer Material Entry OR Materialimport (wenn Foto vorhanden) */}
                        {entry.suggested_type === 'material_entry' && (
                          <Button size="sm" onClick={() => openConvert(entry, 'CustomerMaterialEntry')}
                            className="bg-amber-500 hover:bg-amber-600 text-white text-xs">
                            <ArrowRight className="h-3 w-3 mr-1" />Material Entry
                          </Button>
                        )}
                        {entry.suggested_type === 'material_entry' && entry.photo_urls?.length > 0 && (
                          <Button
                            size="sm"
                            onClick={() => handleSendToMaterialImport(entry)}
                            disabled={importingEntryId === entry.id}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                          >
                            {importingEntryId === entry.id
                              ? <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              : <Receipt className="h-3 w-3 mr-1" />
                            }
                            {importingEntryId === entry.id ? 'KI extrahiert…' : '→ Materialimport'}
                          </Button>
                        )}

                        {/* customer_request → Lead, Offer Draft */}
                        {entry.suggested_type === 'customer_request' && (<>
                          <Button size="sm" onClick={() => openConvert(entry, 'Lead')}
                            className="bg-blue-600 hover:bg-blue-700 text-white text-xs">
                            <ArrowRight className="h-3 w-3 mr-1" />Lead
                          </Button>
                          <Button size="sm" onClick={() => openConvert(entry, 'Offer')}
                            className="bg-green-600 hover:bg-green-700 text-white text-xs">
                            <ArrowRight className="h-3 w-3 mr-1" />Offer Draft
                          </Button>
                        </>)}

                        {/* project_intake → Lead, Offer Draft */}
                        {entry.suggested_type === 'project_intake' && (<>
                          <Button size="sm" onClick={() => openConvert(entry, 'Lead')}
                            className="bg-blue-600 hover:bg-blue-700 text-white text-xs">
                            <ArrowRight className="h-3 w-3 mr-1" />Lead
                          </Button>
                          <Button size="sm" onClick={() => openConvert(entry, 'Offer')}
                            className="bg-green-600 hover:bg-green-700 text-white text-xs">
                            <ArrowRight className="h-3 w-3 mr-1" />Offer Draft
                          </Button>
                        </>)}

                        {/* internal_note → Customer Note */}
                        {entry.suggested_type === 'internal_note' && (
                          <Button size="sm" onClick={() => openConvert(entry, 'Note')}
                            className="bg-slate-700 hover:bg-slate-800 text-white text-xs">
                            <ArrowRight className="h-3 w-3 mr-1" />Customer Note
                          </Button>
                        )}

                        {/* tool_tracking → Customer Note */}
                        {entry.suggested_type === 'tool_tracking' && (
                          <Button size="sm" onClick={() => openConvert(entry, 'Note')}
                            className="bg-slate-700 hover:bg-slate-800 text-white text-xs">
                            <ArrowRight className="h-3 w-3 mr-1" />Customer Note
                          </Button>
                        )}

                        {/* Fallback for unclassified entries */}
                        {!entry.suggested_type && (
                          <Button size="sm" onClick={() => openConvert(entry, 'Note')}
                            className="bg-slate-700 hover:bg-slate-800 text-white text-xs">
                            <ArrowRight className="h-3 w-3 mr-1" />Save as Note
                          </Button>
                        )}

                        {/* Mark Reviewed (secondary) */}
                        {entry.review_status === 'new' && (
                          <Button size="sm" variant="outline" onClick={() => updateStatus(entry, 'reviewed')}
                            disabled={isActing} className="text-blue-700 border-blue-200 text-xs">
                            <CheckCircle2 className="h-3 w-3 mr-1" />Reviewed
                          </Button>
                        )}

                        <Button size="sm" variant="ghost" onClick={() => updateStatus(entry, 'dismissed')}
                          disabled={isActing} className="text-slate-400 text-xs">
                          <XCircle className="h-3 w-3 mr-1" />Dismiss
                        </Button>
                      </div>
                    </div>
                  )}

                  {entry.reviewed_by && entry.reviewed_at && (
                    <p className="text-xs text-slate-400">
                      Reviewed by {entry.reviewed_by} · {format(parseISO(entry.reviewed_at), 'MMM d, HH:mm')}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <InvoiceScanModal
        open={showInvoiceScanModal}
        onOpenChange={setShowInvoiceScanModal}
      />

      <QuickCaptureModal
        open={showCaptureModal}
        onClose={() => { setShowCaptureModal(false); loadData(); }}
        customers={customers}
        boats={boats}
      />

      {convertingEntry && (
        <ConversionDialog
          entry={convertingEntry}
          customers={customers}
          boats={boats}
          forcedTarget={forcedTarget}
          onSuccess={handleConversionSuccess}
          onCancel={() => { setConvertingEntry(null); setForcedTarget(null); }}
        />
      )}
    </div>
  );
}