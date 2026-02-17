import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Globe, ExternalLink, Edit, Trash, Copy, User, Key } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

export default function PortalTab({ supplierId }) {
  const [portals, setPortals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPortal, setEditingPortal] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [portalToDelete, setPortalToDelete] = useState(null);
  const [formData, setFormData] = useState({
    portal_name: '',
    portal_url: '',
    username: '',
    password_reference: '',
    notes: '',
    last_verified_at: ''
  });

  useEffect(() => {
    loadPortals();
  }, [supplierId]);

  const loadPortals = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.SupplierPortal.filter({ supplier_id: supplierId });
      setPortals(data);
    } catch (error) {
      console.error('Error loading portals:', error);
    }
    setLoading(false);
  };

  const handleOpenDialog = (portal = null) => {
    if (portal) {
      setEditingPortal(portal);
      setFormData({
        portal_name: portal.portal_name || '',
        portal_url: portal.portal_url || '',
        username: portal.username || '',
        password_reference: portal.password_reference || '',
        notes: portal.notes || '',
        last_verified_at: portal.last_verified_at || ''
      });
    } else {
      setEditingPortal(null);
      setFormData({
        portal_name: '',
        portal_url: '',
        username: '',
        password_reference: '',
        notes: '',
        last_verified_at: ''
      });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = { ...formData, supplier_id: supplierId };
      if (editingPortal) {
        await base44.entities.SupplierPortal.update(editingPortal.id, data);
      } else {
        await base44.entities.SupplierPortal.create(data);
      }
      setDialogOpen(false);
      loadPortals();
    } catch (error) {
      console.error('Error saving portal:', error);
      alert('Failed to save portal');
    }
  };

  const handleDelete = async () => {
    try {
      await base44.entities.SupplierPortal.delete(portalToDelete.id);
      setDeleteDialogOpen(false);
      setPortalToDelete(null);
      loadPortals();
    } catch (error) {
      console.error('Error deleting portal:', error);
      alert('Failed to delete portal');
    }
  };

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  if (loading) {
    return <div className="text-center py-8 text-slate-500">Loading portal access...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Portal Access</h3>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="w-4 h-4 mr-2" />
          Add Portal
        </Button>
      </div>

      {portals.length === 0 ? (
        <Card>
          <CardContent className="pt-12 pb-12 text-center">
            <Globe className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">No portal access configured</p>
            <Button onClick={() => handleOpenDialog()} className="mt-4">
              <Plus className="w-4 h-4 mr-2" />
              Add First Portal
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {portals.map(portal => (
            <Card key={portal.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-3">
                      <Globe className="w-5 h-5 text-blue-600" />
                      <h4 className="font-semibold">{portal.portal_name}</h4>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="text-sm text-slate-500 w-32">Portal URL:</div>
                        <a 
                          href={portal.portal_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline flex items-center gap-1 text-sm"
                        >
                          {portal.portal_url}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => copyToClipboard(portal.portal_url, 'Portal URL')}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>

                      {portal.username && (
                        <div className="flex items-center gap-2">
                          <div className="text-sm text-slate-500 w-32 flex items-center gap-1">
                            <User className="w-3 h-3" />
                            Username:
                          </div>
                          <code className="text-sm bg-slate-100 px-2 py-0.5 rounded">{portal.username}</code>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => copyToClipboard(portal.username, 'Username')}
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                      )}

                      {portal.password_reference && (
                        <div className="flex items-center gap-2">
                          <div className="text-sm text-slate-500 w-32 flex items-center gap-1">
                            <Key className="w-3 h-3" />
                            Password Ref:
                          </div>
                          <code className="text-sm bg-yellow-50 text-yellow-800 px-2 py-0.5 rounded border border-yellow-200">
                            {portal.password_reference}
                          </code>
                        </div>
                      )}

                      {portal.last_verified_at && (
                        <div className="flex items-center gap-2">
                          <div className="text-sm text-slate-500 w-32">Last Verified:</div>
                          <div className="text-sm">{new Date(portal.last_verified_at).toLocaleDateString()}</div>
                        </div>
                      )}

                      {portal.notes && (
                        <div className="text-sm text-slate-500 mt-2 bg-slate-50 p-2 rounded">
                          {portal.notes}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(portal)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => {
                      setPortalToDelete(portal);
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

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingPortal ? 'Edit Portal' : 'Add Portal Access'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Portal Name *</Label>
              <Input
                required
                value={formData.portal_name}
                onChange={(e) => setFormData({ ...formData, portal_name: e.target.value })}
                placeholder="e.g., B2B Portal, Webshop"
              />
            </div>
            <div>
              <Label>Portal URL *</Label>
              <Input
                required
                type="url"
                value={formData.portal_url}
                onChange={(e) => setFormData({ ...formData, portal_url: e.target.value })}
                placeholder="https://portal.example.com"
              />
            </div>
            <div>
              <Label>Username</Label>
              <Input
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                placeholder="Login username"
              />
            </div>
            <div>
              <Label>Password Reference</Label>
              <Input
                value={formData.password_reference}
                onChange={(e) => setFormData({ ...formData, password_reference: e.target.value })}
                placeholder="e.g., Bitwarden: AlphaYachting/Shared/SupplierX"
              />
              <p className="text-xs text-slate-500 mt-1">
                ⚠️ Never store actual passwords - only reference where it's stored (e.g., password manager)
              </p>
            </div>
            <div>
              <Label>Last Verified Date</Label>
              <Input
                type="date"
                value={formData.last_verified_at}
                onChange={(e) => setFormData({ ...formData, last_verified_at: e.target.value })}
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes about portal access"
                rows={2}
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">
                {editingPortal ? 'Update' : 'Add'} Portal
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Portal Access</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this portal access? This action cannot be undone.
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