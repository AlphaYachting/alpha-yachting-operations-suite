import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowRight, ArrowLeft, Package, MapPin, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { calculateOffer } from '@/components/utils/pricingEngine';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useWizard } from './WizardContext';

const SUB_STEP_TITLES = ['Boat Details', 'Transport', 'Storage', 'Modules', 'Options', 'Review'];

export function StorageTransportFlow() {
    const { wizardData, setStep: setMainStep } = useWizard();
    const navigate = useNavigate();

    const [subStep, setSubStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [calculation, setCalculation] = useState(null);

    const [formData, setFormData] = useState({
        title: 'Storage & Transport Offer',
        boat_length: wizardData.vessel?.new?.length_m || 0,
        trailer_present: false,
        transport_needed: false,
        pickup_address: '',
        distance_km: 0,
        storage_needed: true,
        storage_period: 'month',
        roof_option: false,
        selected_modules: [],
        selected_options: []
    });

    // Load pricing engine data
    const { data: rateCards } = useQuery({
        queryKey: ['ActiveRateCard'],
        queryFn: () => base44.entities.RateCard.filter({ is_active: true })
    });
    const activeRateCard = rateCards?.[0];

    const { data: rateCardItems } = useQuery({
        queryKey: ['RateCardItems', activeRateCard?.id],
        queryFn: () => base44.entities.RateCardItem.filter({ rate_card_id: activeRateCard?.id }),
        enabled: !!activeRateCard?.id
    });

    const { data: modules } = useQuery({
        queryKey: ['ProductModule'],
        queryFn: () => base44.entities.ProductModule.filter({ is_active: true })
    });

    const { data: allModuleComponents } = useQuery({
        queryKey: ['ModuleComponent_All'],
        queryFn: () => base44.entities.ModuleComponent.list()
    });

    // Resolve customer_id from wizard context (set in steps 1-4)
    const getCustomerId = () => {
        if (wizardData.source === 'customer') return wizardData.sourceData?.customer?.id;
        if (wizardData.source === 'lead') return wizardData.sourceData?.lead?.customer_id;
        return null;
    };

    const availableOptions = rateCardItems?.filter(i => i.category === 'OPTION' && i.is_active !== false) || [];

    const handleOptionToggle = (code, checked) => {
        setFormData(prev => {
            const opts = checked
                ? [...prev.selected_options, { code, quantity: 1 }]
                : prev.selected_options.filter(o => o.code !== code);
            return { ...prev, selected_options: opts };
        });
    };

    const handleBack = () => {
        if (subStep === 1) {
            setMainStep(5); // Back to Intent selection in main wizard
        } else {
            setSubStep(s => s - 1);
        }
    };

    const handleNext = () => {
        // Validation
        if (subStep === 1 && formData.boat_length <= 0) {
            toast.error("Please enter a valid boat length.");
            return;
        }

        // On sub-step 5 (Options), calculate before showing Review
        if (subStep === 5) {
            try {
                const extendedParams = { ...formData };
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

                for (const selectedMod of formData.selected_modules) {
                    const components = allModuleComponents?.filter(c => c.module_id === selectedMod.module_id) || [];
                    if (components.length === 0) {
                        toast.error(`Module "${selectedMod.module.name}" has no configured components.`);
                        return;
                    }
                }

                const res = calculateOffer(extendedParams, rateCardItems || [], activeRateCard?.vat_rate || 25);
                const hasStorage = res.lineItems.some(li => li.category === 'STORAGE' || li.category === 'ROOF_RULE');
                if (!hasStorage) {
                    toast.error("Storage base fee missing. Check rate card configuration.");
                    return;
                }
                setCalculation(res);
                setSubStep(6);
            } catch (err) {
                if (err.message.includes('STORAGE_NOT_FOUND')) {
                    toast.error(err.message.replace('STORAGE_NOT_FOUND: ', '').split('Available rates:')[0]);
                } else {
                    toast.error('Calculation failed: ' + err.message);
                }
            }
            return;
        }

        setSubStep(s => s + 1);
    };

    const handleGenerate = async () => {
        const customerId = getCustomerId();
        if (!customerId) {
            setError("No existing customer found. Storage & Transport offers require an existing customer selected in Step 2.");
            return;
        }
        if (!activeRateCard) {
            setError("No active rate card found.");
            return;
        }

        setIsSubmitting(true);
        setError('');

        try {
            // Generate offer number (same logic as StorageTransportWizard)
            const currentYear = new Date().getFullYear();
            const allOffers = await base44.entities.Offer.list();
            const existingNumbers = allOffers
                .map(o => o.offer_number)
                .filter(num => num && num.startsWith(`OFF-${currentYear}-`))
                .map(num => parseInt(num.split('-')[2]) || 0);
            const maxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
            const offerNumber = `OFF-2026-${String(maxNumber + 1).padStart(4, '0')}`;

            // Resolve boat_id and location_id from wizard context
            const boatId = typeof wizardData.vessel?.existing === 'string'
                ? wizardData.vessel.existing
                : (wizardData.vessel?.existing?.id || null);
            const locationId = typeof wizardData.location?.existing === 'string'
                ? wizardData.location.existing
                : (wizardData.location?.existing?.id || null);

            // Create Offer
            const offer = await base44.entities.Offer.create({
                customer_id: customerId,
                boat_id: boatId,
                location_id: locationId,
                title: formData.title,
                offer_number: offerNumber,
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

            // Create OfferTasks
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

            // Create OfferSections (presentation layer)
            const sections = [];
            let displayOrder = 0;
            sections.push({
                offer_id: offer.id,
                section_type: 'STORAGE',
                title: 'Storage Service',
                description: `Storage for ${formData.boat_length}m boat - ${formData.storage_period}${formData.roof_option ? ' (with roof cover)' : ''}`,
                bullets_json: ['Base storage service included'],
                display_order: displayOrder++
            });
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
            if (sections.length > 0) {
                await base44.entities.OfferSection.bulkCreate(sections);
            }

            toast.success("Storage & Transport Offer created successfully!");
            navigate(createPageUrl(`OfferDetail?id=${offer.id}`));
        } catch (err) {
            setError(err.message || 'Failed to create offer');
        } finally {
            setIsSubmitting(false);
        }
    };

    // No active rate card → show error state
    if (rateCards && !activeRateCard) {
        return (
            <div className="p-8 text-center">
                <Package className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                <h2 className="text-xl font-bold mb-2">No Active Rate Card Found</h2>
                <p className="text-slate-500 mb-4">Please configure pricing in Storage Pricing Admin before creating storage offers.</p>
                <Button variant="outline" onClick={() => setMainStep(5)}>← Back to Intent</Button>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Sub-step progress indicator */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1">
                {SUB_STEP_TITLES.map((title, idx) => (
                    <div key={idx} className="flex items-center gap-1 shrink-0">
                        <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                            subStep === idx + 1 ? 'bg-emerald-600 text-white' :
                            subStep > idx + 1 ? 'bg-green-500 text-white' :
                            'bg-slate-200 text-slate-600'
                        }`}>
                            {subStep > idx + 1 ? '✓' : idx + 1}
                        </div>
                        <span className="text-xs text-slate-600 whitespace-nowrap">{title}</span>
                        {idx < SUB_STEP_TITLES.length - 1 && <div className="h-0.5 w-4 bg-slate-200 mx-1" />}
                    </div>
                ))}
            </div>

            <Card>
                <CardHeader className="bg-slate-50 border-b">
                    <CardTitle className="text-base">
                        {subStep === 1 && "Boat Details"}
                        {subStep === 2 && "Transport Configuration"}
                        {subStep === 3 && "Storage Configuration (Required)"}
                        {subStep === 4 && "Service Modules"}
                        {subStep === 5 && "Additional Options"}
                        {subStep === 6 && "Review & Generate Offer"}
                    </CardTitle>
                </CardHeader>

                <CardContent className="pt-6">
                    {/* SUB-STEP 1: Boat Details */}
                    {subStep === 1 && (
                        <div className="space-y-4">
                            <div>
                                <label className="text-sm font-medium mb-1 block">Offer Title</label>
                                <Input
                                    value={formData.title}
                                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium mb-1 block">Boat Length (meters)</label>
                                <Input
                                    type="number"
                                    step="0.1"
                                    placeholder="e.g. 8.5"
                                    value={formData.boat_length || ''}
                                    onChange={e => setFormData({ ...formData, boat_length: parseFloat(e.target.value) || 0 })}
                                />
                                {wizardData.vessel?.new?.length_m > 0 && (
                                    <p className="text-xs text-emerald-600 mt-1">
                                        Pre-filled from selected vessel ({wizardData.vessel.new.length_m}m)
                                    </p>
                                )}
                            </div>
                            <div className="flex items-center space-x-2 pt-1">
                                <Checkbox
                                    id="trailer"
                                    checked={formData.trailer_present}
                                    onCheckedChange={c => setFormData({ ...formData, trailer_present: !!c })}
                                />
                                <label htmlFor="trailer" className="text-sm font-medium text-slate-700 cursor-pointer">
                                    Customer has own trailer
                                </label>
                            </div>
                        </div>
                    )}

                    {/* SUB-STEP 2: Transport */}
                    {subStep === 2 && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between p-4 border rounded-lg bg-blue-50/50">
                                <div className="flex items-center gap-3">
                                    <MapPin className="text-blue-500 shrink-0" />
                                    <div>
                                        <h3 className="font-semibold text-sm">Transport Needed?</h3>
                                        <p className="text-xs text-slate-500">We will pick up the boat from customer.</p>
                                    </div>
                                </div>
                                <Checkbox
                                    checked={formData.transport_needed}
                                    onCheckedChange={c => setFormData({ ...formData, transport_needed: !!c, distance_km: c ? formData.distance_km : 0 })}
                                    className="h-6 w-6"
                                />
                            </div>
                            {formData.transport_needed && (
                                <div className="space-y-4 pt-2 border-t">
                                    <div>
                                        <label className="text-sm font-medium mb-1 block">Pickup Address / Marina</label>
                                        <Input
                                            value={formData.pickup_address}
                                            onChange={e => setFormData({ ...formData, pickup_address: e.target.value })}
                                            placeholder="e.g. Marina Veruda"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium mb-1 block">Distance (one-way, km)</label>
                                        <Input
                                            type="number"
                                            value={formData.distance_km || ''}
                                            onChange={e => setFormData({ ...formData, distance_km: parseFloat(e.target.value) || 0 })}
                                            placeholder="e.g. 25"
                                        />
                                        <p className="text-xs text-slate-400 mt-1">
                                            Pricing engine matches this against rate card distance brackets.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* SUB-STEP 3: Storage Configuration */}
                    {subStep === 3 && (
                        <div className="space-y-6">
                            <div className="p-4 border rounded-lg bg-emerald-50 border-emerald-200">
                                <div className="flex items-center gap-3 mb-1">
                                    <Package className="text-emerald-600 shrink-0" />
                                    <h3 className="font-semibold text-sm">Storage Service (Mandatory)</h3>
                                </div>
                                <p className="text-sm text-slate-600">Storage is the base service and always included in every offer.</p>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm font-medium mb-1 block">Storage Period</label>
                                    <Select
                                        value={formData.storage_period}
                                        onValueChange={v => setFormData({ ...formData, storage_period: v })}
                                    >
                                        <SelectTrigger><SelectValue /></SelectTrigger>
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
                                        <h3 className="font-medium text-sm">Indoor / Roof Covered</h3>
                                        <p className="text-xs text-slate-500">Applies surcharge or multiplier from rate card</p>
                                    </div>
                                    <Checkbox
                                        checked={formData.roof_option}
                                        onCheckedChange={c => setFormData({ ...formData, roof_option: !!c })}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* SUB-STEP 4: Service Modules */}
                    {subStep === 4 && (
                        <div className="space-y-6">
                            {(!modules || modules.length === 0) && (
                                <p className="text-slate-500 text-sm py-4 text-center">No service modules configured. You can skip this step.</p>
                            )}
                            {['TECH', 'CARE', 'PREMIUM'].map(group => {
                                const groupModules = modules?.filter(m => m.module_group === group).sort((a, b) => a.display_order - b.display_order) || [];
                                if (groupModules.length === 0) return null;
                                const groupName = { TECH: 'Technical Service', CARE: 'Care & Value', PREMIUM: 'Premium Upgrades' }[group];
                                const isRadio = group === 'TECH' || group === 'CARE';
                                return (
                                    <div key={group}>
                                        <h3 className="font-semibold mb-3 text-sm">{groupName}</h3>
                                        <div className="space-y-2">
                                            {isRadio && (
                                                <div
                                                    className="p-3 border rounded-lg hover:bg-slate-50 cursor-pointer"
                                                    onClick={() => setFormData({
                                                        ...formData,
                                                        selected_modules: formData.selected_modules.filter(
                                                            m => modules?.find(mod => mod.id === m.module_id)?.module_group !== group
                                                        )
                                                    })}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <input
                                                            type="radio"
                                                            readOnly
                                                            checked={!formData.selected_modules.some(m => modules?.find(mod => mod.id === m.module_id)?.module_group === group)}
                                                        />
                                                        <span className="text-sm font-medium">None – Skip {groupName}</span>
                                                    </div>
                                                </div>
                                            )}
                                            {groupModules.map(module => {
                                                const isSelected = formData.selected_modules.some(m => m.module_id === module.id);
                                                return (
                                                    <div
                                                        key={module.id}
                                                        className={`p-3 border rounded-lg cursor-pointer transition-all ${isSelected ? 'border-emerald-500 bg-emerald-50' : 'hover:bg-slate-50'}`}
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
                                                        }}
                                                    >
                                                        <div className="flex items-start gap-3">
                                                            <input type={isRadio ? 'radio' : 'checkbox'} checked={isSelected} readOnly className="mt-0.5" />
                                                            <div>
                                                                <div className="font-medium text-sm">{module.name}</div>
                                                                <p className="text-xs text-slate-500 mt-0.5">{module.description_short}</p>
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

                    {/* SUB-STEP 5: Additional Options */}
                    {subStep === 5 && (
                        <div className="space-y-4">
                            <p className="text-sm font-medium">Additional Services</p>
                            {availableOptions.length === 0 && (
                                <p className="text-slate-500 text-sm">No additional options configured in the rate card. Click "Calculate & Review" to proceed.</p>
                            )}
                            {availableOptions.map(opt => {
                                const isSelected = formData.selected_options.some(o => o.code === opt.code);
                                return (
                                    <div key={opt.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50">
                                        <div>
                                            <span className="font-medium text-sm">{opt.title}</span>
                                            <p className="text-xs text-slate-500">€{opt.price} / {opt.unit}</p>
                                        </div>
                                        <Checkbox
                                            checked={isSelected}
                                            onCheckedChange={c => handleOptionToggle(opt.code, !!c)}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* SUB-STEP 6: Review & Generate */}
                    {subStep === 6 && calculation && (
                        <div className="space-y-6">
                            {error && (
                                <Alert variant="destructive">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertDescription>{error}</AlertDescription>
                                </Alert>
                            )}
                            {!getCustomerId() && (
                                <Alert variant="destructive">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertDescription>
                                        No existing customer found. Please go back to Step 1 and select an existing customer.
                                    </AlertDescription>
                                </Alert>
                            )}

                            {/* Summary grid */}
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div className="p-3 bg-slate-50 rounded border">
                                    <p className="text-xs text-slate-500">Boat Length</p>
                                    <p className="font-semibold">{formData.boat_length}m</p>
                                </div>
                                <div className="p-3 bg-slate-50 rounded border">
                                    <p className="text-xs text-slate-500">Storage Period</p>
                                    <p className="font-semibold capitalize">{formData.storage_period?.replace('_', ' ')}</p>
                                </div>
                                <div className="p-3 bg-slate-50 rounded border">
                                    <p className="text-xs text-slate-500">Transport</p>
                                    <p className="font-semibold">{formData.transport_needed ? `Yes – ${formData.distance_km}km` : 'Not needed'}</p>
                                </div>
                                <div className="p-3 bg-slate-50 rounded border">
                                    <p className="text-xs text-slate-500">Roof / Indoor</p>
                                    <p className="font-semibold">{formData.roof_option ? 'Yes' : 'No'}</p>
                                </div>
                                {formData.selected_modules.length > 0 && (
                                    <div className="col-span-2 p-3 bg-slate-50 rounded border">
                                        <p className="text-xs text-slate-500">Service Modules</p>
                                        <p className="font-semibold">{formData.selected_modules.map(m => m.module.name).join(', ')}</p>
                                    </div>
                                )}
                            </div>

                            {/* Pricing breakdown */}
                            <div className="bg-slate-800 text-white p-4 rounded-lg">
                                <h3 className="font-medium mb-3 text-sm opacity-80">Pricing Breakdown</h3>
                                <div className="space-y-2">
                                    {calculation.lineItems.map((li, idx) => (
                                        <div key={idx} className="flex justify-between text-sm border-b border-white/10 pb-2">
                                            <div>
                                                <div>{li.title}</div>
                                                <div className="text-xs opacity-60">{li.quantity} {li.unit} × €{li.unit_price} [{li.category}]</div>
                                            </div>
                                            <div className="font-mono shrink-0 ml-4">€{li.total_price.toFixed(2)}</div>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-4 pt-3 border-t border-white/20 text-right space-y-1">
                                    <div className="text-sm opacity-80">Subtotal: €{calculation.subtotal.toFixed(2)}</div>
                                    <div className="text-sm opacity-80">VAT ({activeRateCard?.vat_rate}%): €{calculation.vat.toFixed(2)}</div>
                                    <div className="text-xl font-bold text-emerald-400 pt-1">Total: €{calculation.total.toFixed(2)}</div>
                                </div>
                            </div>
                            <p className="text-xs text-slate-500">
                                Clicking "Generate Offer" creates a standard editable Offer document with these line items.
                            </p>
                        </div>
                    )}
                </CardContent>

                <CardFooter className="bg-slate-50 border-t flex justify-between p-4">
                    <Button variant="outline" onClick={handleBack}>
                        <ArrowLeft className="w-4 h-4 mr-2" /> Back
                    </Button>
                    {subStep < 6 ? (
                        <Button onClick={handleNext} className="bg-emerald-600 hover:bg-emerald-700">
                            {subStep === 5 ? 'Calculate & Review' : 'Next'}
                            <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                    ) : (
                        <Button
                            onClick={handleGenerate}
                            disabled={isSubmitting || !getCustomerId()}
                            className="bg-blue-600 hover:bg-blue-700"
                        >
                            {isSubmitting ? (
                                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating...</>
                            ) : 'Generate Offer'}
                        </Button>
                    )}
                </CardFooter>
            </Card>
        </div>
    );
}