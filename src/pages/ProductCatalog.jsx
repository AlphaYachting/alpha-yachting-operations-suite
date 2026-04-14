import { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Search, ShoppingCart, AlertCircle, Package, CheckCircle2, X, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function ProductCatalog() {
  const [manufacturers, setManufacturers] = useState([]);
  const [offers, setOffers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [boats, setBoats] = useState([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterMfgId, setFilterMfgId] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const [selectedItems, setSelectedItems] = useState({}); // { productId: { item, qty } }
  const [selectedOfferId, setSelectedOfferId] = useState('');
  const [offerSearch, setOfferSearch] = useState('');
  const [offerDropdownOpen, setOfferDropdownOpen] = useState(false);
  const offerDropdownRef = useRef(null);

  const [adding, setAdding] = useState(false);
  const [addSuccess, setAddSuccess] = useState(false);

  const searchTimerRef = useRef(null);

  useEffect(() => {
    loadMeta();
    const handleClick = (e) => {
      if (offerDropdownRef.current && !offerDropdownRef.current.contains(e.target)) {
        setOfferDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const loadMeta = async () => {
    const [mfgs, allOffers, cust, b] = await Promise.all([
      base44.entities.Manufacturer.filter({ active: true }),
      base44.entities.Offer.list('-created_date', 100),
      base44.entities.Customer.list(),
      base44.entities.Boat.list(),
    ]);
    setManufacturers(mfgs);
    setOffers(allOffers);
    setCustomers(cust);
    setBoats(b);
  };

  const runSearch = useCallback(async (query, mfgId) => {
    if (!query.trim() && !mfgId) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const q = query.trim().toLowerCase();
      let results = [];

      if (mfgId && !q) {
        // No query, just manufacturer filter — load all for that manufacturer
        results = await base44.entities.ProductCatalogItem.filter({ manufacturer_id: mfgId, active: true }, 'product_name', 2000);
      } else {
        // Load ALL active products — limit 2000 covers large catalogs (Victron has ~919)
        const filterObj = mfgId ? { manufacturer_id: mfgId, active: true } : { active: true };
        const all = await base44.entities.ProductCatalogItem.filter(filterObj, 'product_name', 2000);

        results = all.filter(p =>
          p.searchable_text?.includes(q) ||
          p.product_code?.toLowerCase().includes(q) ||
          p.product_name?.toLowerCase().includes(q)
        );
      }

      setSearchResults(results.slice(0, 200));
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      runSearch(searchQuery, filterMfgId);
    }, 300);
    return () => clearTimeout(searchTimerRef.current);
  }, [searchQuery, filterMfgId, runSearch]);

  const toggleItem = (item) => {
    setSelectedItems(prev => {
      const next = { ...prev };
      if (next[item.id]) {
        delete next[item.id];
      } else {
        next[item.id] = { item, qty: 1 };
      }
      return next;
    });
    setAddSuccess(false);
  };

  const updateQty = (id, qty) => {
    const n = parseFloat(qty);
    if (isNaN(n) || n <= 0) return;
    setSelectedItems(prev => ({ ...prev, [id]: { ...prev[id], qty: n } }));
  };

  const selectedCount = Object.keys(selectedItems).length;

  // Offer display helpers
  const getOfferLabel = (o) => {
    const cust = customers.find(c => c.id === o.customer_id);
    const custName = cust ? (cust.company_name || `${cust.first_name || ''} ${cust.last_name || ''}`.trim()) : '';
    return `${o.offer_number || o.id.slice(-6)} – ${o.title}${custName ? ` (${custName})` : ''}`;
  };

  const filteredOffers = offers.filter(o => {
    if (!offerSearch) return true;
    return getOfferLabel(o).toLowerCase().includes(offerSearch.toLowerCase());
  });

  const selectedOffer = offers.find(o => o.id === selectedOfferId);

  const getMfgName = (mfgId) => manufacturers.find(m => m.id === mfgId)?.name || '';

  const handleAddToOffer = async () => {
    if (!selectedOfferId) { toast.error('Please select an offer first'); return; }
    if (selectedCount === 0) { toast.error('Please select at least one product'); return; }

    setAdding(true);
    try {
      // Get current max sequence_order for this offer
      const existingTasks = await base44.entities.OfferTask.filter({ offer_id: selectedOfferId }, 'sequence_order');
      const maxSeq = existingTasks.length > 0 ? Math.max(...existingTasks.map(t => t.sequence_order || 0)) : -1;

      const lineItems = Object.values(selectedItems).map(({ item, qty }, idx) => ({
        offer_id: selectedOfferId,
        sequence_order: maxSeq + 1 + idx,
        title: `${item.product_name}`,
        description: `${getMfgName(item.manufacturer_id)} | ${item.product_code}${item.external_category_code ? ` | ${item.external_category_code}` : ''}`,
        item_type: 'Material',
        unit_type: 'Piece',
        quantity: qty,
        unit_price: item.net_price ?? 0,
        total_amount: qty * (item.net_price ?? 0),
        is_optional: false,
        meta_json: {
          catalog_item_id: item.id,
          manufacturer_id: item.manufacturer_id,
          manufacturer_name: getMfgName(item.manufacturer_id),
          product_code: item.product_code,
          tax_rate: item.tax_rate,
          unit_net_price: item.net_price,
          unit_gross_price: item.gross_price,
          unit_purchase_price: item.purchase_price,
          currency: item.currency || 'EUR',
          imported_from_catalog: true,
          source_import_id: item.source_import_id,
        },
      }));

      await base44.entities.OfferTask.bulkCreate(lineItems);
      toast.success(`${lineItems.length} product(s) added to offer ${selectedOffer?.offer_number || ''}`);
      setSelectedItems({});
      setAddSuccess(true);
    } catch (err) {
      console.error(err);
      toast.error('Failed to add products to offer');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-violet-100 rounded-lg">
            <Package className="h-6 w-6 text-violet-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Product Catalog</h1>
            <p className="text-slate-500 text-sm">Search and add products to offers</p>
          </div>
        </div>
        <Link to={createPageUrl('ProductCatalogImport')}>
          <Button variant="outline" size="sm">Manage Imports</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT: Search + Results */}
        <div className="lg:col-span-2 space-y-4">
          {/* Search bar */}
          <Card>
            <CardContent className="pt-4 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  className="pl-9"
                  placeholder="Search by product code, name, or category..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge
                  variant={filterMfgId === '' ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => setFilterMfgId('')}
                >
                  All Manufacturers
                </Badge>
                {manufacturers.map(m => (
                  <Badge
                    key={m.id}
                    variant={filterMfgId === m.id ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => setFilterMfgId(v => v === m.id ? '' : m.id)}
                  >
                    {m.name}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Results */}
          {searching && (
            <div className="text-center py-8 text-slate-400">Searching...</div>
          )}

          {!searching && searchResults.length === 0 && (searchQuery || filterMfgId) && (
            <div className="text-center py-8 text-slate-400">No products found. Try a different search term.</div>
          )}

          {!searching && !searchQuery && !filterMfgId && (
            <div className="text-center py-12 text-slate-400">
              <Search className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>Start typing to search the product catalog</p>
            </div>
          )}

          {searchResults.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-slate-500 px-1">{searchResults.length} result{searchResults.length !== 1 ? 's' : ''}</p>
              {searchResults.map(item => {
                const isSelected = !!selectedItems[item.id];
                return (
                  <div
                    key={item.id}
                    onClick={() => toggleItem(item)}
                    className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all ${
                      isSelected ? 'border-violet-400 bg-violet-50' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <Checkbox checked={isSelected} onChange={() => {}} className="flex-shrink-0 pointer-events-none" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-slate-900 text-sm truncate">{item.product_name}</span>
                        <Badge variant="outline" className="text-xs font-mono shrink-0">{item.product_code}</Badge>
                        {item.external_category_code && (
                          <Badge variant="outline" className="text-xs text-slate-500 shrink-0">{item.external_category_code}</Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{getMfgName(item.manufacturer_id)}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-semibold text-slate-900 text-sm">€{(item.net_price ?? 0).toFixed(2)}</p>
                      <p className="text-xs text-slate-400">net · {item.tax_rate ?? 0}% VAT</p>
                      {item.gross_price != null && (
                        <p className="text-xs text-slate-400">€{item.gross_price.toFixed(2)} gross</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT: Basket + Offer selector */}
        <div className="space-y-4">
          {/* Offer Selector */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Target Offer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div ref={offerDropdownRef} className="relative">
                <button
                  type="button"
                  onClick={() => setOfferDropdownOpen(v => !v)}
                  className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
                >
                  <span className={selectedOffer ? 'text-foreground truncate' : 'text-muted-foreground'}>
                    {selectedOffer ? getOfferLabel(selectedOffer) : 'Select offer...'}
                  </span>
                  <ChevronRight className="h-4 w-4 opacity-50 flex-shrink-0" />
                </button>
                {offerDropdownOpen && (
                  <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
                    <div className="flex items-center border-b px-3">
                      <Search className="mr-2 h-4 w-4 opacity-50 flex-shrink-0" />
                      <input
                        autoFocus
                        className="flex h-9 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                        placeholder="Search offer..."
                        value={offerSearch}
                        onChange={e => setOfferSearch(e.target.value)}
                      />
                    </div>
                    <div className="max-h-64 overflow-y-auto p-1">
                      {filteredOffers.length === 0 ? (
                        <div className="py-6 text-center text-sm text-muted-foreground">No offers found</div>
                      ) : filteredOffers.map(o => (
                        <div
                          key={o.id}
                          className={`relative flex cursor-pointer select-none flex-col rounded-sm px-2 py-2 text-sm hover:bg-accent ${selectedOfferId === o.id ? 'bg-accent' : ''}`}
                          onClick={() => { setSelectedOfferId(o.id); setOfferDropdownOpen(false); setOfferSearch(''); setAddSuccess(false); }}
                        >
                          <span className="font-medium">{o.offer_number || o.id.slice(-6)} — {o.title}</span>
                          <span className="text-xs text-slate-500">{customers.find(c => c.id === o.customer_id)?.company_name || `${customers.find(c => c.id === o.customer_id)?.last_name || ''}`} · {o.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {selectedOffer && (
                <div className="p-3 bg-slate-50 rounded-lg border text-sm space-y-1">
                  <p className="font-semibold">{selectedOffer.offer_number} — {selectedOffer.title}</p>
                  <div className="flex gap-2 flex-wrap">
                    <Badge className={
                      selectedOffer.status === 'Approved' ? 'bg-green-100 text-green-700' :
                      selectedOffer.status === 'Sent' ? 'bg-blue-100 text-blue-700' :
                      selectedOffer.status === 'Draft' ? 'bg-slate-100 text-slate-700' :
                      'bg-orange-100 text-orange-700'
                    }>{selectedOffer.status}</Badge>
                  </div>
                  <Link
                    to={createPageUrl('OfferDetail') + `?id=${selectedOffer.id}`}
                    className="text-xs text-blue-600 hover:underline"
                    onClick={e => e.stopPropagation()}
                  >
                    Open offer →
                  </Link>
                </div>
              )}

              {!selectedOffer && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    Select an offer before adding products.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Selected Products Basket */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4" />
                  Selected ({selectedCount})
                </CardTitle>
                {selectedCount > 0 && (
                  <Button size="sm" variant="ghost" onClick={() => { setSelectedItems({}); setAddSuccess(false); }}>
                    <X className="h-3 w-3 mr-1" /> Clear
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {selectedCount === 0 && (
                <p className="text-sm text-slate-400">No products selected. Click items in the list to select them.</p>
              )}

              {Object.values(selectedItems).map(({ item, qty }) => (
                <div key={item.id} className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-900 truncate">{item.product_name}</p>
                    <p className="text-xs text-slate-500">{item.product_code} · €{(item.net_price ?? 0).toFixed(2)}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={qty}
                      onChange={e => updateQty(item.id, e.target.value)}
                      className="w-16 h-7 text-xs text-center"
                    />
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => toggleItem(item)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}

              {selectedCount > 0 && (
                <>
                  <div className="border-t pt-3">
                    <div className="flex justify-between text-sm text-slate-600">
                      <span>Subtotal (net)</span>
                      <span className="font-semibold">
                        €{Object.values(selectedItems).reduce((s, { item, qty }) => s + (item.net_price ?? 0) * qty, 0).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {addSuccess && (
                    <div className="flex items-center gap-2 p-2 bg-emerald-50 rounded-lg border border-emerald-200">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <span className="text-sm text-emerald-700">Added to offer!</span>
                    </div>
                  )}

                  <Button
                    className="w-full bg-violet-600 hover:bg-violet-700"
                    onClick={handleAddToOffer}
                    disabled={adding || !selectedOfferId}
                  >
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    {adding ? 'Adding...' : `Add ${selectedCount} to Offer`}
                  </Button>

                  {!selectedOfferId && (
                    <p className="text-xs text-amber-600 text-center">Select an offer first</p>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}