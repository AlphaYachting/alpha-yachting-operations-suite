import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { createPageUrl } from './utils';
import { base44 } from '@/api/base44Client';
import MobileAppModal from '@/components/mobile/MobileAppModal';
import { 
              LayoutDashboard, 
              Users, 
              Ship, 
              MapPin, 
              Briefcase, 
              ClipboardList,
              Package, 
              Wrench,
              Clock,
              BarChart3,
              Settings,
              Menu,
              X,
              LogOut,
              ChevronDown,
              Anchor,
              Smartphone,
              Upload,
              FileText,
              Receipt,
              Bug,
              Phone,
              Camera,
              Bell
            } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import NotificationBell from '@/components/notifications/NotificationBell';

const navItems = [
        { name: 'Dashboard', icon: LayoutDashboard, page: 'Dashboard' },
        { name: 'Leads', icon: Phone, page: 'Leads' },
        { name: 'Customers', icon: Users, page: 'Customers' },
        { name: 'Boats', icon: Ship, page: 'Boats' },
        { name: 'Locations', icon: MapPin, page: 'Locations' },
  { name: 'Projects', icon: Briefcase, page: 'Jobs' },
  { name: 'Work Orders', icon: ClipboardList, page: 'WorkOrders' },
  { name: 'Team Orders', icon: Users, page: 'TeamOrders' },
  { name: 'Schedule', icon: Clock, page: 'Schedule' },
  { name: 'Technicians', icon: Wrench, page: 'Technicians' },
  { name: 'Tools & Inventory', icon: Package, page: 'Inventory' },
  { name: 'Vehicles', icon: Anchor, page: 'Vehicles' },
  { name: 'Task Templates', icon: ClipboardList, page: 'TaskTemplates', adminOnly: true },
  { name: 'Offers', icon: FileText, page: 'Offers' },
  { name: 'Invoices', icon: Receipt, page: 'Invoices' },
  { name: 'Reports', icon: BarChart3, page: 'Reports' },
    { name: 'Workshop Display', icon: Monitor, page: 'WorkshopDisplay' },
    { name: 'Settings', icon: Settings, page: 'Settings' },
  ];

export default function Layout({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [mobileAppOpen, setMobileAppOpen] = useState(false);
  const [logoUrl, setLogoUrl] = useState(user?.company_logo);
  const fileInputRef = useRef(null);
  const location = useLocation();

  useEffect(() => {
    const loadUser = async () => {
      try {
        const userData = await base44.auth.me();
        setUser(userData);
        setLogoUrl(userData?.company_logo);
      } catch (e) {
        console.log('User not logged in');
      }
    };
    loadUser();
  }, []);

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setLogoUrl(file_url);
      await base44.auth.updateMe({ company_logo: file_url });
    } catch (error) {
      console.error('Error uploading logo:', error);
    }
  };

  const isMobilePage = currentPageName?.startsWith('Mobile') || 
                       currentPageName === 'TeamMobileHome' || 
                       currentPageName === 'TeamWorkOrderDetail' || 
                       currentPageName === 'TeamTaskDetail' || 
                       currentPageName === 'TeamPreviewMode';

  if (isMobilePage) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-slate-200 px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <img 
            src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6972766f1bd9af32693610c1/a2e80b763_Bildschirmfoto2026-01-28um222024.png"
            alt="Alpha Yachting"
            className="h-6 object-contain"
          />
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="lg:hidden fixed inset-0 z-50 bg-black/50"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed top-0 left-0 z-50 h-screen w-64 bg-white border-r border-slate-200 transition-transform lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="h-16 px-3 flex items-center justify-between border-b border-slate-100">
            <div className="flex items-center justify-between flex-1">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="relative group h-12 flex items-center hover:opacity-75 transition-opacity"
              >
                <img 
                  src={logoUrl || "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6972766f1bd9af32693610c1/a2e80b763_Bildschirmfoto2026-01-28um222024.png"}
                  alt="Company Logo"
                  className="h-12 object-contain"
                />
                <div className="absolute inset-0 bg-black/30 rounded opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <Camera className="h-4 w-4 text-white" />
                </div>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogoUpload}
              />
              {user && <NotificationBell userEmail={user.email} />}
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {navItems.filter(item => !item.adminOnly || user?.role === 'admin').map((item) => {
              const isActive = currentPageName === item.page;
              return (
                <Link
                  key={item.name}
                  to={createPageUrl(item.page)}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                    isActive 
                      ? "bg-blue-50 text-blue-700" 
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  )}
                >
                  <item.icon className={cn(
                    "h-5 w-5",
                    isActive ? "text-blue-600" : "text-slate-400"
                  )} />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* Quick Actions */}
          <div className="px-3 pb-3 space-y-2">
            <Link
              to={createPageUrl('TasklistImport')}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200 transition-all"
            >
              <Upload className="h-5 w-5" />
              Tasklist Import
            </Link>
            <button
              onClick={() => setMobileAppOpen(true)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium bg-gradient-to-r from-blue-600 to-cyan-500 text-white hover:from-blue-700 hover:to-cyan-600 transition-all"
            >
              <Smartphone className="h-5 w-5" />
              Mobile App
            </button>
            </div>

          {/* User Menu */}
          <div className="p-3 border-t border-slate-100">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-slate-200 text-slate-600 text-sm">
                      {user?.full_name?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {user?.full_name || 'User'}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {user?.email || ''}
                    </p>
                  </div>
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem asChild>
                  <Link to={createPageUrl('Settings')}>
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => base44.auth.logout()}
                  className="text-red-600"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:pl-64 pt-16 lg:pt-0 min-h-screen">
        <div className="p-6 lg:p-8">
          {children}
        </div>
      </main>

      {/* Mobile App Modal */}
      <MobileAppModal open={mobileAppOpen} onOpenChange={setMobileAppOpen} />
      </div>
      );
      }