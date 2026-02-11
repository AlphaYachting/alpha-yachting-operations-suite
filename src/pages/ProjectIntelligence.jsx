import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Brain, FileSearch, Lightbulb, TrendingUp } from 'lucide-react';

export default function ProjectIntelligence() {
  // SAFETY GUARD: Prevents any write/update actions from this module by default
  const isWriteAllowed = false;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Brain className="h-8 w-8 text-blue-600" />
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Project Intelligence</h1>
          <p className="text-slate-500 mt-1">Internal analysis and planning module</p>
        </div>
      </div>

      <Card className="border-blue-200 bg-blue-50/30">
        <CardHeader>
          <CardTitle className="text-slate-900">Module Overview</CardTitle>
          <CardDescription className="text-slate-600">
            Internal analysis and planning module. All actions are read-only unless explicitly confirmed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3">
            <Button 
              variant="outline" 
              disabled={!isWriteAllowed}
              className="justify-start"
            >
              <FileSearch className="h-4 w-4 mr-2" />
              Run Audit (Read-only)
            </Button>
            <Button 
              variant="outline" 
              disabled={!isWriteAllowed}
              className="justify-start"
            >
              <Lightbulb className="h-4 w-4 mr-2" />
              Run Suggestions (Draft)
            </Button>
            <Button 
              variant="outline" 
              disabled={!isWriteAllowed}
              className="justify-start"
            >
              <TrendingUp className="h-4 w-4 mr-2" />
              Run Planning (Draft)
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}