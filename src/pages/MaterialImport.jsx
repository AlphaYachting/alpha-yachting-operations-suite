import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Plus, FileText, Search, Edit } from 'lucide-react';
import ManualMaterialEntryModal from '@/components/materialimport/ManualMaterialEntryModal';
import moment from 'moment';

const STATUS_COLORS = {
  uploaded: 'bg-slate-100 text-slate-600',
  extracted: 'bg-blue-100 text-blue-700',
  needs_review: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  booked: 'bg-emerald-100 text-emerald-800',
  failed: 'bg-red-100 text-red-700',
};

export default function MaterialImport() {
  const [search, setSearch] = useState('');
  const [showManualModal, setShowManualModal] = useState(false);

  const { data: documents = [], refetch } = useQuery({
    queryKey: ['import_documents'],
    queryFn: () => base44.entities.ImportDocument.list('-created_date', 100),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers_for_import'],
    queryFn: () => base44.entities.Customer.list('-created_date', 500),
  });

  const customerMap = Object.fromEntries(customers.map(c => [c.id, c]));

  const filtered = documents.filter(doc => {
    const q = search.toLowerCase();
    return (
      !q ||
      doc.supplier_name?.toLowerCase().includes(q) ||
      doc.document_number?.toLowerCase().includes(q) ||
      customerMap[doc.selected_customer_id]?.last_name?.toLowerCase().includes(q) ||
      customerMap[doc.selected_customer_id]?.company_name?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Material Import</h1>
          <p className="text-sm text-slate-500 mt-1">Import supplier invoices & delivery notes, assign to customers</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowManualModal(true)}>
            <Plus className="h-4 w-4 mr-1" /> Manual Entry
          </Button>
          <Link to="/MaterialImportDetail">
            <Button>
              <FileText className="h-4 w-4 mr-1" /> New Import
            </Button>
          </Link>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          className="pl-9"
          placeholder="Search supplier, document number, customer…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No imports yet</p>
            <p className="text-sm mt-1">Create a new import or add a manual entry</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Document</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Supplier</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Customer</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Date</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(doc => {
                const customer = customerMap[doc.selected_customer_id];
                const customerName = customer
                  ? (customer.company_name || `${customer.first_name || ''} ${customer.last_name}`.trim())
                  : '—';
                return (
                  <tr key={doc.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{doc.document_number || '(no number)'}</div>
                      <div className="text-xs text-slate-400">{doc.document_type || 'Invoice'}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{doc.supplier_name || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{customerName}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {doc.document_date ? moment(doc.document_date).format('DD.MM.YYYY') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[doc.extraction_status] || 'bg-slate-100 text-slate-600'}`}>
                        {doc.extraction_status || 'uploaded'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link to={`/MaterialImportDetail?id=${doc.id}`}>
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showManualModal && (
        <ManualMaterialEntryModal
          customers={customers}
          onClose={() => setShowManualModal(false)}
          onSaved={() => { setShowManualModal(false); refetch(); }}
        />
      )}
    </div>
  );
}