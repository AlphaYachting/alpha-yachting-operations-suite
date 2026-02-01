import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, ArrowRight } from 'lucide-react';

export default function PreviewStep({ data = [], headers = [], onNext, onBack }) {
  const previewData = (data || []).slice(0, 20);

  if (!headers || headers.length === 0) {
    return <div className="p-4 text-slate-600">No data to preview. Please upload a file first.</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 2: Preview Data</CardTitle>
        <CardDescription>
          Showing first 20 rows of {(data || []).length} total rows. {headers.length} columns detected.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto max-h-96">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                {headers.slice(0, 8).map((header, idx) => (
                  <TableHead key={idx} className="min-w-32">{header}</TableHead>
                ))}
                {headers.length > 8 && (
                  <TableHead>...+{headers.length - 8} more</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {previewData.map((row, idx) => (
                <TableRow key={idx}>
                  <TableCell className="font-medium">{idx + 1}</TableCell>
                  {headers.slice(0, 8).map((header, hIdx) => (
                    <TableCell key={hIdx} className="text-xs">
                      {String(row[header] || '').substring(0, 50)}
                      {String(row[header] || '').length > 50 && '...'}
                    </TableCell>
                  ))}
                  {headers.length > 8 && <TableCell>...</TableCell>}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex justify-between mt-6">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <Button onClick={onNext}>
            Next: Column Mapping
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}