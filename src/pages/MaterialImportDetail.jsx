import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Upload, Loader2, Plus, Trash2, CheckCircle, Search } from 'lucide-react';
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
  is_manually_edited: false,
});

export default function MaterialImportDetail() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const docId = urlParams.get('id');

  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [booking, setBooking] = useState(false);

  const [header, setHeader] = useState({
    document_type: 'Invoice',
    supplier_name: '',
    document_number: '',
    document_date: '',
    original_file_url: '',
    extraction_status: 'uploaded',
    selected_customer_id: '',
    notes: '',
  });
  const [lines, setLines] = useState([EMPTY_LINE()]);
  const [customerSearch, setCustomerSearch] = useState('');
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
        selected_customer_id: d.selected_customer_id || '',
        notes: d.notes || '',
      });
      setSavedDocId(d.id);
    }
  }, [existingDoc]);

  useEffect(() => {
    if (existingLines?.length > 0) {
      setLines(existingLines.map(l => ({ ...l, _key: l.id, _savedId: l.id })));
    }
  }, [existingLines]);

  const { data: customers = [] } = useQuery({
    queryKey: ['customers_basic'],
    queryFn: () => base44.entities.Customer.list('-created_date', 500),
  });

  const filteredCustomers = customers.filter(c => {
    const q = customerSearch.toLowerCase();
    if (!q) return false;
    const name = `${c.first_name || ''} ${c.last_name} ${c.company_name || ''}`.toLowerCase();
    return name.includes(q);
  }).slice(0, 8);

  const selectedCustomer = customers.find(c => c.id === header.selected_customer_id);

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

  // AI Extraction
  const handleExtract = async () => {
    if (!header.original_file_url) return toast.error('Please upload a file first');
    setExtracting(true);
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a document parser. Extract structured data from this supplier invoice or delivery note.
Return a JSON object with these exact fields:
{
  "document_type": "Invoice" or "Delivery Note" or "Other",
  "supplier_name": "string or null",
  "document_number": "string or null",
  "document_date": "YYYY-MM-DD or null",
  "lines": [
    {
      "item_title": "string",
      "item_description": "string or null",
      "quantity": number or null,
      "unit": "string or null",
      "unit_purchase_price": number or null,
      "total_purchase_price": number or null,
      "sku": "string or null"
    }
  ]
}
Rules:
- Leave fields null if not clearly visible in the document
- Do not invent or guess values
- Extract all line items you can identify
- Prices should be numbers without currency symbols`,
      file_urls: [header.original_file_url],
      response_json_schema: {
        type: 'object',
        properties: {
          document_type: { type: 'string' },
          supplier_name: { type: 'string' },
          document_number: { type: 'string' },
          document_date: { type: 'string' },
          lines: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                item_title: { type: 'string' },
                item_description: { type: 'string' },
                quantity: { type: 'number' },
                unit: { type: 'string' },
                unit_purchase_price: { type: 'number' },
                total_purchase_price: { type: 'number' },
                sku: { type: 'string' },
              }
            }
          }
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
        is_manually_edited: false,
        line_order: i,
      })));
    }
    setExtracting(false);
    toast.success('Extraction complete — please review');
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
    // Save lines
    for (const line of lines) {
      const lineData = {
        import_document_id: docIdToUse,
        line_order: lines.indexOf(line),
        item_title: line.item_title,
        item_description: line.item_description,
        quantity: line.quantity !== '' ? Number(line.quantity) : null,
        unit: line.unit,
        unit_purchase_price: line.unit_purchase_price !== '' ? Number(line.unit_purchase_price) : null,
        total_purchase_price: line.total_purchase_price !== '' ? Number(line.total_purchase_price) : null,
        sku: line.sku,
        is_manually_edited: line.is_manually_edited,
      };
      if (line._savedId) {
        await base44.entities.ImportDocumentLine.update(line._savedId, lineData);
      } else {
        const saved = await base44.entities.ImportDocumentLine.create(lineData);
        line._savedId = saved.id;
      }
    }
    await base44.entities.ImportDocument.update(docIdToUse, { extraction_status: 'approved' });
    setHeader(h => ({ ...h, extraction_status: 'approved' }));
    setSaving(false);
    toast.success('Saved');
  };

  // Book to customer
  const handleBook = async () => {
    if (!header.selected_customer_id) return toast.error('Please select a customer first');
    if (!savedDocId) await handleSave();
    setBooking(true);
    for (const line of lines) {
      if (!line.item_title) continue;
      await base44.entities.CustomerMaterialEntry.create({
        customer_id: header.selected_customer_id,
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
    }
    if (savedDocId) {
      await base44.entities.ImportDocument.update(savedDocId, {
        extraction_status: 'booked',
        selected_customer_id: header.selected_customer_id,
      });
    }
    setHeader(h => ({ ...h, extraction_status: 'booked' }));
    setBooking(false);
    toast.success('Booked to customer');
  };

  const updateLine = (key, field, value) => {
    setLines(prev => prev.map(l => l._key === key ? { ...l, [field]: value, is_manually_edited: true } : l));
  };
  const addLine = () => setLines(prev => [...prev, EMPTY_LINE()]);
  const removeLine = (key) => setLines(prev => prev.filter(l => l._key !== key));

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/MaterialImport')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            {savedDocId ? 'Review Import' : 'New Import'}
          </h1>
          <p className="text-xs text-slate-500">Upload document → Extract → Review → Assign to Customer → Book</p>
        </div>
      </div>

      {/* Step 1: Upload */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <h2 className="font-semibold text-slate-800">1. Upload Document</h2>
        <div className="flex items-center gap-4">
          <label className="cursor-pointer">
            <input type="file" accept=".pdf,image/*" className="hidden" onChange={handleFileUpload} />
            <div className="flex items-center gap-2 px-4 py-2 border border-dashed border-slate-300 rounded-lg hover:border-blue-400 transition-colors text-slate-600 text-sm">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploading ? 'Uploading…' : 'Choose PDF or Image'}
            </div>
          </label>
          {header.original_file_url && (
            <a href={header.original_file_url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline">
              View uploaded file
            </a>
          )}
          {header.original_file_url && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleExtract}
              disabled={extracting}
            >
              {extracting ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Extracting…</> : 'Extract with AI'}
            </Button>
          )}
        </div>
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

      {/* Step 3: Line Items */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">3. Line Items</h2>
          <Button variant="outline" size="sm" onClick={addLine}>
            <Plus className="h-4 w-4 mr-1" /> Add Line
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="text-left pb-2 pr-2 font-medium w-[200px]">Title</th>
                <th className="text-left pb-2 pr-2 font-medium w-[140px]">Description</th>
                <th className="text-left pb-2 pr-2 font-medium w-[60px]">Qty</th>
                <th className="text-left pb-2 pr-2 font-medium w-[60px]">Unit</th>
                <th className="text-left pb-2 pr-2 font-medium w-[90px]">Unit Price</th>
                <th className="text-left pb-2 pr-2 font-medium w-[90px]">Total</th>
                <th className="text-left pb-2 pr-2 font-medium w-[90px]">SKU</th>
                <th className="pb-2 w-[32px]" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {lines.map(line => (
                <tr key={line._key}>
                  <td className="py-1 pr-2"><Input value={line.item_title} onChange={e => updateLine(line._key, 'item_title', e.target.value)} className="h-7 text-xs" /></td>
                  <td className="py-1 pr-2"><Input value={line.item_description} onChange={e => updateLine(line._key, 'item_description', e.target.value)} className="h-7 text-xs" /></td>
                  <td className="py-1 pr-2"><Input type="number" value={line.quantity} onChange={e => updateLine(line._key, 'quantity', e.target.value)} className="h-7 text-xs" /></td>
                  <td className="py-1 pr-2"><Input value={line.unit} onChange={e => updateLine(line._key, 'unit', e.target.value)} className="h-7 text-xs" /></td>
                  <td className="py-1 pr-2"><Input type="number" value={line.unit_purchase_price} onChange={e => updateLine(line._key, 'unit_purchase_price', e.target.value)} className="h-7 text-xs" /></td>
                  <td className="py-1 pr-2"><Input type="number" value={line.total_purchase_price} onChange={e => updateLine(line._key, 'total_purchase_price', e.target.value)} className="h-7 text-xs" /></td>
                  <td className="py-1 pr-2"><Input value={line.sku} onChange={e => updateLine(line._key, 'sku', e.target.value)} className="h-7 text-xs" /></td>
                  <td className="py-1">
                    <button onClick={() => removeLine(line._key)} className="text-slate-300 hover:text-red-500 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Step 4: Customer Assignment */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <h2 className="font-semibold text-slate-800">4. Assign to Customer</h2>
        {selectedCustomer ? (
          <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
            <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-medium text-green-800">
                {selectedCustomer.company_name || `${selectedCustomer.first_name || ''} ${selectedCustomer.last_name}`.trim()}
              </p>
              <p className="text-xs text-green-600">{selectedCustomer.email}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => { setHeader(h => ({ ...h, selected_customer_id: '' })); setCustomerSearch(''); }}>
              Change
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                className="pl-9"
                placeholder="Search customer by name or company…"
                value={customerSearch}
                onChange={e => setCustomerSearch(e.target.value)}
              />
            </div>
            {filteredCustomers.length > 0 && (
              <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-48 overflow-y-auto">
                {filteredCustomers.map(c => (
                  <button
                    key={c.id}
                    className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors"
                    onClick={() => { setHeader(h => ({ ...h, selected_customer_id: c.id })); setCustomerSearch(''); }}
                  >
                    <p className="font-medium text-sm text-slate-800">
                      {c.company_name || `${c.first_name || ''} ${c.last_name}`.trim()}
                    </p>
                    <p className="text-xs text-slate-400">{c.email}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
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
            disabled={booking || !header.selected_customer_id}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {booking ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-1" />}
            Confirm & Book
          </Button>
        </div>
      </div>
    </div>
  );
}