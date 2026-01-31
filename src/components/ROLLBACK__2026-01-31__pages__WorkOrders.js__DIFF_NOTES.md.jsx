
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom'; // Assuming react-router-dom for URL parameters

// Mock base44 API client for demonstration purposes.
// In a real application, this would be an actual API client.
const base44 = {
  entities: {
    WorkOrder: {
      list: async (orderBy, limit) => {
        console.log(`Mock: Fetching WorkOrder.list with orderBy=${orderBy}, limit=${limit}`);
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 300));
        return Array.from({ length: limit }, (_, i) => ({
          id: `wo-${i}-${Math.random().toString(16).slice(2, 6)}`,
          status: i % 3 === 0 ? 'Draft' : (i % 3 === 1 ? 'Scheduled' : 'Completed'),
          scheduled_date: `2024-01-${(i % 28) + 1}`,
          customer_id: `cust${i % 5}`,
          boat_id: `boat${i % 3}`,
          details: `Work order details for item ${i}`
        }));
      },
      filter: async (criteria, orderBy, limit) => {
        console.log(`Mock: Fetching WorkOrder.filter with criteria=${JSON.stringify(criteria)}, orderBy=${orderBy}, limit=${limit}`);
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 300));
        const allWorkOrders = await base44.entities.WorkOrder.list(orderBy, limit * 2); // Fetch more to allow filtering
        return allWorkOrders.filter(wo => {
          return Object.entries(criteria).every(([key, value]) => {
            if (key === 'work_order_id' && value.$in) { // Handle $in operator
              return value.$in.includes(wo.id);
            }
            return wo[key] === value;
          });
        }).slice(0, limit); // Apply limit after client-side filtering on mock data
      },
    },
    Job: { list: async (orderBy, limit) => { await new Promise(resolve => setTimeout(resolve, 100)); return Array.from({ length: limit }, (_, i) => ({ id: `job${i}`, name: `Job ${i}` })); } },
    Technician: { list: async () => { await new Promise(resolve => setTimeout(resolve, 100)); return Array.from({ length: 10 }, (_, i) => ({ id: `tech${i}`, name: `Tech ${i}` })); } },
    Customer: { list: async (orderBy, limit) => { await new Promise(resolve => setTimeout(resolve, 100)); return Array.from({ length: limit }, (_, i) => ({ id: `cust${i}`, name: `Customer ${i}` })); } },
    Boat: { list: async (orderBy, limit) => { await new Promise(resolve => setTimeout(resolve, 100)); return Array.from({ length: limit }, (_, i) => ({ id: `boat${i}`, name: `Boat ${i}` })); } },
    Location: { list: async () => { await new Promise(resolve => setTimeout(resolve, 100)); return Array.from({ length: 5 }, (_, i) => ({ id: `loc${i}`, name: `Location ${i}` })); } },
    InventoryReservation: { filter: async (criteria) => { await new Promise(resolve => setTimeout(resolve, 100)); return []; } },
    InventoryItem: { filter: async (criteria) => { await new Promise(resolve => setTimeout(resolve, 100)); return []; } },
    TimeEntry: { filter: async (criteria) => { await new Promise(resolve => setTimeout(resolve, 100)); const woIds = criteria.work_order_id.$in || []; return woIds.map(woId => ({ id: `te-${woId}-1`, work_order_id: woId, duration: 60 })); } },
    WorkOrderPhoto: { filter: async (criteria) => { await new Promise(resolve => setTimeout(resolve, 100)); return []; } },
    Task: { filter: async (criteria) => { await new Promise(resolve => setTimeout(resolve, 100)); return []; } },
    TeamOrder: { filter: async (criteria) => { await new Promise(resolve => setTimeout(resolve, 100)); return []; } },
  }
};

