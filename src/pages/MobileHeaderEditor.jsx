import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowUp, ArrowDown, Save } from 'lucide-react';

export default function MobileHeaderEditor() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await base44.auth.me();
      if (currentUser?.role !== 'admin') {
        window.location.href = '/';
        return;
      }
      setUser(currentUser);

      const configs = await base44.entities.MobileHeaderConfig.list();
      if (configs.length > 0) {
        setConfig(configs[0]);
      } else {
        // Create default config
        const defaultConfig = {
          layout: {
            logoPosition: 'left',
            logoHeight: 48,
            timePosition: 'center',
            tasksPosition: 'right',
            flexDirection: 'row',
            padding: { x: 16, y: 16 },
            gap: 16,
            elementsOrder: ['logo', 'time', 'tasks'],
          },
          styling: {
            backgroundColor: 'from-blue-600 via-blue-500 to-cyan-500',
            welcomeBackground: 'bg-white/15',
            borderRadius: 'rounded-lg',
            headerHeight: 140,
          },
        };
        setConfig(defaultConfig);
      }
    } catch (error) {
      console.error('Error loading config:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateLayout = (field, value) => {
    setConfig(prev => ({
      ...prev,
      layout: {
        ...prev.layout,
        [field]: value,
      },
    }));
  };

  const updatePadding = (axis, value) => {
    setConfig(prev => ({
      ...prev,
      layout: {
        ...prev.layout,
        padding: {
          ...prev.layout.padding,
          [axis]: value,
        },
      },
    }));
  };

  const updateStyling = (field, value) => {
    setConfig(prev => ({
      ...prev,
      styling: {
        ...prev.styling,
        [field]: value,
      },
    }));
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      if (config.id) {
        await base44.entities.MobileHeaderConfig.update(config.id, config);
      } else {
        await base44.entities.MobileHeaderConfig.create(config);
      }
      alert('Header configuration saved!');
    } catch (error) {
      console.error('Error saving config:', error);
      alert('Error saving configuration');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6">Loading...</div>;
  if (!config) return <div className="p-6">Error loading configuration</div>;

  const now = new Date();
  const timeString = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const dateString = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  // Preview render
  const previewElements = {
    logo: (
      <img
        key="logo"
        src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6972766f1bd9af32693610c1/27c878803_alpha-yachting-logo-weiss.png"
        alt="Alpha Yachting"
        className="object-contain flex-shrink-0"
        style={{ height: config.layout.logoHeight }}
      />
    ),
    time: (
      <div key="time" className="flex-1">
        <p className="text-2xl font-bold font-mono leading-none">{timeString}</p>
        <p className="text-xs text-blue-100">{dateString}</p>
      </div>
    ),
    tasks: (
      <div key="tasks" className="text-right flex flex-col items-end gap-2">
        <div className="bg-white/20 rounded-full px-3 py-1">
          <p className="text-lg font-bold text-white">2</p>
          <p className="text-xs text-blue-100">tasks</p>
        </div>
      </div>
    ),
  };

  const orderedElements = config.layout.elementsOrder.map(key => previewElements[key]);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Mobile Header Editor</h1>
        <p className="text-slate-600 mt-1">Customize the layout and positioning of header elements</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Live Preview */}
        <Card>
          <CardHeader>
            <CardTitle>Live Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`bg-gradient-to-br ${config.styling.backgroundColor} text-white rounded-lg overflow-hidden`}
              style={{
                padding: `${config.layout.padding.y}px ${config.layout.padding.x}px`,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: config.layout.flexDirection,
                  gap: config.layout.gap,
                  alignItems: 'center',
                }}
              >
                {orderedElements}
              </div>
              <div className="mt-4 bg-white/15 rounded-lg p-3 border border-white/20">
                <p className="text-sm font-medium text-white">
                  Welcome back! Ready to make waves today?
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Controls */}
        <Card>
          <CardHeader>
            <CardTitle>Layout Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Logo Height */}
            <div className="space-y-2">
              <Label>Logo Height: {config.layout.logoHeight}px</Label>
              <Slider
                value={[config.layout.logoHeight]}
                onValueChange={(value) => updateLayout('logoHeight', value[0])}
                min={30}
                max={140}
                step={2}
                className="w-full"
              />
            </div>

            {/* Header Height */}
            <div className="space-y-2">
              <Label>Header Height: {config.styling.headerHeight}px</Label>
              <Slider
                value={[config.styling.headerHeight]}
                onValueChange={(value) => updateStyling('headerHeight', value[0])}
                min={80}
                max={200}
                step={5}
                className="w-full"
              />
            </div>

            {/* Gap */}
            <div className="space-y-2">
              <Label>Gap Between Elements: {config.layout.gap}px</Label>
              <Slider
                value={[config.layout.gap]}
                onValueChange={(value) => updateLayout('gap', value[0])}
                min={4}
                max={32}
                step={2}
                className="w-full"
              />
            </div>

            {/* Padding X */}
            <div className="space-y-2">
              <Label>Horizontal Padding: {config.layout.padding.x}px</Label>
              <Slider
                value={[config.layout.padding.x]}
                onValueChange={(value) => updatePadding('x', value[0])}
                min={8}
                max={32}
                step={2}
                className="w-full"
              />
            </div>

            {/* Padding Y */}
            <div className="space-y-2">
              <Label>Vertical Padding: {config.layout.padding.y}px</Label>
              <Slider
                value={[config.layout.padding.y]}
                onValueChange={(value) => updatePadding('y', value[0])}
                min={8}
                max={32}
                step={2}
                className="w-full"
              />
            </div>

            {/* Elements Order */}
            <div className="space-y-2">
              <Label>Elements Order (Left to Right)</Label>
              <div className="space-y-2">
                {config.layout.elementsOrder.map((item, index) => (
                  <div key={item} className="flex items-center gap-2">
                    {index > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const newOrder = [...config.layout.elementsOrder];
                          [newOrder[index], newOrder[index - 1]] = [
                            newOrder[index - 1],
                            newOrder[index],
                          ];
                          updateLayout('elementsOrder', newOrder);
                        }}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                    )}
                    {index < config.layout.elementsOrder.length - 1 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const newOrder = [...config.layout.elementsOrder];
                          [newOrder[index], newOrder[index + 1]] = [
                            newOrder[index + 1],
                            newOrder[index],
                          ];
                          updateLayout('elementsOrder', newOrder);
                        }}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                    )}
                    <span className="text-sm font-medium capitalize flex-1">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Save Button */}
            <Button
              onClick={saveConfig}
              disabled={saving}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              <Save className="mr-2 h-4 w-4" />
              {saving ? 'Saving...' : 'Save Configuration'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}