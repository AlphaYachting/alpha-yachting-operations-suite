import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Admin access required' }, { status: 403 });
        }

        const { rateCardData, items } = await req.json();

        // STEP 1: Check if RateCard already exists
        const existing = await base44.entities.RateCard.filter({ name: rateCardData.name });
        if (existing.length > 0) {
            return Response.json({
                error: 'DUPLICATE_RATE_CARD',
                message: `RateCard "${rateCardData.name}" already exists (ID: ${existing[0].id})`,
                existing_id: existing[0].id
            }, { status: 400 });
        }

        // STEP 2: Create new RateCard
        const newRateCard = await base44.asServiceRole.entities.RateCard.create(rateCardData);
        
        const summary = {
            rate_card_id: newRateCard.id,
            rate_card_name: newRateCard.name,
            storage_created: 0,
            transport_created: 0,
            option_created: 0,
            roof_created: 0,
            skipped: [],
            validation_errors: []
        };

        // STEP 3: Check for existing items by code (should be none for new RateCard)
        const existingItems = await base44.entities.RateCardItem.filter({ rate_card_id: newRateCard.id });
        const existingCodes = new Set(existingItems.map(i => i.code));

        // STEP 4: Validate STORAGE items for overlaps within same period
        const storageItems = items.filter(i => i.category === 'STORAGE');
        const periodGroups = {};
        
        for (const item of storageItems) {
            const period = item.rules_json.period;
            if (!periodGroups[period]) periodGroups[period] = [];
            periodGroups[period].push(item);
        }

        for (const [period, group] of Object.entries(periodGroups)) {
            const sorted = group.sort((a, b) => a.rules_json.length_min - b.rules_json.length_min);
            for (let i = 0; i < sorted.length - 1; i++) {
                const curr = sorted[i];
                const next = sorted[i + 1];
                // Check for overlap: current max should be < next min (using < not <=)
                if (curr.rules_json.length_max >= next.rules_json.length_min) {
                    summary.validation_errors.push(
                        `Overlap detected in ${period}: ${curr.code} (${curr.rules_json.length_min}-${curr.rules_json.length_max}) overlaps with ${next.code} (${next.rules_json.length_min}-${next.rules_json.length_max})`
                    );
                }
            }
        }

        if (summary.validation_errors.length > 0) {
            // Rollback: delete the RateCard
            await base44.asServiceRole.entities.RateCard.delete(newRateCard.id);
            return Response.json({
                error: 'VALIDATION_FAILED',
                message: 'Storage range validation failed. RateCard not created.',
                validation_errors: summary.validation_errors
            }, { status: 400 });
        }

        // STEP 5: Check ROOF_RULE uniqueness
        const roofItems = items.filter(i => i.category === 'ROOF_RULE');
        if (roofItems.length > 1) {
            await base44.asServiceRole.entities.RateCard.delete(newRateCard.id);
            return Response.json({
                error: 'VALIDATION_FAILED',
                message: 'Multiple ROOF_RULE items found. Only one allowed per RateCard.',
                validation_errors: ['Multiple ROOF_RULE definitions']
            }, { status: 400 });
        }

        // STEP 6: Create all items
        const itemsToCreate = [];
        
        for (const item of items) {
            if (existingCodes.has(item.code)) {
                summary.skipped.push({ code: item.code, reason: 'Code already exists' });
                continue;
            }

            itemsToCreate.push({
                rate_card_id: newRateCard.id,
                category: item.category,
                code: item.code,
                title: item.title,
                unit: item.unit,
                price: item.price,
                is_active: item.is_active,
                rules_json: item.rules_json
            });

            // Count by category
            if (item.category === 'STORAGE') summary.storage_created++;
            else if (item.category.startsWith('TRANSPORT')) summary.transport_created++;
            else if (item.category === 'OPTION') summary.option_created++;
            else if (item.category === 'ROOF_RULE') summary.roof_created++;
        }

        if (itemsToCreate.length > 0) {
            await base44.asServiceRole.entities.RateCardItem.bulkCreate(itemsToCreate);
        }

        return Response.json({
            success: true,
            summary: summary
        });

    } catch (error) {
        console.error('Import error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});