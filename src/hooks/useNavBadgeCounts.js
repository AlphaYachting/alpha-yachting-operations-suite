import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

export default function useNavBadgeCounts() {
  const [counts, setCounts] = useState({ newLeads: 0, draftOffers: 0 });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [leads, offers] = await Promise.all([
          base44.entities.Lead.filter({ status: 'New Incoming' }, '-created_date', 200),
          base44.entities.Offer.filter({ status: 'Draft' }, '-created_date', 200),
        ]);
        if (!cancelled) {
          setCounts({
            newLeads: leads?.length || 0,
            draftOffers: offers?.length || 0,
          });
        }
      } catch {
        // silently ignore
      }
    };

    load();
    const interval = setInterval(load, 60000); // refresh every 60s
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  return counts;
}