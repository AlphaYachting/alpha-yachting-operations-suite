/**
 * useRefData — Shared Reference Data Cache
 *
 * Module-level in-memory cache for stable reference datasets:
 * Customer, Boat, Location, Technician.
 *
 * TTL:
 *   customers:    15 minutes
 *   boats:        15 minutes
 *   locations:    30 minutes
 *   technicians:  15 minutes
 *
 * Pattern: identical to useLeadV3Data.js (existing cache in this codebase).
 * No Context provider, no React Query, no localStorage.
 */

import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

// ─── TTL constants (ms) ────────────────────────────────────────────────────
const TTL = {
  customers:    15 * 60 * 1000,  // 15 min
  boats:        15 * 60 * 1000,  // 15 min
  locations:    30 * 60 * 1000,  // 30 min
  technicians:  15 * 60 * 1000,  // 15 min
};

// ─── Module-level cache state ──────────────────────────────────────────────
// These survive React re-renders and page navigation (same JS module lifetime).
const _cache = {
  customers:    null,
  boats:        null,
  locations:    null,
  technicians:  null,
};

const _cacheTs = {
  customers:    0,
  boats:        0,
  locations:    0,
  technicians:  0,
};

// In-flight promise deduplication: if two components request the same entity
// simultaneously, only one backend call is made.
const _inflight = {
  customers:    null,
  boats:        null,
  locations:    null,
  technicians:  null,
};

// ─── Per-entity fetch functions ────────────────────────────────────────────

function isFresh(entity) {
  return _cache[entity] !== null && (Date.now() - _cacheTs[entity]) < TTL[entity];
}

async function fetchEntity(entity, fetcher) {
  // Cache hit — return immediately
  if (isFresh(entity)) return _cache[entity];

  // Deduplicate concurrent requests — return the existing promise if in-flight
  if (_inflight[entity]) return _inflight[entity];

  _inflight[entity] = fetcher()
    .then(data => {
      _cache[entity] = data || [];
      _cacheTs[entity] = Date.now();
      _inflight[entity] = null;
      return _cache[entity];
    })
    .catch(err => {
      _inflight[entity] = null;
      // Return stale data if available, otherwise empty array
      return _cache[entity] || [];
    });

  return _inflight[entity];
}

function fetchCustomers()    { return fetchEntity('customers',   () => base44.entities.Customer.list('-created_date', 200)); }
function fetchBoats()        { return fetchEntity('boats',       () => base44.entities.Boat.list('-created_date', 200)); }
function fetchLocations()    { return fetchEntity('locations',   () => base44.entities.Location.list()); }
function fetchTechnicians()  { return fetchEntity('technicians', () => base44.entities.Technician.list('-created_date', 200)); }

// ─── Public invalidation API ───────────────────────────────────────────────
/**
 * Invalidate cache for one or all entities.
 * Call after creating, updating, or deleting a Customer/Boat/Location/Technician.
 *
 * @param {string|null} entityName - 'customers' | 'boats' | 'locations' | 'technicians' | null (all)
 */
export function invalidateRefData(entityName = null) {
  const entities = entityName ? [entityName] : Object.keys(_cache);
  entities.forEach(e => {
    if (e in _cache) {
      _cache[e] = null;
      _cacheTs[e] = 0;
    }
  });
}

// ─── Main hook ────────────────────────────────────────────────────────────
/**
 * useRefData()
 *
 * Returns cached reference data. All four datasets are fetched in parallel
 * on first call; subsequent calls within TTL return instantly from cache.
 *
 * Returns:
 *   customers, boats, locations, technicians — arrays
 *   loading — true until all four datasets are available
 *   error — string if fetch failed (non-fatal)
 *   refreshRefData() — force re-fetch all (ignores TTL)
 *   getCustomerById(id), getBoatById(id), getLocationById(id), getTechnicianById(id)
 */
export function useRefData() {
  const [customers, setCustomers] = useState(_cache.customers || []);
  const [boats, setBoats] = useState(_cache.boats || []);
  const [locations, setLocations] = useState(_cache.locations || []);
  const [technicians, setTechnicians] = useState(_cache.technicians || []);
  const [loading, setLoading] = useState(
    // Already warm? No loading needed.
    !(_cache.customers && _cache.boats && _cache.locations && _cache.technicians)
  );
  const [error, setError] = useState(null);

  const loadAll = (forceInvalidate = false) => {
    if (forceInvalidate) invalidateRefData();

    // If everything is fresh, sync state immediately without async work
    if (
      isFresh('customers') &&
      isFresh('boats') &&
      isFresh('locations') &&
      isFresh('technicians')
    ) {
      setCustomers(_cache.customers);
      setBoats(_cache.boats);
      setLocations(_cache.locations);
      setTechnicians(_cache.technicians);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    Promise.all([
      fetchCustomers(),
      fetchBoats(),
      fetchLocations(),
      fetchTechnicians(),
    ])
      .then(([c, b, l, t]) => {
        setCustomers(c);
        setBoats(b);
        setLocations(l);
        setTechnicians(t);
        setLoading(false);
      })
      .catch(err => {
        // Individual entity errors are already handled in fetchEntity (returns [])
        // This catch handles unexpected Promise.all failures.
        setError(err?.message || 'Failed to load reference data');
        setLoading(false);
      });
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Lookup helpers (O(n) — acceptable for small reference datasets) ────
  const getCustomerById   = id => customers.find(c => c.id === id) || null;
  const getBoatById       = id => boats.find(b => b.id === id) || null;
  const getLocationById   = id => locations.find(l => l.id === id) || null;
  const getTechnicianById = id => technicians.find(t => t.id === id) || null;

  const refreshRefData = () => loadAll(true);

  return {
    customers,
    boats,
    locations,
    technicians,
    loading,
    error,
    refreshRefData,
    getCustomerById,
    getBoatById,
    getLocationById,
    getTechnicianById,
  };
}