import React, { createContext, useState, useContext, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';

const SearchIndexContext = createContext(null);

export const useSearchIndex = () => {
  const context = useContext(SearchIndexContext);
  if (!context) {
    throw new Error('useSearchIndex must be used within SearchIndexManager');
  }
  return context;
};

export default function SearchIndexManager({ children }) {
  const { isAuthenticated, user } = useAuth();
  const [searchIndex, setSearchIndex] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAuthenticated && user) {
      loadSearchIndex();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated, user]);

  const loadSearchIndex = async () => {
    try {
      setLoading(true);
      
      // Check cache validity (max 10 minutes)
      const cacheTimestamp = localStorage.getItem('search_index_timestamp');
      const now = Date.now();
      const cacheAge = cacheTimestamp ? now - parseInt(cacheTimestamp) : Infinity;
      const cacheValid = cacheAge < 10 * 60 * 1000; // 10 minutes
      
      // Try to load from localStorage if cache is valid
      if (cacheValid) {
        const cached = localStorage.getItem('search_index');
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            setSearchIndex(parsed);
          } catch (e) {
            console.error('Failed to parse cached index:', e);
          }
        }
      }

      // Fetch fresh data
      const [customers, boats, jobs, workOrders, offers] = await Promise.all([
        base44.entities.Customer.list('-updated_date', 100),
        base44.entities.Boat.list('-updated_date', 100),
        base44.entities.Job.list('-updated_date', 100),
        base44.entities.WorkOrder.list('-updated_date', 200),
        base44.entities.Offer.list('-updated_date', 50)
      ]);

      // Transform to unified index with customer lookup map
      const customerMap = {};
      customers.forEach(c => {
        customerMap[c.id] = c.company_name || `${c.first_name || ''} ${c.last_name || ''}`.trim();
      });

      const index = [
        ...customers.map(c => ({
          id: c.id,
          type: 'Customer',
          name: c.company_name || `${c.first_name || ''} ${c.last_name || ''}`.trim(),
          secondary: c.email || c.phone || '',
          searchText: [
            c.company_name,
            c.first_name,
            c.last_name,
            c.email,
            c.phone
          ].filter(Boolean).join(' ').toLowerCase(),
          route: 'CustomerDetail',
          icon: 'user'
        })),
        ...boats.map(b => ({
          id: b.id,
          type: 'Boat',
          name: b.vessel_name || 'Unknown Boat',
          secondary: [customerMap[b.customer_id], b.manufacturer, b.model].filter(Boolean).join(' • '),
          searchText: [
            b.vessel_name,
            b.manufacturer,
            b.model,
            customerMap[b.customer_id]
          ].filter(Boolean).join(' ').toLowerCase(),
          route: 'BoatDetail',
          icon: 'ship'
        })),
        ...jobs.map(j => {
          // Build related WOs (sort by sort_index asc, fallback to scheduled_date asc)
          const relatedWOs = workOrders
            .filter(wo => wo.job_id === j.id)
            .sort((a, b) => {
              if (a.sort_index != null && b.sort_index != null) return a.sort_index - b.sort_index;
              if (a.scheduled_date && b.scheduled_date) return new Date(a.scheduled_date) - new Date(b.scheduled_date);
              return 0;
            })
            .slice(0, 2)
            .map(wo => ({ id: wo.id, title: wo.title || 'Untitled', number: wo.work_order_number || '' }));

          // Build recent offers for this job's customer (offers already sorted -updated_date)
          const recentOffers = j.customer_id
            ? offers
                .filter(o => o.customer_id === j.customer_id)
                .slice(0, 3)
                .map(o => ({ id: o.id, title: o.title || 'Untitled', number: o.offer_number || '' }))
            : [];

          return {
            id: j.id,
            type: 'Project',
            name: j.title || 'Untitled Project',
            secondary: [j.job_number, customerMap[j.customer_id]].filter(Boolean).join(' · '),
            searchText: [
              j.title,
              j.job_number,
              customerMap[j.customer_id]
            ].filter(Boolean).join(' ').toLowerCase(),
            route: 'JobDetail',
            icon: 'briefcase',
            relatedWorkOrders: relatedWOs,
            recentOffers,
          };
        }),
        ...workOrders.map(wo => {
          const woJob = wo.job_id ? jobs.find(j => j.id === wo.job_id) : null;
          const woCustomer = woJob?.customer_id ? customerMap[woJob.customer_id] : null;
          const woBoat = woJob?.boat_id ? boats.find(b => b.id === woJob.boat_id) : null;
          const woSecondary = [wo.work_order_number, woCustomer, woBoat?.vessel_name].filter(Boolean).join(' · ');
          return {
            id: wo.id,
            type: 'Work Order',
            name: wo.title || 'Untitled Work Order',
            secondary: woSecondary,
            searchText: [
              wo.title,
              wo.work_order_number,
              woCustomer,
              woBoat?.vessel_name
            ].filter(Boolean).join(' ').toLowerCase(),
            route: 'WorkOrderDetail',
            icon: 'clipboard'
          };
        }),
        ...offers.map(o => ({
          id: o.id,
          type: 'Offer',
          name: o.title || 'Untitled Offer',
          secondary: [o.offer_number, customerMap[o.customer_id]].filter(Boolean).join(' • '),
          searchText: [
            o.title,
            o.offer_number,
            customerMap[o.customer_id]
          ].filter(Boolean).join(' ').toLowerCase(),
          route: 'OfferDetail',
          icon: 'file'
        }))
      ];

      setSearchIndex(index);
      
      // Cache for next load with timestamp
      localStorage.setItem('search_index', JSON.stringify(index));
      localStorage.setItem('search_index_timestamp', Date.now().toString());
    } catch (error) {
      console.error('Failed to load search index:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshIndex = () => {
    loadSearchIndex();
  };

  return (
    <SearchIndexContext.Provider value={{ searchIndex, loading, refreshIndex }}>
      {children}
    </SearchIndexContext.Provider>
  );
}