import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';

export default function StandardizeWorkOrders() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleStandardize = async () => {
    if (!window.confirm('This will update all non-standard work order numbers to the format WO00001, WO00002, etc. Continue?')) {
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await base44.functions.invoke('standardizeWorkOrderNumbers', {});
      setResult(response.data);
      toast.success(response.data.message);
    } catch (error) {
      console.error('Error standardizing work orders:', error);
      toast.error('Failed to standardize work order numbers');
      setResult({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to={createPageUrl('Settings')}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Standardize Work Order Numbers</h1>
          <p className="text-slate-500 mt-1">Convert all work orders to WO00001 format</p>
        </div>
      </div>

      <Alert className="border-blue-200 bg-blue-50">
        <AlertCircle className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-900">
          This tool will update all work order numbers to the standardized format: <strong>WO00001</strong>, <strong>WO00002</strong>, etc.
          Work orders will be renumbered sequentially based on their creation date.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Run Standardization</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600">
            This process will:
          </p>
          <ul className="list-disc list-inside space-y-1 text-sm text-slate-600">
            <li>Find all work orders with non-standard numbers (not WO00000 format)</li>
            <li>Assign new sequential numbers starting from the highest existing standard number</li>
            <li>Maintain chronological order based on creation date</li>
            <li>Skip work orders that already have the correct format</li>
          </ul>

          <Button 
            onClick={handleStandardize}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              'Standardize Work Order Numbers'
            )}
          </Button>

          {result && (
            <Alert className={result.error ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}>
              {result.error ? (
                <>
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-900">
                    Error: {result.error}
                  </AlertDescription>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-900">
                    <strong>{result.message}</strong>
                    {result.updates && result.updates.length > 0 && (
                      <div className="mt-3 space-y-1 text-xs">
                        <p className="font-medium">Updated work orders:</p>
                        <div className="max-h-48 overflow-y-auto space-y-0.5">
                          {result.updates.map((update, idx) => (
                            <div key={idx} className="font-mono">
                              {update.old_number || '(no number)'} → {update.new_number}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </AlertDescription>
                </>
              )}
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}