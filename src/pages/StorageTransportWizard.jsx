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
import { calculateOffer } from '@/utils/pricingEngine';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/Layout/utils';

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

    // Wizard State
    const [formData, setFormData] = useState({
        customer_id: '',
        title: 'Storage & Transport Offer',
        boat_length: 0,
        trailer_present: false,
        transport_needed: false,
        pickup_address: '',
        distance_km: 0,
        storage_needed: false,
        storage_period: 'month',
        roof_option: false,
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
                calculation_snapshot_json: { rateCardItems, params: formData },
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
        if (step === 4) {
            // Generate Preview Calculation
            const res = calculateOffer(formData, rateCardItems || [], activeRateCard?.vat_rate || 25);
            setCalculation(res);
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

    if (!activeRateCard) return <div className="p-8">Loading configuration or no active Rate Card found...</div>;

    const availableOptions = rateCardItems?.filter(i => i.category === 'OPTION' && i.is_active) || [];

    return (
        <div className="max-w-3xl mx-auto p-4 lg:p-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-slate-900">Storage & Transport Wizard</h1>
                <p className="text-slate-500">Generate a custom offer configured by the pricing engine.</p>
            </div>

            {/* Stepper Indicator */}
            <div className="flex justify-between items-center mb-8 border-b pb-4">
                {[1, 2, 3, 4, 5].map((num) => (
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
                        {step === 3 && "Step 3: Storage Configuration"}
                        {step === 4 && "Step 4: Additional Options"}
                        {step === 5 && "Step 5: Review & Generate"}
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

                    {/* STEP 3 */}
                    {step === 3 && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between p-4 border rounded-lg bg-emerald-50/50">
                                <div className="flex items-center gap-3">
                                    <Package className="text-emerald-500" />
                                    <div>
                                        <h3 className="font-semibold">Storage Needed?</h3>
                                        <p className="text-sm text-slate-500">Store boat at our facility.</p>
                                    </div>
                                </div>
                                <Checkbox checked={formData.storage_needed} onCheckedChange={c => setFormData({...formData, storage_needed: !!c})} className="h-6 w-6" />
                            </div>

                            {formData.storage_needed && (
                                <div className="space-y-4 pt-4 border-t animate-in fade-in slide-in-from-top-4">
                                    <div>
                                        <label className="text-sm font-medium mb-1 block">Storage Period</label>
                                        <Select value={formData.storage_period} onValueChange={v => setFormData({...formData, storage_period: v})}>
                                            <SelectTrigger><SelectValue/></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="day">Daily</SelectItem>
                                                <SelectItem value="month">Monthly</SelectItem>
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
                            )}
                        </div>
                    )}

                    {/* STEP 4 */}
                    {step === 4 && (
                        <div className="space-y-4">
                            <h3 className="font-medium mb-4">Select Additional Services</h3>
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

                    {/* STEP 5 */}
                    {step === 5 && calculation && (
                        <div className="space-y-6">
                            <div className="bg-slate-800 text-white p-4 rounded-lg">
                                <h3 className="font-medium mb-2 opacity-80">Pricing Engine Output</h3>
                                <div className="space-y-2">
                                    {calculation.lineItems.map((li, idx) => (
                                        <div key={idx} className="flex justify-between text-sm items-center border-b border-white/10 pb-2">
                                            <div>
                                                <div>{li.title}</div>
                                                <div className="text-xs opacity-60">{li.quantity} {li.unit} x €{li.unit_price}</div>
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
                    
                    {step < 5 ? (
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