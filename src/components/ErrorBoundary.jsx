import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error?.message, error?.stack?.split('\n').slice(0, 5).join('\n'));
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center p-6">
          <div className="max-w-md w-full">
            <Card className="border-red-200 bg-red-50">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  <CardTitle className="text-red-900 text-base">Seite konnte nicht geladen werden</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-red-800">
                  {this.state.error?.message || 'Ein unerwarteter Fehler ist aufgetreten.'}
                </p>
                <div className="flex gap-2">
                  <Button
                    onClick={() => this.setState({ hasError: false, error: null })}
                    variant="outline"
                    className="flex-1"
                  >
                    Nochmal versuchen
                  </Button>
                  <Button 
                    onClick={() => window.location.reload()}
                    className="flex-1 bg-red-600 hover:bg-red-700"
                  >
                    Neu laden
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}