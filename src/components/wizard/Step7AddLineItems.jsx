import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useWizard } from './WizardContext';
import { WizardAlert } from './WizardAlert';
import { Plus, Trash2 } from 'lucide-react';

export function Step7AddLineItems() {
  const { wizardData, updateWizardData, setStep } = useWizard();
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [newItem, setNewItem] = useState({
    title: '',
    description: '',
    unit_type: 'Hour',
    quantity: 1,
    unit_price: 0,
    is_optional: false
  });

  const handleAddLineItem = () => {
    if (!newItem.title) {
      setAlertMessage('Line item title is required');
      setAlertOpen(true);
      return;
    }
    if (newItem.quantity <= 0 || newItem.unit_price < 0) {
      setAlertMessage('Quantity must be > 0 and price must be >= 0');
      setAlertOpen(true);
      return;
    }

    updateWizardData('offer.lineItems', [
      ...wizardData.offer.lineItems,
      { ...newItem, id: Date.now() }
    ]);

    setNewItem({
      title: '',
      description: '',
      unit_type: 'Hour',
      quantity: 1,
      unit_price: 0,
      is_optional: false
    });
  };

  const handleRemoveLineItem = (id) => {
    updateWizardData('offer.lineItems', wizardData.offer.lineItems.filter(item => item.id !== id));
  };

  const totalAmount = wizardData.offer.lineItems
    .filter(item => !item.is_optional)
    .reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);

  const handleNext = () => {
    setStep(8);
  };

  return (
    <div className="space-y-6">
      <WizardAlert open={alertOpen} onOpenChange={setAlertOpen} message={alertMessage} />
      <Card>
        <CardHeader>
          <CardTitle>Add Line Items to Offer</CardTitle>
          <p className="text-sm text-slate-500 mt-2">Services and parts included in this offer</p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Existing Line Items */}
          {wizardData.offer.lineItems.length > 0 && (
            <div className="space-y-3">
              {wizardData.offer.lineItems.map((item) => {
                const itemTotal = item.quantity * item.unit_price;
                return (
                  <div key={item.id} className="p-3 border rounded bg-slate-50 flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900">{item.title}</p>
                      {item.description && <p className="text-sm text-slate-600">{item.description}</p>}
                      <div className="flex gap-4 mt-2 text-sm text-slate-600">
                        <span>{item.quantity} × {item.unit_price.toFixed(2)} {item.unit_type}</span>
                        <span className="font-medium">€{itemTotal.toFixed(2)}</span>
                        {item.is_optional && <span className="text-amber-600">(Optional)</span>}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveLineItem(item.id)}
                      className="text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Total */}
          {wizardData.offer.lineItems.length > 0 && (
            <div className="p-3 bg-blue-50 rounded border border-blue-200">
              <div className="flex justify-between items-center">
                <span className="font-medium text-slate-900">Offer Total (before VAT)</span>
                <span className="text-lg font-bold text-blue-600">€{totalAmount.toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* Add New Item Form */}
          <div className="border-t pt-6">
            <p className="font-medium text-slate-900 mb-4">Add New Line Item</p>
            <div className="space-y-4">
              <div>
                <Label>Title *</Label>
                <Input
                  value={newItem.title}
                  onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
                  placeholder="e.g., Engine Oil Change"
                />
              </div>

              <div>
                <Label>Description</Label>
                <Input
                  value={newItem.description}
                  onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                  placeholder="Optional details"
                />
              </div>

              <div className="grid grid-cols-4 gap-3">
                <div>
                  <Label>Unit</Label>
                  <Select
                    value={newItem.unit_type}
                    onValueChange={(value) => setNewItem({ ...newItem, unit_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Hour">Hour</SelectItem>
                      <SelectItem value="Piece">Piece</SelectItem>
                      <SelectItem value="Square Meter">Sq. Meter</SelectItem>
                      <SelectItem value="Liter">Liter</SelectItem>
                      <SelectItem value="Kilogram">Kg</SelectItem>
                      <SelectItem value="Lump Sum">Lump Sum</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Qty</Label>
                  <Input
                    type="number"
                    value={newItem.quantity}
                    onChange={(e) => setNewItem({ ...newItem, quantity: parseFloat(e.target.value) || 0 })}
                    min="0"
                    step="0.5"
                  />
                </div>

                <div>
                  <Label>Price</Label>
                  <Input
                    type="number"
                    value={newItem.unit_price}
                    onChange={(e) => setNewItem({ ...newItem, unit_price: parseFloat(e.target.value) || 0 })}
                    min="0"
                    step="1"
                    placeholder="0.00"
                  />
                </div>

                <div className="flex items-end">
                  <div className="w-full">
                    <p className="text-xs text-slate-500 mb-2">Total</p>
                    <p className="font-medium">€{(newItem.quantity * newItem.unit_price).toFixed(2)}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="optional"
                  checked={newItem.is_optional}
                  onChange={(e) => setNewItem({ ...newItem, is_optional: e.target.checked })}
                  className="rounded"
                />
                <Label htmlFor="optional" className="font-normal cursor-pointer">
                  Optional (shown in offer but not included in total)
                </Label>
              </div>

              <Button
                onClick={handleAddLineItem}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Line Item
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between gap-2">
        <Button variant="outline" onClick={() => setStep(6)}>
          ← Back
        </Button>
        <Button onClick={handleNext} className="bg-blue-600 hover:bg-blue-700">
          Next →
        </Button>
      </div>
    </div>
  );
}