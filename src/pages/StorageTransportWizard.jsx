import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowRight, ArrowLeft, CheckCircle2, Package, MapPin, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { calculateOffer } from '@/components/utils/pricingEngine';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function StorageTransportWizard() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [step, setStep] = useState(1);
    
    // Configs
    const { data: rateCards } = useQuery({ queryKey: ['ActiveRateCard'], queryFn: () => base44.entities.RateCard.filter({is_active: true}) });
    const activeRateCard = rateCards?.[0];
    
    const { data: rateCardItems } = useQuery({ 
        queryKey: ['RateCardItems', activeRateCard?.id], 
        queryFn: () => base44.entities.RateCardItem.filter({ rate_card_id: activeRateCard?.id }),
        enabled: !!activeRateCard?.id
    });
    
    const { data: customers } = useQuery({ queryKey: ['Customers'], queryFn: () => base44.entities.Customer.list() });
    
    const { data: modules } = useQuery({ 
        queryKey: ['ProductModule'], 
        queryFn: () => base44.entities.ProductModule.filter({ is_active: true }) 
    });
    
    const { data: allModuleComponents } = useQuery({
        queryKey: ['ModuleComponent_All'],
        queryFn: () => base44.entities.ModuleComponent.list()
    });

    // Wizard State
    const [formData, setFormData] = useState({
        customer_id: '',
        title: 'Storage & Transport Offer',
        boat_length: 0,
        trailer_present: false,
        transport_needed: false,
        pickup_address: '',
        distance_km: 0,
        storage_needed: true, // MANDATORY
        storage_period: 'month',
        roof_option: false,
        selected_modules: [], // [{module_id, module}]
        selected_options: [] // [{code, quantity}]
    });

    const [calculation, setCalculation] = useState(null);

    const createOfferMutation = useMutation({
        mutationFn: async (data) => {
            // 1. Create Offer
            const offer = await base44.entities.Offer.create({
                customer_id: formData.customer_id,
                title: formData.title,
                rate_card_id: activeRateCard.id,
                boat_length: formData.boat_length,
                transport_distance_km: formData.distance_km,
                storage_period: formData.storage_period,
                roof_option: formData.roof_option,
                subtotal: calculation.subtotal,
                vat: calculation.vat,
                total_amount: calculation.total,
                calculation_snapshot_json: { 
                    rateCardItems, 
                    params: formData,
                    selected_modules: formData.selected_modules.map(m => ({ module_id: m.module_id, name: m.module.name }))
                },
                status: 'Draft',
                vat_rate: activeRateCard.vat_rate
            });

            // 2. Create Offer Items (Tasks)
            const tasks = calculation.lineItems.map((li, idx) => ({
                offer_id: offer.id,
                sequence_order: idx,
                title: li.title,
                unit_type: li.unit,
                quantity: li.quantity,
                unit_price: li.unit_price,
                total_amount: li.total_price,
                code: li.code,
                meta_json: { category: li.category }
            }));

            await base44.entities.OfferTask.bulkCreate(tasks);
            
            // 3. Create Offer Sections (Presentation Layer)
            const sections = [];
            let displayOrder = 0;
            
            // Storage section
            sections.push({
                offer_id: offer.id,
                section_type: 'STORAGE',
                title: 'Storage Service',
                description: `Storage for ${formData.boat_length}m boat - ${formData.storage_period} ${formData.roof_option ? '(with roof cover)' : ''}`,
                bullets_json: ['Base storage service included'],
                display_order: displayOrder++
            });
            
            // Transport section
            if (formData.transport_needed) {
                sections.push({
                    offer_id: offer.id,
                    section_type: 'TRANSPORT',
                    title: 'Transport Service',
                    description: `Transport from ${formData.pickup_address || 'customer location'} (${formData.distance_km}km)`,
                    bullets_json: [],
                    display_order: displayOrder++
                });
            }
            
            // Module sections
            for (const selectedMod of formData.selected_modules) {
                sections.push({
                    offer_id: offer.id,
                    section_type: 'MODULE',
                    title: selectedMod.module.name,
                    description: selectedMod.module.description_long || selectedMod.module.description_short,
                    bullets_json: selectedMod.module.bullets_json || [],
                    display_order: displayOrder++,
                    module_id: selectedMod.module_id
                });
            }
            
            // Options section
            if (formData.selected_options.length > 0) {
                const optionItems = formData.selected_options.map(opt => {
                    const item = rateCardItems?.find(i => i.code === opt.code);
                    return item?.title || opt.code;
                });
                sections.push({
                    offer_id: offer.id,
                    section_type: 'OPTIONS',
                    title: 'Additional Services',
                    description: 'Selected add-on services',
                    bullets_json: optionItems,
                    display_order: displayOrder++
                });
            }
            
            await base44.entities.OfferSection.bulkCreate(sections);
            
            return offer;
        },
        onSuccess: (offer) => {
            toast.success("Offer Created Successfully");
            navigate(createPageUrl(`OfferDetail?id=${offer.id}`));
        }
    });

    const handleNext = () => {
        if (step === 1 && (!formData.customer_id || formData.boat_length <= 0)) {
            return toast.error("Please select a customer and enter valid boat length.");
        }
        if (step === 5) {
            // Generate Preview Calculation
            try {
                // Build extended params with module components
                const extendedParams = { ...formData };
                
                // Add module components to calculation
                for (const selectedMod of formData.selected_modules) {
                    const components = allModuleComponents?.filter(c => c.module_id === selectedMod.module_id) || [];
                    for (const comp of components) {
                        if (comp.pricing_mode === 'ADD_AS_LINE_ITEM') {
                            extendedParams.selected_options = [
                                ...(extendedParams.selected_options || []),
                                { code: comp.rate_card_item_code, quantity: comp.qty_value }
                            ];
                        }
                    }
                }
                
                const res = calculateOffer(extendedParams, rateCardItems || [], activeRateCard?.vat_rate || 25);
                
                // VALIDATION: Storage must exist
                const hasStorage = res.lineItems.some(li => li.category === 'STORAGE' || li.category === 'ROOF_RULE');
                if (!hasStorage) {
                    return toast.error("Storage base fee missing. Check rate card configuration.");
                }
                
                // VALIDATION: Selected modules must have components
                for (const selectedMod of formData.selected_modules) {
                    const components = allModuleComponents?.filter(c => c.module_id === selectedMod.module_id) || [];
                    if (components.length === 0) {
                        return toast.error(`Module "${selectedMod.module.name}" has no configured components. Please configure in Admin.`);
                    }
                }
                
                setCalculation(res);
            } catch (error) {
                if (error.message.includes('STORAGE_NOT_FOUND')) {
                    const msg = error.message.split('Available rates:')[0];
                    toast.error(msg.replace('STORAGE_NOT_FOUND: ', ''));
                    console.error('Storage Rate Debug Info:', error.message);
                    return;
                }
                toast.error('Calculation failed: ' + error.message);
                return;
            }
        }
        setStep(s => s + 1);
    };

    const handleOptionToggle = (code, checked, maxQty = 1) => {
        setFormData(prev => {
            let opts = [...prev.selected_options];
            if (checked) {
                opts.push({ code, quantity: maxQty });
            } else {
                opts = opts.filter(o => o.code !== code);
            }
            return { ...prev, selected_options: opts };
        });
    };

    if (!activeRateCard && !rateCards) {
        return <div className="p-8">Loading configuration...</div>;
    }

    if (!activeRateCard && rateCards) {
        return (
            <div className="p-8 max-w-3xl mx-auto text-center mt-12">
                <Package className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                <h2 className="text-2xl font-bold mb-2 text-slate-800">No Active Pricing Found</h2>
                <p className="text-slate-500 mb-6">
                    Before generating an offer, the pricing engine requires an active Rate Card.
                </p>
                <Button onClick={() => navigate(createPageUrl('StoragePricingAdmin'))}>
                    <Settings className="w-4 h-4 mr-2" /> Go to Storage Pricing Admin
                </Button>
            </div>
        );
    }

    const availableOptions = rateCardItems?.filter(i => i.category === 'OPTION' && i.is_active) || [];

    return (
        <div className="max-w-3xl mx-auto p-4 lg:p-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-slate-900">Storage & Transport Wizard</h1>
                <p className="text-slate-500">Generate a custom offer configured by the pricing engine.</p>
            </div>

            {/* Stepper Indicator */}
            <div className="flex justify-between items-center mb-8 border-b pb-4">
                {[1, 2, 3, 4, 5, 6].map((num) => (
                    <div key={num} className={`flex items-center ${step === num ? 'text-blue-600 font-bold' : step > num ? 'text-green-500' : 'text-slate-300'}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${step === num ? 'border-blue-600 bg-blue-50' : step > num ? 'border-green-500 bg-green-50' : 'border-slate-300'}`}>
                            {step > num ? <CheckCircle2 className="w-5 h-5" /> : num}
                        </div>
                    </div>
                ))}
            </div>

            <Card className="shadow-lg border-slate-200">
                <CardHeader className="bg-slate-50 border-b rounded-t-xl">
                    <CardTitle>
                        {step === 1 && "Step 1: Customer & Boat Data"}
                        {step === 2 && "Step 2: Transport Needs"}
                        {step === 3 && "Step 3: Storage Configuration (Mandatory)"}
                        {step === 4 && "Step 4: Service Modules"}
                        {step === 5 && "Step 5: Additional Options"}
                        {step === 6 && "Step 6: Review & Generate"}
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                    {/* STEP 1 */}
                    {step === 1 && (
                        <div className="space-y-6">
                            <div>
                                <label className="text-sm font-medium mb-1 block">Customer</label>
                                <Select value={formData.customer_id} onValueChange={v => setFormData({...formData, customer_id: v})}>
                                    <SelectTrigger><SelectValue placeholder="Select Customer" /></SelectTrigger>
                                    <SelectContent>
                                        {customers?.map(c => (
                                            <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name} {c.company_name ? `(${c.company_name})` : ''}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <label className="text-sm font-medium mb-1 block">Offer Title</label>
                                <Input value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
                            </div>
                            <div>
                                <label className="text-sm font-medium mb-1 block">Boat Length (meters)</label>
                                <Input type="number" step="0.1" placeholder="e.g. 8.5" value={formData.boat_length || ''} onChange={e => setFormData({...formData, boat_length: parseFloat(e.target.value) || 0})} />
                            </div>
                            <div className="flex items-center space-x-2 pt-2">
                                <Checkbox id="trailer" checked={formData.trailer_present} onCheckedChange={c => setFormData({...formData, trailer_present: !!c})} />
                                <label htmlFor="trailer" className="font-medium text-slate-700">Customer has own trailer</label>
                            </div>
                        </div>
                    )}

                    {/* STEP 2 */}
                    {step === 2 && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between p-4 border rounded-lg bg-blue-50/50">
                                <div className="flex items-center gap-3">
                                    <MapPin className="text-blue-500" />
                                    <div>
                                        <h3 className="font-semibold">Transport Needed?</h3>
                                        <p className="text-sm text-slate-500">We will pick up the boat from customer.</p>
                                    </div>
                                </div>
                                <Checkbox checked={formData.transport_needed} onCheckedChange={c => setFormData({...formData, transport_needed: !!c, distance_km: c ? formData.distance_km : 0})} className="h-6 w-6" />
                            </div>

                            {formData.transport_needed && (
                                <div className="space-y-4 pt-4 border-t animate-in fade-in slide-in-from-top-4">
                                    <div>
                                        <label className="text-sm font-medium mb-1 block">Pickup Address / Marina</label>
                                        <Input value={formData.pickup_address} onChange={e => setFormData({...formData, pickup_address: e.target.value})} placeholder="e.g. Marina Veruda" />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium mb-1 block">Distance (One-way in KM)</label>
                                        <Input type="number" value={formData.distance_km || ''} onChange={e => setFormData({...formData, distance_km: parseFloat(e.target.value) || 0})} />
                                        <p className="text-xs text-slate-400 mt-1">Pricing engine uses this to match with rate cards (0-50km, 51-100km, etc.)</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* STEP 3 - Storage (MANDATORY) */}
                    {step === 3 && (
                        <div className="space-y-6">
                            <div className="p-4 border rounded-lg bg-emerald-50 border-emerald-200">
                                <div className="flex items-center gap-3 mb-2">
                                    <Package className="text-emerald-600" />
                                    <h3 className="font-semibold">Storage Service (Mandatory)</h3>
                                </div>
                                <p className="text-sm text-slate-600">Storage is the base service and always included in every offer.</p>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm font-medium mb-1 block">Storage Period</label>
                                    <Select value={formData.storage_period} onValueChange={v => setFormData({...formData, storage_period: v})}>
                                        <SelectTrigger><SelectValue/></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="day">Daily</SelectItem>
                                            <SelectItem value="month">Monthly</SelectItem>
                                            <SelectItem value="6_months">6 Months</SelectItem>
                                            <SelectItem value="year">Full Year</SelectItem>
                                            <SelectItem value="season">Full Season</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex items-center justify-between p-4 border rounded-lg">
                                    <div>
                                        <h3 className="font-medium">Indoor / Roof Covered</h3>
                                        <p className="text-sm text-slate-500">Applies rule surcharge/multiplier</p>
                                    </div>
                                    <Checkbox checked={formData.roof_option} onCheckedChange={c => setFormData({...formData, roof_option: !!c})} />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 4 - Service Modules */}
                    {step === 4 && (
                        <div className="space-y-6">
                            {['TECH', 'CARE', 'PREMIUM'].map(group => {
                                const groupModules = modules?.filter(m => m.module_group === group).sort((a, b) => a.display_order - b.display_order) || [];
                                if (groupModules.length === 0) return null;
                                
                                const groupName = { TECH: 'Technical Service', CARE: 'Care & Value', PREMIUM: 'Premium Upgrades' }[group];
                                const isRadio = group === 'TECH' || group === 'CARE';
                                
                                return (
                                    <div key={group}>
                                        <h3 className="font-semibold mb-3">{groupName}</h3>
                                        <div className="space-y-3">
                                            {isRadio && (
                                                <div className="p-3 border rounded-lg hover:bg-slate-50 cursor-pointer"
                                                    onClick={() => setFormData({...formData, selected_modules: formData.selected_modules.filter(m => modules?.find(mod => mod.id === m.module_id)?.module_group !== group)})}>
                                                    <div className="flex items-center gap-3">
                                                        <input type="radio" checked={!formData.selected_modules.some(m => modules?.find(mod => mod.id === m.module_id)?.module_group === group)} readOnly />
                                                        <div>
                                                            <div className="font-medium">None</div>
                                                            <div className="text-sm text-slate-500">Skip {groupName}</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                            {groupModules.map(module => {
                                                const isSelected = formData.selected_modules.some(m => m.module_id === module.id);
                                                return (
                                                    <div key={module.id} className={`p-4 border rounded-lg cursor-pointer transition-all ${isSelected ? 'border-blue-500 bg-blue-50' : 'hover:bg-slate-50'}`}
                                                        onClick={() => {
                                                            if (isRadio) {
                                                                setFormData({
                                                                    ...formData,
                                                                    selected_modules: [
                                                                        ...formData.selected_modules.filter(m => modules?.find(mod => mod.id === m.module_id)?.module_group !== group),
                                                                        { module_id: module.id, module }
                                                                    ]
                                                                });
                                                            } else {
                                                                setFormData({
                                                                    ...formData,
                                                                    selected_modules: isSelected
                                                                        ? formData.selected_modules.filter(m => m.module_id !== module.id)
                                                                        : [...formData.selected_modules, { module_id: module.id, module }]
                                                                });
                                                            }
                                                        }}>
                                                        <div className="flex items-start gap-3">
                                                            <input type={isRadio ? "radio" : "checkbox"} checked={isSelected} readOnly />
                                                            <div className="flex-1">
                                                                <div className="font-semibold">{module.name}</div>
                                                                <p className="text-sm text-slate-600 mt-1">{module.description_short}</p>
                                                                {module.bullets_json?.length > 0 && (
                                                                    <ul className="text-xs text-slate-500 mt-2 space-y-1">
                                                                        {module.bullets_json.slice(0, 3).map((bullet, idx) => (
                                                                            <li key={idx}>• {bullet}</li>
                                                                        ))}
                                                                    </ul>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    
                    {/* STEP 5 - Additional Options */}
                    {step === 5 && (
                        <div className="space-y-4">
                            <h3 className="font-medium mb-4">Additional Services</h3>
                            {availableOptions.map(opt => {
                                const isSelected = formData.selected_options.some(o => o.code === opt.code);
                                return (
                                    <div key={opt.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50">
                                        <div className="flex flex-col">
                                            <span className="font-medium">{opt.title}</span>
                                            <span className="text-sm text-slate-500">€{opt.price} / {opt.unit}</span>
                                        </div>
                                        <Checkbox checked={isSelected} onCheckedChange={c => handleOptionToggle(opt.code, !!c)} />
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* STEP 6 - Review */}
                    {step === 6 && calculation && (
                        <div className="space-y-6">
                            {/* Full Function Check Panel */}
                            <div className="bg-blue-50 border border-blue-300 p-4 rounded-lg text-xs font-mono space-y-3">
                                <div className="font-bold text-blue-900">✅ FUNCTION CHECK - WIZARD CONFIGURATION</div>
                                
                                <div className="border-t border-blue-300 pt-2">
                                    <div className="font-semibold text-blue-900">Rate Card:</div>
                                    <div className="ml-2">• {activeRateCard?.name || 'N/A'}</div>
                                    <div className="ml-2">• Items loaded: {rateCardItems?.length || 0}</div>
                                    <div className="ml-2">• VAT Rate: {activeRateCard?.vat_rate}%</div>
                                </div>
                                
                                <div className="border-t border-blue-300 pt-2">
                                    <div className="font-semibold text-blue-900">User Input:</div>
                                    <div className="ml-2">• Boat Length: {formData.boat_length}m</div>
                                    <div className="ml-2">• Transport Needed: {formData.transport_needed ? 'YES' : 'NO'}</div>
                                    {formData.transport_needed && (
                                        <>
                                            <div className="ml-4 text-blue-700">- Distance: {formData.distance_km} km</div>
                                            <div className="ml-4 text-blue-700">- Pickup: {formData.pickup_address || 'N/A'}</div>
                                        </>
                                    )}
                                    <div className="ml-2">• Storage Period: {formData.storage_period}</div>
                                    <div className="ml-2">• Roof/Indoor: {formData.roof_option ? 'YES ✅' : 'NO'}</div>
                                    <div className="ml-2">• Selected Modules: {formData.selected_modules.length}</div>
                                    <div className="ml-2">• Additional Options: {formData.selected_options.length}</div>
                                </div>
                                
                                <div className="border-t border-blue-300 pt-2">
                                    <div className="font-semibold text-blue-900">Rate Card Lookup Results:</div>
                                    {formData.transport_needed && (() => {
                                        const startFee = rateCardItems?.find(i => 
                                            i.category === 'TRANSPORT_START' && 
                                            i.is_active !== false &&
                                            (i.rules_json?.length_min || 0) <= formData.boat_length && 
                                            (i.rules_json?.length_max ? i.rules_json.length_max >= formData.boat_length : true)
                                        );
                                        const kmRate = rateCardItems?.find(i => 
                                            i.category === 'TRANSPORT_KM' && 
                                            i.is_active !== false &&
                                            (i.rules_json?.distance_min || 0) <= formData.distance_km && 
                                            (i.rules_json?.distance_max ? i.rules_json.distance_max >= formData.distance_km : true)
                                        );
                                        return (
                                            <>
                                                <div className="ml-2">• TRANSPORT_START: {startFee ? `✅ ${startFee.title} - €${startFee.price}` : '❌ NOT FOUND'}</div>
                                                <div className="ml-2">• TRANSPORT_KM: {kmRate ? `✅ ${kmRate.title} - €${kmRate.price}/km` : '❌ NOT FOUND'}</div>
                                            </>
                                        );
                                    })()}
                                    {(() => {
                                        const storage = rateCardItems?.find(i => 
                                            i.category === 'STORAGE' && 
                                            i.is_active !== false &&
                                            i.rules_json?.period === formData.storage_period && 
                                            (i.rules_json?.length_min || 0) <= formData.boat_length && 
                                            (i.rules_json?.length_max ? i.rules_json.length_max >= formData.boat_length : true)
                                        );
                                        const roof = rateCardItems?.find(i => i.category === 'ROOF_RULE' && i.is_active !== false);
                                        return (
                                            <>
                                                <div className="ml-2">• STORAGE: {storage ? `✅ ${storage.title} - €${storage.price}` : '❌ NOT FOUND'}</div>
                                                {formData.roof_option && (
                                                    <div className="ml-2">• ROOF_RULE: {roof ? `✅ ${roof.title} (${roof.rules_json?.type}) - ${roof.rules_json?.type === 'multiplier' ? `x${roof.price}` : `+€${roof.price}`}` : '❌ NOT FOUND'}</div>
                                                )}
                                            </>
                                        );
                                    })()}
                                </div>
                                
                                {formData.selected_modules.length > 0 && (() => {
                                    const moduleComponentsDebug = [];
                                    const extendedParams = { ...formData };
                                    
                                    for (const selectedMod of formData.selected_modules) {
                                        const components = allModuleComponents?.filter(c => c.module_id === selectedMod.module_id) || [];
                                        moduleComponentsDebug.push({
                                            module_name: selectedMod.module.name,
                                            module_id: selectedMod.module_id,
                                            components_count: components.length,
                                            components: components.map(c => ({
                                                code: c.rate_card_item_code,
                                                qty: c.qty_value,
                                                pricing_mode: c.pricing_mode
                                            }))
                                        });
                                        
                                        for (const comp of components) {
                                            if (comp.pricing_mode === 'ADD_AS_LINE_ITEM') {
                                                extendedParams.selected_options = [
                                                    ...(extendedParams.selected_options || []),
                                                    { code: comp.rate_card_item_code, quantity: comp.qty_value }
                                                ];
                                            }
                                        }
                                    }
                                    
                                    const optionsLookup = (extendedParams.selected_options || []).filter(opt => 
                                        !formData.selected_options.find(o => o.code === opt.code)
                                    ).map(opt => {
                                        const found = rateCardItems?.find(i => i.code === opt.code && i.is_active !== false);
                                        return {
                                            code: opt.code,
                                            qty: opt.quantity,
                                            found: !!found,
                                            category: found?.category,
                                            price: found?.price,
                                            title: found?.title
                                        };
                                    });
                                    
                                    return (
                                        <div className="border-t border-blue-300 pt-2">
                                            <div className="font-semibold text-blue-900">Selected Modules ({formData.selected_modules.length}):</div>
                                            {moduleComponentsDebug.map((m, i) => (
                                                <div key={i} className="ml-2 mt-1">
                                                    <div>• {m.module_name}</div>
                                                    <div className="ml-4 text-blue-700">
                                                        Components: {m.components_count}
                                                        {m.components_count === 0 && <span className="text-red-600 font-bold"> ⚠️ NO COMPONENTS</span>}
                                                    </div>
                                                    {m.components.map((c, j) => (
                                                        <div key={j} className="ml-6 text-blue-700">
                                                            - {c.code}: Qty={c.qty}, Mode={c.pricing_mode}
                                                        </div>
                                                    ))}
                                                </div>
                                            ))}
                                            {optionsLookup.length > 0 && (
                                                <div className="mt-2">
                                                    <div className="font-semibold text-blue-900">Module Components Lookup:</div>
                                                    {optionsLookup.map((o, i) => (
                                                        <div key={i} className="ml-2">
                                                            {o.found ? (
                                                                <div className="text-green-700">✅ {o.code}: {o.title} - €{o.price} ({o.category})</div>
                                                            ) : (
                                                                <div className="text-red-600 font-bold">❌ {o.code}: NOT FOUND</div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}
                                
                                <div className="border-t border-blue-300 pt-2">
                                    <div className="font-semibold text-blue-900">Calculation Breakdown:</div>
                                    <div className="ml-2">• Line Items Generated: {calculation.lineItems.length}</div>
                                    <div className="ml-2 mt-1 space-y-1">
                                        {calculation.lineItems.map((li, i) => (
                                            <div key={i} className="text-blue-700">
                                                - {li.category}: {li.title} = €{li.total_price.toFixed(2)}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            )()}
                            
                            <div className="bg-slate-800 text-white p-4 rounded-lg">
                                <h3 className="font-medium mb-2 opacity-80">Pricing Engine Output</h3>
                                <div className="space-y-2">
                                    {calculation.lineItems.map((li, idx) => (
                                        <div key={idx} className="flex justify-between text-sm items-center border-b border-white/10 pb-2">
                                            <div>
                                                <div>{li.title}</div>
                                                <div className="text-xs opacity-60">{li.quantity} {li.unit} x €{li.unit_price} [{li.category}]</div>
                                            </div>
                                            <div className="font-mono">€{li.total_price.toFixed(2)}</div>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-4 pt-4 border-t border-white/20 text-right space-y-1">
                                    <div className="text-sm opacity-80">Subtotal: €{calculation.subtotal.toFixed(2)}</div>
                                    <div className="text-sm opacity-80">VAT ({activeRateCard.vat_rate}%): €{calculation.vat.toFixed(2)}</div>
                                    <div className="text-xl font-bold text-emerald-400 pt-2">Total: €{calculation.total.toFixed(2)}</div>
                                </div>
                            </div>
                            <p className="text-sm text-slate-500">
                                Clicking "Generate Offer" will create a standard editable Offer document with these exact line items populated.
                            </p>
                        </div>
                    )}
                </CardContent>
                <CardFooter className="bg-slate-50 border-t rounded-b-xl flex justify-between p-4">
                    <Button variant="outline" onClick={() => setStep(s => s - 1)} disabled={step === 1}>
                        <ArrowLeft className="w-4 h-4 mr-2" /> Back
                    </Button>
                    
                    {step < 6 ? (
                        <Button onClick={handleNext}>
                            Next <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                    ) : (
                        <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => createOfferMutation.mutate()} disabled={createOfferMutation.isPending}>
                            {createOfferMutation.isPending ? "Generating..." : "Generate Final Offer"}
                        </Button>
                    )}
                </CardFooter>
            </Card>
        </div>
    );
}