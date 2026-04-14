import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, Plus, CheckCircle2, AlertCircle, Loader2, Package, History } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';

export default function ProductCatalogImport() {
  const [manufacturers, setManufacturers] = useState([]);
  const [imports, setImports] = useState([]);
  const [selectedManufacturerId, setSelectedManufacturerId] = useState('');
  const [newMfgName, setNewMfgName] = useState('');
  const [newMfgCode, setNewMfgCode] = useState('');
  const [showNewMfg, setShowNewMfg] = useState(false);
  const [importing, setImporting] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [file, setFile] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [mfgs, imps] = await Promise.all([
      base44.entities.Manufacturer.list(),
      base44.entities.ProductCatalogImport.list('-created_date', 20),
    ]);
    setManufacturers(mfgs);
    setImports(imps);
  };

  const handleCreateManufacturer = async () => {
    if (!newMfgName.trim()) { toast.error('Name required'); return; }
    const mfg = await base44.entities.Manufacturer.create({
      name: newMfgName.trim(),
      code: newMfgCode.trim().toUpperCase() || newMfgName.trim().toUpperCase().slice(0, 10),
      active: true,
    });
    toast.success(`Manufacturer "${mfg.name}" created`);
    setNewMfgName('');
    setNewMfgCode('');
    setShowNewMfg(false);
    setSelectedManufacturerId(mfg.id);
    await loadData();
  };

  const handleImport = async () => {
    if (!file) { toast.error('Please select an Excel file'); return; }
    if (!selectedManufacturerId) { toast.error('Please select a manufacturer'); return; }

    setImporting(true);
    setLastResult(null);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const res = await base44.functions.invoke('importProductCatalog', {
        file_url,
        manufacturer_id: selectedManufacturerId,
        file_name: file.name,
      });
      setLastResult(res.data);
      toast.success(`Import complete: ${res.data.created} created, ${res.data.updated} updated`);
      setFile(null);
      await loadData();
    } catch (err) {
      toast.error('Import failed: ' + (err.message || 'Unknown error'));
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-100 rounded-lg">
          <Package className="h-6 w-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Product Catalog Import</h1>
          <p className="text-slate-500 text-sm">Import manufacturer price lists from Excel</p>
        </div>
      </div>

      {/* Manufacturer Management */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Manufacturers</CardTitle>
            <Button size="sm" variant="outline" onClick={() => setShowNewMfg(v => !v)}>
              <Plus className="h-4 w-4 mr-1" />
              Add Manufacturer
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {showNewMfg && (
            <div className="p-4 bg-slate-50 rounded-lg border space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Name *</Label>
                  <Input value={newMfgName} onChange={e => setNewMfgName(e.target.value)} placeholder="e.g. Victron Energy" />
                </div>
                <div>
                  <Label>Code (optional)</Label>
                  <Input value={newMfgCode} onChange={e => setNewMfgCode(e.target.value)} placeholder="e.g. VICTRON" />
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleCreateManufacturer}>Create</Button>
                <Button size="sm" variant="outline" onClick={() => setShowNewMfg(false)}>Cancel</Button>
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {manufacturers.map(m => (
              <Badge
                key={m.id}
                variant={selectedManufacturerId === m.id ? 'default' : 'outline'}
                className="cursor-pointer px-3 py-1 text-sm"
                onClick={() => setSelectedManufacturerId(m.id)}
              >
                {m.name}
              </Badge>
            ))}
            {manufacturers.length === 0 && (
              <p className="text-sm text-slate-500">No manufacturers yet. Add one above.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Import */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Import Excel File</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="bg-blue-50 border-blue-200">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-sm text-blue-800">
              <strong>Expected columns (Victron format):</strong> Produktcode, Name, Bruttobetrag, USt (%), Nettobetrag, Einkaufspreis, KPD.
              Other column names are auto-detected. Re-importing updates existing products without affecting existing offer line items.
            </AlertDescription>
          </Alert>

          <div>
            <Label>Select Manufacturer</Label>
            <Select value={selectedManufacturerId} onValueChange={setSelectedManufacturerId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose manufacturer..." />
              </SelectTrigger>
              <SelectContent>
                {manufacturers.map(m => (
                  <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Excel File (.xlsx / .xls)</Label>
            <Input
              type="file"
              accept=".xlsx,.xls"
              onChange={e => setFile(e.target.files?.[0] || null)}
            />
          </div>

          {file && (
            <p className="text-sm text-slate-600">Selected: <strong>{file.name}</strong> ({(file.size / 1024).toFixed(1)} KB)</p>
          )}

          <Button
            onClick={handleImport}
            disabled={importing || !file || !selectedManufacturerId}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            {importing ? 'Importing...' : 'Start Import'}
          </Button>

          {lastResult && (
            <div className={`p-4 rounded-lg border ${lastResult.success ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-center gap-2 mb-2">
                {lastResult.success
                  ? <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  : <AlertCircle className="h-5 w-5 text-red-600" />}
                <span className="font-semibold">{lastResult.success ? 'Import Successful' : 'Import Failed'}</span>
              </div>
              {lastResult.success && (
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div className="bg-white rounded p-2 text-center border">
                    <p className="text-2xl font-bold text-emerald-600">{lastResult.created}</p>
                    <p className="text-slate-500">Created</p>
                  </div>
                  <div className="bg-white rounded p-2 text-center border">
                    <p className="text-2xl font-bold text-blue-600">{lastResult.updated}</p>
                    <p className="text-slate-500">Updated</p>
                  </div>
                  <div className="bg-white rounded p-2 text-center border">
                    <p className="text-2xl font-bold text-slate-400">{lastResult.skipped}</p>
                    <p className="text-slate-500">Skipped</p>
                  </div>
                </div>
              )}
              {lastResult.errors?.length > 0 && (
                <div className="mt-3">
                  <p className="text-sm font-medium text-red-700 mb-1">Row errors ({lastResult.errors.length}):</p>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {lastResult.errors.map((e, i) => (
                      <p key={i} className="text-xs text-red-600">Row {e.row}: {e.reason} {e.product_code ? `(${e.product_code})` : ''}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Import History */}
      {imports.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-slate-500" />
              <CardTitle className="text-lg">Import History</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {imports.map(imp => {
                const mfg = manufacturers.find(m => m.id === imp.manufacturer_id);
                return (
                  <div key={imp.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
                    <div>
                      <p className="font-medium text-sm">{imp.file_name}</p>
                      <p className="text-xs text-slate-500">
                        {mfg?.name || 'Unknown'} · {imp.imported_by} ·{' '}
                        {imp.created_date ? format(parseISO(imp.created_date), 'dd.MM.yyyy HH:mm') : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-600">
                      <span className="text-emerald-600 font-medium">+{imp.created_count}</span>
                      <span className="text-blue-600 font-medium">↑{imp.updated_count}</span>
                      <span className="text-slate-400">={imp.skipped_count}</span>
                      <Badge className={imp.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : imp.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}>
                        {imp.status}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}