const WorkOrders = () => {
  const [searchParams] = useSearchParams();

  // Line 88 - Default Filter
  const [statusFilter, setStatusFilter] = useState('Draft');
  const [searchTerm, setSearchTerm] = useState('');
  const [boatFilter, setBoatFilter] = useState('all'); // Placeholder for other filters
  const [detailsFilter, setDetailsFilter] = useState(''); // Placeholder for other filters
  const [generalFilter, setGeneralFilter] = useState(''); // Placeholder for general filter

  const [loading, setLoading] = useState(true); // Start loading true for initial fetch

  const [workOrders, setWorkOrders] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [boats, setBoats] = useState([]);
  const [locations, setLocations] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [timeEntries, setTimeEntries] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [tasksData, setTasksData] = useState([]);
  const [allTeamOrders, setAllTeamOrders] = useState([]);

  // Load data function, now made into a useCallback to be used as a dependency
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Optimize: Only load work orders matching the current status filter
      const woQuery = statusFilter === 'all'
        ? base44.entities.WorkOrder.list('-scheduled_date', 100)
        : base44.entities.WorkOrder.filter({ status: statusFilter }, '-scheduled_date', 100);

      const [woData, jobsData, techData, custData, boatsData, locData, reservationsData, vehiclesData] = await Promise.all([
        woQuery, // ✅ Now filtered query
        base44.entities.Job.list('-created_date', 50),
        base44.entities.Technician.list(),
        base44.entities.Customer.list('-created_date', 50),
        base44.entities.Boat.list('-created_date', 50),
        base44.entities.Location.list(),
        base44.entities.InventoryReservation.filter({ status: 'Reserved' }),
        base44.entities.InventoryItem.filter({ item_type: 'VEHICLE' })
      ]);

      // Only fetch related data for work orders being displayed
      const woIds = woData.map(wo => wo.id);
      const [timeEntriesData, photosData, tasksDataFetched, allTeamOrdersFetched] = await Promise.all([
        base44.entities.TimeEntry.filter({ work_order_id: { $in: woIds } }),
        base44.entities.WorkOrderPhoto.filter({ work_order_id: { $in: woIds } }),
        base44.entities.Task.filter({ work_order_id: { $in: woIds } }),
        base44.entities.TeamOrder.filter({ work_order_id: { $in: woIds } })
      ]);

      setWorkOrders(woData);
      setJobs(jobsData);
      setTechnicians(techData);
      setCustomers(custData);
      setBoats(boatsData);
      setLocations(locData);
      setReservations(reservationsData);
      setVehicles(vehiclesData);
      setTimeEntries(timeEntriesData);
      setPhotos(photosData);
      setTasksData(tasksDataFetched);
      setAllTeamOrders(allTeamOrdersFetched);

    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]); // loadData now depends on statusFilter

  // Lines 116-131 - Added Filter Listener
  // This useEffect handles initial filter settings from URL search parameters
  useEffect(() => {
    // Apply filter from dashboard
    const filterParam = searchParams.get('filter');
    if (filterParam === 'today') {
      setStatusFilter('all');
    } else if (filterParam === 'pending') {
      setStatusFilter('Draft');
    }
    // loadData() is explicitly removed from here. It will be triggered by the statusFilter dependency in the next useEffect.
  }, [searchParams]);

  // Reload data when status filter changes
  // This useEffect handles data fetching based on changes to statusFilter
  useEffect(() => {
    // Prevent double fetch on initial mount if `loadData` is also called elsewhere,
    // though with `useCallback` and `statusFilter` dependency, this setup should be fine.
    // The `!loading` check ensures we don't attempt to load data if a previous load is still in progress.
    if (!loading) { // This condition is as per the outline's proposed change.
      loadData();
    }
  }, [statusFilter, loadData]); // `loadData` is included because it's a useCallback and might change (though unlikely here)

  // Lines 150-174 - Aggregate Work Orders (now only for the loaded ones)
  const woAggregates = useMemo(() => {
    const aggregates = {};
    workOrders.forEach(wo => { // Processes only the currently loaded work orders
      const woTimeEntries = timeEntries.filter(te => te.work_order_id === wo.id);
      // ... expensive computation for each WO (mocking with simple sum)
      aggregates[wo.id] = {
        totalTimeMinutes: woTimeEntries.reduce((sum, te) => sum + (te.duration || 0), 0),
        // Add other aggregates as needed
      };
    });
    return aggregates;
  }, [workOrders, timeEntries]); // Dependencies for memoization

  // Lines 514-546 - Client-Side Filter (still useful for search, boat, etc. on the currently loaded subset)
  const filteredWorkOrders = useMemo(() => {
    return workOrders.filter(wo => {
      // The status filter is now primarily handled server-side/at fetch time.
      // This 'matchesStatus' check will mostly be true for the loaded `workOrders`
      // unless statusFilter is 'all' or there's a discrepancy.
      const matchesStatus = statusFilter === 'all' || wo.status === statusFilter;

      // Other client-side filters (mocked)
      const matchesSearch = searchTerm === '' ||
                            wo.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            wo.details.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesBoat = boatFilter === 'all' || wo.boat_id === boatFilter;
      const matchesDetails = detailsFilter === '' || wo.details.toLowerCase().includes(detailsFilter.toLowerCase());
      const matchesFilter = generalFilter === '' ||
                            Object.values(wo).some(val =>
                              String(val).toLowerCase().includes(generalFilter.toLowerCase())
                            );

      return matchesSearch && matchesStatus && matchesBoat && matchesDetails && matchesFilter;
    });
  }, [workOrders, searchTerm, statusFilter, boatFilter, detailsFilter, generalFilter /* ... other filter dependencies */ ]);

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>Work Orders</h1>

      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <label>
          Filter by Status:
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ marginLeft: '5px' }}>
            <option value="all">All</option>
            <option value="Draft">Draft</option>
            <option value="Scheduled">Scheduled</option>
            <option value="Completed">Completed</option>
            {/* Add other statuses as needed */}
          </select>
        </label>
        <input
          type="text"
          placeholder="Search work orders..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
        />
        <label>
          Filter by Boat:
          <select value={boatFilter} onChange={(e) => setBoatFilter(e.target.value)} style={{ marginLeft: '5px' }}>
            <option value="all">All Boats</option>
            {boats.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </label>
      </div>

      {loading ? (
        <p>Loading work orders...</p>
      ) : (
        <>
          {filteredWorkOrders.length === 0 && <p>No work orders found for the current filters.</p>}

          <ul style={{ listStyle: 'none', padding: 0 }}>
            {filteredWorkOrders.map(wo => (
              <li key={wo.id} style={{ border: '1px solid #eee', marginBottom: '10px', padding: '10px', borderRadius: '5px' }}>
                <strong>ID:</strong> {wo.id} <br />
                <strong>Status:</strong> {wo.status} <br />
                <strong>Scheduled Date:</strong> {wo.scheduled_date} <br />
                <strong>Customer:</strong> {customers.find(c => c.id === wo.customer_id)?.name || 'N/A'} <br />
                <strong>Boat:</strong> {boats.find(b => b.id === wo.boat_id)?.name || 'N/A'} <br />
                <strong>Details:</strong> {wo.details} <br />
                <strong>Aggregated Time:</strong> {woAggregates[wo.id]?.totalTimeMinutes || 0} minutes
                {/* Display other WO details and related data as needed */}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
};

export default WorkOrders;
