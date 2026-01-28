import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Bell, Play, Pause, RotateCcw, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';

const notificationScenarios = [
  {
    id: 'work_order_assigned',
    title: 'Work Order Assigned',
    type: 'work_order_assignment',
    message: 'You have been assigned to Work Order #WO-2026-001 at Marina Novigrad',
    icon: '📋',
    delay: 2000
  },
  {
    id: 'task_reminder',
    title: 'Task Due Soon',
    type: 'work_order_reminder',
    message: 'Upcoming: Engine inspection for "Sailing Serenity" - Due in 2 hours',
    icon: '⏰',
    delay: 5000
  },
  {
    id: 'material_used',
    title: 'Material Used',
    type: 'task_status_change',
    message: 'Engine oil (5L) deducted from inventory by John Smith',
    icon: '⚙️',
    delay: 8000
  },
  {
    id: 'work_order_completed',
    title: 'Work Order Completed',
    type: 'task_status_change',
    message: 'Work Order #WO-2026-001 marked as completed by John Smith',
    icon: '✅',
    delay: 12000
  },
  {
    id: 'customer_signature',
    title: 'Customer Signature Received',
    type: 'work_order_assignment',
    message: 'Customer signed off on Work Order #WO-2026-001',
    icon: '📝',
    delay: 15000
  },
  {
    id: 'team_order_accepted',
    title: 'Team Order Accepted',
    type: 'task_status_change',
    message: 'External partner accepted Team Order #TO-2026-045',
    icon: '👥',
    delay: 18000
  }
];

