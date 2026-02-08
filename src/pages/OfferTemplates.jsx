import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, FileText, Trash2, Copy, Search } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function OfferTemplates() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteTemplateId, setDeleteTemplateId] = useState(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['offerTemplates'],
    queryFn: () => base44.entities.OfferTemplate.list('-created_date'),
  });

  const { data: lineItems = [] } = useQuery({
    queryKey: ['offerTemplateLineItems'],
    queryFn: () => base44.entities.OfferTemplateLineItem.list(),
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (templateId) => {
      const items = lineItems.filter(item => item.template_id === templateId);
      for (const item of items) {
        await base44.entities.OfferTemplateLineItem.delete(item.id);
      }
      await base44.entities.OfferTemplate.delete(templateId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['offerTemplates']);
      queryClient.invalidateQueries(['offerTemplateLineItems']);
      toast.success('Template deleted');
      setDeleteTemplateId(null);
    },
  });

  const duplicateTemplateMutation = useMutation({
    mutationFn: async (templateId) => {
      const template = templates.find(t => t.id === templateId);
      const items = lineItems.filter(item => item.template_id === templateId);
      
      const newTemplate = await base44.entities.OfferTemplate.create({
        ...template,
        template_name: `${template.template_name} (Copy)`,
      });

      if (items.length > 0) {
        await base44.entities.OfferTemplateLineItem.bulkCreate(
          items.map(item => ({
            ...item,
            template_id: newTemplate.id,
          }))
        );
      }

      return newTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['offerTemplates']);
      queryClient.invalidateQueries(['offerTemplateLineItems']);
      toast.success('Template duplicated');
    },
  });

  const filteredTemplates = templates.filter(template =>
    template.template_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    template.title?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getTemplateItemCount = (templateId) => {
    return lineItems.filter(item => item.template_id === templateId).length;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-slate-600">Loading templates...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Offer Templates</h1>
          <p className="text-slate-600 mt-1">Create reusable templates for common offers</p>
        </div>
        <Button
          onClick={() => navigate(createPageUrl('OfferTemplateDetail'))}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Template
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search templates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="text-sm text-slate-600">
          {filteredTemplates.length} template{filteredTemplates.length !== 1 ? 's' : ''}
        </div>
      </div>

      {filteredTemplates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-slate-300 mb-4" />
            <p className="text-slate-600 text-center mb-4">
              {searchTerm ? 'No templates match your search' : 'No templates yet'}
            </p>
            {!searchTerm && (
              <Button
                onClick={() => navigate(createPageUrl('OfferTemplateDetail'))}
                variant="outline"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create First Template
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map((template) => (
            <Card
              key={template.id}
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => navigate(createPageUrl('OfferTemplateDetail') + `?id=${template.id}`)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{template.template_name}</CardTitle>
                    <CardDescription className="mt-1">{template.title}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">Line Items</span>
                    <Badge variant="outline">{getTemplateItemCount(template.id)}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">Language</span>
                    <span className="font-medium">{template.language || 'German'}</span>
                  </div>
                  {template.vat_rate > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">VAT Rate</span>
                      <span className="font-medium">{template.vat_rate}%</span>
                    </div>
                  )}
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        duplicateTemplateMutation.mutate(template.id);
                      }}
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      Duplicate
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTemplateId(template.id);
                      }}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteTemplateId} onOpenChange={() => setDeleteTemplateId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this template and all its line items. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTemplateMutation.mutate(deleteTemplateId)}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete Template
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}