import React from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function NotificationList({ notifications, onNotificationClick, onRefresh }) {
  const navigate = useNavigate();

  const getIcon = (type) => {
    switch (type) {
      case 'work_order_assignment':
        return <CheckCircle2 className="h-5 w-5 text-blue-500" />;
      case 'task_status_change':
        return <AlertCircle className="h-5 w-5 text-orange-500" />;
      case 'work_order_reminder':
        return <Clock className="h-5 w-5 text-purple-500" />;
      default:
        return <CheckCircle2 className="h-5 w-5 text-slate-500" />;
    }
  };

  const handleNotificationClick = async (notification) => {
    // Mark as read
    if (!notification.is_read) {
      await base44.entities.Notification.update(notification.id, { is_read: true });
      onRefresh();
    }

    // Navigate to related page
    if (notification.related_work_order_id) {
      navigate(createPageUrl(`WorkOrderDetail?id=${notification.related_work_order_id}`));
      onNotificationClick();
    }
  };

  if (notifications.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500">
        <p>No notifications yet</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-96">
      <div className="divide-y">
        {notifications.map((notification) => (
          <button
            key={notification.id}
            onClick={() => handleNotificationClick(notification)}
            className={`w-full p-4 text-left hover:bg-slate-50 transition-colors ${
              !notification.is_read ? 'bg-blue-50' : ''
            }`}
          >
            <div className="flex gap-3">
              {getIcon(notification.type)}
              <div className="flex-1 min-w-0">
                <p className={`font-medium text-sm ${!notification.is_read ? 'text-slate-900' : 'text-slate-600'}`}>
                  {notification.title}
                </p>
                <p className="text-sm text-slate-500 mt-1">
                  {notification.message}
                </p>
                <p className="text-xs text-slate-400 mt-2">
                  {notification.created_date ? formatDistanceToNow(new Date(notification.created_date), { addSuffix: true }) : 'Just now'}
                </p>
              </div>
              {!notification.is_read && (
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2" />
              )}
            </div>
          </button>
        ))}
      </div>
    </ScrollArea>
  );
}