export default function NotificationSimulator() {
  const [user, setUser] = useState(null);
  const [simulatedNotifications, setSimulatedNotifications] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [scenarioIndex, setScenarioIndex] = useState(0);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const userData = await base44.auth.me();
        setUser(userData);
      } catch (error) {
        console.error('Error loading user:', error);
      }
    };
    loadUser();
  }, []);

  useEffect(() => {
    if (!isRunning) return;

    const scenario = notificationScenarios[scenarioIndex];
    if (!scenario) return;

    const timer = setTimeout(async () => {
      if (scenarioIndex >= notificationScenarios.length) {
        setIsRunning(false);
        return;
      }

      const currentScenario = notificationScenarios[scenarioIndex];
      
      // Add to simulated notifications list
      const newNotification = {
        id: `sim-${Date.now()}`,
        title: currentScenario.title,
        type: currentScenario.type,
        message: currentScenario.message,
        icon: currentScenario.icon,
        is_read: false,
        created_date: new Date().toISOString(),
        timestamp: Date.now()
      };

      setSimulatedNotifications(prev => [newNotification, ...prev]);

      // If user exists, also create in database for real-time demo
      if (user?.email) {
        try {
          await base44.entities.Notification.create({
            user_email: user.email,
            title: currentScenario.title,
            type: currentScenario.type,
            message: currentScenario.message,
            is_read: false
          });
        } catch (error) {
          console.error('Error creating notification:', error);
        }
      }

      setScenarioIndex(prev => prev + 1);
    }, scenario.delay);

    return () => clearTimeout(timer);
  }, [isRunning, scenarioIndex, user]);

  const startSimulation = () => {
    setSimulatedNotifications([]);
    setScenarioIndex(0);
    setIsRunning(true);
  };

  const pauseSimulation = () => {
    setIsRunning(false);
  };

  const resetSimulation = () => {
    setSimulatedNotifications([]);
    setScenarioIndex(0);
    setIsRunning(false);
  };

  const markAllAsRead = () => {
    setSimulatedNotifications(prev =>
      prev.map(n => ({ ...n, is_read: true }))
    );
  };

  const unreadCount = simulatedNotifications.filter(n => !n.is_read).length;
  const progress = Math.round((scenarioIndex / notificationScenarios.length) * 100);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Notification Simulator</h1>
        <p className="text-slate-500 mt-2">See how real-time notifications will work in production with live event simulation</p>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Simulation Controls</span>
            <div className="flex gap-2">
              <Button
                onClick={startSimulation}
                disabled={isRunning}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <Play className="h-4 w-4 mr-2" />
                Start Simulation
              </Button>
              <Button
                onClick={pauseSimulation}
                disabled={!isRunning}
                variant="outline"
              >
                <Pause className="h-4 w-4 mr-2" />
                Pause
              </Button>
              <Button
                onClick={resetSimulation}
                variant="outline"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-700">
                Progress: {scenarioIndex}/{notificationScenarios.length}
              </span>
              <span className="text-sm text-slate-500">{progress}%</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-3 bg-blue-50 rounded-lg">
              <p className="text-2xl font-bold text-blue-600">{simulatedNotifications.length}</p>
              <p className="text-xs text-slate-600">Total Notifications</p>
            </div>
            <div className="p-3 bg-red-50 rounded-lg">
              <p className="text-2xl font-bold text-red-600">{unreadCount}</p>
              <p className="text-xs text-slate-600">Unread</p>
            </div>
            <div className="p-3 bg-emerald-50 rounded-lg">
              <p className="text-2xl font-bold text-emerald-600">{simulatedNotifications.length - unreadCount}</p>
              <p className="text-xs text-slate-600">Read</p>
            </div>
          </div>

          <div className="bg-slate-50 p-3 rounded-lg text-sm text-slate-600">
            <p><strong>How it works:</strong> This simulation triggers notifications at realistic intervals, just like real events would. Each notification is also saved to your database, demonstrating real-time sync.</p>
          </div>
        </CardContent>
      </Card>

      {/* Scenario Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Event Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {notificationScenarios.map((scenario, idx) => (
              <div
                key={scenario.id}
                className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
                  idx < scenarioIndex
                    ? 'bg-emerald-50 border border-emerald-200'
                    : idx === scenarioIndex && isRunning
                    ? 'bg-blue-50 border border-blue-300 animate-pulse'
                    : 'bg-slate-50 border border-slate-200'
                }`}
              >
                <span className="text-lg">{scenario.icon}</span>
                <div className="flex-1">
                  <p className="font-medium text-slate-900">{scenario.title}</p>
                  <p className="text-sm text-slate-600">{scenario.message}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">{(scenario.delay / 1000).toFixed(0)}s</span>
                  {idx < scenarioIndex && (
                    <Badge className="bg-emerald-100 text-emerald-700">Sent</Badge>
                  )}
                  {idx === scenarioIndex && isRunning && (
                    <Badge className="bg-blue-100 text-blue-700">Sending...</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Live Notifications Feed */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle>Live Notifications Feed</CardTitle>
              {unreadCount > 0 && (
                <Badge className="bg-red-500">{unreadCount}</Badge>
              )}
            </div>
            {simulatedNotifications.length > 0 && (
              <Button
                onClick={markAllAsRead}
                variant="ghost"
                size="sm"
                className="text-xs"
              >
                Mark all as read
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {simulatedNotifications.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Bell className="h-12 w-12 mx-auto text-slate-300 mb-3" />
              <p>Start the simulation to see notifications appear here</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {simulatedNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-3 rounded-lg border transition-all ${
                    notification.is_read
                      ? 'bg-slate-50 border-slate-200'
                      : 'bg-blue-50 border-blue-200'
                  }`}
                >
                  <div className="flex gap-3">
                    <span className="text-xl">{notification.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium text-sm ${notification.is_read ? 'text-slate-600' : 'text-slate-900'}`}>
                        {notification.title}
                      </p>
                      <p className="text-sm text-slate-600 mt-1">
                        {notification.message}
                      </p>
                      <p className="text-xs text-slate-400 mt-2">
                        {formatDistanceToNow(new Date(notification.created_date), { addSuffix: true })}
                      </p>
                    </div>
                    {!notification.is_read && (
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-1 flex-shrink-0" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* How It Will Work in Production */}
      <Card className="border-amber-200 bg-amber-50/50">
        <CardHeader>
          <CardTitle className="text-amber-900">How Notifications Work in Production</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-amber-900">
          <div>
            <strong>1. Backend Automation Triggers:</strong>
            <p className="text-amber-800 mt-1">When a technician updates a work order status, completes a task, or uses materials, a backend function automatically creates Notification records.</p>
          </div>
          <div>
            <strong>2. Real-Time Subscription:</strong>
            <p className="text-amber-800 mt-1">The NotificationBell component subscribes to Notification entity changes. The moment a new notification is created, it appears in the bell icon (if the user is logged in).</p>
          </div>
          <div>
            <strong>3. Unread Badge Updates:</strong>
            <p className="text-amber-800 mt-1">The badge shows unread count. When clicked, users can mark as read or interact with the notification to navigate to the related work order.</p>
          </div>
          <div>
            <strong>4. Scalability:</strong>
            <p className="text-amber-800 mt-1">As you grow, consider filtering notifications by role/permissions (e.g., only show certain notifications to specific team members).</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}