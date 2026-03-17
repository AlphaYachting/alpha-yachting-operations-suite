import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, ChevronRight, Bell, Layout, Bug, Smartphone, Ruler, Download, Upload, ClipboardList, Mail, Bot } from 'lucide-react';
import PDFDiagnosticsPanel from '@/components/pdf/PDFDiagnosticsPanel';

export default function Settings() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const userData = await base44.auth.me();
        setUser(userData);
      } catch (e) {
        console.log('User not loaded');
      }
    };
    loadUser();
  }, []);

  const settingsCategories = [
    {
      title: 'Email Configuration',
      description: 'Setup custom email service for app invitations',
      icon: Mail,
      page: 'EmailConfiguration'
    },
    {
      title: 'Notification Preferences',
      description: 'Configure when and how you receive notifications',
      icon: Bell,
      page: 'NotificationPreferences'
    },
    {
      title: 'Unit Settings',
      description: 'Manage measurement units used across the application',
      icon: Ruler,
      page: 'UnitSettingsPage'
    },
    {
      title: 'Inventory Import',
      description: 'Import inventory items from Excel with strict validation',
      icon: Upload,
      page: 'InventoryImport'
    },
    {
      title: 'Inventory Export Schema',
      description: 'Download templates and structure for importing inventory data',
      icon: Download,
      page: 'InventoryExportSchema'
    },
    {
      title: 'PDF Templates',
      description: 'Configure document templates for offers and invoices',
      icon: FileText,
      page: 'PDFTemplateSettings'
    },
    {
      title: 'PDF Layout Editor',
      description: 'Visually design page layout, margins, and block positions',
      icon: Layout,
      page: 'PDFLayoutEditor'
    },
    {
      title: 'KI-Assistent Einstellungen',
      description: 'System-Prompt und Wissensdatenbank für den KI-Angebots-Assistenten konfigurieren',
      icon: Bot,
      page: 'AIAssistantSettings'
    }
  ];

  const adminCategories = [
    {
      title: 'App Invitations',
      description: 'Manage customer and technician app invites',
      icon: Mail,
      page: 'AppInvites'
    },
    {
      title: 'Standardize Work Orders',
      description: 'Convert all work order numbers to WO00001 format',
      icon: ClipboardList,
      page: 'StandardizeWorkOrders'
    },
    {
      title: 'Header Editor',
      description: 'Customize mobile app header layout and styling',
      icon: Smartphone,
      page: 'MobileHeaderEditor'
    },
    {
      title: 'PDF Debugger',
      description: 'Debug and test PDF export functionality',
      icon: Bug,
      page: 'PDFExportDebugger'
    },
    {
      title: 'Notification Simulator',
      description: 'Test notification system with live scenarios',
      icon: Bell,
      page: 'NotificationSimulator'
    },
    {
      title: 'PDF Template Manager',
      description: 'Manage PDF templates',
      icon: FileText,
      page: 'PDFTemplateManager'
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500 mt-1">Manage your application settings</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {settingsCategories.map((category) => (
          <Card 
            key={category.title}
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => navigate(createPageUrl(category.page))}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <category.icon className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{category.title}</CardTitle>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-400" />
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription>{category.description}</CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Admin: PDF Export Diagnostics */}
      {user?.role === 'admin' && (
        <div className="mt-8 space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Admin Tools</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {adminCategories.map((category) => (
                <Card 
                  key={category.title}
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => navigate(createPageUrl(category.page))}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                          <category.icon className="h-5 w-5 text-amber-600" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{category.title}</CardTitle>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-slate-400" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardDescription>{category.description}</CardDescription>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
          <PDFDiagnosticsPanel />
        </div>
      )}
    </div>
  );
}