import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Trash2, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';

export default function AdminCleanup() {
  const [cleaning, setCleaning] = useState(false);
  const [result, setResult] = useState(null);

  const runCleanup = async () => {
    if (!confirm('This will delete all orphaned WorkOrders and Tasks. Continue?')) {
      return;
    }

    setCleaning(true);
    setResult(null);

    try {
      const response = await base44.functions.invoke('cleanupOrphanedWorkOrders', {});
      setResult(response.data);
    } catch (error) {
      setResult({ success: false, error: error.message });
    } finally {
      setCleaning(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Database Cleanup</h1>
        <p className="text-slate-500 mt-1">Remove orphaned records</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-red-600" />
            Cleanup Orphaned Records
          </CardTitle>
          <CardDescription>
            Remove WorkOrders and Tasks that reference deleted Jobs
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="bg-amber-50 border-amber-200">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              <strong>Warning:</strong> This will permanently delete:
              <ul className="list-disc ml-5 mt-2 space-y-1">
                <li>WorkOrders referencing non-existent Jobs</li>
                <li>Tasks referencing non-existent WorkOrders</li>
                <li>Tasks directly referencing non-existent Jobs</li>
              </ul>
            </AlertDescription>
          </Alert>

          <Button 
            onClick={runCleanup} 
            disabled={cleaning}
            className="w-full bg-red-600 hover:bg-red-700"
          >
            {cleaning ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Cleaning up...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Run Cleanup
              </>
            )}
          </Button>

          {result && (
            <Alert className={result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}>
              {result.success ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    <strong>Cleanup Complete</strong>
                    <div className="mt-2 space-y-1">
                      <div>Work Orders deleted: {result.deleted.work_orders}</div>
                      <div>Tasks deleted: {result.deleted.tasks}</div>
                    </div>
                    <p className="mt-2 text-sm">{result.message}</p>
                  </AlertDescription>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800">
                    <strong>Error:</strong> {result.error}
                  </AlertDescription>
                </>
              )}
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Verification Checklist</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
              <div>
                <strong>After cleanup:</strong>
                <ul className="list-disc ml-5 mt-1 space-y-1 text-slate-600">
                  <li>Go to Projects page - should see no "references non-existent project" errors</li>
                  <li>Go to WorkOrders page - all work orders should have valid job references</li>
                  <li>Check browser console for any "job not found" errors</li>
                </ul>
              </div>
            </div>
            
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
              <div>
                <strong>Test cascade delete:</strong>
                <ul className="list-disc ml-5 mt-1 space-y-1 text-slate-600">
                  <li>Create a test Job → WorkOrder → Tasks</li>
                  <li>Delete the Job from Projects page</li>
                  <li>Verify WorkOrder and Tasks are also deleted</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}