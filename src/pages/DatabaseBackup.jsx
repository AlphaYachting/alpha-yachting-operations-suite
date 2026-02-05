import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { 
  Database, 
  Download, 
  Upload, 
  AlertTriangle,
  CheckCircle2,
  Loader2,
  FileDown,
  Trash2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const ENTITIES = [
  'Customer',
  'Boat',
  'Location',
  'Job',
  'WorkOrder',
  'Task',
  'Technician',
  'InventoryItem',
  'MaterialUsage',
  'TimeEntry',
  'Offer',
  'OfferTask',
  'TeamOrder',
  'Lead',
  'Note',
  'Document',
  'DocumentLineItem',
  'DocumentPayment'
];

export default function DatabaseBackup() {
  const [selectedEntities, setSelectedEntities] = useState(ENTITIES);
  const [backing, setBacking] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [backupResult, setBackupResult] = useState(null);
  const [restoreResult, setRestoreResult] = useState(null);
  const [restoreMode, setRestoreMode] = useState('merge');
  const [backupUrl, setBackupUrl] = useState('');

  const toggleEntity = (entity) => {
    setSelectedEntities(prev =>
      prev.includes(entity)
        ? prev.filter(e => e !== entity)
        : [...prev, entity]
    );
  };

  const selectAll = () => setSelectedEntities(ENTITIES);
  const deselectAll = () => setSelectedEntities([]);

  const handleBackup = async () => {
    if (selectedEntities.length === 0) {
      alert('Please select at least one entity to backup');
      return;
    }

    setBacking(true);
    setBackupResult(null);

    try {
      const { data } = await base44.functions.invoke('createBackup', {
        entities: selectedEntities
      });

      setBackupResult(data);
      
      // Auto-download
      if (data.backup_url) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const a = document.createElement('a');
        a.href = data.backup_url;
        a.download = `database-backup-${timestamp}.json`;
        a.click();
      }
    } catch (error) {
      setBackupResult({ error: error.message });
    } finally {
      setBacking(false);
    }
  };

  const handleRestore = async () => {
    if (!backupUrl) {
      alert('Please enter a backup URL');
      return;
    }

    if (!confirm(`This will ${restoreMode === 'replace' ? 'DELETE ALL existing data and' : ''} restore from backup. Continue?`)) {
      return;
    }

    setRestoring(true);
    setRestoreResult(null);

    try {
      const { data } = await base44.functions.invoke('restoreBackup', {
        backup_url: backupUrl,
        mode: restoreMode
      });

      setRestoreResult(data);
    } catch (error) {
      setRestoreResult({ error: error.message });
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Database Backup & Restore</h1>
        <p className="text-slate-500 mt-1">Create backups and restore your database</p>
      </div>

      {/* Create Backup */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Create Backup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="border-blue-200 bg-blue-50">
            <Database className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              <strong>Tip:</strong> Regular backups protect your data. Download and store backup files securely.
            </AlertDescription>
          </Alert>

          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium">Select entities to backup:</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={selectAll}>
                  Select All
                </Button>
                <Button variant="outline" size="sm" onClick={deselectAll}>
                  Deselect All
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {ENTITIES.map(entity => (
                <label key={entity} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={selectedEntities.includes(entity)}
                    onCheckedChange={() => toggleEntity(entity)}
                  />
                  <span className="text-sm">{entity}</span>
                </label>
              ))}
            </div>
          </div>

          <Button 
            onClick={handleBackup}
            disabled={backing || selectedEntities.length === 0}
            className="w-full"
          >
            {backing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating Backup...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Create Backup ({selectedEntities.length} entities)
              </>
            )}
          </Button>

          {backupResult && (
            <Alert className={backupResult.error ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}>
              {backupResult.error ? (
                <AlertTriangle className="h-4 w-4 text-red-600" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              )}
              <AlertDescription className={backupResult.error ? 'text-red-800' : 'text-green-800'}>
                {backupResult.error ? (
                  <div>
                    <strong>Backup Failed:</strong>
                    <div className="mt-1 text-sm">{backupResult.error}</div>
                  </div>
                ) : (
                  <div>
                    <strong>Backup Created Successfully!</strong>
                    <div className="mt-1 text-sm">
                      {backupResult.entity_count} entities, {backupResult.total_records} total records
                    </div>
                    {backupResult.backup_url && (
                      <div className="mt-2">
                        <a 
                          href={backupResult.backup_url}
                          download
                          className="text-xs underline"
                        >
                          Download backup file
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Restore Backup */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Restore from Backup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="border-amber-200 bg-amber-50">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              <strong>Warning:</strong> Restoring will modify your database. Create a backup first!
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <label className="text-sm font-medium">Backup File URL:</label>
            <input
              type="text"
              value={backupUrl}
              onChange={(e) => setBackupUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Restore Mode:</label>
            <Select value={restoreMode} onValueChange={setRestoreMode}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="merge">
                  Merge (keep existing + add backup data)
                </SelectItem>
                <SelectItem value="replace">
                  Replace (delete existing + restore backup)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button 
            onClick={handleRestore}
            disabled={restoring || !backupUrl}
            className="w-full"
            variant="destructive"
          >
            {restoring ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Restoring...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Restore from Backup
              </>
            )}
          </Button>

          {restoreResult && (
            <Alert className={restoreResult.error ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}>
              {restoreResult.error ? (
                <AlertTriangle className="h-4 w-4 text-red-600" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              )}
              <AlertDescription className={restoreResult.error ? 'text-red-800' : 'text-green-800'}>
                {restoreResult.error ? (
                  <div>
                    <strong>Restore Failed:</strong>
                    <div className="mt-1 text-sm">{restoreResult.error}</div>
                  </div>
                ) : (
                  <div>
                    <strong>Restore Completed!</strong>
                    <div className="mt-2 space-y-1">
                      {Object.entries(restoreResult.results.restored).map(([entity, count]) => (
                        <div key={entity} className="text-sm">
                          {entity}: {count} records
                        </div>
                      ))}
                      {restoreResult.results.errors.length > 0 && (
                        <div className="mt-2 text-red-600 text-sm">
                          <strong>Errors:</strong>
                          {restoreResult.results.errors.map((err, i) => (
                            <div key={i}>{err}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}