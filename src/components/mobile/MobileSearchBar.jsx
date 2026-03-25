import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Search, ClipboardList, Briefcase, X } from 'lucide-react';
import { offlineStorage } from '@/components/offline/offlineStorage';

const TYPE_ICONS = {
  'Work Order': ClipboardList,
  'Project': Briefcase,
};

// Build search index from localStorage cache (populated by desktop SearchIndexManager)
// or fall back to offlineStorage (populated by TeamMobileHome)
async function buildMobileIndex() {
  // 1. Try desktop cache first (fast, already indexed)
  try {
    const cacheTs = localStorage.getItem('search_index_timestamp');
    const cacheAge = cacheTs ? Date.now() - parseInt(cacheTs) : Infinity;
    if (cacheAge < 10 * 60 * 1000) {
      const cached = localStorage.getItem('search_index');
      if (cached) {
        const parsed = JSON.parse(cached);
        // Filter to mobile-relevant types only
        return parsed.filter(i => i.type === 'Work Order' || i.type === 'Project');
      }
    }
  } catch (e) { /* ignore */ }

  // 2. Fall back to offlineStorage
  try {
    const [workOrders, jobs] = await Promise.all([
      offlineStorage.getAllData(offlineStorage.STORES.workOrders),
      offlineStorage.getAllData(offlineStorage.STORES.jobs),
    ]);

    const index = [
      ...(workOrders || []).map(wo => ({
        id: wo.id,
        type: 'Work Order',
        name: wo.title || 'Untitled Work Order',
        secondary: wo.work_order_number || '',
        searchText: [wo.title, wo.work_order_number].filter(Boolean).join(' ').toLowerCase(),
        woId: wo.id,
      })),
      ...(jobs || []).map(j => ({
        id: j.id,
        type: 'Project',
        name: j.title || 'Untitled Project',
        secondary: j.job_number || '',
        searchText: [j.title, j.job_number].filter(Boolean).join(' ').toLowerCase(),
        woId: null, // navigate to job detail
        jobId: j.id,
      })),
    ];
    return index;
  } catch (e) {
    return [];
  }
}

export default function MobileSearchBar({ onNavigate }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [index, setIndex] = useState([]);
  const inputRef = useRef(null);
  const containerRef = useRef(null);
  const navigate = useNavigate();

  // Load index on mount
  useEffect(() => {
    buildMobileIndex().then(setIndex);
  }, []);

  // Search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.length >= 3 && index.length > 0) {
        const lq = query.toLowerCase();
        const filtered = index
          .filter(item => item.searchText.includes(lq))
          .slice(0, 8);
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

    const woId = item.woId || item.id;
    if (item.type === 'Work Order') {
      if (onNavigate) {
        onNavigate('workOrderDetail', { woId });
      } else {
        navigate(createPageUrl('TeamWorkOrderDetail') + `?woId=${woId}`);
      }
    } else if (item.type === 'Project') {
      // Navigate to job detail (desktop route, best available)
      navigate(createPageUrl('JobDetail') + `?id=${item.jobId || item.id}`);
    }
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setShowResults(false);
    inputRef.current?.focus();
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
          placeholder="Auftrag, Projekt suchen..."
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

      {/* Hint under input */}
      {query.length > 0 && query.length < 3 && (
        <p className="text-white/60 text-xs mt-1 pl-1">{3 - query.length} Buchstaben noch...</p>
      )}

      {/* Dropdown results */}
      {showResults && (
        <div className="absolute left-4 right-4 top-full mt-1 bg-white rounded-xl shadow-2xl border border-slate-100 z-50 overflow-hidden">
          {results.map((item) => {
            const Icon = TYPE_ICONS[item.type] || ClipboardList;
            return (
              <button
                key={`${item.type}-${item.id}`}
                onMouseDown={e => { e.preventDefault(); handleSelect(item); }}
                onTouchEnd={e => { e.preventDefault(); handleSelect(item); }}
                className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 active:bg-slate-100 border-b border-slate-100 last:border-b-0 text-left transition-colors"
              >
                <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <Icon className="h-4 w-4 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-500 mb-0.5">{item.type}</p>
                  <p className="font-semibold text-slate-900 text-sm truncate">{item.name}</p>
                  {item.secondary && (
                    <p className="text-xs text-slate-400 truncate">{item.secondary}</p>
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