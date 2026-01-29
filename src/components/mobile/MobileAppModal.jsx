import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import TeamMobileHome from '@/pages/TeamMobileHome';
import TeamCalendar from '@/pages/TeamCalendar';
import TeamWorkOrderDetail from '@/pages/TeamWorkOrderDetail';

export default function MobileAppModal({ open, onOpenChange }) {
  const [currentView, setCurrentView] = useState('home');
  const [viewParams, setViewParams] = useState({});
  const [previewUserId, setPreviewUserId] = useState(null);

  const navigateTo = (view, params = {}) => {
    setCurrentView(view);
    setViewParams(params);
  };

  const handlePreviewUserChange = (userId) => {
    setPreviewUserId(userId);
  };

  const renderView = () => {
    switch (currentView) {
      case 'calendar':
        return <TeamCalendar onNavigate={navigateTo} previewUserId={previewUserId} />;
      case 'workOrderDetail':
        return <TeamWorkOrderDetail woId={viewParams.woId} onNavigate={navigateTo} />;
      default:
        return <TeamMobileHome onNavigate={navigateTo} previewUserId={previewUserId} onPreviewUserChange={handlePreviewUserChange} />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[500px] h-[90vh] p-0 flex flex-col">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="flex items-center justify-between">
            <span>Mobile App</span>
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-auto">
          {renderView()}
        </div>
      </DialogContent>
    </Dialog>
  );
}