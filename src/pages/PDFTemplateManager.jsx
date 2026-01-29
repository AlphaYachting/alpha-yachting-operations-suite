import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Edit, Eye, Plus, Trash2, Copy, Check, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import PDFDocumentTemplate from '@/components/pdf/PDFDocumentTemplate';

export default function PDFTemplateManager() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [editingTemplateName, setEditingTemplateName] = useState('');

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const data = await base44.entities.PDFTemplate.list();
      setTemplates(data || []);
    } catch (err) {
      console.error('Error loading templates:', err);
      setError('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTemplate = async () => {
    if (!newTemplateName.trim()) {
      setError('Please enter a template name');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const newTemplate = {
        ...base44.entities.PDFTemplate.schema(),
        template_name: newTemplateName,
        company_name: 'Alpha Yachting',
        primary_color: '#2563eb',
        secondary_color: '#06b6d4',
        is_default: templates.length === 0,
      };

      const created = await base44.entities.PDFTemplate.create(newTemplate);
      setTemplates([...templates, created]);
      setSuccess(`Template "${newTemplateName}" created successfully!`);
      setNewTemplateName('');
      setShowNewDialog(false);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error creating template:', err);
      setError('Failed to create template');
    } finally {
      setSaving(false);
    }
  };

  const handleRenameTemplate = async () => {
    if (!editingTemplateName.trim() || !selectedTemplate) {
      setError('Please enter a valid name');
      return;
    }

    setSaving(true);
    setError('');

    try {
      await base44.entities.PDFTemplate.update(selectedTemplate.id, {
        template_name: editingTemplateName
      });
      
      setTemplates(templates.map(t => 
        t.id === selectedTemplate.id 
          ? { ...t, template_name: editingTemplateName }
          : t
      ));
      
      setSuccess('Template renamed successfully!');
      setShowRenameDialog(false);
      setEditingTemplateName('');
      setSelectedTemplate(null);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error renaming template:', err);
      setError('Failed to rename template');
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicateTemplate = async (template) => {
    setSaving(true);
    setError('');

    try {
      const duplicated = {
        ...template,
        template_name: `${template.template_name || template.company_name} (Copy)`,
        is_default: false,
      };
      delete duplicated.id;
      delete duplicated.created_date;
      delete duplicated.updated_date;

      const created = await base44.entities.PDFTemplate.create(duplicated);
      setTemplates([...templates, created]);
      setSuccess('Template duplicated successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error duplicating template:', err);
      setError('Failed to duplicate template');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTemplate = async () => {
    if (!selectedTemplate) return;

    setSaving(true);
    setError('');

    try {
      await base44.entities.PDFTemplate.delete(selectedTemplate.id);
      setTemplates(templates.filter(t => t.id !== selectedTemplate.id));
      setSuccess('Template deleted successfully!');
      setShowDeleteDialog(false);
      setSelectedTemplate(null);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error deleting template:', err);
      setError('Failed to delete template');
    } finally {
      setSaving(false);
    }
  };

  const handleSetDefault = async (template) => {
    try {
      // Update all templates
      const updates = templates.map(t => ({
        ...t,
        is_default: t.id === template.id,
      }));

      // Update in database
      for (const t of updates) {
        await base44.entities.PDFTemplate.update(t.id, { is_default: t.is_default });
      }

      setTemplates(updates);
      setSuccess('Default template updated!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error setting default template:', err);
      setError('Failed to set default template');
    }
  };

  // Sample data for preview
  const sampleDocument = {
    document_type: 'Invoice',
    document_number: 'INV-2026-0001',
    status: 'Issued',
    issue_date: '2026-01-24',
    due_date: '2026-02-07',
    currency: 'EUR',
    customer_name: 'Sample Customer Ltd.',
    customer_address: 'Sample Street 123\n12345 Sample City\nSample Country',
    customer_vat: 'EU123456789',
    boat_name: 'Sample Yacht',
    boat_details: 'Bavaria 46 Cruiser, 14m',
    location_name: 'Marina Novigrad',
    payment_terms: 'Net 14 days',
    public_notes: 'Thank you for your business!',
    subtotal: 1200.00,
    tax_total: 300.00,
    total: 1500.00,
    paid_amount: 0
  };

  const sampleLineItems = [
    {
      title: 'Engine Service',
      description: 'Full engine service including oil change and filter replacement',
      quantity: 1,
      unit: 'job',
      unit_price: 500,
      tax_rate: 25,
      total_net: 500,
      total_tax: 125,
      total_gross: 625
    },
    {
      title: 'Labor',
      description: 'Technical work hours',
      quantity: 10,
      unit: 'hrs',
      unit_price: 70,
      tax_rate: 25,
      total_net: 700,
      total_tax: 175,
      total_gross: 875
    }
  ];

  if (loading) {
    return <div className="p-8">Loading templates...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">PDF Templates</h1>
          <p className="text-slate-500 mt-1">Manage document templates for invoices and offers</p>
        </div>
        <Button onClick={() => setShowNewDialog(true)} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4 mr-2" />
          New Template
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="border-emerald-200 bg-emerald-50">
          <Check className="h-4 w-4 text-emerald-700" />
          <AlertDescription className="text-emerald-700">{success}</AlertDescription>
        </Alert>
      )}

      {templates.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-slate-400 mb-4">
              <AlertCircle className="h-12 w-12" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No Templates Yet</h3>
            <p className="text-slate-500 mb-6">Create your first PDF template to get started</p>
            <Button onClick={() => setShowNewDialog(true)} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              Create Template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map(template => (
            <Card key={template.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{template.template_name || template.company_name}</CardTitle>
                    {template.template_type && template.template_type !== 'Generic' && (
                      <CardDescription className="text-xs mt-1">
                        Type: {template.template_type}
                      </CardDescription>
                    )}
                    <CardDescription className="text-xs mt-1">
                      ID: {template.id.substring(0, 8)}...
                    </CardDescription>
                  </div>
                  {template.is_default && (
                    <Badge className="bg-blue-100 text-blue-800 shrink-0">Default</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Template Info */}
                <div className="space-y-2 text-sm">
                  {template.letterhead_enabled && (
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
                      <span className="text-slate-600">Letterhead enabled</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-slate-400"></div>
                    <span className="text-slate-600">
                      Font: {template.font_family || 'Arial'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded" style={{ backgroundColor: template.primary_color || '#2563eb' }}></div>
                    <span className="text-slate-600">
                      Primary color: {template.primary_color || '#2563eb'}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                 <div className="flex flex-col gap-2 pt-3 border-t">
                   <div className="flex gap-2">
                     <Button
                       variant="outline"
                       size="sm"
                       onClick={() => {
                         setSelectedTemplate(template);
                         setShowPreviewDialog(true);
                       }}
                       className="flex-1"
                       title="Preview"
                     >
                       <Eye className="h-3.5 w-3.5" />
                     </Button>
                     <Button
                       variant="outline"
                       size="sm"
                       onClick={() => navigate(createPageUrl('PDFTemplateSettings'), { state: { templateId: template.id } })}
                       className="flex-1"
                       title="Edit Settings"
                     >
                       <Edit className="h-3.5 w-3.5" />
                     </Button>
                     <Button
                       variant="outline"
                       size="sm"
                       onClick={() => {
                         setSelectedTemplate(template);
                         setEditingTemplateName(template.template_name || template.company_name);
                         setShowRenameDialog(true);
                       }}
                       disabled={saving}
                       className="flex-1"
                       title="Rename"
                     >
                       ✏️
                     </Button>
                   </div>
                   <div className="flex gap-2">
                     <Button
                       variant="outline"
                       size="sm"
                       onClick={() => handleDuplicateTemplate(template)}
                       disabled={saving}
                       className="flex-1"
                       title="Duplicate"
                     >
                       <Copy className="h-3.5 w-3.5" />
                     </Button>
                     <Button
                       variant="outline"
                       size="sm"
                       onClick={() => {
                         setSelectedTemplate(template);
                         setShowDeleteDialog(true);
                       }}
                       disabled={saving}
                       className="flex-1 text-red-600 hover:text-red-700"
                       title="Delete"
                     >
                       <Trash2 className="h-3.5 w-3.5" />
                     </Button>
                   </div>
                 </div>

                {/* Set Default Button */}
                {!template.is_default && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSetDefault(template)}
                    className="w-full text-blue-600 hover:bg-blue-50"
                  >
                    Set as Default
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* New Template Dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Template</DialogTitle>
            <DialogDescription>Enter a name for your new PDF template</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Template Name</Label>
              <Input
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                placeholder="e.g., Standard Invoice, Premium Offer"
                onKeyPress={(e) => e.key === 'Enter' && handleCreateTemplate()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateTemplate}
              disabled={saving || !newTemplateName.trim()}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {saving ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Preview: {selectedTemplate?.company_name}</DialogTitle>
          </DialogHeader>
          {selectedTemplate && (
            <div className="bg-slate-100 p-4 rounded-lg">
              <PDFDocumentTemplate
                document={sampleDocument}
                lineItems={sampleLineItems}
                template={selectedTemplate}
              />
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setShowPreviewDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogTitle>Delete Template</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete "{selectedTemplate?.company_name}"? This action cannot be undone.
          </AlertDialogDescription>
          <DialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTemplate}
              disabled={saving}
              className="bg-red-600 hover:bg-red-700"
            >
              {saving ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </DialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}