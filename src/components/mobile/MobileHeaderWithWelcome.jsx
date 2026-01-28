import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Settings, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

export default function MobileHeaderWithWelcome({ user, taskCount, onSettingsClick, showSettings }) {
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [loadingWelcome, setLoadingWelcome] = useState(true);

  useEffect(() => {
    generateDailyWelcome();
  }, [user]);

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

  return (
    <div className="bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-500 text-white sticky top-0 z-10 shadow-xl">
      {/* Main Header Section */}
      <div className="p-4 md:p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          {/* Logo */}
          <img 
            src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6972766f1bd9af32693610c1/27c878803_alpha-yachting-logo-weiss.png"
            alt="Alpha Yachting"
            className="h-20 md:h-24 object-contain flex-shrink-0"
          />
          
          {/* Time & Admin Button */}
          <div className="flex-1 flex flex-col justify-between h-20 md:h-24">
            <div>
              <p className="text-3xl md:text-4xl font-bold font-mono leading-none">{timeString}</p>
              <p className="text-xs md:text-sm text-blue-100 mt-1">{dateString}</p>
            </div>
            
            {/* Admin Settings Button */}
            {user?.role === 'admin' && (
              <Button 
                variant="ghost" 
                size="icon"
                onClick={onSettingsClick}
                className="h-8 w-8 hover:bg-white/20 self-end flex-shrink-0 -mt-2"
              >
                <Settings className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Welcome Message */}
        <div className="bg-white/15 backdrop-blur-sm rounded-xl p-3 md:p-4 border border-white/20 mb-4">
          <div className="flex items-start gap-2">
            {loadingWelcome && (
              <Loader2 className="h-4 w-4 mt-0.5 animate-spin flex-shrink-0" />
            )}
            <p className="text-sm md:text-base font-medium text-white leading-relaxed">
              {welcomeMessage || 'Loading your message...'}
            </p>
          </div>
        </div>

        {/* Tasks Today Badge */}
        <div className="inline-block bg-white/25 hover:bg-white/35 transition-colors rounded-full px-4 md:px-5 py-2 border border-white/30">
          <p className="text-xs md:text-sm font-semibold text-white">
            <span className="text-lg font-bold">{taskCount}</span>
            <span className="ml-2">tasks today</span>
          </p>
        </div>
      </div>

      {/* Divider */}
      <div className="h-0.5 bg-white/20"></div>
    </div>
  );
}