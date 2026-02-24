import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Save, Trash2, Edit2, Play, X } from 'lucide-react';
import { toast } from 'sonner';
import { calculateOffer } from '@/components/utils/pricingEngine';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export default function StoragePricingAdmin() {
    const queryClient = useQueryClient();
    const [activeRateCardId, setActiveRateCardId] = useState(null);

    const { data: rateCards, isLoading: isLoadingRC } = useQuery({
        queryKey: ['RateCard'],
        queryFn: () => base44.entities.RateCard.list(),
        onSuccess: (data) => {
            if (data.length > 0 && !activeRateCardId) {
                setActiveRateCardId(data[0].id);
            }
        }
    });

    const { data: items, isLoading: isLoadingItems } = useQuery({
        queryKey: ['RateCardItem', activeRateCardId],
        queryFn: () => base44.entities.RateCardItem.filter({ rate_card_id: activeRateCardId }),
        enabled: !!activeRateCardId
    });

    const createRateCardMutation = useMutation({
        mutationFn: (data) => base44.entities.RateCard.create(data),
        onSuccess: (data) => {
            queryClient.invalidateQueries(['RateCard']);
            setActiveRateCardId(data.id);
            toast.success("Rate Card created");
        }
    });

    const saveItemMutation = useMutation({
        mutationFn: (data) => data.id ? base44.entities.RateCardItem.update(data.id, data) : base44.entities.RateCardItem.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries(['RateCardItem', activeRateCardId]);
            toast.success("Saved successfully");
        }
    });

    const deleteItemMutation = useMutation({
        mutationFn: (id) => base44.entities.RateCardItem.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries(['RateCardItem', activeRateCardId]);
            toast.success("Deleted successfully");
        }
    });

    const createDefaultRateCard = () => {
        createRateCardMutation.mutate({
            name: "Standard Rates 2026",
            currency: "EUR",
            vat_rate: 25,
            valid_from: new Date().toISOString().split('T')[0],
            valid_to: "2026-12-31",
            version_number: 1,
            is_active: true
        });
    };

    if (isLoadingRC) return <div className="p-8">Loading...</div>;

    if (!rateCards || rateCards.length === 0) {
        return (
            <div className="p-8 max-w-4xl mx-auto text-center">
                <h1 className="text-2xl font-bold mb-4">Storage & Transport Pricing Config</h1>
                <p className="mb-6 text-slate-500">No Rate Cards found. You need to create a Rate Card to start configuring prices.</p>
                <Button onClick={createDefaultRateCard}>Create Initial Rate Card</Button>
            </div>
        );
    }

    const activeRateCard = rateCards.find(rc => rc.id === activeRateCardId) || rateCards[0];
    const storageItems = items?.filter(i => i.category === 'STORAGE') || [];
    const transportStartItems = items?.filter(i => i.category === 'TRANSPORT_START') || [];
    const transportKmItems = items?.filter(i => i.category === 'TRANSPORT_KM') || [];
    const roofRule = items?.find(i => i.category === 'ROOF_RULE');
    const optionItems = items?.filter(i => i.category === 'OPTION') || [];

    return (
        <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Price Management</h1>
                    <p className="text-slate-500">Configure Storage & Transport Wizard pricing</p>
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-slate-600">Active Rate Card:</span>
                    <Select value={activeRateCardId} onValueChange={setActiveRateCardId}>
                        <SelectTrigger className="w-64 bg-white">
                            <SelectValue placeholder="Select Rate Card" />
                        </SelectTrigger>
                        <SelectContent>
                            {rateCards.map(rc => (
                                <SelectItem key={rc.id} value={rc.id}>
                                    {rc.name} (v{rc.version_number})
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button variant="outline" onClick={createDefaultRateCard}><Plus className="w-4 h-4 mr-2" /> New Version</Button>
                </div>
            </div>

            <Tabs defaultValue="storage" className="w-full">
                <TabsList className="grid w-full grid-cols-5 mb-8">
                    <TabsTrigger value="storage">Storage Matrix</TabsTrigger>
                    <TabsTrigger value="roof">Roof Rules</TabsTrigger>
                    <TabsTrigger value="transport">Transport Config</TabsTrigger>
                    <TabsTrigger value="options">Options</TabsTrigger>
                    <TabsTrigger value="test">Test Calculation</TabsTrigger>
                </TabsList>

                <TabsContent value="storage">
                    <StorageMatrixEditor 
                        items={storageItems} 
                        rateCardId={activeRateCardId} 
                        onSave={(data) => saveItemMutation.mutate(data)}
                        onDelete={(id) => deleteItemMutation.mutate(id)}
                    />
                </TabsContent>

                <TabsContent value="roof">
                    <RoofRuleEditor 
                        item={roofRule} 
                        rateCardId={activeRateCardId} 
                        onSave={(data) => saveItemMutation.mutate(data)}
                    />
                </TabsContent>

                <TabsContent value="transport">
                    <TransportEditor 
                        startItems={transportStartItems} 
                        kmItems={transportKmItems}
                        rateCardId={activeRateCardId} 
                        onSave={(data) => saveItemMutation.mutate(data)}
                        onDelete={(id) => deleteItemMutation.mutate(id)}
                    />
                </TabsContent>

                <TabsContent value="options">
                    <OptionsEditor 
                        items={optionItems} 
                        rateCardId={activeRateCardId} 
                        onSave={(data) => saveItemMutation.mutate(data)}
                        onDelete={(id) => deleteItemMutation.mutate(id)}
                    />
                </TabsContent>

                <TabsContent value="test">
                    <TestCalculationPanel 
                        rateCard={activeRateCard}
                        items={items || []} 
                    />
                </TabsContent>
            </Tabs>
        </div>
    );
}

function StorageMatrixEditor({ items, rateCardId, onSave, onDelete }) {
    const [newItem, setNewItem] = useState({ length_min: 0, length_max: 5, period: 'month', price: 0, title: '', code: '' });
    const [editingId, setEditingId] = useState(null);
    const [editData, setEditData] = useState({});

    const handleSave = () => {
        if(!newItem.title || !newItem.code) return toast.error("Title and Code required");
        
        // Check for duplicate code
        const duplicate = items.find(i => i.code === newItem.code);
        if(duplicate) return toast.error("Code already exists. Use a unique code.");
        
        onSave({
            rate_card_id: rateCardId,
            category: 'STORAGE',
            code: newItem.code,
            title: newItem.title,
            unit: 'flat',
            price: parseFloat(newItem.price),
            rules_json: { length_min: parseFloat(newItem.length_min), length_max: parseFloat(newItem.length_max), period: newItem.period },
            is_active: true
        });
        setNewItem({ length_min: 0, length_max: 5, period: 'month', price: 0, title: '', code: '' });
    };

    const startEdit = (item) => {
        setEditingId(item.id);
        setEditData({
            title: item.title,
            price: item.price,
            code: item.code,
            length_min: item.rules_json?.length_min || 0,
            length_max: item.rules_json?.length_max || 0,
            period: item.rules_json?.period || 'month'
        });
    };

    const saveEdit = () => {
        if(!editData.title || !editData.code) return toast.error("Title and Code required");
        
        // Check for duplicate code (excluding current item)
        const duplicate = items.find(i => i.code === editData.code && i.id !== editingId);
        if(duplicate) return toast.error("Code already exists. Use a unique code.");
        
        onSave({
            id: editingId,
            rate_card_id: rateCardId,
            category: 'STORAGE',
            code: editData.code,
            title: editData.title,
            unit: 'flat',
            price: parseFloat(editData.price),
            rules_json: { length_min: parseFloat(editData.length_min), length_max: parseFloat(editData.length_max), period: editData.period },
            is_active: true
        });
        setEditingId(null);
        setEditData({});
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditData({});
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Storage Matrix</CardTitle>
                <CardDescription>Define prices based on boat length classes and storage periods.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-12 gap-2 font-medium text-sm text-slate-500 mb-2 px-2">
                    <div className="col-span-2">Code</div>
                    <div className="col-span-3">Title</div>
                    <div className="col-span-2">Length Range (m)</div>
                    <div className="col-span-2">Period</div>
                    <div className="col-span-2">Price (€)</div>
                    <div className="col-span-1"></div>
                </div>
                <div className="space-y-2 mb-6">
                    {items.map(item => (
                        <div key={item.id} className={`grid grid-cols-12 gap-2 items-center p-2 rounded border ${editingId === item.id ? 'bg-blue-50 border-blue-300' : 'bg-slate-50'}`}>
                            {editingId === item.id ? (
                                <>
                                    <div className="col-span-2">
                                        <Input value={editData.code} onChange={e => setEditData({...editData, code: e.target.value})} className="h-8 text-sm" />
                                    </div>
                                    <div className="col-span-3">
                                        <Input value={editData.title} onChange={e => setEditData({...editData, title: e.target.value})} className="h-8 text-sm" />
                                    </div>
                                    <div className="col-span-2 flex gap-1">
                                        <Input type="number" value={editData.length_min} onChange={e => setEditData({...editData, length_min: e.target.value})} className="h-8 text-sm" placeholder="Min" />
                                        <Input type="number" value={editData.length_max} onChange={e => setEditData({...editData, length_max: e.target.value})} className="h-8 text-sm" placeholder="Max" />
                                    </div>
                                    <div className="col-span-2">
                                        <Select value={editData.period} onValueChange={v => setEditData({...editData, period: v})}>
                                            <SelectTrigger className="h-8 text-sm"><SelectValue/></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="day">Day</SelectItem>
                                                <SelectItem value="month">Month</SelectItem>
                                                <SelectItem value="season">Season</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="col-span-2">
                                        <Input type="number" value={editData.price} onChange={e => setEditData({...editData, price: e.target.value})} className="h-8 text-sm" />
                                    </div>
                                    <div className="col-span-1 flex justify-end gap-1">
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600" onClick={saveEdit}><Save className="w-4 h-4"/></Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500" onClick={cancelEdit}><X className="w-4 h-4"/></Button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="col-span-2">{item.code}</div>
                                    <div className="col-span-3 font-medium">{item.title}</div>
                                    <div className="col-span-2">{item.rules_json?.length_min} - {item.rules_json?.length_max} m</div>
                                    <div className="col-span-2 capitalize">{item.rules_json?.period}</div>
                                    <div className="col-span-2">€{item.price}</div>
                                    <div className="col-span-1 flex justify-end gap-1">
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(item)}><Edit2 className="w-4 h-4"/></Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => onDelete(item.id)}><Trash2 className="w-4 h-4"/></Button>
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                </div>

                <div className="p-4 border rounded-lg bg-slate-50">
                    <h3 className="font-semibold mb-4 text-sm">Add New Storage Rule</h3>
                    <div className="grid grid-cols-12 gap-4">
                        <div className="col-span-2">
                            <Input placeholder="Code (e.g. ST_S_1M)" value={newItem.code} onChange={e => setNewItem({...newItem, code: e.target.value})} />
                        </div>
                        <div className="col-span-3">
                            <Input placeholder="Title" value={newItem.title} onChange={e => setNewItem({...newItem, title: e.target.value})} />
                        </div>
                        <div className="col-span-1">
                            <Input type="number" placeholder="Min" value={newItem.length_min} onChange={e => setNewItem({...newItem, length_min: e.target.value})} />
                        </div>
                        <div className="col-span-1">
                            <Input type="number" placeholder="Max" value={newItem.length_max} onChange={e => setNewItem({...newItem, length_max: e.target.value})} />
                        </div>
                        <div className="col-span-2">
                            <Select value={newItem.period} onValueChange={v => setNewItem({...newItem, period: v})}>
                                <SelectTrigger><SelectValue placeholder="Period" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="day">Day</SelectItem>
                                    <SelectItem value="month">Month</SelectItem>
                                    <SelectItem value="season">Season</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="col-span-2">
                            <Input type="number" placeholder="Price" value={newItem.price} onChange={e => setNewItem({...newItem, price: e.target.value})} />
                        </div>
                        <div className="col-span-1">
                            <Button onClick={handleSave} className="w-full"><Plus className="w-4 h-4"/></Button>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function RoofRuleEditor({ item, rateCardId, onSave }) {
    const [rule, setRule] = useState(item || { code: 'ROOF_SURCHARGE', title: 'Indoor Roof Storage', price: 1.5, type: 'multiplier' });

    // Sync state if item loads later
    React.useEffect(() => { if(item) setRule({ ...item, type: item.rules_json?.type || 'multiplier' }); }, [item]);

    const handleSave = () => {
        onSave({
            id: item?.id,
            rate_card_id: rateCardId,
            category: 'ROOF_RULE',
            code: rule.code,
            title: rule.title,
            unit: 'flat',
            price: parseFloat(rule.price),
            rules_json: { type: rule.type },
            is_active: true
        });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Roof Surcharge Rule</CardTitle>
                <CardDescription>Extra cost applied when customer selects covered/indoor storage.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 max-w-lg">
                <div>
                    <label className="text-sm font-medium mb-1 block">Rule Type</label>
                    <Select value={rule.type} onValueChange={v => setRule({...rule, type: v})}>
                        <SelectTrigger><SelectValue/></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="multiplier">Multiplier (e.g. 1.5x of base storage)</SelectItem>
                            <SelectItem value="surcharge">Fixed Surcharge (Flat amount added)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <label className="text-sm font-medium mb-1 block">Value ({rule.type === 'multiplier' ? 'Factor' : '€'})</label>
                    <Input type="number" step="0.01" value={rule.price} onChange={e => setRule({...rule, price: e.target.value})} />
                </div>
                <div>
                    <label className="text-sm font-medium mb-1 block">Title shown on Offer</label>
                    <Input value={rule.title} onChange={e => setRule({...rule, title: e.target.value})} />
                </div>
                <Button onClick={handleSave}><Save className="w-4 h-4 mr-2"/> Save Roof Rule</Button>
            </CardContent>
        </Card>
    );
}

function TransportEditor({ startItems, kmItems, rateCardId, onSave, onDelete }) {
    const [newItem, setNewItem] = useState({ type: 'start', length_min: 0, length_max: 10, distance_min: 0, distance_max: 50, price: 0, title: '', code: '' });
    const [editingId, setEditingId] = useState(null);
    const [editData, setEditData] = useState({});

    const handleSave = () => {
        if(!newItem.title || !newItem.code) return toast.error("Title and Code required");
        
        const allItems = [...startItems, ...kmItems];
        const duplicate = allItems.find(i => i.code === newItem.code);
        if(duplicate) return toast.error("Code already exists. Use a unique code.");
        
        onSave({
            rate_card_id: rateCardId,
            category: newItem.type === 'start' ? 'TRANSPORT_START' : 'TRANSPORT_KM',
            code: newItem.code,
            title: newItem.title,
            unit: newItem.type === 'start' ? 'flat' : 'km',
            price: parseFloat(newItem.price),
            rules_json: newItem.type === 'start' 
                ? { length_min: parseFloat(newItem.length_min), length_max: parseFloat(newItem.length_max) }
                : { distance_min: parseFloat(newItem.distance_min), distance_max: parseFloat(newItem.distance_max) },
            is_active: true
        });
        setNewItem({ ...newItem, price: 0, title: '', code: '' });
    };

    const startEdit = (item, category) => {
        setEditingId(item.id);
        setEditData({
            title: item.title,
            price: item.price,
            code: item.code,
            category: category,
            length_min: item.rules_json?.length_min || 0,
            length_max: item.rules_json?.length_max || 0,
            distance_min: item.rules_json?.distance_min || 0,
            distance_max: item.rules_json?.distance_max || 0
        });
    };

    const saveEdit = () => {
        if(!editData.title || !editData.code) return toast.error("Title and Code required");
        
        const allItems = [...startItems, ...kmItems];
        const duplicate = allItems.find(i => i.code === editData.code && i.id !== editingId);
        if(duplicate) return toast.error("Code already exists. Use a unique code.");
        
        onSave({
            id: editingId,
            rate_card_id: rateCardId,
            category: editData.category,
            code: editData.code,
            title: editData.title,
            unit: editData.category === 'TRANSPORT_START' ? 'flat' : 'km',
            price: parseFloat(editData.price),
            rules_json: editData.category === 'TRANSPORT_START'
                ? { length_min: parseFloat(editData.length_min), length_max: parseFloat(editData.length_max) }
                : { distance_min: parseFloat(editData.distance_min), distance_max: parseFloat(editData.distance_max) },
            is_active: true
        });
        setEditingId(null);
        setEditData({});
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditData({});
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Transport Configuration</CardTitle>
                <CardDescription>Setup start fees (by boat length) and km rates (by distance brackets).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
                <div>
                    <h3 className="font-semibold text-lg mb-2">Transport Start Fees</h3>
                    <div className="space-y-2">
                        {startItems.map(item => (
                            <div key={item.id} className={`grid grid-cols-12 gap-2 items-center p-2 rounded border ${editingId === item.id ? 'bg-blue-50 border-blue-300' : 'bg-slate-50'}`}>
                                {editingId === item.id ? (
                                    <>
                                        <div className="col-span-3 flex gap-1">
                                            <Input value={editData.code} onChange={e => setEditData({...editData, code: e.target.value})} className="h-8 text-sm" placeholder="Code" />
                                            <Input value={editData.title} onChange={e => setEditData({...editData, title: e.target.value})} className="h-8 text-sm" placeholder="Title" />
                                        </div>
                                        <div className="col-span-4 flex gap-1">
                                            <Input type="number" value={editData.length_min} onChange={e => setEditData({...editData, length_min: e.target.value})} className="h-8 text-sm" placeholder="Min" />
                                            <Input type="number" value={editData.length_max} onChange={e => setEditData({...editData, length_max: e.target.value})} className="h-8 text-sm" placeholder="Max" />
                                        </div>
                                        <div className="col-span-4">
                                            <Input type="number" value={editData.price} onChange={e => setEditData({...editData, price: e.target.value})} className="h-8 text-sm" placeholder="Price" />
                                        </div>
                                        <div className="col-span-1 flex justify-end gap-1">
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600" onClick={saveEdit}><Save className="w-4 h-4"/></Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={cancelEdit}><X className="w-4 h-4"/></Button>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="col-span-3">{item.code} - {item.title}</div>
                                        <div className="col-span-4">Boat: {item.rules_json?.length_min} - {item.rules_json?.length_max} m</div>
                                        <div className="col-span-4 font-bold">€{item.price} Flat</div>
                                        <div className="col-span-1 flex justify-end gap-1">
                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(item, 'TRANSPORT_START')}><Edit2 className="w-4 h-4"/></Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => onDelete(item.id)}><Trash2 className="w-4 h-4"/></Button>
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <div>
                    <h3 className="font-semibold text-lg mb-2">Transport KM Rates</h3>
                    <div className="space-y-2">
                        {kmItems.map(item => (
                            <div key={item.id} className={`grid grid-cols-12 gap-2 items-center p-2 rounded border ${editingId === item.id ? 'bg-blue-50 border-blue-300' : 'bg-slate-50'}`}>
                                {editingId === item.id ? (
                                    <>
                                        <div className="col-span-3 flex gap-1">
                                            <Input value={editData.code} onChange={e => setEditData({...editData, code: e.target.value})} className="h-8 text-sm" placeholder="Code" />
                                            <Input value={editData.title} onChange={e => setEditData({...editData, title: e.target.value})} className="h-8 text-sm" placeholder="Title" />
                                        </div>
                                        <div className="col-span-4 flex gap-1">
                                            <Input type="number" value={editData.distance_min} onChange={e => setEditData({...editData, distance_min: e.target.value})} className="h-8 text-sm" placeholder="Min KM" />
                                            <Input type="number" value={editData.distance_max} onChange={e => setEditData({...editData, distance_max: e.target.value})} className="h-8 text-sm" placeholder="Max KM" />
                                        </div>
                                        <div className="col-span-4">
                                            <Input type="number" value={editData.price} onChange={e => setEditData({...editData, price: e.target.value})} className="h-8 text-sm" placeholder="Price/km" />
                                        </div>
                                        <div className="col-span-1 flex justify-end gap-1">
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600" onClick={saveEdit}><Save className="w-4 h-4"/></Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={cancelEdit}><X className="w-4 h-4"/></Button>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="col-span-3">{item.code} - {item.title}</div>
                                        <div className="col-span-4">Distance: {item.rules_json?.distance_min} - {item.rules_json?.distance_max} km</div>
                                        <div className="col-span-4 font-bold">€{item.price} / km</div>
                                        <div className="col-span-1 flex justify-end gap-1">
                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(item, 'TRANSPORT_KM')}><Edit2 className="w-4 h-4"/></Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => onDelete(item.id)}><Trash2 className="w-4 h-4"/></Button>
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="p-4 border rounded-lg bg-slate-50">
                    <h3 className="font-semibold mb-4 text-sm">Add New Transport Rule</h3>
                    <div className="grid grid-cols-12 gap-4">
                        <div className="col-span-2">
                            <Select value={newItem.type} onValueChange={v => setNewItem({...newItem, type: v})}>
                                <SelectTrigger><SelectValue/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="start">Start Fee</SelectItem>
                                    <SelectItem value="km">KM Rate</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="col-span-2">
                            <Input placeholder="Code" value={newItem.code} onChange={e => setNewItem({...newItem, code: e.target.value})} />
                        </div>
                        <div className="col-span-3">
                            <Input placeholder="Title" value={newItem.title} onChange={e => setNewItem({...newItem, title: e.target.value})} />
                        </div>
                        
                        {newItem.type === 'start' ? (
                            <>
                                <div className="col-span-1"><Input type="number" placeholder="Min L" value={newItem.length_min} onChange={e => setNewItem({...newItem, length_min: e.target.value})} /></div>
                                <div className="col-span-1"><Input type="number" placeholder="Max L" value={newItem.length_max} onChange={e => setNewItem({...newItem, length_max: e.target.value})} /></div>
                            </>
                        ) : (
                            <>
                                <div className="col-span-1"><Input type="number" placeholder="Min KM" value={newItem.distance_min} onChange={e => setNewItem({...newItem, distance_min: e.target.value})} /></div>
                                <div className="col-span-1"><Input type="number" placeholder="Max KM" value={newItem.distance_max} onChange={e => setNewItem({...newItem, distance_max: e.target.value})} /></div>
                            </>
                        )}
                        
                        <div className="col-span-2">
                            <Input type="number" placeholder="Price" value={newItem.price} onChange={e => setNewItem({...newItem, price: e.target.value})} />
                        </div>
                        <div className="col-span-1">
                            <Button onClick={handleSave} className="w-full"><Plus className="w-4 h-4"/></Button>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function OptionsEditor({ items, rateCardId, onSave, onDelete }) {
    const [newItem, setNewItem] = useState({ code: '', title: '', unit: 'piece', price: 0 });
    const [editingId, setEditingId] = useState(null);
    const [editData, setEditData] = useState({});

    const handleSave = () => {
        if(!newItem.title || !newItem.code) return toast.error("Title and Code required");
        
        const duplicate = items.find(i => i.code === newItem.code);
        if(duplicate) return toast.error("Code already exists. Use a unique code.");
        
        onSave({
            rate_card_id: rateCardId,
            category: 'OPTION',
            code: newItem.code,
            title: newItem.title,
            unit: newItem.unit,
            price: parseFloat(newItem.price),
            is_active: true
        });
        setNewItem({ code: '', title: '', unit: 'piece', price: 0 });
    };

    const startEdit = (item) => {
        setEditingId(item.id);
        setEditData({
            code: item.code,
            title: item.title,
            unit: item.unit,
            price: item.price
        });
    };

    const saveEdit = () => {
        if(!editData.title || !editData.code) return toast.error("Title and Code required");
        
        const duplicate = items.find(i => i.code === editData.code && i.id !== editingId);
        if(duplicate) return toast.error("Code already exists. Use a unique code.");
        
        onSave({
            id: editingId,
            rate_card_id: rateCardId,
            category: 'OPTION',
            code: editData.code,
            title: editData.title,
            unit: editData.unit,
            price: parseFloat(editData.price),
            is_active: true
        });
        setEditingId(null);
        setEditData({});
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditData({});
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Additional Options</CardTitle>
                <CardDescription>Setup selectable extra services (e.g., Winterization, Covers).</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-2 mb-6">
                    {items.map(item => (
                        <div key={item.id} className={`grid grid-cols-12 gap-2 items-center p-2 rounded border ${editingId === item.id ? 'bg-blue-50 border-blue-300' : 'bg-slate-50'}`}>
                            {editingId === item.id ? (
                                <>
                                    <div className="col-span-3">
                                        <Input value={editData.code} onChange={e => setEditData({...editData, code: e.target.value})} className="h-8 text-sm" />
                                    </div>
                                    <div className="col-span-4">
                                        <Input value={editData.title} onChange={e => setEditData({...editData, title: e.target.value})} className="h-8 text-sm" />
                                    </div>
                                    <div className="col-span-2">
                                        <Input value={editData.unit} onChange={e => setEditData({...editData, unit: e.target.value})} className="h-8 text-sm" />
                                    </div>
                                    <div className="col-span-2">
                                        <Input type="number" value={editData.price} onChange={e => setEditData({...editData, price: e.target.value})} className="h-8 text-sm" />
                                    </div>
                                    <div className="col-span-1 flex justify-end gap-1">
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600" onClick={saveEdit}><Save className="w-4 h-4"/></Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={cancelEdit}><X className="w-4 h-4"/></Button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="col-span-3">{item.code}</div>
                                    <div className="col-span-4 font-medium">{item.title}</div>
                                    <div className="col-span-2">Per {item.unit}</div>
                                    <div className="col-span-2 font-bold">€{item.price}</div>
                                    <div className="col-span-1 flex justify-end gap-1">
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(item)}><Edit2 className="w-4 h-4"/></Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => onDelete(item.id)}><Trash2 className="w-4 h-4"/></Button>
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                </div>

                <div className="p-4 border rounded-lg bg-slate-50">
                    <h3 className="font-semibold mb-4 text-sm">Add New Option</h3>
                    <div className="grid grid-cols-12 gap-4">
                        <div className="col-span-3">
                            <Input placeholder="Code (e.g. OPT_BATTERY)" value={newItem.code} onChange={e => setNewItem({...newItem, code: e.target.value})} />
                        </div>
                        <div className="col-span-4">
                            <Input placeholder="Title (e.g. Battery Service)" value={newItem.title} onChange={e => setNewItem({...newItem, title: e.target.value})} />
                        </div>
                        <div className="col-span-2">
                            <Input placeholder="Unit (piece, season)" value={newItem.unit} onChange={e => setNewItem({...newItem, unit: e.target.value})} />
                        </div>
                        <div className="col-span-2">
                            <Input type="number" placeholder="Price" value={newItem.price} onChange={e => setNewItem({...newItem, price: e.target.value})} />
                        </div>
                        <div className="col-span-1">
                            <Button onClick={handleSave} className="w-full"><Plus className="w-4 h-4"/></Button>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function TestCalculationPanel({ rateCard, items }) {
    const [params, setParams] = useState({
        boat_length: 6.5,
        transport_needed: true,
        distance_km: 120,
        storage_needed: true,
        storage_period: 'month',
        roof_option: false,
        selected_options: []
    });

    const [result, setResult] = useState(null);

    const handleCalculate = () => {
        const res = calculateOffer(params, items, rateCard.vat_rate);
        setResult(res);
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
                <CardHeader>
                    <CardTitle>Test Parameters</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-medium mb-1 block">Boat Length (m)</label>
                            <Input type="number" step="0.1" value={params.boat_length} onChange={e => setParams({...params, boat_length: parseFloat(e.target.value) || 0})} />
                        </div>
                    </div>
                    
                    <div className="p-4 border rounded bg-slate-50 space-y-4">
                        <div className="flex items-center space-x-2">
                            <Checkbox id="t_needed" checked={params.transport_needed} onCheckedChange={c => setParams({...params, transport_needed: !!c})} />
                            <label htmlFor="t_needed" className="font-medium">Include Transport</label>
                        </div>
                        {params.transport_needed && (
                            <div>
                                <label className="text-sm font-medium mb-1 block">Distance (km)</label>
                                <Input type="number" value={params.distance_km} onChange={e => setParams({...params, distance_km: parseFloat(e.target.value) || 0})} />
                            </div>
                        )}
                    </div>

                    <div className="p-4 border rounded bg-slate-50 space-y-4">
                        <div className="flex items-center space-x-2">
                            <Checkbox id="s_needed" checked={params.storage_needed} onCheckedChange={c => setParams({...params, storage_needed: !!c})} />
                            <label htmlFor="s_needed" className="font-medium">Include Storage</label>
                        </div>
                        {params.storage_needed && (
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium mb-1 block">Period</label>
                                    <Select value={params.storage_period} onValueChange={v => setParams({...params, storage_period: v})}>
                                        <SelectTrigger><SelectValue/></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="day">Day</SelectItem>
                                            <SelectItem value="month">Month</SelectItem>
                                            <SelectItem value="season">Season</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex items-center space-x-2 mt-6">
                                    <Checkbox id="roof" checked={params.roof_option} onCheckedChange={c => setParams({...params, roof_option: !!c})} />
                                    <label htmlFor="roof" className="text-sm">Indoor / Roof</label>
                                </div>
                            </div>
                        )}
                    </div>

                    <Button onClick={handleCalculate} className="w-full" size="lg"><Play className="w-4 h-4 mr-2"/> Run Engine Simulation</Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Calculation Result</CardTitle>
                </CardHeader>
                <CardContent>
                    {result ? (
                        <div className="space-y-6">
                            <div className="border rounded-md divide-y">
                                {result.lineItems.map((li, idx) => (
                                    <div key={idx} className="p-3 flex justify-between items-center text-sm">
                                        <div>
                                            <div className="font-medium">{li.title}</div>
                                            <div className="text-slate-500 text-xs">{li.code} | {li.quantity} {li.unit} x €{li.unit_price}</div>
                                        </div>
                                        <div className="font-bold">€{li.total_price.toFixed(2)}</div>
                                    </div>
                                ))}
                            </div>
                            <div className="bg-slate-100 p-4 rounded-md space-y-2 text-right">
                                <div className="flex justify-between text-slate-600"><span>Subtotal:</span> <span>€{result.subtotal.toFixed(2)}</span></div>
                                <div className="flex justify-between text-slate-600"><span>VAT ({rateCard.vat_rate}%):</span> <span>€{result.vat.toFixed(2)}</span></div>
                                <div className="flex justify-between font-bold text-lg pt-2 border-t border-slate-300"><span>Total:</span> <span>€{result.total.toFixed(2)}</span></div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center p-8 text-slate-500">Click Run to see output.</div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}