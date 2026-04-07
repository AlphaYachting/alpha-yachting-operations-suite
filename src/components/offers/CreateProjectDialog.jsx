import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Briefcase, Loader2 } from 'lucide-react';

export default function CreateProjectDialog({
  open,
  onOpenChange,
  formData,
  tasks,
  filteredJobs,
  projectStartDate,
  setProjectStartDate,
  convertMode,
  setConvertMode,
  selectedExistingJobId,
  setSelectedExistingJobId,
  saving,
  onConfirm,
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (o) {
          if (!projectStartDate) setProjectStartDate(new Date().toISOString().split('T')[0]);
          setConvertMode('new');
          setSelectedExistingJobId('');
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Angebot in Projekt umwandeln</DialogTitle>
          <DialogDescription>
            Work Orders aus diesem Angebot werden erstellt und einem Projekt zugeordnet.
          </DialogDescription>
        </DialogHeader>

        {/* Mode selection */}
        <div className="flex gap-2 my-3">
          <button
            onClick={() => setConvertMode('new')}
            className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
              convertMode === 'new' ? 'bg-green-600 text-white border-green-700' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            Neues Projekt erstellen
          </button>
          <button
            onClick={() => setConvertMode('existing')}
            className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
              convertMode === 'existing' ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            Zu bestehendem Projekt
          </button>
        </div>

        {convertMode === 'existing' && (
          <div className="space-y-2 mb-3">
            <Label>Bestehendes Projekt auswählen</Label>
            <Select value={selectedExistingJobId} onValueChange={setSelectedExistingJobId}>
              <SelectTrigger>
                <SelectValue placeholder="Projekt auswählen..." />
              </SelectTrigger>
              <SelectContent>
                {filteredJobs.map(j => (
                  <SelectItem key={j.id} value={j.id}>
                    {j.title} {j.job_number ? `(${j.job_number})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {filteredJobs.length === 0 && (
              <p className="text-xs text-amber-600">Keine bestehenden Projekte für diesen Kunden gefunden.</p>
            )}
          </div>
        )}

        <div className="space-y-2 my-2">
          <Label>Projektstart-Datum</Label>
          <Input
            type="date"
            value={projectStartDate}
            onChange={(e) => setProjectStartDate(e.target.value)}
          />
          <p className="text-xs text-slate-500">Wird als geplantes Datum für alle Work Orders verwendet.</p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 my-4">
          <p className="text-sm text-blue-800"><strong>Wird erstellt:</strong></p>
          <ul className="text-sm text-blue-700 mt-2 space-y-1 ml-4 list-disc">
            <li>1 Projekt: <strong>{formData.title}</strong></li>
            <li>1 Organisations-WO mit allen Materialien & Org-Tasks</li>
            {(() => {
              const chapters = [];
              let cur = { title: null, hasLabor: false };
              for (const t of tasks) {
                if (t.item_type === 'Chapter') { if (cur.hasLabor) chapters.push(cur); cur = { title: t.title, hasLabor: false }; }
                else if (t.item_type !== 'Material' && !t.is_optional) cur.hasLabor = true;
              }
              if (cur.hasLabor) chapters.push(cur);
              const hasChapters = chapters.some(c => c.title !== null);
              if (hasChapters) {
                return chapters.filter(c => c.hasLabor).map((c, i) => (
                  <li key={i}>Execution-WO: <strong>{c.title || formData.title}</strong></li>
                ));
              }
              return <li>1 Execution-WO mit allen Arbeitsschritten</li>;
            })()}
            <li className="text-slate-500 italic">Material-Tasks nur in Orga-WO, nicht in Execution-WOs</li>
          </ul>
        </div>

        <div className="flex justify-end gap-3 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={onConfirm}
            disabled={saving || (convertMode === 'existing' && !selectedExistingJobId)}
            className="bg-green-600 hover:bg-green-700"
          >
            {saving ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating...</>
            ) : (
              <><Briefcase className="h-4 w-4 mr-2" />Create Project</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}