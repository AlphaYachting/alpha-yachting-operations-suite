import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

export default function useNavBadgeCounts() {
  const [counts, setCounts] = useState({ newLeads: 0, draftOffers: 0, notStartedTasks: 0 });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const user = await base44.auth.me();
        const [leads, offers, workOrders, technicians] = await Promise.all([
          base44.entities.Lead.filter({ status: 'New Incoming' }, '-created_date', 200),
          base44.entities.Offer.filter({ status: 'Draft' }, '-created_date', 200),
          base44.entities.WorkOrder.list('-created_date', 500),
          base44.entities.Technician.list('-created_date', 200),
        ]);
        
        if (!cancelled) {
          // Find technician profile for current user
          const myTechnicianProfile = technicians.find(tech => 
            tech.user_id === user.id || tech.email === user.email
          );
          
          // Count "Not Started" tasks assigned to current user
          let notStartedCount = 0;
          if (myTechnicianProfile) {
            const tasks = await base44.entities.Task.filter({ status: 'Not Started' }, '-created_date', 500);
            notStartedCount = tasks.filter(task => {
              const wo = workOrders.find(w => w.id === task.work_order_id);
              if (!wo) return false;
              return wo.lead_technician_id === myTechnicianProfile.id ||
                (wo.assigned_technicians && wo.assigned_technicians.includes(myTechnicianProfile.id));
            }).length;
          }
          
          setCounts({
            newLeads: leads?.length || 0,
            draftOffers: offers?.length || 0,
            notStartedTasks: notStartedCount,
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