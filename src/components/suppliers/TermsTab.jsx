import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, FileText, Edit, Trash, Upload, ExternalLink } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

export default function TermsTab({ supplierId }) {
  const [terms, setTerms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTerms, setEditingTerms] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [termsToDelete, setTermsToDelete] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    payment_terms: '',
    discount_note: '',
    lead_time_days: '',
    notes: '',
    attachment: ''
  });

  useEffect(() => {
    loadTerms();
  }, [supplierId]);

  const loadTerms = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.SupplierTerms.filter({ supplier_id: supplierId });
      setTerms(data.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)));
    } catch (error) {
      console.error('Error loading terms:', error);
    }
    setLoading(false);
  };

  const handleOpenDialog = (term = null) => {
    if (term) {
      setEditingTerms(term);
      setFormData({
        payment_terms: term.payment_terms || '',
        discount_note: term.discount_note || '',
        lead_time_days: term.lead_time_days || '',
        notes: term.notes || '',
        attachment: term.attachment || ''
      });
    } else {
      setEditingTerms(null);
      setFormData({
        payment_terms: '',
        discount_note: '',
        lead_time_days: '',
        notes: '',
        attachment: ''
      });
    }
    setDialogOpen(true);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFormData({ ...formData, attachment: file_url });
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Failed to upload file');
    }
    setUploading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = { ...formData, supplier_id: supplierId };
      if (editingTerms) {
        await base44.entities.SupplierTerms.update(editingTerms.id, data);
      } else {
        await base44.entities.SupplierTerms.create(data);
      }
      setDialogOpen(false);
      loadTerms();
    } catch (error) {
      console.error('Error saving terms:', error);
      alert('Failed to save terms');
    }
  };

  const handleDelete = async () => {
    try {
      await base44.entities.SupplierTerms.delete(termsToDelete.id);
      setDeleteDialogOpen(false);
      setTermsToDelete(null);
      loadTerms();
    } catch (error) {
      console.error('Error deleting terms:', error);
      alert('Failed to delete terms');
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-slate-500">Loading terms...</div>;
  }

  const latestTerms = terms[0];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Supplier Terms</h3>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="w-4 h-4 mr-2" />
          Add Terms
        </Button>
      </div>

      {terms.length === 0 ? (
        <Card>
          <CardContent className="pt-12 pb-12 text-center">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">No terms configured</p>
            <Button onClick={() => handleOpenDialog()} className="mt-4">
              <Plus className="w-4 h-4 mr-2" />
              Add First Terms
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Latest/Active Terms */}
          {latestTerms && (
            <Card className="border-2 border-blue-200 bg-blue-50">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-4">
                      <FileText className="w-5 h-5 text-blue-600" />
                      <h4 className="font-semibold text-blue-900">Current Terms</h4>
                      <span className="text-xs text-blue-600">
                        Added {new Date(latestTerms.created_date).toLocaleDateString()}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm text-slate-600 mb-1">Payment Terms</div>
                        <div className="font-medium">{latestTerms.payment_terms}</div>
                      </div>
                      <div>
                        <div className="text-sm text-slate-600 mb-1">Discount/Pricing</div>
                        <div className="font-medium">{latestTerms.discount_note}</div>
                      </div>
                      {latestTerms.lead_time_days && (
                        <div>
                          <div className="text-sm text-slate-600 mb-1">Lead Time</div>
                          <div className="font-medium">{latestTerms.lead_time_days} days</div>
                        </div>
                      )}
                      {latestTerms.notes && (
                        <div className="col-span-2">
                          <div className="text-sm text-slate-600 mb-1">Notes</div>
                          <div className="text-sm">{latestTerms.notes}</div>
                        </div>
                      )}
                      {latestTerms.attachment && (
                        <div className="col-span-2">
                          <div className="text-sm text-slate-600 mb-1">Attachment</div>
                          <a 
                            href={latestTerms.attachment} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline flex items-center gap-1 text-sm"
                          >
                            View Document
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(latestTerms)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => {
                      setTermsToDelete(latestTerms);
                      setDeleteDialogOpen(true);
                    }}>
                      <Trash className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Historical Terms */}
          {terms.length > 1 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-slate-600">Historical Terms</h4>
              {terms.slice(1).map(term => (
                <Card key={term.id} className="bg-slate-50">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="text-sm">
                          <span className="font-medium">{term.payment_terms}</span> • {term.discount_note}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          Added {new Date(term.created_date).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(term)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => {
                          setTermsToDelete(term);
                          setDeleteDialogOpen(true);
                        }}>
                          <Trash className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingTerms ? 'Edit Terms' : 'Add Supplier Terms'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Payment Terms *</Label>
              <Input
                required
                value={formData.payment_terms}
                onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                placeholder="e.g., 7 days, proforma, 30 days net"
              />
            </div>
            <div>
              <Label>Discount/Pricing Note *</Label>
              <Input
                required
                value={formData.discount_note}
                onChange={(e) => setFormData({ ...formData, discount_note: e.target.value })}
                placeholder="e.g., -15% dealer, special pricing"
              />
            </div>
            <div>
              <Label>Lead Time (days)</Label>
              <Input
                type="number"
                value={formData.lead_time_days}
                onChange={(e) => setFormData({ ...formData, lead_time_days: e.target.value })}
                placeholder="Typical delivery time in days"
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional terms or conditions"
                rows={2}
              />
            </div>
            <div>
              <Label>Attachment (PDF/Image)</Label>
              <div className="space-y-2">
                <Input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileUpload}
                  disabled={uploading}
                />
                {uploading && <p className="text-sm text-slate-500">Uploading...</p>}
                {formData.attachment && (
                  <a 
                    href={formData.attachment} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                  >
                    View Current Attachment
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">
                {editingTerms ? 'Update' : 'Add'} Terms
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Terms</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete these terms? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}