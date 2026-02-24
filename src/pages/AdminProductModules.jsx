import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit2, Trash2, Save, X, GripVertical } from 'lucide-react';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function AdminProductModules() {
    const queryClient = useQueryClient();
    const [editingModule, setEditingModule] = useState(null);
    const [showModuleDialog, setShowModuleDialog] = useState(false);
    
    const { data: modules } = useQuery({
        queryKey: ['ProductModule'],
        queryFn: () => base44.entities.ProductModule.list()
    });

    const { data: rateCardItems } = useQuery({
        queryKey: ['RateCardItem_All'],
        queryFn: () => base44.entities.RateCardItem.list()
    });

    const saveModuleMutation = useMutation({
        mutationFn: (data) => data.id ? base44.entities.ProductModule.update(data.id, data) : base44.entities.ProductModule.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries(['ProductModule']);
            setShowModuleDialog(false);
            setEditingModule(null);
            toast.success('Module saved');
        }
    });

    const deleteModuleMutation = useMutation({
        mutationFn: (id) => base44.entities.ProductModule.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries(['ProductModule']);
            toast.success('Module deleted');
        }
    });

    const handleNewModule = () => {
        setEditingModule({
            name: '',
            module_group: 'TECH',
            description_short: '',
            description_long: '',
            bullets_json: [],
            terms_json: [],
            is_active: true,
            display_order: 0,
            ui_default_selected: false,
            requires_storage: true
        });
        setShowModuleDialog(true);
    };

    const handleEditModule = (module) => {
        setEditingModule({...module});
        setShowModuleDialog(true);
    };

    const groupedModules = modules?.reduce((acc, m) => {
        if (!acc[m.module_group]) acc[m.module_group] = [];
        acc[m.module_group].push(m);
        return acc;
    }, {}) || {};

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold">Product Modules</h1>
                    <p className="text-slate-500">Manage configurable service packages</p>
                </div>
                <Button onClick={handleNewModule}>
                    <Plus className="w-4 h-4 mr-2" /> New Module
                </Button>
            </div>

            <Tabs defaultValue="TECH">
                <TabsList>
                    <TabsTrigger value="TECH">Tech Modules</TabsTrigger>
                    <TabsTrigger value="CARE">Care Modules</TabsTrigger>
                    <TabsTrigger value="PREMIUM">Premium</TabsTrigger>
                    <TabsTrigger value="ADDON">Add-ons</TabsTrigger>
                </TabsList>

                {['TECH', 'CARE', 'PREMIUM', 'ADDON'].map(group => (
                    <TabsContent key={group} value={group}>
                        <div className="grid gap-4">
                            {groupedModules[group]?.map(module => (
                                <Card key={module.id}>
                                    <CardHeader className="flex flex-row items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <GripVertical className="w-4 h-4 text-slate-400" />
                                            <div>
                                                <CardTitle className="text-lg">{module.name}</CardTitle>
                                                <div className="flex gap-2 mt-1">
                                                    <Badge variant={module.is_active ? 'default' : 'secondary'}>
                                                        {module.is_active ? 'Active' : 'Inactive'}
                                                    </Badge>
                                                    <Badge variant="outline">Order: {module.display_order}</Badge>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button variant="ghost" size="icon" onClick={() => handleEditModule(module)}>
                                                <Edit2 className="w-4 h-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="text-red-500" onClick={() => deleteModuleMutation.mutate(module.id)}>
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-sm text-slate-600 mb-2">{module.description_short}</p>
                                        {module.bullets_json?.length > 0 && (
                                            <ul className="text-sm text-slate-500 space-y-1">
                                                {module.bullets_json.map((bullet, idx) => (
                                                    <li key={idx}>• {bullet}</li>
                                                ))}
                                            </ul>
                                        )}
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </TabsContent>
                ))}
            </Tabs>

            {/* Module Edit Dialog */}
            <Dialog open={showModuleDialog} onOpenChange={setShowModuleDialog}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingModule?.id ? 'Edit Module' : 'New Module'}</DialogTitle>
                    </DialogHeader>
                    {editingModule && (
                        <ModuleEditor
                            module={editingModule}
                            rateCardItems={rateCardItems}
                            onSave={(data) => saveModuleMutation.mutate(data)}
                            onCancel={() => setShowModuleDialog(false)}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

function ModuleEditor({ module, rateCardItems, onSave, onCancel }) {
    const [formData, setFormData] = useState(module);
    const [newBullet, setNewBullet] = useState('');

    const addBullet = () => {
        if (!newBullet.trim()) return;
        setFormData({
            ...formData,
            bullets_json: [...(formData.bullets_json || []), newBullet]
        });
        setNewBullet('');
    };

    const removeBullet = (idx) => {
        setFormData({
            ...formData,
            bullets_json: formData.bullets_json.filter((_, i) => i !== idx)
        });
    };

    return (
        <div className="space-y-4">
            <div>
                <label className="text-sm font-medium mb-1 block">Name</label>
                <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
            </div>

            <div>
                <label className="text-sm font-medium mb-1 block">Module Group</label>
                <Select value={formData.module_group} onValueChange={v => setFormData({...formData, module_group: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="TECH">Tech</SelectItem>
                        <SelectItem value="CARE">Care</SelectItem>
                        <SelectItem value="PREMIUM">Premium</SelectItem>
                        <SelectItem value="ADDON">Add-on</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="text-sm font-medium mb-1 block">Display Order</label>
                    <Input type="number" value={formData.display_order} onChange={e => setFormData({...formData, display_order: parseInt(e.target.value)})} />
                </div>
                <div className="flex items-center gap-2 mt-6">
                    <input type="checkbox" checked={formData.is_active} onChange={e => setFormData({...formData, is_active: e.target.checked})} />
                    <label className="text-sm">Active</label>
                </div>
            </div>

            <div>
                <label className="text-sm font-medium mb-1 block">Short Description</label>
                <Textarea value={formData.description_short} onChange={e => setFormData({...formData, description_short: e.target.value})} rows={2} />
            </div>

            <div>
                <label className="text-sm font-medium mb-1 block">Long Description</label>
                <Textarea value={formData.description_long} onChange={e => setFormData({...formData, description_long: e.target.value})} rows={4} />
            </div>

            <div>
                <label className="text-sm font-medium mb-2 block">Features / Bullets</label>
                <div className="space-y-2 mb-2">
                    {formData.bullets_json?.map((bullet, idx) => (
                        <div key={idx} className="flex items-center gap-2 bg-slate-50 p-2 rounded">
                            <span className="flex-1 text-sm">{bullet}</span>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeBullet(idx)}>
                                <X className="w-3 h-3" />
                            </Button>
                        </div>
                    ))}
                </div>
                <div className="flex gap-2">
                    <Input placeholder="Add feature..." value={newBullet} onChange={e => setNewBullet(e.target.value)} onKeyDown={e => e.key === 'Enter' && addBullet()} />
                    <Button type="button" onClick={addBullet}>Add</Button>
                </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={onCancel}>Cancel</Button>
                <Button onClick={() => onSave(formData)}>
                    <Save className="w-4 h-4 mr-2" /> Save Module
                </Button>
            </div>

            {formData.id && <ModuleComponentsEditor moduleId={formData.id} rateCardItems={rateCardItems} />}
        </div>
    );
}

function ModuleComponentsEditor({ moduleId, rateCardItems }) {
    const queryClient = useQueryClient();
    const [newComponent, setNewComponent] = useState({ rate_card_item_code: '', qty_value: 1 });

    const { data: components } = useQuery({
        queryKey: ['ModuleComponent', moduleId],
        queryFn: () => base44.entities.ModuleComponent.filter({ module_id: moduleId })
    });

    const saveComponentMutation = useMutation({
        mutationFn: (data) => base44.entities.ModuleComponent.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries(['ModuleComponent', moduleId]);
            setNewComponent({ rate_card_item_code: '', qty_value: 1 });
            toast.success('Component added');
        }
    });

    const deleteComponentMutation = useMutation({
        mutationFn: (id) => base44.entities.ModuleComponent.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries(['ModuleComponent', moduleId]);
            toast.success('Component removed');
        }
    });

    const handleAdd = () => {
        if (!newComponent.rate_card_item_code) return toast.error('Select a rate card item');
        
        const duplicate = components?.find(c => c.rate_card_item_code === newComponent.rate_card_item_code);
        if (duplicate) return toast.error('Component already added');

        saveComponentMutation.mutate({
            module_id: moduleId,
            ...newComponent,
            qty_type: 'FIXED',
            pricing_mode: 'ADD_AS_LINE_ITEM',
            is_included: true,
            display_order: components?.length || 0
        });
    };

    return (
        <div className="mt-6 pt-6 border-t">
            <h3 className="font-semibold mb-4">Module Components (Pricing Items)</h3>
            
            <div className="space-y-2 mb-4">
                {components?.map(comp => {
                    const item = rateCardItems?.find(i => i.code === comp.rate_card_item_code);
                    return (
                        <div key={comp.id} className="flex items-center justify-between bg-slate-50 p-2 rounded">
                            <div className="flex-1">
                                <div className="font-medium text-sm">{item?.title || comp.rate_card_item_code}</div>
                                <div className="text-xs text-slate-500">
                                    Code: {comp.rate_card_item_code} | Qty: {comp.qty_value} ({comp.qty_type})
                                </div>
                            </div>
                            <Button variant="ghost" size="icon" className="text-red-500" onClick={() => deleteComponentMutation.mutate(comp.id)}>
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </div>
                    );
                })}
            </div>

            <div className="flex gap-2">
                <Select value={newComponent.rate_card_item_code} onValueChange={v => setNewComponent({...newComponent, rate_card_item_code: v})}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Select rate card item..." /></SelectTrigger>
                    <SelectContent>
                        {rateCardItems?.filter(i => i.is_active).map(item => (
                            <SelectItem key={item.id} value={item.code}>
                                {item.title} ({item.code}) - €{item.price}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Input type="number" className="w-20" value={newComponent.qty_value} onChange={e => setNewComponent({...newComponent, qty_value: parseInt(e.target.value)})} />
                <Button onClick={handleAdd}><Plus className="w-4 h-4" /></Button>
            </div>
        </div>
    );
}