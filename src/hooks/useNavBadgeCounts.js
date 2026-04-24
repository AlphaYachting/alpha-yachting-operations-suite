import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

// Module-level stable cache — survives re-renders and navigation, never resets to 0
let _stableCounts = null; // null = not yet loaded
let _loadPromise = null;

async function loadCounts() {
  if (_loadPromise) return _loadPromise;

  _loadPromise = (async () => {
    const user = await base44.auth.me();
    const [leads, offers, workOrders, technicians] = await Promise.all([
      base44.entities.Lead.filter({ status: 'New Incoming' }, '-created_date', 200),
      base44.entities.Offer.filter({ status: 'Draft' }, '-created_date', 200),
      base44.entities.WorkOrder.list('-created_date', 500),
      base44.entities.Technician.list('-created_date', 200),
    ]);

    const myTechnicianProfile = technicians.find(tech =>
      tech.user_id === user.id || tech.email === user.email
    );

    const tasks = await base44.entities.Task.filter({ status: 'Not Started' }, '-created_date', 500);
    const notStartedCount = tasks.filter(task => {
      if (task.assigned_user_id && task.assigned_user_id === user.id) return true;
      if (!myTechnicianProfile) return false;
      const wo = workOrders.find(w => w.id === task.work_order_id);
      if (!wo) return false;
      return wo.lead_technician_id === myTechnicianProfile.id ||
        (wo.assigned_technicians && wo.assigned_technicians.includes(myTechnicianProfile.id));
    }).length;

    _stableCounts = {
      newLeads: leads?.length || 0,
      draftOffers: offers?.length || 0,
      notStartedTasks: notStartedCount,
    };
    _loadPromise = null; // allow refresh after 5 minutes
    setTimeout(() => { _loadPromise = null; _stableCounts = null; }, 5 * 60 * 1000);
    return _stableCounts;
  })().catch(() => {
    _loadPromise = null;
    return _stableCounts || { newLeads: 0, draftOffers: 0, notStartedTasks: 0 };
  });

  return _loadPromise;
}

export default function useNavBadgeCounts() {
  // Initialize immediately from cache if available — no flash to 0
  const [counts, setCounts] = useState(() => _stableCounts || { newLeads: 0, draftOffers: 0, notStartedTasks: 0 });

  useEffect(() => {
    // If already cached, don't re-fetch — just use what we have
    if (_stableCounts) {
      setCounts(_stableCounts);
      return;
    }

    // First load: delay 3s to avoid racing with page queries
    const timer = setTimeout(() => {
      loadCounts().then(c => setCounts(c)).catch(() => {});
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  return counts;
}