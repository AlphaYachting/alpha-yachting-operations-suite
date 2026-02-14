import React, { createContext, useContext, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const SearchIndexContext = createContext(null);

export const useSearchIndex = () => {
  const context = useContext(SearchIndexContext);
  if (!context) {
    throw new Error('useSearchIndex must be used within SearchIndexManager');
  }
  return context;
};

export default function SearchIndexManager({ children }) {
  const [searchIndex, setSearchIndex] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSearchIndex();
  }, []);

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

      // Transform to unified index
      const index = [
        ...customers.map(c => ({
          id: c.id,
          type: 'Customer',
          name: c.company_name || `${c.first_name || ''} ${c.last_name || ''}`.trim(),
          secondary: c.email || c.phone || '',
          route: 'CustomerDetail',
          icon: 'user'
        })),
        ...boats.map(b => ({
          id: b.id,
          type: 'Boat',
          name: b.vessel_name || 'Unknown Boat',
          secondary: [b.manufacturer, b.model].filter(Boolean).join(' '),
          route: 'BoatDetail',
          icon: 'ship'
        })),
        ...jobs.map(j => ({
          id: j.id,
          type: 'Project',
          name: j.title || 'Untitled Project',
          secondary: j.job_number || '',
          route: 'JobDetail',
          icon: 'briefcase'
        })),
        ...workOrders.map(wo => ({
          id: wo.id,
          type: 'Work Order',
          name: wo.title || 'Untitled Work Order',
          secondary: wo.work_order_number || '',
          route: 'WorkOrderDetail',
          icon: 'clipboard'
        })),
        ...offers.map(o => ({
          id: o.id,
          type: 'Offer',
          name: o.title || 'Untitled Offer',
          secondary: o.offer_number || '',
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