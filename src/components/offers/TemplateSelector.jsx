import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { FileText, Search, Clock } from 'lucide-react';
import { format } from 'date-fns';

export default function TemplateSelector({ open, onOpenChange, onSelectTemplate }) {
  const [searchTerm, setSearchTerm] = useState('');

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['offerTemplates'],
    queryFn: () => base44.entities.OfferTemplate.list('-created_date'),
    enabled: open,
  });

  const filteredTemplates = templates.filter(t =>
    t.template_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.title?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelect = async (template) => {
    // Load template line items
    const lineItems = await base44.entities.OfferTemplateLineItem.filter({ 
      template_id: template.id 
    });
    onSelectTemplate(template, lineItems);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Select Offer Template</DialogTitle>
          <DialogDescription>
            Choose a template to prefill your offer
          </DialogDescription>
        </DialogHeader>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search templates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="space-y-3 overflow-y-auto max-h-[50vh]">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : filteredTemplates.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-6">
                  <FileText className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-600">No templates found</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            filteredTemplates.map(template => (
              <Card 
                key={template.id} 
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleSelect(template)}
              >
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-50 to-cyan-50 flex items-center justify-center flex-shrink-0">
                        <FileText className="h-5 w-5 text-blue-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-slate-900">{template.template_name}</h3>
                        <p className="text-sm text-slate-600 truncate">{template.title}</p>
                        <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                          <Clock className="h-3 w-3" />
                          <span>Created {format(new Date(template.created_date), 'MMM d, yyyy')}</span>
                        </div>
                      </div>
                    </div>
                    <Button size="sm" variant="outline">
                      Use Template
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}