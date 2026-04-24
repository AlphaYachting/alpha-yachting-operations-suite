/**
 * Inline edit dialogs for Customer and Boat on the OfferDetail page.
 * Opened via small "Bearbeiten" links next to the Customer/Boat selects.
 */
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import CustomerForm from '@/components/customers/CustomerForm';
import BoatForm from '@/components/boats/BoatForm';

export default function OfferEditEntityDialogs({
  showEditCustomer,
  setShowEditCustomer,
  showEditBoat,
  setShowEditBoat,
  customer,
  boat,
  customers,
  locations,
  onCustomerSaved,
  onBoatSaved,
}) {
  return (
    <>
      {/* Edit Customer Dialog */}
      <Dialog open={showEditCustomer} onOpenChange={setShowEditCustomer}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Kunde bearbeiten</DialogTitle>
          </DialogHeader>
          <CustomerForm
            customer={customer}
            onSave={onCustomerSaved}
            onCancel={() => setShowEditCustomer(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Boat Dialog */}
      <Dialog open={showEditBoat} onOpenChange={setShowEditBoat}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Boot bearbeiten</DialogTitle>
          </DialogHeader>
          <BoatForm
            boat={boat}
            customers={customers}
            locations={locations}
            onSave={onBoatSaved}
            onCancel={() => setShowEditBoat(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}