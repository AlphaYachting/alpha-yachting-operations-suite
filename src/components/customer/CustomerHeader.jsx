import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

export default function CustomerHeader() {
  const [logoUrl, setLogoUrl] = useState(null);

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
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-slate-200">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center">
        <img 
          src={logoUrl || "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6972766f1bd9af32693610c1/a2e80b763_Bildschirmfoto2026-01-28um222024.png"}
          alt="Alpha Yachting"
          className="h-10 object-contain"
        />
      </div>
    </header>
  );
}