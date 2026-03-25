import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ClipboardList, X } from 'lucide-react';

export default function MobileSearchBar({ onNavigate, workOrders = [], jobs = [], boats = [], locations = [], customers = [], tasks = [] }) {
  const [index, setIndex] = useState([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const inputRef = useRef(null);
  const containerRef = useRef(null);
  const navigate = useNavigate();

  // Rebuild index whenever data changes
  useEffect(() => {
    if (!workOrders || workOrders.length === 0) {
      setIndex([]);
      return;
    }

    const newIndex = workOrders.map(wo => {
      const job = jobs.find(j => j.id === wo.job_id);
      const boat = job?.boat_id ? boats.find(b => b.id === job.boat_id) : null;
      const location = job?.location_id ? locations.find(l => l.id === job.location_id) : null;
      const customer = job?.customer_id ? customers.find(c => c.id === job.customer_id) : null;
      const woTasks = tasks.filter(t => t.work_order_id === wo.id);
      const firstTask = woTasks[0];

      const customerName = customer
        ? [customer.first_name, customer.last_name].filter(Boolean).join(' ') || customer.company_name
        : null;

      const searchParts = [
        wo.title,
        wo.work_order_number,
        wo.description,
        job?.title,
        boat?.vessel_name,
        boat?.manufacturer,
        boat?.model,
        customerName,
        location?.name,
        ...woTasks.map(t => t.title),
      ].filter(Boolean).join(' ').toLowerCase();

      return {
        id: wo.id,
        woNumber: wo.work_order_number,
        title: wo.title || 'Untitled',
        taskName: firstTask?.title || null,
        customerName,
        locationName: location?.name || null,
        boatName: boat?.vessel_name || null,
        searchText: searchParts,
        woId: wo.id,
      };
    });

    setIndex(newIndex);
  }, [workOrders, jobs, boats, locations, customers, tasks]);

  // Search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.length >= 2 && index.length > 0) {
        const lq = query.toLowerCase();
        const filtered = index.filter(item => item.searchText.includes(lq)).slice(0, 8);
        setResults(filtered);
        setShowResults(filtered.length > 0);
      } else {
        setResults([]);
        setShowResults(false);
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [query, index]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (item) => {
    setQuery('');
    setShowResults(false);
    inputRef.current?.blur();
    if (onNavigate) {
      onNavigate('workOrderDetail', { woId: item.woId });
    } else {
      navigate('/TeamWorkOrderDetail?woId=' + item.woId);
    }
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setShowResults(false);
    inputRef.current?.focus();
  };

  // Build line 3: customer · location · boat
  const buildLine3 = (item) => {
    return [item.customerName, item.locationName, item.boatName].filter(Boolean).join(' · ') || null;
  };

  return (
    <div ref={containerRef} className="relative px-4 pb-4">
      {/* Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/70 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          inputMode="search"
          autoComplete="off"
          placeholder="Auftrag suchen..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setShowResults(true)}
          className="w-full h-11 pl-10 pr-10 rounded-xl bg-white/20 border border-white/30 text-white placeholder-white/60 text-sm font-medium focus:outline-none focus:bg-white/30 focus:border-white/50 transition-all"
        />
        {query.length > 0 && (
          <button
            onMouseDown={e => { e.preventDefault(); clearSearch(); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/70 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Hint */}
      {query.length === 1 && (
        <p className="text-white/60 text-xs mt-1 pl-1">1 Buchstabe noch...</p>
      )}

      {/* Dropdown results */}
      {showResults && (
        <div className="absolute left-4 right-4 top-full mt-1 bg-white rounded-xl shadow-2xl border border-slate-100 z-50 overflow-hidden">
          {results.map((item) => {
            const line3 = buildLine3(item);
            return (
              <button
                key={item.id}
                onMouseDown={e => { e.preventDefault(); handleSelect(item); }}
                onTouchEnd={e => { e.preventDefault(); handleSelect(item); }}
                className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 active:bg-slate-100 border-b border-slate-100 last:border-b-0 text-left transition-colors"
              >
                <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <ClipboardList className="h-4 w-4 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  {/* Line 1: WO Number + Title */}
                  <p className="font-semibold text-slate-900 text-sm truncate">
                    {item.woNumber ? `${item.woNumber} · ${item.title}` : item.title}
                  </p>
                  {/* Line 2: Task */}
                  {item.taskName && (
                    <p className="text-xs text-blue-600 truncate mt-0.5">{item.taskName}</p>
                  )}
                  {/* Line 3: Customer · Location · Boat */}
                  {line3 && (
                    <p className="text-xs text-slate-400 truncate mt-0.5">{line3}</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}