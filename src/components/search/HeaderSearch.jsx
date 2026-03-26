import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useSearchIndex } from './SearchIndexManager';
import { Search, User, Ship, Briefcase, ClipboardList, FileText } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const iconMap = {
  user: User,
  ship: Ship,
  briefcase: Briefcase,
  clipboard: ClipboardList,
  file: FileText
};

export default function HeaderSearch({ compact = false }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const resultsRef = useRef(null);
  const navigate = useNavigate();
  const { searchIndex, loading } = useSearchIndex();

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.length >= 2) {
        performSearch(query);
      } else {
        setResults([]);
        setShowResults(false);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [query, searchIndex]);

  const performSearch = (searchQuery) => {
    const lowerQuery = searchQuery.toLowerCase();
    
    const filtered = searchIndex
      .filter(item => {
        // Use searchText if available, otherwise fall back to name + secondary
        const searchTarget = item.searchText || 
          `${item.name} ${item.secondary || ''}`.toLowerCase();
        return searchTarget.includes(lowerQuery);
      })
      .slice(0, 10);

    // Group by type and limit per type
    const grouped = {};
    filtered.forEach(item => {
      if (!grouped[item.type]) grouped[item.type] = [];
      if (grouped[item.type].length < 2) {
        grouped[item.type].push(item);
      }
    });

    const finalResults = Object.values(grouped).flat().slice(0, 10);
    setResults(finalResults);
    setShowResults(finalResults.length > 0);
    setSelectedIndex(0);
  };

  const handleKeyDown = (e) => {
    if (!showResults || results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) {
        handleSelect(results[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      setShowResults(false);
      inputRef.current?.blur();
    }
  };

  const handleSelect = (item) => {
    navigate(createPageUrl(`${item.route}?id=${item.id}`));
    setQuery('');
    setShowResults(false);
    inputRef.current?.blur();
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        resultsRef.current &&
        !resultsRef.current.contains(e.target) &&
        !inputRef.current?.contains(e.target)
      ) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={cn("relative w-full", !compact && "max-w-md")}>
      <div className="relative">
        <Search className={cn("absolute left-3 top-1/2 -translate-y-1/2 text-slate-400", compact ? "h-3.5 w-3.5" : "h-4 w-4")} />
        <Input
          ref={inputRef}
          type="text"
          placeholder={compact ? "Suchen..." : "Search customers, boats, projects..."}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => query.length >= 2 && results.length > 0 && setShowResults(true)}
          className={cn("pl-8 pr-3", compact && "h-8 text-sm")}
          disabled={loading}
        />
      </div>

      {showResults && (
        <div
          ref={resultsRef}
          className="absolute top-full mt-2 w-full bg-white border border-slate-200 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto"
        >
          {results.map((item, index) => {
            const Icon = iconMap[item.icon] || FileText;
            return (
              <button
                key={`${item.type}-${item.id}`}
                onClick={() => handleSelect(item)}
                className={cn(
                  "w-full px-4 py-3 flex items-start gap-3 hover:bg-slate-50 transition-colors text-left border-b border-slate-100 last:border-b-0",
                  selectedIndex === index && "bg-slate-50"
                )}
              >
                <Icon className="h-5 w-5 text-slate-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-medium text-slate-500">{item.type}</span>
                  </div>
                  <div className="font-medium text-slate-900 truncate">{item.name}</div>
                  {item.secondary && (
                    <div className="text-sm text-slate-500 truncate">{item.secondary}</div>
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