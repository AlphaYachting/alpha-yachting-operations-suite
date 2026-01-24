import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, GripVertical, Plus } from 'lucide-react';
import ReactQuill from 'react-quill';

export default function LineItemsTable({ lineItems, onChange, isLocked, currency }) {
  const calculateLineTotals = (item) => {
    const subtotal = (item.quantity || 0) * (item.unit_price || 0);
    const discounted = subtotal * (1 - (item.discount_percent || 0) / 100);
    const totalNet = discounted;
    const totalTax = totalNet * ((item.tax_rate || 0) / 100);
    const totalGross = totalNet + totalTax;
    
    return { total_net: totalNet, total_tax: totalTax, total_gross: totalGross };
  };

  const updateLineItem = (index, updates) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], ...updates };
    
    // Recalculate totals
    const totals = calculateLineTotals(updated[index]);
    updated[index] = { ...updated[index], ...totals };
    
    onChange(updated);
  };

  const addLineItem = () => {
    const newItem = {
      line_type: 'Labor',
      title: '',
      description: '',
      quantity: 1,
      unit: 'hrs',
      unit_price: 0,
      tax_rate: 20,
      discount_percent: 0,
      sort_order: lineItems.length,
      show_on_pdf: true,
      total_net: 0,
      total_tax: 0,
      total_gross: 0
    };
    onChange([...lineItems, newItem]);
  };

  const removeLineItem = (index) => {
    const updated = lineItems.filter((_, i) => i !== index);
    onChange(updated);
  };

  const moveLineItem = (index, direction) => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === lineItems.length - 1) return;
    
    const updated = [...lineItems];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    
    // Update sort orders
    updated.forEach((item, i) => item.sort_order = i);
    onChange(updated);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Line Items</CardTitle>
        {!isLocked && (
          <Button onClick={addLineItem} size="sm" variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Add Line
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {lineItems.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <p>No line items yet</p>
              <Button onClick={addLineItem} variant="outline" className="mt-4">
                Add First Line Item
              </Button>
            </div>
          ) : (
            lineItems.map((item, index) => (
              <div key={index} className="border rounded-lg p-4 space-y-3 bg-slate-50">
                <div className="flex items-start gap-3">
                  {!isLocked && (
                    <div className="flex flex-col gap-1 pt-7">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => moveLineItem(index, 'up')}
                        disabled={index === 0}
                      >
                        ▲
                      </Button>
                      <GripVertical className="h-4 w-4 text-slate-400" />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => moveLineItem(index, 'down')}
                        disabled={index === lineItems.length - 1}
                      >
                        ▼
                      </Button>
                    </div>
                  )}
                  
                  <div className="flex-1 space-y-3">
                    {/* Row 1: Type, Title */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div>
                        <Select
                          value={item.line_type}
                          onValueChange={(value) => updateLineItem(index, { line_type: value })}
                          disabled={isLocked}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Labor">Labor</SelectItem>
                            <SelectItem value="Travel">Travel</SelectItem>
                            <SelectItem value="Material">Material</SelectItem>
                            <SelectItem value="FlatFee">Flat Fee</SelectItem>
                            <SelectItem value="Discount">Discount</SelectItem>
                            <SelectItem value="Note">Note</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="md:col-span-3">
                        <Input
                          placeholder="Title *"
                          value={item.title || ''}
                          onChange={(e) => updateLineItem(index, { title: e.target.value })}
                          disabled={isLocked}
                        />
                      </div>
                    </div>

                    {/* Row 2: Description */}
                    <div>
                      <ReactQuill
                        value={item.description || ''}
                        onChange={(value) => updateLineItem(index, { description: value })}
                        readOnly={isLocked}
                        theme="snow"
                        modules={{
                          toolbar: [
                            ['bold', 'italic', 'underline'],
                            [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                            ['clean']
                          ]
                        }}
                        placeholder="Description"
                        className="bg-white rounded-md"
                      />
                    </div>

                    {/* Row 3: Quantity, Unit, Price, Tax, Discount */}
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                      <div>
                        <Input
                          type="number"
                          placeholder="Qty"
                          value={item.quantity || 0}
                          onChange={(e) => updateLineItem(index, { quantity: parseFloat(e.target.value) || 0 })}
                          disabled={isLocked}
                          step="0.01"
                        />
                      </div>
                      <div>
                        <Select
                          value={item.unit}
                          onValueChange={(value) => updateLineItem(index, { unit: value })}
                          disabled={isLocked}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="hrs">hrs</SelectItem>
                            <SelectItem value="pcs">pcs</SelectItem>
                            <SelectItem value="km">km</SelectItem>
                            <SelectItem value="m">m</SelectItem>
                            <SelectItem value="set">set</SelectItem>
                            <SelectItem value="job">job</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Input
                          type="number"
                          placeholder="Unit Price"
                          value={item.unit_price || 0}
                          onChange={(e) => updateLineItem(index, { unit_price: parseFloat(e.target.value) || 0 })}
                          disabled={isLocked}
                          step="0.01"
                        />
                      </div>
                      <div>
                        <Input
                          type="number"
                          placeholder="Tax %"
                          value={item.tax_rate || 0}
                          onChange={(e) => updateLineItem(index, { tax_rate: parseFloat(e.target.value) || 0 })}
                          disabled={isLocked}
                          step="0.1"
                        />
                      </div>
                      <div>
                        <Input
                          type="number"
                          placeholder="Disc %"
                          value={item.discount_percent || 0}
                          onChange={(e) => updateLineItem(index, { discount_percent: parseFloat(e.target.value) || 0 })}
                          disabled={isLocked}
                          step="0.1"
                        />
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-sm font-semibold">
                          {currency === 'EUR' ? '€' : currency === 'USD' ? '$' : '£'}
                          {(item.total_gross || 0).toFixed(2)}
                        </span>
                        {!isLocked && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeLineItem(index)}
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* References */}
                    {(item.job_id || item.task_id) && (
                      <div className="text-xs text-slate-500">
                        📎 Linked: {item.job_id ? `Job ${item.job_id.slice(0, 8)}` : ''} 
                        {item.task_id ? ` • Task ${item.task_id.slice(0, 8)}` : ''}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}