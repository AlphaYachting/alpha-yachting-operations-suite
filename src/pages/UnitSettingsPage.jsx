import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Edit, Trash2, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function UnitSettingsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [editingUnit, setEditingUnit] = useState(null);
  const [initLoading, setInitLoading] = useState(false);
  const [formData, setFormData] = useState({
    value: '',
    display: '',
    label: '',
    category: 'Other',
    active: true,
  });

  const { data: units = [] } = useQuery({
    queryKey: ['unitSettings'],
    queryFn: () => base44.entities.UnitSettings.list('-created_date'),
  });

  const { data: offers = [] } = useQuery({
    queryKey: ['offers'],
    queryFn: () => base44.entities.Offer.list(),
  });

  const { data: offerTasks = [] } = useQuery({
    queryKey: ['offerTasks'],
    queryFn: () => base44.entities.OfferTask.list(),
  });

  const usedUnits = new Set(offerTasks.map(t => t.unit_type).filter(Boolean));

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.UnitSettings.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unitSettings'] });
      setShowDialog(false);
      setFormData({ value: '', display: '', label: '', category: 'Other', active: true });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.UnitSettings.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unitSettings'] });
      setShowDialog(false);
      setEditingUnit(null);
      setFormData({ value: '', display: '', label: '', category: 'Other', active: true });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.UnitSettings.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unitSettings'] });
    },
  });

  const handleSave = () => {
    if (!formData.value || !formData.display || !formData.label) {
      alert('Please fill in all required fields');
      return;
    }

    if (editingUnit) {
      updateMutation.mutate({ id: editingUnit.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (unit) => {
    setEditingUnit(unit);
    setFormData(unit);
    setShowDialog(true);
  };

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this unit?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleOpenNew = () => {
    setEditingUnit(null);
    setFormData({ value: '', display: '', label: '', category: 'Other', active: true });
    setShowDialog(true);
  };

  const handleInitializeDefaults = async () => {
    setInitLoading(true);
    try {
      await base44.functions.invoke('initializeDefaultUnits', {});
      queryClient.invalidateQueries({ queryKey: ['unitSettings'] });
    } catch (error) {
      alert('Error initializing units: ' + error.message);
    } finally {
      setInitLoading(false);
    }
  };

  const categories = units.reduce((acc, unit) => {
    if (!acc.includes(unit.category)) {
      acc.push(unit.category);
    }
    return acc;
  }, []).sort();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(createPageUrl('Settings'))}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Unit Settings</h1>
          <p className="text-slate-500 mt-1">Manage measurement units used across the application</p>
        </div>
      </div>

      <Button onClick={handleOpenNew} className="bg-blue-600 hover:bg-blue-700">
        <Plus className="h-4 w-4 mr-2" />
        Add Unit
      </Button>

      {categories.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center space-y-4">
            <p className="text-slate-600">No units defined yet</p>
            <Button 
              onClick={handleInitializeDefaults}
              disabled={initLoading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {initLoading ? 'Initializing...' : 'Initialize Default Units'}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {categories.map((category) => {
            const categoryUnits = units.filter(u => u.category === category);
            return (
              <div key={category}>
                <h2 className="text-lg font-semibold text-slate-900 mb-3">{category}</h2>
                <div className="grid gap-3">
                  {categoryUnits.map((unit) => {
                    const isUsed = usedUnits.has(unit.value);
                    return (
                      <Card key={unit.id} className={!unit.active ? 'opacity-50' : ''}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <div className="font-semibold text-slate-900">{unit.label}</div>
                                {isUsed && (
                                  <Badge className="bg-green-100 text-green-800 flex items-center gap-1 text-xs">
                                    <CheckCircle2 className="h-3 w-3" />
                                    In Use
                                  </Badge>
                                )}
                              </div>
                              <div className="text-sm text-slate-600 mt-1">
                                Value: <code className="bg-slate-100 px-2 py-1 rounded">{unit.value}</code>
                                {' '}Display: <code className="bg-slate-100 px-2 py-1 rounded">{unit.display}</code>
                              </div>
                              {!unit.active && (
                                <div className="text-xs text-amber-600 mt-2">Inactive</div>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEdit(unit)}
                              >
                                <Edit className="h-4 w-4 text-slate-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(unit.id)}
                              >
                                <Trash2 className="h-4 w-4 text-red-600" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
                          </div>
                          );
                          })}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingUnit ? 'Edit Unit' : 'Add New Unit'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Internal Value *</Label>
              <Input
                value={formData.value}
                onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                placeholder="e.g., Hour, Piece"
              />
              <p className="text-xs text-slate-500">Used internally in database and mappings</p>
            </div>
            <div className="space-y-2">
              <Label>Display Format *</Label>
              <Input
                value={formData.display}
                onChange={(e) => setFormData({ ...formData, display: e.target.value })}
                placeholder="e.g., hrs, pcs, m²"
              />
              <p className="text-xs text-slate-500">Short format shown in offers and PDFs</p>
            </div>
            <div className="space-y-2">
              <Label>Full Label *</Label>
              <Input
                value={formData.label}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                placeholder="e.g., Hours, Pieces"
              />
              <p className="text-xs text-slate-500">Descriptive label for user interface</p>
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Time">Time</SelectItem>
                  <SelectItem value="Quantity">Quantity</SelectItem>
                  <SelectItem value="Dimension">Dimension</SelectItem>
                  <SelectItem value="Volume">Volume</SelectItem>
                  <SelectItem value="Weight">Weight</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="active">Active</Label>
              <input
                id="active"
                type="checkbox"
                checked={formData.active}
                onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                className="h-4 w-4"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
              {editingUnit ? 'Update Unit' : 'Add Unit'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}