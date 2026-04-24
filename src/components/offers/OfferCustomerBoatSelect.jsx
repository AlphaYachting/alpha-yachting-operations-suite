/**
 * Customer + Boat select fields for OfferDetail,
 * with inline "Bearbeiten" links that open edit dialogs.
 */
import React from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search } from 'lucide-react';
import OfferEditEntityDialogs from './OfferEditEntityDialogs';

export default function OfferCustomerBoatSelect({
  // Customer search/select
  customerDropdownRef,
  customerDropdownOpen,
  setCustomerDropdownOpen,
  setCustomerSearch,
  selectedCustomerName,
  customerSearch,
  filteredCustomers,
  customerId,
  onCustomerSelect,
  // Boat select
  boatId,
  filteredBoats,
  onBoatSelect,
  // Edit dialog state
  showEditCustomerDialog,
  setShowEditCustomerDialog,
  showEditBoatDialog,
  setShowEditBoatDialog,
  // Data for dialogs
  customers,
  boats,
  locations,
  onCustomerSaved,
  onBoatSaved,
}) {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Customer */}
        <div className="space-y-2" ref={customerDropdownRef}>
          <div className="flex items-center justify-between">
            <Label>Customer *</Label>
            {customerId && (
              <button
                type="button"
                onClick={() => setShowEditCustomerDialog(true)}
                className="text-xs text-blue-600 hover:underline"
              >
                Bearbeiten
              </button>
            )}
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => { setCustomerDropdownOpen(v => !v); setCustomerSearch(''); }}
              className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <span className={selectedCustomerName ? 'text-foreground' : 'text-muted-foreground'}>
                {selectedCustomerName || 'Select customer'}
              </span>
              <svg className="h-4 w-4 opacity-50" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
            </button>
            {customerDropdownOpen && (
              <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
                <div className="flex items-center border-b px-3">
                  <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                  <input
                    autoFocus
                    className="flex h-9 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                    placeholder="Search customer..."
                    value={customerSearch}
                    onChange={e => setCustomerSearch(e.target.value)}
                  />
                </div>
                <div className="max-h-52 overflow-y-auto p-1">
                  {filteredCustomers.length === 0 ? (
                    <div className="py-6 text-center text-sm text-muted-foreground">No customer found.</div>
                  ) : filteredCustomers.map(c => (
                    <div
                      key={c.id}
                      className={`relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground ${customerId === c.id ? 'bg-accent' : ''}`}
                      onClick={() => onCustomerSelect(c.id)}
                    >
                      {c.company_name || `${c.first_name || ''} ${c.last_name || ''}`.trim()}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Boat */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Boat</Label>
            {boatId && (
              <button
                type="button"
                onClick={() => setShowEditBoatDialog(true)}
                className="text-xs text-blue-600 hover:underline"
              >
                Bearbeiten
              </button>
            )}
          </div>
          <Select value={boatId} onValueChange={onBoatSelect}>
            <SelectTrigger>
              <SelectValue placeholder="Select boat" />
            </SelectTrigger>
            <SelectContent>
              {filteredBoats.map(b => (
                <SelectItem key={b.id} value={b.id}>
                  {b.vessel_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <OfferEditEntityDialogs
        showEditCustomer={showEditCustomerDialog}
        setShowEditCustomer={setShowEditCustomerDialog}
        showEditBoat={showEditBoatDialog}
        setShowEditBoat={setShowEditBoatDialog}
        customer={customers.find(c => c.id === customerId)}
        boat={boats.find(b => b.id === boatId)}
        customers={customers}
        locations={locations}
        onCustomerSaved={onCustomerSaved}
        onBoatSaved={onBoatSaved}
      />
    </>
  );
}