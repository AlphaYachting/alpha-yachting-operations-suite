import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';

export default function CustomerHeader({ jobCount = 0, welcomeMessage, customerName }) {
  const [logoUrl, setLogoUrl] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const loadUser = async () => {
      try {
        const userData = await base44.auth.me();
        setLogoUrl(userData?.company_logo);
      } catch (e) {
        console.log('Could not load user data');
      }
    };
    loadUser();

    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-blue-600 to-cyan-500 shadow-lg">
      <div className="px-4 py-4">
        {/* Top Row: Job Count, Time, Logo */}
        <div className="flex items-center justify-between mb-4">
          {/* Job Count Badge */}
          <div className="flex items-center justify-center h-16 w-16 rounded-full bg-white/20 backdrop-blur-sm">
            <div className="text-center">
              <div className="text-2xl font-bold text-white">{jobCount}</div>
              <div className="text-xs text-white/90">projects</div>
            </div>
          </div>

          {/* Time and Date */}
          <div className="text-center flex-1 mx-4">
            <div className="text-3xl font-bold text-white">
              {format(currentTime, 'HH:mm')}
            </div>
            <div className="text-sm text-white/90">
              {format(currentTime, 'EEE, MMM d')}
            </div>
          </div>

          {/* Logo */}
          <div className="h-16 w-16 flex items-center justify-center">
            <img 
              src={logoUrl || "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6972766f1bd9af32693610c1/a2e80b763_Bildschirmfoto2026-01-28um222024.png"}
              alt="Alpha Yachting"
              className="h-12 object-contain"
            />
          </div>
        </div>

        {/* Welcome Message */}
        {welcomeMessage && (
          <div className="bg-white/20 backdrop-blur-sm rounded-2xl px-6 py-4">
            <p className="text-white text-center font-medium">
              {welcomeMessage}
            </p>
          </div>
        )}
      </div>
    </header>
  );
}