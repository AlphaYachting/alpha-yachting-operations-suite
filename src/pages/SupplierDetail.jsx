import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useLocation, Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, Edit, Building2, Globe, ExternalLink, Mail, Phone, FileText } from 'lucide-react';
import SupplierForm from '@/components/suppliers/SupplierForm';
import ContactsTab from '@/components/suppliers/ContactsTab';
import PortalTab from '@/components/suppliers/PortalTab';
import TermsTab from '@/components/suppliers/TermsTab';

const typeColors = {
  PRODUCT: 'bg-blue-100 text-blue-800',
  WORK: 'bg-purple-100 text-purple-800',
  BOTH: 'bg-green-100 text-green-800'
};

const statusColors = {
  ACTIVE: 'bg-green-100 text-green-800',
  INACTIVE: 'bg-slate-100 text-slate-600'
};

export default function SupplierDetail() {
  const location = useLocation();
  const supplierId = new URLSearchParams(location.search).get('id');
  const [supplier, setSupplier] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  useEffect(() => {
    if (supplierId) {
      loadSupplier();
    }
  }, [supplierId]);

  const loadSupplier = async () => {
    setLoading(true);
    try {
      const suppliers = await base44.entities.Supplier.filter({ id: supplierId });
      setSupplier(suppliers[0]);
    } catch (error) {
      console.error('Error loading supplier:', error);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-500">Loading supplier...</div>
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Supplier not found</p>
        <Link to={createPageUrl('Suppliers')}>
          <Button className="mt-4">Back to Suppliers</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to={createPageUrl('Suppliers')}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-slate-900">{supplier.supplier_name}</h1>
              <Badge className={typeColors[supplier.type]}>{supplier.type}</Badge>
              <Badge className={statusColors[supplier.status]}>{supplier.status}</Badge>
            </div>
            <p className="text-slate-500 mt-1">{supplier.country}</p>
          </div>
        </div>
        <Button onClick={() => setEditDialogOpen(true)}>
          <Edit className="w-4 h-4 mr-2" />
          Edit Supplier
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
          <TabsTrigger value="portal">Portal Access</TabsTrigger>
          <TabsTrigger value="terms">Terms</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Supplier Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-slate-500">Supplier Name</div>
                    <div className="font-medium">{supplier.supplier_name}</div>
                  </div>
                  <div>
                    <div className="text-sm text-slate-500">Phone</div>
                    <a href={`tel:${supplier.phone}`} className="font-medium text-blue-600 hover:underline flex items-center gap-1">
                      <Phone className="w-4 h-4" />
                      {supplier.phone}
                    </a>
                  </div>
                  {supplier.email && (
                    <div>
                      <div className="text-sm text-slate-500">Email</div>
                      <a href={`mailto:${supplier.email}`} className="font-medium text-blue-600 hover:underline flex items-center gap-1">
                        <Mail className="w-4 h-4" />
                        {supplier.email}
                      </a>
                    </div>
                  )}
                  <div>
                    <div className="text-sm text-slate-500">Type</div>
                    <Badge className={typeColors[supplier.type]}>{supplier.type}</Badge>
                  </div>
                  <div>
                    <div className="text-sm text-slate-500">Status</div>
                    <Badge className={statusColors[supplier.status]}>{supplier.status}</Badge>
                  </div>
                  <div>
                    <div className="text-sm text-slate-500">Country</div>
                    <div className="font-medium">{supplier.country}</div>
                  </div>
                  {supplier.vat_oib && (
                    <div>
                      <div className="text-sm text-slate-500">VAT/OIB</div>
                      <div className="font-medium">{supplier.vat_oib}</div>
                    </div>
                  )}
                  {supplier.website_url && (
                    <div>
                      <div className="text-sm text-slate-500">Website</div>
                      <a href={supplier.website_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">
                        <Globe className="w-3 h-3" />
                        {supplier.website_url}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </div>

                {supplier.tags && supplier.tags.length > 0 && (
                  <div>
                    <div className="text-sm text-slate-500 mb-2">Tags</div>
                    <div className="flex flex-wrap gap-2">
                      {supplier.tags.map((tag, idx) => (
                        <Badge key={idx} variant="outline">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {supplier.address && (
                  <div>
                    <div className="text-sm text-slate-500 mb-1">Address</div>
                    <div className="text-sm">{supplier.address}</div>
                  </div>
                )}

                {supplier.internal_notes && (
                  <div>
                    <div className="text-sm text-slate-500 mb-1">Internal Notes</div>
                    <div className="text-sm bg-slate-50 p-3 rounded">{supplier.internal_notes}</div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="contacts">
          <ContactsTab supplierId={supplierId} />
        </TabsContent>

        <TabsContent value="portal">
          <PortalTab supplierId={supplierId} />
        </TabsContent>

        <TabsContent value="terms">
          <TermsTab supplierId={supplierId} />
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Supplier</DialogTitle>
          </DialogHeader>
          <SupplierForm
            supplier={supplier}
            onSuccess={() => {
              setEditDialogOpen(false);
              loadSupplier();
            }}
            onCancel={() => setEditDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}