import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function ImportNauticoRateCard() {
    const [importing, setImporting] = useState(false);
    const [result, setResult] = useState(null);

    const rateCardData = {
        name: "Nautico Novigrad 2024-2025 (imported)",
        currency: "EUR",
        vat_rate: 25,
        valid_from: "2024-10-01",
        valid_to: "2025-09-30",
        is_active: true,
        version_number: 1
    };

    const items = [
        { category: "ROOF_RULE", code: "ROOF_MULTIPLIER_150", title: "Under the roof surcharge (multiplier)", unit: "flat", price: 1.5, is_active: true, rules_json: { type: "multiplier", applies_to: "STORAGE" } },
        
        // 0-4.99m
        { category: "STORAGE", code: "STORAGE_YEAR_0_4_99", title: "Storage 1 year (0-4.99m)", unit: "year", price: 645, is_active: true, rules_json: { period: "year", length_min: 0.00, length_max: 5.00 } },
        { category: "STORAGE", code: "STORAGE_6M_0_4_99", title: "Storage 6 months (0-4.99m)", unit: "6_months", price: 405, is_active: true, rules_json: { period: "6_months", length_min: 0.00, length_max: 5.00 } },
        { category: "STORAGE", code: "STORAGE_MONTH_0_4_99", title: "Storage 1 month (0-4.99m)", unit: "month", price: 90, is_active: true, rules_json: { period: "month", length_min: 0.00, length_max: 5.00 } },
        { category: "STORAGE", code: "STORAGE_DAY_0_4_99", title: "Storage 1 day (0-4.99m)", unit: "day", price: 6, is_active: true, rules_json: { period: "day", length_min: 0.00, length_max: 5.00 } },
        
        // 5-5.99m
        { category: "STORAGE", code: "STORAGE_YEAR_5_5_99", title: "Storage 1 year (5-5.99m)", unit: "year", price: 705, is_active: true, rules_json: { period: "year", length_min: 5.00, length_max: 6.00 } },
        { category: "STORAGE", code: "STORAGE_6M_5_5_99", title: "Storage 6 months (5-5.99m)", unit: "6_months", price: 450, is_active: true, rules_json: { period: "6_months", length_min: 5.00, length_max: 6.00 } },
        { category: "STORAGE", code: "STORAGE_MONTH_5_5_99", title: "Storage 1 month (5-5.99m)", unit: "month", price: 105, is_active: true, rules_json: { period: "month", length_min: 5.00, length_max: 6.00 } },
        { category: "STORAGE", code: "STORAGE_DAY_5_5_99", title: "Storage 1 day (5-5.99m)", unit: "day", price: 9, is_active: true, rules_json: { period: "day", length_min: 5.00, length_max: 6.00 } },
        
        // 6-6.99m
        { category: "STORAGE", code: "STORAGE_YEAR_6_6_99", title: "Storage 1 year (6-6.99m)", unit: "year", price: 765, is_active: true, rules_json: { period: "year", length_min: 6.00, length_max: 7.00 } },
        { category: "STORAGE", code: "STORAGE_6M_6_6_99", title: "Storage 6 months (6-6.99m)", unit: "6_months", price: 495, is_active: true, rules_json: { period: "6_months", length_min: 6.00, length_max: 7.00 } },
        { category: "STORAGE", code: "STORAGE_MONTH_6_6_99", title: "Storage 1 month (6-6.99m)", unit: "month", price: 120, is_active: true, rules_json: { period: "month", length_min: 6.00, length_max: 7.00 } },
        { category: "STORAGE", code: "STORAGE_DAY_6_6_99", title: "Storage 1 day (6-6.99m)", unit: "day", price: 12, is_active: true, rules_json: { period: "day", length_min: 6.00, length_max: 7.00 } },
        
        // 7-7.99m
        { category: "STORAGE", code: "STORAGE_YEAR_7_7_99", title: "Storage 1 year (7-7.99m)", unit: "year", price: 825, is_active: true, rules_json: { period: "year", length_min: 7.00, length_max: 8.00 } },
        { category: "STORAGE", code: "STORAGE_6M_7_7_99", title: "Storage 6 months (7-7.99m)", unit: "6_months", price: 540, is_active: true, rules_json: { period: "6_months", length_min: 7.00, length_max: 8.00 } },
        { category: "STORAGE", code: "STORAGE_MONTH_7_7_99", title: "Storage 1 month (7-7.99m)", unit: "month", price: 135, is_active: true, rules_json: { period: "month", length_min: 7.00, length_max: 8.00 } },
        { category: "STORAGE", code: "STORAGE_DAY_7_7_99", title: "Storage 1 day (7-7.99m)", unit: "day", price: 15, is_active: true, rules_json: { period: "day", length_min: 7.00, length_max: 8.00 } },
        
        // 8-8.99m
        { category: "STORAGE", code: "STORAGE_YEAR_8_8_99", title: "Storage 1 year (8-8.99m)", unit: "year", price: 885, is_active: true, rules_json: { period: "year", length_min: 8.00, length_max: 9.00 } },
        { category: "STORAGE", code: "STORAGE_6M_8_8_99", title: "Storage 6 months (8-8.99m)", unit: "6_months", price: 585, is_active: true, rules_json: { period: "6_months", length_min: 8.00, length_max: 9.00 } },
        { category: "STORAGE", code: "STORAGE_MONTH_8_8_99", title: "Storage 1 month (8-8.99m)", unit: "month", price: 150, is_active: true, rules_json: { period: "month", length_min: 8.00, length_max: 9.00 } },
        { category: "STORAGE", code: "STORAGE_DAY_8_8_99", title: "Storage 1 day (8-8.99m)", unit: "day", price: 18, is_active: true, rules_json: { period: "day", length_min: 8.00, length_max: 9.00 } },
        
        // 9-9.99m
        { category: "STORAGE", code: "STORAGE_YEAR_9_9_99", title: "Storage 1 year (9-9.99m)", unit: "year", price: 945, is_active: true, rules_json: { period: "year", length_min: 9.00, length_max: 10.00 } },
        { category: "STORAGE", code: "STORAGE_6M_9_9_99", title: "Storage 6 months (9-9.99m)", unit: "6_months", price: 630, is_active: true, rules_json: { period: "6_months", length_min: 9.00, length_max: 10.00 } },
        { category: "STORAGE", code: "STORAGE_MONTH_9_9_99", title: "Storage 1 month (9-9.99m)", unit: "month", price: 165, is_active: true, rules_json: { period: "month", length_min: 9.00, length_max: 10.00 } },
        { category: "STORAGE", code: "STORAGE_DAY_9_9_99", title: "Storage 1 day (9-9.99m)", unit: "day", price: 22, is_active: true, rules_json: { period: "day", length_min: 9.00, length_max: 10.00 } },
        
        // 10-10.99m
        { category: "STORAGE", code: "STORAGE_YEAR_10_10_99", title: "Storage 1 year (10-10.99m)", unit: "year", price: 1005, is_active: true, rules_json: { period: "year", length_min: 10.00, length_max: 11.00 } },
        { category: "STORAGE", code: "STORAGE_6M_10_10_99", title: "Storage 6 months (10-10.99m)", unit: "6_months", price: 675, is_active: true, rules_json: { period: "6_months", length_min: 10.00, length_max: 11.00 } },
        { category: "STORAGE", code: "STORAGE_MONTH_10_10_99", title: "Storage 1 month (10-10.99m)", unit: "month", price: 180, is_active: true, rules_json: { period: "month", length_min: 10.00, length_max: 11.00 } },
        { category: "STORAGE", code: "STORAGE_DAY_10_10_99", title: "Storage 1 day (10-10.99m)", unit: "day", price: 25, is_active: true, rules_json: { period: "day", length_min: 10.00, length_max: 11.00 } },
        
        // 11-11.99m
        { category: "STORAGE", code: "STORAGE_YEAR_11_11_99", title: "Storage 1 year (11-11.99m)", unit: "year", price: 1065, is_active: true, rules_json: { period: "year", length_min: 11.00, length_max: 12.00 } },
        { category: "STORAGE", code: "STORAGE_6M_11_11_99", title: "Storage 6 months (11-11.99m)", unit: "6_months", price: 720, is_active: true, rules_json: { period: "6_months", length_min: 11.00, length_max: 12.00 } },
        { category: "STORAGE", code: "STORAGE_MONTH_11_11_99", title: "Storage 1 month (11-11.99m)", unit: "month", price: 195, is_active: true, rules_json: { period: "month", length_min: 11.00, length_max: 12.00 } },
        { category: "STORAGE", code: "STORAGE_DAY_11_11_99", title: "Storage 1 day (11-11.99m)", unit: "day", price: 28, is_active: true, rules_json: { period: "day", length_min: 11.00, length_max: 12.00 } },
        
        // 12-12.99m
        { category: "STORAGE", code: "STORAGE_YEAR_12_12_99", title: "Storage 1 year (12-12.99m)", unit: "year", price: 1125, is_active: true, rules_json: { period: "year", length_min: 12.00, length_max: 13.00 } },
        { category: "STORAGE", code: "STORAGE_6M_12_12_99", title: "Storage 6 months (12-12.99m)", unit: "6_months", price: 765, is_active: true, rules_json: { period: "6_months", length_min: 12.00, length_max: 13.00 } },
        { category: "STORAGE", code: "STORAGE_MONTH_12_12_99", title: "Storage 1 month (12-12.99m)", unit: "month", price: 210, is_active: true, rules_json: { period: "month", length_min: 12.00, length_max: 13.00 } },
        { category: "STORAGE", code: "STORAGE_DAY_12_12_99", title: "Storage 1 day (12-12.99m)", unit: "day", price: 34, is_active: true, rules_json: { period: "day", length_min: 12.00, length_max: 13.00 } },
        
        // 13m+
        { category: "STORAGE", code: "STORAGE_YEAR_13_PLUS", title: "Storage 1 year (13m+)", unit: "year", price: 1200, is_active: true, rules_json: { period: "year", length_min: 13.00, length_max: 999.00 } },
        { category: "STORAGE", code: "STORAGE_6M_13_PLUS", title: "Storage 6 months (13m+)", unit: "6_months", price: 825, is_active: true, rules_json: { period: "6_months", length_min: 13.00, length_max: 999.00 } },
        { category: "STORAGE", code: "STORAGE_MONTH_13_PLUS", title: "Storage 1 month (13m+)", unit: "month", price: 225, is_active: true, rules_json: { period: "month", length_min: 13.00, length_max: 999.00 } },
        { category: "STORAGE", code: "STORAGE_DAY_13_PLUS", title: "Storage 1 day (13m+)", unit: "day", price: 40, is_active: true, rules_json: { period: "day", length_min: 13.00, length_max: 999.00 } },
        
        // Options
        { category: "OPTION", code: "OPTION_OUTBOARD_SEASON", title: "Outboard motor storage (season)", unit: "season", price: 150, is_active: true, rules_json: { type: "storage_option" } },
        { category: "OPTION", code: "OPTION_TENDER_SEASON", title: "Tender storage (season)", unit: "season", price: 150, is_active: true, rules_json: { type: "storage_option" } },
        { category: "OPTION", code: "OPTION_WINTERCOVER_SEASON", title: "Winter cover storage (season)", unit: "season", price: 80, is_active: true, rules_json: { type: "storage_option" } },
        { category: "OPTION", code: "OPTION_BATTERY_SERVICE_SEASON", title: "Battery remove/service/charge (season)", unit: "season", price: 20, is_active: true, rules_json: { type: "service_option" } },
        { category: "OPTION", code: "OPTION_CARAVAN_DAY", title: "Caravan parking (per day)", unit: "day", price: 8, is_active: true, rules_json: { type: "parking" } },
        { category: "OPTION", code: "OPTION_TRAILER_DAY", title: "Trailer parking (per day)", unit: "day", price: 5, is_active: true, rules_json: { type: "parking" } },
        
        // Transport <8m
        { category: "TRANSPORT_START", code: "TRANSPORT_START_LT8_LOCAL", title: "Transport start fee <8m (local <5km)", unit: "flat", price: 50, is_active: true, rules_json: { boat_class: "LT8M", distance_min: 0, distance_max: 5 } },
        { category: "TRANSPORT_KM", code: "TRANSPORT_KM_LT8_0_50", title: "Transport per km <8m (0-50km)", unit: "km", price: 2.8, is_active: true, rules_json: { boat_class: "LT8M", distance_min: 0, distance_max: 50 } },
        { category: "TRANSPORT_KM", code: "TRANSPORT_KM_LT8_51_100", title: "Transport per km <8m (51-100km)", unit: "km", price: 2.6, is_active: true, rules_json: { boat_class: "LT8M", distance_min: 51, distance_max: 100 } },
        { category: "TRANSPORT_KM", code: "TRANSPORT_KM_LT8_101_200", title: "Transport per km <8m (101-200km)", unit: "km", price: 2.4, is_active: true, rules_json: { boat_class: "LT8M", distance_min: 101, distance_max: 200 } },
        { category: "TRANSPORT_KM", code: "TRANSPORT_KM_LT8_201_PLUS", title: "Transport per km <8m (201km+)", unit: "km", price: 2.0, is_active: true, rules_json: { boat_class: "LT8M", distance_min: 201, distance_max: 999999 } },
        
        // Transport <10m
        { category: "TRANSPORT_START", code: "TRANSPORT_START_LT10_LOCAL", title: "Transport start fee <10m (local <5km)", unit: "flat", price: 80, is_active: true, rules_json: { boat_class: "LT10M", distance_min: 0, distance_max: 5 } },
        { category: "TRANSPORT_KM", code: "TRANSPORT_KM_LT10_0_50", title: "Transport per km <10m (0-50km)", unit: "km", price: 3.6, is_active: true, rules_json: { boat_class: "LT10M", distance_min: 0, distance_max: 50 } },
        { category: "TRANSPORT_KM", code: "TRANSPORT_KM_LT10_51_100", title: "Transport per km <10m (51-100km)", unit: "km", price: 3.4, is_active: true, rules_json: { boat_class: "LT10M", distance_min: 51, distance_max: 100 } },
        { category: "TRANSPORT_KM", code: "TRANSPORT_KM_LT10_101_200", title: "Transport per km <10m (101-200km)", unit: "km", price: 3.2, is_active: true, rules_json: { boat_class: "LT10M", distance_min: 101, distance_max: 200 } },
        { category: "TRANSPORT_KM", code: "TRANSPORT_KM_LT10_201_PLUS", title: "Transport per km <10m (201km+)", unit: "km", price: 3.0, is_active: true, rules_json: { boat_class: "LT10M", distance_min: 201, distance_max: 999999 } }
    ];

    const handleImport = async () => {
        setImporting(true);
        setResult(null);
        
        try {
            const response = await base44.functions.invoke('importRateCard', {
                rateCardData,
                items
            });
            
            if (response.data.error) {
                toast.error(response.data.message || response.data.error);
                setResult({ success: false, ...response.data });
            } else {
                toast.success('Rate card imported successfully!');
                setResult(response.data);
            }
        } catch (error) {
            toast.error('Import failed: ' + error.message);
            setResult({ success: false, error: error.message });
        } finally {
            setImporting(false);
        }
    };

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <Card>
                <CardHeader>
                    <CardTitle>Import Nautico Novigrad Rate Card</CardTitle>
                    <CardDescription>
                        Import the complete 2024-2025 pricing structure with validation and duplicate checks.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="bg-slate-50 p-4 rounded-lg border">
                        <h3 className="font-semibold mb-2">Import Details</h3>
                        <div className="text-sm text-slate-600 space-y-1">
                            <div>• Rate Card: {rateCardData.name}</div>
                            <div>• Valid Period: {rateCardData.valid_from} to {rateCardData.valid_to}</div>
                            <div>• VAT Rate: {rateCardData.vat_rate}%</div>
                            <div>• Total Items: {items.length} (Storage: {items.filter(i => i.category === 'STORAGE').length}, Transport: {items.filter(i => i.category.startsWith('TRANSPORT')).length}, Options: {items.filter(i => i.category === 'OPTION').length})</div>
                        </div>
                    </div>

                    <Button 
                        onClick={handleImport} 
                        disabled={importing}
                        className="w-full"
                        size="lg"
                    >
                        {importing ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Importing...
                            </>
                        ) : (
                            <>
                                <Upload className="w-4 h-4 mr-2" />
                                Import Rate Card & Items
                            </>
                        )}
                    </Button>

                    {result && (
                        <div className={`p-4 rounded-lg border ${result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                            <div className="flex items-start gap-3">
                                {result.success ? (
                                    <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                                ) : (
                                    <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                                )}
                                <div className="flex-1">
                                    <h3 className="font-semibold mb-2">
                                        {result.success ? 'Import Successful' : 'Import Failed'}
                                    </h3>
                                    
                                    {result.success && result.summary && (
                                        <div className="text-sm space-y-1">
                                            <div>Rate Card ID: <span className="font-mono">{result.summary.rate_card_id}</span></div>
                                            <div>Storage items created: {result.summary.storage_created}</div>
                                            <div>Transport items created: {result.summary.transport_created}</div>
                                            <div>Option items created: {result.summary.option_created}</div>
                                            <div>Roof rule created: {result.summary.roof_created}</div>
                                            {result.summary.skipped.length > 0 && (
                                                <div className="mt-2 text-amber-700">
                                                    Skipped: {result.summary.skipped.length} items (duplicates)
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    
                                    {!result.success && (
                                        <div className="text-sm text-red-800">
                                            <div className="mb-2">{result.message}</div>
                                            {result.validation_errors && (
                                                <ul className="list-disc list-inside space-y-1">
                                                    {result.validation_errors.map((err, idx) => (
                                                        <li key={idx}>{err}</li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}