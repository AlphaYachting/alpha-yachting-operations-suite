import React from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, ChevronRight, Bell, Layout } from 'lucide-react';

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
      title: 'Notification Preferences',
      description: 'Configure when and how you receive notifications',
      icon: Bell,
      page: 'NotificationPreferences'
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
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Admin Tools</h2>
          <PDFDiagnosticsPanel />
        </div>
      )}
    </div>
  );
}