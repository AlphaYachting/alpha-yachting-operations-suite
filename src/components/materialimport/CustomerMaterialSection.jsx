import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useState } from 'react';
import { Package, Plus, Pencil, Trash2, CheckCircle2, Circle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import ManualMaterialEntryModal from './ManualMaterialEntryModal';
import moment from 'moment';

export default function CustomerMaterialSection({ customerId }) {
  const [showManual, setShowManual] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);

  const handleDelete = async (entry) => {
    if (!confirm(`"${entry.item_title}" wirklich löschen?`)) return;
    await base44.entities.CustomerMaterialEntry.delete(entry.id);
    toast.success('Eintrag gelöscht');
    refetch();
  };

  const handleToggleBillingStatus = async (entry) => {
    const newStatus = entry.billing_status === 'verrechnet' ? 'offen' : 'verrechnet';
    await base44.entities.CustomerMaterialEntry.update(entry.id, { billing_status: newStatus });
    toast.success(newStatus === 'verrechnet' ? 'Als verrechnet markiert' : 'Status zurückgesetzt');
    refetch();
  };

  const { data: entries = [], refetch } = useQuery({
    queryKey: ['customer_material', customerId],
    queryFn: () => base44.entities.CustomerMaterialEntry.filter({ customer_id: customerId }, '-created_date', 100),
    enabled: !!customerId,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers_basic'],
    queryFn: () => base44.entities.Customer.list('-created_date', 500),
    staleTime: 60000,
  });

  if (!customerId) return null;

  return (
    <div className="border-t border-slate-200 pt-6 mt-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-slate-500" />
          <h3 className="font-semibold text-slate-800">Booked Materials</h3>
          {entries.length > 0 && (
            <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full">{entries.length}</span>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowManual(true)}>
          <Plus className="h-4 w-4 mr-1" /> Add Manual Entry
        </Button>
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-slate-400 py-4 text-center">No material entries yet</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-slate-500">Item</th>
                <th className="text-left px-3 py-2 font-medium text-slate-500">Supplier</th>
                <th className="text-left px-3 py-2 font-medium text-slate-500">Document</th>
                <th className="text-left px-3 py-2 font-medium text-slate-500">Qty</th>
                <th className="text-left px-3 py-2 font-medium text-slate-500">Unit</th>
                <th className="text-right px-3 py-2 font-medium text-slate-500">Total</th>
                <th className="text-left px-3 py-2 font-medium text-slate-500">Date</th>
                <th className="text-left px-3 py-2 font-medium text-slate-500">Source</th>
                <th className="text-left px-3 py-2 font-medium text-slate-500">Status</th>
                <th className="px-3 py-2"></th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {entries.map(entry => (
                <tr key={entry.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-800">{entry.item_title}</div>
                    {entry.item_description && <div className="text-slate-400 truncate max-w-[180px]">{entry.item_description}</div>}
                  </td>
                  <td className="px-3 py-2 text-slate-600">{entry.supplier_name || '—'}</td>
                  <td className="px-3 py-2 text-slate-600">{entry.document_number || '—'}</td>
                  <td className="px-3 py-2 text-slate-600">{entry.quantity ?? '—'}</td>
                  <td className="px-3 py-2 text-slate-600">{entry.unit || '—'}</td>
                  <td className="px-3 py-2 text-right text-slate-800 font-medium">
                    {entry.total_purchase_price != null ? `€ ${Number(entry.total_purchase_price).toFixed(2)}` : '—'}
                  </td>
                  <td className="px-3 py-2 text-slate-500">
                    {entry.document_date ? moment(entry.document_date).format('DD.MM.YYYY') : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${
                      entry.source_type === 'manual'
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {entry.source_type === 'manual' ? 'manual' : 'import'}
                    </span>
                    </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => handleToggleBillingStatus(entry)}
                      title={entry.billing_status === 'verrechnet' ? 'Zurücksetzen auf offen' : 'Als verrechnet markieren'}
                      className="flex items-center gap-1"
                    >
                      {entry.billing_status === 'verrechnet' ? (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-700">
                          <CheckCircle2 className="h-3 w-3" />
                          verrechnet
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-500">
                          <Circle className="h-3 w-3" />
                          offen
                        </span>
                      )}
                    </button>
                    </td>
                    <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <button onClick={() => setEditingEntry(entry)} className="p-1 text-slate-400 hover:text-blue-600 rounded" title="Bearbeiten">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => handleDelete(entry)} className="p-1 text-slate-400 hover:text-red-600 rounded" title="Löschen">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    </td>
                    </tr>
                    ))}
            </tbody>
          </table>
        </div>
      )}

      {showManual && (
        <ManualMaterialEntryModal
          customers={customers}
          preselectedCustomerId={customerId}
          onClose={() => setShowManual(false)}
          onSaved={() => { setShowManual(false); refetch(); }}
        />
      )}

      {editingEntry && (
        <ManualMaterialEntryModal
          customers={customers}
          entry={editingEntry}
          onClose={() => setEditingEntry(null)}
          onSaved={() => { setEditingEntry(null); refetch(); }}
        />
      )}
    </div>
  );
}