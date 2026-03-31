import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Upload, Loader2, Plus, Trash2, CheckCircle, Search, User, X } from 'lucide-react';
import { toast } from 'sonner';

const EMPTY_LINE = () => ({
  _key: Math.random().toString(36).slice(2),
  item_title: '',
  item_description: '',
  quantity: '',
  unit: '',
  unit_purchase_price: '',
  total_purchase_price: '',
  sku: '',
  assigned_customer_id: '',
  is_manually_edited: false,
  line_order: 0,
});

// Small inline customer picker for each line
function LineCustomerPicker({ value, customers, onChange }) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const selected = customers.find(c => c.id === value);
  const filtered = search.length > 0
    ? customers.filter(c => {
        const name = `${c.first_name || ''} ${c.last_name} ${c.company_name || ''}`.toLowerCase();
        return name.includes(search.toLowerCase());
      }).slice(0, 6)
    : [];

  useEffect(() => {
    const handleClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  if (selected) {
    return (
      <div className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800 whitespace-nowrap max-w-[150px]">
        <span className="truncate flex-1">{selected.company_name || `${selected.first_name || ''} ${selected.last_name}`.trim()}</span>
        <button onClick={() => onChange('')} className="text-blue-400 hover:text-blue-700 flex-shrink-0">
          <X className="h-3 w-3" />
        </button>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center gap-1">
        <Input
          value={search}
          onChange={e => { setSearch(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Kunde…"
          className="h-7 text-xs w-[130px]"
        />
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-50 top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg w-52 max-h-40 overflow-y-auto">
          {filtered.map(c => (
            <button
              key={c.id}
              className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-xs border-b border-slate-100 last:border-0"
              onMouseDown={e => { e.preventDefault(); onChange(c.id); setSearch(''); setOpen(false); }}
            >
              <span className="font-medium">{c.company_name || `${c.first_name || ''} ${c.last_name}`.trim()}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MaterialImportDetail() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const docId = urlParams.get('id');

  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [booking, setBooking] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [translationLanguage, setTranslationLanguage] = useState('none');
  const [defaultCustomerId, setDefaultCustomerId] = useState('');
  const [defaultCustomerSearch, setDefaultCustomerSearch] = useState('');

  const [header, setHeader] = useState({
    document_type: 'Invoice',
    supplier_name: '',
    document_number: '',
    document_date: '',
    original_file_url: '',
    extraction_status: 'uploaded',
    notes: '',
  });
  const [lines, setLines] = useState([EMPTY_LINE()]);
  const [savedDocId, setSavedDocId] = useState(docId || null);

  // Load existing document
  const { data: existingDoc } = useQuery({
    queryKey: ['import_doc', docId],
    queryFn: () => base44.entities.ImportDocument.filter({ id: docId }),
    enabled: !!docId,
  });
  const { data: existingLines } = useQuery({
    queryKey: ['import_lines', docId],
    queryFn: () => base44.entities.ImportDocumentLine.filter({ import_document_id: docId }),
    enabled: !!docId,
  });

  useEffect(() => {
    if (existingDoc?.[0]) {
      const d = existingDoc[0];
      setHeader({
        document_type: d.document_type || 'Invoice',
        supplier_name: d.supplier_name || '',
        document_number: d.document_number || '',
        document_date: d.document_date || '',
        original_file_url: d.original_file_url || '',
        extraction_status: d.extraction_status || 'uploaded',
        notes: d.notes || '',
      });
      setSavedDocId(d.id);
    }
  }, [existingDoc]);

  useEffect(() => {
    if (existingLines?.length > 0) {
      setLines(existingLines.map(l => ({ ...l, _key: l.id, _savedId: l.id, assigned_customer_id: l.assigned_customer_id || '' })));
    }
  }, [existingLines]);

  const { data: customers = [] } = useQuery({
    queryKey: ['customers_basic'],
    queryFn: () => base44.entities.Customer.list('-created_date', 500),
  });

  const filteredDefaultCustomers = customers.filter(c => {
    const q = defaultCustomerSearch.toLowerCase();
    if (!q) return false;
    const name = `${c.first_name || ''} ${c.last_name} ${c.company_name || ''}`.toLowerCase();
    return name.includes(q);
  }).slice(0, 8);

  const selectedDefaultCustomer = customers.find(c => c.id === defaultCustomerId);

  // Apply default customer to all lines that have no customer assigned
  const applyDefaultToAll = () => {
    if (!defaultCustomerId) return;
    setLines(prev => prev.map(l => ({ ...l, assigned_customer_id: l.assigned_customer_id || defaultCustomerId })));
    toast.success('Standardkunde auf alle Zeilen ohne Kundenzuweisung angewendet');
  };

  // File upload
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setHeader(h => ({ ...h, original_file_url: file_url, extraction_status: 'uploaded' }));
    setUploading(false);
    toast.success('File uploaded');
  };

  // AI Translation
  const handleTranslate = async () => {
    if (lines.length === 0) return toast.error('No lines to translate');
    setTranslating(true);
    const linesToTranslate = lines.filter(l => l.item_title);
    const lineContent = linesToTranslate.map(l => ({ title: l.item_title, description: l.item_description || '' }));
    const result = await base44.integrations.Core.InvokeLLM({
      model: 'gemini_3_flash',
      prompt: `Translate the following invoice line item titles and descriptions to ${translationLanguage}. Only translate item_title and item_description, not codes or numbers.
Items: ${JSON.stringify(lineContent)}
Return JSON: {"items": [{"title": "...", "description": "..."}]}`,
      response_json_schema: {
        type: 'object',
        properties: {
          items: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, description: { type: 'string' } } } },
        },
      },
    });
    const translatedItems = result?.items || [];
    if (Array.isArray(translatedItems) && translatedItems.length > 0) {
      setLines(prev => {
        const nonEmptyLines = prev.filter(l => l.item_title);
        const emptyLines = prev.filter(l => !l.item_title);
        const updatedNonEmpty = nonEmptyLines.map((l, i) => ({
          ...l,
          item_title: translatedItems[i]?.title || l.item_title,
          item_description: translatedItems[i]?.description || l.item_description,
          is_manually_edited: true,
        }));
        return [...updatedNonEmpty, ...emptyLines];
      });
      toast.success(`Translated to ${translationLanguage}`);
    }
    setTranslating(false);
  };

  // AI Extraction
  const handleExtract = async () => {
    if (!header.original_file_url) return toast.error('Please upload a file first');
    setExtracting(true);
    const translateInstruction = translationLanguage !== 'none'
      ? `\n- Translate item_title and item_description fields to ${translationLanguage}. Do NOT translate supplier_name, document_number or any numeric fields.`
      : '';
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
Rules:
- Leave fields null if not clearly visible in the document
- Do not invent or guess values
- Extract all line items you can identify
- Prices should be numbers without currency symbols${translateInstruction}`,
      file_urls: [header.original_file_url],
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

    setHeader(h => ({
      ...h,
      document_type: result.document_type || h.document_type,
      supplier_name: result.supplier_name || h.supplier_name,
      document_number: result.document_number || h.document_number,
      document_date: result.document_date || h.document_date,
      extraction_status: 'needs_review',
    }));

    if (result.lines?.length > 0) {
      setLines(result.lines.map((l, i) => ({
        _key: Math.random().toString(36).slice(2),
        item_title: l.item_title || '',
        item_description: l.item_description || '',
        quantity: l.quantity ?? '',
        unit: l.unit || '',
        unit_purchase_price: l.unit_purchase_price ?? '',
        total_purchase_price: l.total_purchase_price ?? '',
        sku: l.sku || '',
        assigned_customer_id: defaultCustomerId || '',
        is_manually_edited: false,
        line_order: i,
      })));
    }
    setExtracting(false);
    const langLabel = translationLanguage !== 'none' ? ` (translated to ${translationLanguage})` : '';
    toast.success(`Extraction complete${langLabel} — please review`);
  };

  // Save draft
  const handleSave = async () => {
    setSaving(true);
    let docIdToUse = savedDocId;
    if (!docIdToUse) {
      const created = await base44.entities.ImportDocument.create({ ...header });
      docIdToUse = created.id;
      setSavedDocId(docIdToUse);
    } else {
      await base44.entities.ImportDocument.update(docIdToUse, { ...header });
    }
    await Promise.all(lines.map(async (line, idx) => {
      const lineData = {
        import_document_id: docIdToUse,
        line_order: idx,
        item_title: line.item_title,
        item_description: line.item_description,
        quantity: line.quantity !== '' ? Number(line.quantity) : null,
        unit: line.unit,
        unit_purchase_price: line.unit_purchase_price !== '' ? Number(line.unit_purchase_price) : null,
        total_purchase_price: line.total_purchase_price !== '' ? Number(line.total_purchase_price) : null,
        sku: line.sku,
        assigned_customer_id: line.assigned_customer_id || null,
        is_manually_edited: line.is_manually_edited,
      };
      if (line._savedId) {
        await base44.entities.ImportDocumentLine.update(line._savedId, lineData);
      } else {
        const saved = await base44.entities.ImportDocumentLine.create(lineData);
        line._savedId = saved.id;
      }
    }));
    await base44.entities.ImportDocument.update(docIdToUse, { extraction_status: 'approved' });
    setHeader(h => ({ ...h, extraction_status: 'approved' }));
    setSaving(false);
    toast.success('Saved');
  };

  // Book — each line uses its own customer, fallback to defaultCustomerId
  const handleBook = async () => {
    const linesWithCustomer = lines.filter(l => l.item_title && (l.assigned_customer_id || defaultCustomerId));
    const linesWithoutCustomer = lines.filter(l => l.item_title && !l.assigned_customer_id && !defaultCustomerId);
    if (linesWithoutCustomer.length > 0) {
      return toast.error(`${linesWithoutCustomer.length} Zeile(n) haben keinen Kunden zugewiesen. Bitte alle Zeilen einem Kunden zuweisen oder einen Standardkunden setzen.`);
    }
    if (linesWithCustomer.length === 0) return toast.error('Keine Positionen zum Buchen');
    if (!savedDocId) await handleSave();
    setBooking(true);
    await Promise.all(linesWithCustomer.map(line => {
      const customerId = line.assigned_customer_id || defaultCustomerId;
      return base44.entities.CustomerMaterialEntry.create({
        customer_id: customerId,
        source_type: 'import',
        source_document_id: savedDocId,
        source_line_id: line._savedId || null,
        supplier_name: header.supplier_name,
        document_number: header.document_number,
        document_date: header.document_date,
        item_title: line.item_title,
        item_description: line.item_description,
        quantity: line.quantity !== '' ? Number(line.quantity) : null,
        unit: line.unit,
        unit_purchase_price: line.unit_purchase_price !== '' ? Number(line.unit_purchase_price) : null,
        total_purchase_price: line.total_purchase_price !== '' ? Number(line.total_purchase_price) : null,
      });
    }));
    if (savedDocId) {
      await base44.entities.ImportDocument.update(savedDocId, { extraction_status: 'booked' });
    }
    setHeader(h => ({ ...h, extraction_status: 'booked' }));
    setBooking(false);
    toast.success('Gebucht');
  };

  const updateLine = (key, field, value) => {
    setLines(prev => prev.map(l => l._key === key ? { ...l, [field]: value, is_manually_edited: field !== 'assigned_customer_id' ? true : l.is_manually_edited } : l));
  };
  const addLine = () => setLines(prev => [...prev, { ...EMPTY_LINE(), assigned_customer_id: defaultCustomerId || '' }]);
  const removeLine = (key) => setLines(prev => prev.filter(l => l._key !== key));

  const assignedCount = lines.filter(l => l.item_title && (l.assigned_customer_id || defaultCustomerId)).length;
  const totalWithTitle = lines.filter(l => l.item_title).length;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/MaterialImport')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            {savedDocId ? 'Review Import' : 'New Import'}
          </h1>
          <p className="text-xs text-slate-500">Upload → Extract → Review lines & assign customers → Book</p>
        </div>
      </div>

      {/* Step 1: Upload */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <h2 className="font-semibold text-slate-800">1. Upload Document</h2>
        <div className="flex flex-wrap items-center gap-3">
          <label className="cursor-pointer">
            <input type="file" accept=".pdf,image/*" className="hidden" onChange={handleFileUpload} />
            <div className="flex items-center gap-2 px-4 py-2 border border-dashed border-slate-300 rounded-lg hover:border-blue-400 transition-colors text-slate-600 text-sm">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploading ? 'Uploading…' : 'Choose PDF or Image'}
            </div>
          </label>
          {header.original_file_url && (
            <a href={header.original_file_url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline">
              View file
            </a>
          )}
        </div>
        {header.original_file_url && (
          <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 whitespace-nowrap">Translate line items to:</span>
              <Select value={translationLanguage} onValueChange={setTranslationLanguage}>
                <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No translation</SelectItem>
                  <SelectItem value="German">Deutsch</SelectItem>
                  <SelectItem value="English">English</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" onClick={handleExtract} disabled={extracting}>
              {extracting ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Extracting…</> : 'Extract with AI'}
            </Button>
            {lines.some(l => l.item_title) && (
              <Button variant="outline" size="sm" onClick={handleTranslate} disabled={translating || translationLanguage === 'none'}>
                {translating ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Translating…</> : 'Re-translate lines'}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Step 2: Header Data */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <h2 className="font-semibold text-slate-800">2. Document Header</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <Label>Type</Label>
            <Select value={header.document_type} onValueChange={v => setHeader(h => ({ ...h, document_type: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Invoice">Invoice</SelectItem>
                <SelectItem value="Delivery Note">Delivery Note</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Supplier</Label>
            <Input value={header.supplier_name} onChange={e => setHeader(h => ({ ...h, supplier_name: e.target.value }))} placeholder="Supplier name" />
          </div>
          <div className="space-y-1">
            <Label>Document No.</Label>
            <Input value={header.document_number} onChange={e => setHeader(h => ({ ...h, document_number: e.target.value }))} placeholder="Invoice / DN number" />
          </div>
          <div className="space-y-1">
            <Label>Document Date</Label>
            <Input type="date" value={header.document_date} onChange={e => setHeader(h => ({ ...h, document_date: e.target.value }))} />
          </div>
        </div>
        <div className="space-y-1">
          <Label>Notes</Label>
          <Textarea rows={2} value={header.notes} onChange={e => setHeader(h => ({ ...h, notes: e.target.value }))} placeholder="Internal notes…" />
        </div>
      </div>

      {/* Step 3: Default Customer + Line Items */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold text-slate-800">3. Positionen & Kundenzuweisung</h2>
            <p className="text-xs text-slate-500 mt-0.5">Jede Position kann einem anderen Kunden zugewiesen werden. Standardkunde wird auf alle Zeilen ohne Zuweisung angewendet.</p>
          </div>
          <Button variant="outline" size="sm" onClick={addLine} className="flex-shrink-0">
            <Plus className="h-4 w-4 mr-1" /> Add Line
          </Button>
        </div>

        {/* Default customer selector */}
        <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
          <User className="h-4 w-4 text-slate-400 flex-shrink-0" />
          <span className="text-sm font-medium text-slate-700 whitespace-nowrap">Standardkunde:</span>
          {selectedDefaultCustomer ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-blue-700 font-medium">
                {selectedDefaultCustomer.company_name || `${selectedDefaultCustomer.first_name || ''} ${selectedDefaultCustomer.last_name}`.trim()}
              </span>
              <button onClick={() => { setDefaultCustomerId(''); setDefaultCustomerSearch(''); }} className="text-slate-400 hover:text-red-500">
                <X className="h-3.5 w-3.5" />
              </button>
              <Button size="sm" variant="outline" onClick={applyDefaultToAll} className="ml-2 h-7 text-xs">
                Auf alle offenen Zeilen anwenden
              </Button>
            </div>
          ) : (
            <div className="relative">
              <Input
                value={defaultCustomerSearch}
                onChange={e => setDefaultCustomerSearch(e.target.value)}
                placeholder="Kunde suchen…"
                className="h-8 text-sm w-52"
              />
              {filteredDefaultCustomers.length > 0 && (
                <div className="absolute z-50 top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg w-64 max-h-48 overflow-y-auto">
                  {filteredDefaultCustomers.map(c => (
                    <button
                      key={c.id}
                      className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm border-b border-slate-100 last:border-0"
                      onClick={() => { setDefaultCustomerId(c.id); setDefaultCustomerSearch(''); }}
                    >
                      <span className="font-medium">{c.company_name || `${c.first_name || ''} ${c.last_name}`.trim()}</span>
                      <span className="text-xs text-slate-400 ml-2">{c.email}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {totalWithTitle > 0 && (
            <span className="ml-auto text-xs text-slate-500">
              {assignedCount}/{totalWithTitle} Positionen zugewiesen
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="text-left pb-2 pr-2 font-medium w-[180px]">Title</th>
                <th className="text-left pb-2 pr-2 font-medium w-[120px]">Description</th>
                <th className="text-left pb-2 pr-2 font-medium w-[55px]">Qty</th>
                <th className="text-left pb-2 pr-2 font-medium w-[50px]">Unit</th>
                <th className="text-left pb-2 pr-2 font-medium w-[80px]">Unit Price</th>
                <th className="text-left pb-2 pr-2 font-medium w-[80px]">Total</th>
                <th className="text-left pb-2 pr-2 font-medium w-[70px]">SKU</th>
                <th className="text-left pb-2 pr-2 font-medium w-[155px]">Kunde</th>
                <th className="pb-2 w-[28px]" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {lines.map(line => {
                const effectiveCustomer = line.assigned_customer_id || defaultCustomerId;
                const hasNoCustomer = line.item_title && !effectiveCustomer;
                return (
                  <tr key={line._key} className={hasNoCustomer ? 'bg-amber-50' : ''}>
                    <td className="py-1 pr-2"><Input value={line.item_title} onChange={e => updateLine(line._key, 'item_title', e.target.value)} className="h-7 text-xs" /></td>
                    <td className="py-1 pr-2"><Input value={line.item_description} onChange={e => updateLine(line._key, 'item_description', e.target.value)} className="h-7 text-xs" /></td>
                    <td className="py-1 pr-2"><Input type="number" value={line.quantity} onChange={e => updateLine(line._key, 'quantity', e.target.value)} className="h-7 text-xs" /></td>
                    <td className="py-1 pr-2"><Input value={line.unit} onChange={e => updateLine(line._key, 'unit', e.target.value)} className="h-7 text-xs" /></td>
                    <td className="py-1 pr-2"><Input type="number" value={line.unit_purchase_price} onChange={e => updateLine(line._key, 'unit_purchase_price', e.target.value)} className="h-7 text-xs" /></td>
                    <td className="py-1 pr-2"><Input type="number" value={line.total_purchase_price} onChange={e => updateLine(line._key, 'total_purchase_price', e.target.value)} className="h-7 text-xs" /></td>
                    <td className="py-1 pr-2"><Input value={line.sku} onChange={e => updateLine(line._key, 'sku', e.target.value)} className="h-7 text-xs" /></td>
                    <td className="py-1 pr-2">
                      <LineCustomerPicker
                        value={line.assigned_customer_id}
                        customers={customers}
                        onChange={v => updateLine(line._key, 'assigned_customer_id', v)}
                      />
                    </td>
                    <td className="py-1">
                      <button onClick={() => removeLine(line._key)} className="text-slate-300 hover:text-red-500 transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pb-6">
        <Button variant="outline" onClick={() => navigate('/MaterialImport')}>Cancel</Button>
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
            Save Draft
          </Button>
          <Button
            onClick={handleBook}
            disabled={booking || totalWithTitle === 0}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {booking ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-1" />}
            Confirm & Book ({assignedCount}/{totalWithTitle})
          </Button>
        </div>
      </div>
    </div>
  );
}