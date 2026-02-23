export const calculateOffer = (params, rateCardItems, vatRate = 25) => {
    let subtotal = 0;
    const lineItems = [];
    
    // Transport
    if (params.transport_needed) {
        const startFeeItem = rateCardItems.find(i => 
            i.category === 'TRANSPORT_START' && 
            i.is_active !== false &&
            (i.rules_json?.length_min || 0) <= params.boat_length && 
            (i.rules_json?.length_max ? i.rules_json.length_max >= params.boat_length : true)
        );
        
        if (startFeeItem) {
            lineItems.push({ 
                code: startFeeItem.code, 
                title: startFeeItem.title, 
                quantity: 1, 
                unit: startFeeItem.unit || 'flat', 
                unit_price: startFeeItem.price, 
                total_price: startFeeItem.price, 
                category: 'TRANSPORT_START' 
            });
            subtotal += startFeeItem.price;
        }
        
        const kmRateItem = rateCardItems.find(i => 
            i.category === 'TRANSPORT_KM' && 
            i.is_active !== false &&
            (i.rules_json?.distance_min || 0) <= params.distance_km && 
            (i.rules_json?.distance_max ? i.rules_json.distance_max >= params.distance_km : true)
        );
        
        if (kmRateItem && params.distance_km > 0) {
            const totalKmPrice = params.distance_km * kmRateItem.price;
            lineItems.push({ 
                code: kmRateItem.code, 
                title: kmRateItem.title, 
                quantity: params.distance_km, 
                unit: kmRateItem.unit || 'km', 
                unit_price: kmRateItem.price, 
                total_price: totalKmPrice, 
                category: 'TRANSPORT_KM' 
            });
            subtotal += totalKmPrice;
        }
    }
    
    // Storage
    let storageBasePrice = 0;
    if (params.storage_needed && params.storage_period) {
        const storageItem = rateCardItems.find(i => 
            i.category === 'STORAGE' && 
            i.is_active !== false &&
            i.rules_json?.period === params.storage_period && 
            (i.rules_json?.length_min || 0) <= params.boat_length && 
            (i.rules_json?.length_max ? i.rules_json.length_max >= params.boat_length : true)
        );
        
        if (storageItem) {
            storageBasePrice = storageItem.price;
            
            if (params.roof_option) {
                const roofRule = rateCardItems.find(i => i.category === 'ROOF_RULE' && i.is_active !== false);
                if (roofRule) {
                    if (roofRule.rules_json?.type === 'multiplier') {
                        const newPrice = storageBasePrice * roofRule.price;
                        lineItems.push({ 
                            code: storageItem.code + '_ROOF', 
                            title: `${storageItem.title} (With Roof Multiplier x${roofRule.price})`, 
                            quantity: 1, 
                            unit: storageItem.unit || 'flat', 
                            unit_price: newPrice, 
                            total_price: newPrice, 
                            category: 'STORAGE' 
                        });
                        storageBasePrice = newPrice;
                    } else if (roofRule.rules_json?.type === 'surcharge') {
                        lineItems.push({ 
                            code: storageItem.code, 
                            title: storageItem.title, 
                            quantity: 1, 
                            unit: storageItem.unit || 'flat', 
                            unit_price: storageBasePrice, 
                            total_price: storageBasePrice, 
                            category: 'STORAGE' 
                        });
                        lineItems.push({ 
                            code: roofRule.code, 
                            title: roofRule.title, 
                            quantity: 1, 
                            unit: roofRule.unit || 'flat', 
                            unit_price: roofRule.price, 
                            total_price: roofRule.price, 
                            category: 'ROOF_RULE' 
                        });
                        storageBasePrice += roofRule.price;
                    }
                } else {
                    lineItems.push({ code: storageItem.code, title: storageItem.title, quantity: 1, unit: storageItem.unit || 'flat', unit_price: storageBasePrice, total_price: storageBasePrice, category: 'STORAGE' });
                }
            } else {
                lineItems.push({ code: storageItem.code, title: storageItem.title, quantity: 1, unit: storageItem.unit || 'flat', unit_price: storageBasePrice, total_price: storageBasePrice, category: 'STORAGE' });
            }
            subtotal += storageBasePrice;
        }
    }
    
    // Options
    if (params.selected_options && params.selected_options.length > 0) {
        params.selected_options.forEach(opt => {
            if (opt.quantity > 0) {
                const optionItem = rateCardItems.find(i => i.category === 'OPTION' && i.code === opt.code && i.is_active !== false);
                if (optionItem) {
                    const optTotal = optionItem.price * opt.quantity;
                    lineItems.push({ 
                        code: optionItem.code, 
                        title: optionItem.title, 
                        quantity: opt.quantity, 
                        unit: optionItem.unit || 'piece', 
                        unit_price: optionItem.price, 
                        total_price: optTotal, 
                        category: 'OPTION' 
                    });
                    subtotal += optTotal;
                }
            }
        });
    }
    
    const vat = subtotal * (vatRate / 100);
    const total = subtotal + vat;
    
    return { subtotal, vat, total, lineItems };
};