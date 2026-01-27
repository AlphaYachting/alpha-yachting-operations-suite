import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;

export default function LayoutValidation({ layout }) {
  if (!layout) return null;

  const margins = layout.margins_mm;
  const usableWidth = A4_WIDTH_MM - margins.left - margins.right;
  const usableHeight = A4_HEIGHT_MM - margins.top - margins.bottom;

  const warnings = [];
  const checks = [];

  // Check margins
  if (margins.top < 5) warnings.push('Top margin is very small (<5mm)');
  if (margins.bottom < 5) warnings.push('Bottom margin is very small (<5mm)');
  if (margins.left < 5) warnings.push('Left margin is very small (<5mm)');
  if (margins.right < 5) warnings.push('Right margin is very small (<5mm)');

  // Check header
  if (layout.header?.height_mm > usableHeight * 0.4) {
    warnings.push('Header height is more than 40% of page - may squeeze content');
  }

  // Check table position
  const tableY = layout.table?.y_mm || 0;
  const tableH = (layout.table?.row_height_mm || 7) * 20; // Estimate ~20 rows
  const footerStart = A4_HEIGHT_MM - (layout.footer?.height_mm || 20);
  
  if (tableY + tableH > footerStart - 10) {
    warnings.push('Table may overlap with footer area');
  }

  // Check table width
  const tableW = layout.table?.w_mm || 0;
  if (tableW > usableWidth) {
    warnings.push('Table width exceeds usable area');
  }

  // Positive checks
  if (warnings.length === 0) {
    checks.push('✓ Layout appears valid');
  }

  return (
    <div className="space-y-4 overflow-y-auto max-h-[80vh]">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Layout Validation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {warnings.length > 0 && (
            <>
              <div className="space-y-2">
                {warnings.map((w, i) => (
                  <Alert key={i} variant="destructive" className="py-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs ml-2">{w}</AlertDescription>
                  </Alert>
                ))}
              </div>
            </>
          )}

          {checks.length > 0 && (
            <div className="space-y-2">
              {checks.map((c, i) => (
                <Alert key={i} className="py-2 border-green-200 bg-green-50">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-xs ml-2 text-green-700">{c}</AlertDescription>
                </Alert>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Layout Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Page Stats</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs">
          <div className="flex justify-between">
            <span>Page size:</span>
            <span className="font-mono">{A4_WIDTH_MM} × {A4_HEIGHT_MM} mm</span>
          </div>
          <div className="flex justify-between">
            <span>Usable area:</span>
            <span className="font-mono">{usableWidth.toFixed(0)} × {usableHeight.toFixed(0)} mm</span>
          </div>
          <div className="flex justify-between">
            <span>Header height:</span>
            <span className="font-mono">{(layout.header?.height_mm || 45).toFixed(0)} mm</span>
          </div>
          <div className="flex justify-between">
            <span>Footer height:</span>
            <span className="font-mono">{(layout.footer?.height_mm || 20).toFixed(0)} mm</span>
          </div>
          <div className="flex justify-between">
            <span>Content height:</span>
            <span className="font-mono">{(usableHeight - (layout.header?.height_mm || 45) - (layout.footer?.height_mm || 20)).toFixed(0)} mm</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}