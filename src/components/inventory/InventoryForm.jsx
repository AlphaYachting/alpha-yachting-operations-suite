import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const CATEGORIES = [
  'Engine Parts',
  'Electrical',
  'Electronics',
  'Plumbing',
  'Rigging',
  'Deck Hardware',
  'Safety Equipment',
  'Consumables',
  'Sealants/Adhesives',
  'Filters',
  'Belts/Hoses',
  'Fasteners',
  'Paint/Gelcoat',
  'HVAC',
  'Tools',
  'Other'
];

export default function InventoryForm({ item, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    sku: item?.sku || '',
    name: item?.name || '',
    description: item?.description || '',
    category: item?.category || 'Other',
    manufacturer: item?.manufacturer || '',
    manufacturer_part_number: item?.manufacturer_part_number || '',
    supplier: item?.supplier || '',
    supplier_part_number: item?.supplier_part_number || '',
    unit: item?.unit || 'Piece',
    unit_cost: item?.unit_cost || '',
    markup_percent: item?.markup_percent || 30,
    sales_price: item?.sales_price || '',
    stock_novigrad: item?.stock_novigrad || 0,
    stock_van_1: item?.stock_van_1 || 0,
    stock_van_2: item?.stock_van_2 || 0,
    min_stock_level: item?.min_stock_level || 1,
    reorder_quantity: item?.reorder_quantity || '',
    lead_time_days: item?.lead_time_days || '',
    serial_number_required: item?.serial_number_required || false,
    location_in_warehouse: item?.location_in_warehouse || '',
    notes: item?.notes || '',
    status: item?.status || 'Active'
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await onSave(formData);
    setSaving(false);
  };

  const updateField = (field, value) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      // Auto-calculate sales price when cost or markup changes
      if ((field === 'unit_cost' || field === 'markup_percent') && updated.unit_cost) {
        const cost = parseFloat(updated.unit_cost) || 0;
        const markup = parseFloat(updated.markup_percent) || 0;
        updated.sales_price = cost * (1 + markup / 100);
      }
      return updated;
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Item Name *</Label>
          <Input
            value={formData.name}
            onChange={(e) => updateField('name', e.target.value)}
            placeholder="Item name"
            required
          />
        </div>
        <div className="space-y-2">
          <Label>SKU</Label>
          <Input
            value={formData.sku}
            onChange={(e) => updateField('sku', e.target.value)}
            placeholder="Internal SKU"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Category</Label>
          <Select value={formData.category} onValueChange={(v) => updateField('category', v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Unit</Label>
          <Select value={formData.unit} onValueChange={(v) => updateField('unit', v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Piece">Piece</SelectItem>
              <SelectItem value="Meter">Meter</SelectItem>
              <SelectItem value="Liter">Liter</SelectItem>
              <SelectItem value="Kg">Kg</SelectItem>
              <SelectItem value="Set">Set</SelectItem>
              <SelectItem value="Box">Box</SelectItem>
              <SelectItem value="Roll">Roll</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea
          value={formData.description}
          onChange={(e) => updateField('description', e.target.value)}
          placeholder="Item description..."
          rows={2}
        />
      </div>

      {/* Manufacturer & Supplier */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Manufacturer</Label>
          <Input
            value={formData.manufacturer}
            onChange={(e) => updateField('manufacturer', e.target.value)}
            placeholder="Brand/manufacturer"
          />
        </div>
        <div className="space-y-2">
          <Label>Manufacturer Part #</Label>
          <Input
            value={formData.manufacturer_part_number}
            onChange={(e) => updateField('manufacturer_part_number', e.target.value)}
            placeholder="Part number"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Supplier</Label>
          <Input
            value={formData.supplier}
            onChange={(e) => updateField('supplier', e.target.value)}
            placeholder="Supplier name"
          />
        </div>
        <div className="space-y-2">
          <Label>Supplier Part #</Label>
          <Input
            value={formData.supplier_part_number}
            onChange={(e) => updateField('supplier_part_number', e.target.value)}
            placeholder="Supplier part number"
          />
        </div>
      </div>

      {/* Pricing */}
      <div className="space-y-4">
        <h3 className="font-medium text-slate-900">Pricing</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Unit Cost (€)</Label>
            <Input
              type="number"
              step="0.01"
              value={formData.unit_cost}
              onChange={(e) => updateField('unit_cost', parseFloat(e.target.value) || '')}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-2">
            <Label>Markup (%)</Label>
            <Input
              type="number"
              value={formData.markup_percent}
              onChange={(e) => updateField('markup_percent', parseFloat(e.target.value) || '')}
              placeholder="30"
            />
          </div>
          <div className="space-y-2">
            <Label>Sales Price (€)</Label>
            <Input
              type="number"
              step="0.01"
              value={formData.sales_price}
              onChange={(e) => updateField('sales_price', parseFloat(e.target.value) || '')}
              placeholder="0.00"
            />
          </div>
        </div>
      </div>

      {/* Stock Levels */}
      <div className="space-y-4">
        <h3 className="font-medium text-slate-900">Stock Levels</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label>Novigrad Base</Label>
            <Input
              type="number"
              value={formData.stock_novigrad}
              onChange={(e) => updateField('stock_novigrad', parseInt(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-2">
            <Label>Van 1</Label>
            <Input
              type="number"
              value={formData.stock_van_1}
              onChange={(e) => updateField('stock_van_1', parseInt(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-2">
            <Label>Van 2</Label>
            <Input
              type="number"
              value={formData.stock_van_2}
              onChange={(e) => updateField('stock_van_2', parseInt(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-2">
            <Label>Min Stock Level</Label>
            <Input
              type="number"
              value={formData.min_stock_level}
              onChange={(e) => updateField('min_stock_level', parseInt(e.target.value) || 1)}
            />
          </div>
        </div>
      </div>

      {/* Reorder */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Reorder Quantity</Label>
          <Input
            type="number"
            value={formData.reorder_quantity}
            onChange={(e) => updateField('reorder_quantity', parseInt(e.target.value) || '')}
            placeholder="0"
          />
        </div>
        <div className="space-y-2">
          <Label>Lead Time (days)</Label>
          <Input
            type="number"
            value={formData.lead_time_days}
            onChange={(e) => updateField('lead_time_days', parseInt(e.target.value) || '')}
            placeholder="0"
          />
        </div>
        <div className="space-y-2">
          <Label>Warehouse Location</Label>
          <Input
            value={formData.location_in_warehouse}
            onChange={(e) => updateField('location_in_warehouse', e.target.value)}
            placeholder="e.g., Shelf A-3"
          />
        </div>
      </div>

      {/* Options */}
      <div className="flex items-center justify-between">
        <div>
          <Label>Serial Number Required</Label>
          <p className="text-sm text-slate-500">Track individual serial numbers</p>
        </div>
        <Switch
          checked={formData.serial_number_required}
          onCheckedChange={(v) => updateField('serial_number_required', v)}
        />
      </div>

      {/* Status */}
      <div className="space-y-2">
        <Label>Status</Label>
        <Select value={formData.status} onValueChange={(v) => updateField('status', v)}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Active">Active</SelectItem>
            <SelectItem value="Discontinued">Discontinued</SelectItem>
            <SelectItem value="Out of Stock">Out of Stock</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label>Notes</Label>
        <Textarea
          value={formData.notes}
          onChange={(e) => updateField('notes', e.target.value)}
          placeholder="Additional notes..."
          rows={2}
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700">
          {saving ? 'Saving...' : (item ? 'Update Item' : 'Add Item')}
        </Button>
      </div>
    </form>
  );
}