import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Settings, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

export default function MobileHeaderWithWelcome({ user, taskCount, onSettingsClick, showSettings }) {
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [loadingWelcome, setLoadingWelcome] = useState(true);
  const [config, setConfig] = useState(null);

  useEffect(() => {
    loadConfig();
    generateDailyWelcome();
  }, [user]);

  const loadConfig = async () => {
    try {
      const configs = await base44.entities.MobileHeaderConfig.list();
      if (configs.length > 0) {
        setConfig(configs[0]);
      }
    } catch (error) {
      console.error('Error loading header config:', error);
    }
  };

  const generateDailyWelcome = async () => {
    if (!user) return;

    const today = format(new Date(), 'yyyy-MM-dd');
    const cacheKey = `welcome_${user.id}_${today}`;
    
    // Check if we have cached message for today
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      setWelcomeMessage(cached);
      setLoadingWelcome(false);
      return;
    }

    try {
      const firstName = user.full_name?.split(' ')[0] || 'Team';
      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate a short, uplifting, and professional welcome message for a yacht service technician named "${firstName}" for the Alpha Yachting team mobile app. The message should be 1-2 sentences, encouraging, and relate to their marine service work. Make it feel fresh and unique. Keep it under 50 words.`,
        add_context_from_internet: false
      });

      const message = response.trim();
      setWelcomeMessage(message);
      
      // Cache for the day
      localStorage.setItem(cacheKey, message);
    } catch (error) {
      console.error('Error generating welcome:', error);
      // Fallback message
      const firstName = user.full_name?.split(' ')[0] || 'Team';
      setWelcomeMessage(`Welcome back, ${firstName}! Ready to make waves today?`);
    } finally {
      setLoadingWelcome(false);
    }
  };

  const now = new Date();
  const timeString = format(now, 'HH:mm');
  const dateString = format(now, 'EEE, MMM d');

  const layout = config?.layout || {
    logoPosition: 'left',
    logoHeight: 48,
    timePosition: 'center',
    tasksPosition: 'right',
    flexDirection: 'row',
    padding: { x: 16, y: 16 },
    gap: 16,
    elementsOrder: ['logo', 'time', 'tasks'],
  };

  const elements = {
    logo: (
      <img 
        key="logo"
        src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6972766f1bd9af32693610c1/27c878803_alpha-yachting-logo-weiss.png"
        alt="Alpha Yachting"
        className="object-contain flex-shrink-0"
        style={{ height: layout.logoHeight }}
      />
    ),
    time: (
      <div key="time" className="flex-1">
        <p className="text-2xl md:text-3xl font-bold font-mono leading-none">{timeString}</p>
        <p className="text-xs text-blue-100">{dateString}</p>
      </div>
    ),
    tasks: (
      <div key="tasks" className="bg-white/20 rounded-full px-3 py-1">
        <p className="text-lg md:text-xl font-bold text-white">{taskCount}</p>
        <p className="text-xs text-blue-100">tasks</p>
      </div>
    ),
  };

  const orderedElements = layout.elementsOrder.map(key => elements[key]);

  return (
    <div className={`bg-gradient-to-br ${config?.styling?.backgroundColor || 'from-blue-600 via-blue-500 to-cyan-500'} text-white sticky top-0 z-10 shadow-xl`}>
      {/* Header Top Row - Logo, Time, Tasks Count */}
      <div className="relative">
        <div
          style={{
            padding: `${layout.padding.y}px ${layout.padding.x}px`,
            display: 'flex',
            flexDirection: layout.flexDirection,
            gap: layout.gap,
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {orderedElements}
        </div>
        {user?.role === 'admin' && (
          <Button 
            variant="ghost" 
            size="icon"
            onClick={onSettingsClick}
            className="absolute top-2 right-2 h-7 w-7 hover:bg-white/20 flex-shrink-0"
          >
            <Settings className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Welcome Message */}
      <div className="px-4 md:px-5 pb-4">
        <div className="bg-white/15 backdrop-blur-sm rounded-lg p-3 border border-white/20 flex items-start gap-2">
          {loadingWelcome && (
            <Loader2 className="h-4 w-4 mt-0.5 animate-spin flex-shrink-0" />
          )}
          <p className="text-sm font-medium text-white leading-relaxed">
            {welcomeMessage || 'Loading your message...'}
          </p>
        </div>
      </div>
    </div>
  );
}