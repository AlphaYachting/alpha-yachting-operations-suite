import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function LayoutControls({ layout, onLayoutChange, selectedBlock, onSelectBlock }) {
  if (!layout) return null;

  const handleMarginChange = (side, value) => {
    onLayoutChange({
      ...layout,
      margins_mm: { ...layout.margins_mm, [side]: parseFloat(value) || 0 }
    });
  };

  const handleHeaderBlockChange = (blockName, field, value) => {
    const block = layout.header?.blocks?.[blockName] || {};
    onLayoutChange({
      ...layout,
      header: {
        ...layout.header,
        blocks: {
          ...layout.header.blocks,
          [blockName]: { ...block, [field]: parseFloat(value) || 0 }
        }
      }
    });
  };

  const handleTableChange = (field, value) => {
    onLayoutChange({
      ...layout,
      table: { ...layout.table, [field]: parseFloat(value) || 0 }
    });
  };

  const headerBlocks = ['seller', 'buyer', 'meta'];
  const selectedHeaderBlock = selectedBlock && headerBlocks.includes(selectedBlock) ? selectedBlock : null;
  const selectedBlock2 = selectedBlock;

  return (
    <div className="space-y-4 overflow-y-auto max-h-[80vh]">
      {/* Page Format */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Page Format</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs">Format</Label>
            <Select value={layout.page?.format || 'A4'} onValueChange={(v) => onLayoutChange({ ...layout, page: { ...layout.page, format: v } })}>
              <SelectTrigger className="text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="A4">A4</SelectItem>
                <SelectItem value="Letter">Letter</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Margins */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Margins (mm)</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2">
          {['top', 'right', 'bottom', 'left'].map((side) => (
            <div key={side}>
              <Label className="text-xs capitalize">{side}</Label>
              <Input
                type="number"
                min="0"
                max="50"
                value={layout.margins_mm?.[side] || 0}
                onChange={(e) => handleMarginChange(side, e.target.value)}
                className="text-sm"
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Header Height */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Header Height (mm)</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            type="number"
            min="20"
            max="100"
            value={layout.header?.height_mm || 45}
            onChange={(e) => onLayoutChange({ ...layout, header: { ...layout.header, height_mm: parseFloat(e.target.value) } })}
            className="text-sm"
          />
        </CardContent>
      </Card>

      {/* Selected Block Editor */}
      {selectedHeaderBlock && (
        <Card className="border-blue-300 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-sm capitalize">{selectedHeaderBlock} Block</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {['x_mm', 'y_mm', 'w_mm', 'h_mm'].map((field) => (
              <div key={field}>
                <Label className="text-xs">{field.replace('_mm', '')}</Label>
                <Input
                  type="number"
                  min="0"
                  value={layout.header?.blocks?.[selectedHeaderBlock]?.[field] || 0}
                  onChange={(e) => handleHeaderBlockChange(selectedHeaderBlock, field, e.target.value)}
                  className="text-sm"
                />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {selectedBlock2 === 'table' && (
        <Card className="border-purple-300 bg-purple-50">
          <CardHeader>
            <CardTitle className="text-sm">Table Position & Size</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {['x_mm', 'y_mm', 'w_mm'].map((field) => (
              <div key={field}>
                <Label className="text-xs">{field.replace('_mm', '')}</Label>
                <Input
                  type="number"
                  min="0"
                  value={layout.table?.[field] || 0}
                  onChange={(e) => handleTableChange(field, e.target.value)}
                  className="text-sm"
                />
              </div>
            ))}
            <div>
              <Label className="text-xs">Header Height (mm)</Label>
              <Input
                type="number"
                min="4"
                max="20"
                value={layout.table?.header_height_mm || 8}
                onChange={(e) => handleTableChange('header_height_mm', e.target.value)}
                className="text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Row Height (mm)</Label>
              <Input
                type="number"
                min="4"
                max="20"
                value={layout.table?.row_height_mm || 7}
                onChange={(e) => handleTableChange('row_height_mm', e.target.value)}
                className="text-sm"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Footer Height */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Footer Height (mm)</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            type="number"
            min="10"
            max="50"
            value={layout.footer?.height_mm || 20}
            onChange={(e) => onLayoutChange({ ...layout, footer: { ...layout.footer, height_mm: parseFloat(e.target.value) } })}
            className="text-sm"
          />
        </CardContent>
      </Card>

      {/* Quick block selector */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Select Block to Edit</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedBlock || ''} onValueChange={onSelectBlock}>
            <SelectTrigger className="text-sm">
              <SelectValue placeholder="Choose..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="seller">Seller Info</SelectItem>
              <SelectItem value="buyer">Customer Info</SelectItem>
              <SelectItem value="meta">Document Meta</SelectItem>
              <SelectItem value="table">Table</SelectItem>
              <SelectItem value="totals">Totals</SelectItem>
              <SelectItem value="footer">Footer</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>
    </div>
  );
}