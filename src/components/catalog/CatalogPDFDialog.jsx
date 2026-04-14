import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Download } from 'lucide-react';
import { generateCatalogOrderPDF } from '@/components/pdf/generateCatalogOrderPDF';

export default function CatalogPDFDialog({ open, onOpenChange, selectedItems, manufacturerName }) {
  const [docType, setDocType] = useState('Bestellung');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const items = Object.values(selectedItems).map(({ item, qty }) => ({ item, qty }));
      const doc = generateCatalogOrderPDF({
        items,
        docType,
        reference,
        note,
        companyName: 'Alpha Yachting',
        manufacturerName,
      });

      const dateStr = new Date().toISOString().slice(0, 10);
      const slug = docType === 'Bestellung' ? 'order' : 'inquiry';
      doc.save(`${slug}-${manufacturerName.replace(/\s+/g, '-').toLowerCase()}-${dateStr}.pdf`);
      onOpenChange(false);
    } finally {
      setGenerating(false);
    }
  };

  const count = Object.keys(selectedItems).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-violet-600" />
            Generate PDF Document
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <div className="p-3 bg-slate-50 rounded-lg border text-sm text-slate-600">
            <strong>{count}</strong> product{count !== 1 ? 's' : ''} selected
            {manufacturerName && <> · <strong>{manufacturerName}</strong></>}
          </div>

          <div className="space-y-2">
            <Label>Document Type</Label>
            <Select value={docType} onValueChange={setDocType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Bestellung">Bestellung (Order)</SelectItem>
                <SelectItem value="Anfrage">Anfrage (Inquiry/RFQ)</SelectItem>
                <SelectItem value="Preisanfrage">Preisanfrage (Price Request)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Internal Reference / Note <span className="text-slate-400 font-normal">(optional)</span></Label>
            <Input
              value={reference}
              onChange={e => setReference(e.target.value)}
              placeholder="e.g. Project ref, PO number..."
            />
          </div>

          <div className="space-y-2">
            <Label>Message to Supplier <span className="text-slate-400 font-normal">(optional)</span></Label>
            <Textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Additional message or instructions..."
              rows={3}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              className="flex-1 bg-violet-600 hover:bg-violet-700"
              onClick={handleGenerate}
              disabled={generating}
            >
              <Download className="h-4 w-4 mr-2" />
              {generating ? 'Generating...' : 'Download PDF'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}