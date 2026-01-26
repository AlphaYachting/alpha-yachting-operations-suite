import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ArrowLeft, Bell, Save } from 'lucide-react';
import { toast } from 'sonner';

export default function NotificationPreferences() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState(null);
  const [settings, setSettings] = useState({
    work_order_assignment_enabled: true,
    task_status_change_enabled: true,
    work_order_reminder_enabled: true,
    notification_method: 'both',
    notify_as_lead_only: false
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const userData = await base44.auth.me();
      setUser(userData);

      // Load user's notification settings
      const existingSettings = await base44.entities.NotificationSettings.filter({
        user_email: userData.email
      });

      if (existingSettings.length > 0) {
        setSettings(existingSettings[0]);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const existingSettings = await base44.entities.NotificationSettings.filter({
        user_email: user.email
      });

      if (existingSettings.length > 0) {
        await base44.entities.NotificationSettings.update(existingSettings[0].id, settings);
      } else {
        await base44.entities.NotificationSettings.create({
          ...settings,
          user_email: user.email
        });
      }

      toast.success('Notification preferences saved');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-12 w-64 bg-slate-200 animate-pulse rounded" />
        <div className="h-96 bg-slate-200 animate-pulse rounded" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-3">
          <Link to={createPageUrl('Settings')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Settings
          </Link>
        </Button>
        <div className="flex items-center gap-3">
          <Bell className="h-6 w-6 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Notification Preferences</h1>
            <p className="text-slate-500 mt-1">Control when and how you receive notifications</p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Notification Types</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Work Order Assignment */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="work-order-assignment" className="text-base font-medium">
                Work Order Assignments
              </Label>
              <p className="text-sm text-slate-500">
                Get notified when you're assigned to a work order
              </p>
            </div>
            <Switch
              id="work-order-assignment"
              checked={settings.work_order_assignment_enabled}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, work_order_assignment_enabled: checked })
              }
            />
          </div>

          {/* Task Status Changes */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="task-status" className="text-base font-medium">
                Task Status Changes
              </Label>
              <p className="text-sm text-slate-500">
                Get notified when task status changes on your work orders
              </p>
            </div>
            <Switch
              id="task-status"
              checked={settings.task_status_change_enabled}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, task_status_change_enabled: checked })
              }
            />
          </div>

          {/* Work Order Reminders */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="reminders" className="text-base font-medium">
                24-Hour Reminders
              </Label>
              <p className="text-sm text-slate-500">
                Get reminded 24 hours before scheduled work orders
              </p>
            </div>
            <Switch
              id="reminders"
              checked={settings.work_order_reminder_enabled}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, work_order_reminder_enabled: checked })
              }
            />
          </div>

          {/* Lead Technician Only */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="lead-only" className="text-base font-medium">
                Lead Technician Only
              </Label>
              <p className="text-sm text-slate-500">
                Only notify when assigned as lead technician (not team member)
              </p>
            </div>
            <Switch
              id="lead-only"
              checked={settings.notify_as_lead_only}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, notify_as_lead_only: checked })
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notification Method</CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={settings.notification_method}
            onValueChange={(value) =>
              setSettings({ ...settings, notification_method: value })
            }
          >
            <div className="flex items-center space-x-3 space-y-0 p-3 border rounded-lg">
              <RadioGroupItem value="both" id="both" />
              <Label htmlFor="both" className="cursor-pointer font-normal flex-1">
                <div className="font-medium">In-App & Email</div>
                <p className="text-sm text-slate-500">
                  Receive notifications in both the app and via email
                </p>
              </Label>
            </div>

            <div className="flex items-center space-x-3 space-y-0 p-3 border rounded-lg">
              <RadioGroupItem value="in_app_only" id="in_app_only" />
              <Label htmlFor="in_app_only" className="cursor-pointer font-normal flex-1">
                <div className="font-medium">In-App Only</div>
                <p className="text-sm text-slate-500">
                  Only show notifications in the app notification center
                </p>
              </Label>
            </div>

            <div className="flex items-center space-x-3 space-y-0 p-3 border rounded-lg">
              <RadioGroupItem value="email_only" id="email_only" />
              <Label htmlFor="email_only" className="cursor-pointer font-normal flex-1">
                <div className="font-medium">Email Only</div>
                <p className="text-sm text-slate-500">
                  Only receive notifications via email
                </p>
              </Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving...' : 'Save Preferences'}
        </Button>
      </div>
    </div>
  );
}