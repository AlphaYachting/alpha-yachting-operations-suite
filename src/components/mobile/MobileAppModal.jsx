import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import TeamMobileHome from '@/pages/TeamMobileHome';

export default function MobileAppModal({ open, onOpenChange }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[500px] h-[90vh] p-0 flex flex-col">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="flex items-center justify-between">
            <span>Mobile App</span>
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-auto">
          <TeamMobileHome />
        </div>
      </DialogContent>
    </Dialog>
  );
}