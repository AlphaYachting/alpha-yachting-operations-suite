import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Save, Upload, Eye } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import PDFDocumentTemplate from '@/components/pdf/PDFDocumentTemplate';

export default function PDFTemplateSettings() {
  const navigate = useNavigate();
  const [template, setTemplate] = useState({
    company_name: 'Alpha Yachting',
    company_address: 'Novigrad, Croatia',
    primary_color: '#2563eb',
    secondary_color: '#06b6d4',
    show_vat_column: true,
    show_net_gross: true,
    is_default: true
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [uploading, setUploading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [templateId, setTemplateId] = useState(null);

  useEffect(() => {
    loadTemplate();
  }, []);

  const loadTemplate = async () => {
    try {
      const templates = await base44.entities.PDFTemplate.list();
      const defaultTemplate = templates.find(t => t.is_default) || templates[0];
      
      if (defaultTemplate) {
        setTemplate(defaultTemplate);
        setTemplateId(defaultTemplate.id);
      }
    } catch (error) {
      console.error('Error loading template:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      if (templateId) {
        await base44.entities.PDFTemplate.update(templateId, template);
      } else {
        const created = await base44.entities.PDFTemplate.create(template);
        setTemplateId(created.id);
      }
      setSuccess('Template saved successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error saving template:', error);
      setError('Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    try {
      const result = await base44.integrations.Core.UploadFile({ file });
      setTemplate({ ...template, logo_url: result.file_url });
      setSuccess('Logo uploaded successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error uploading logo:', error);
      setError('Failed to upload logo');
    } finally {
      setUploading(false);
    }
  };

  const handleLetterheadUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file (PNG, JPG, etc.)');
      return;
    }

    setUploading(true);
    setError('');
    try {
      const result = await base44.integrations.Core.UploadFile({ file });
      
      const updatedTemplate = { 
        ...template, 
        letterhead_image_url: result.file_url,
        letterhead_upload_date: new Date().toISOString()
      };
      
      setTemplate(updatedTemplate);
      
      // Save to database immediately
      if (templateId) {
        await base44.entities.PDFTemplate.update(templateId, updatedTemplate);
      } else {
        const created = await base44.entities.PDFTemplate.create(updatedTemplate);
        setTemplateId(created.id);
      }
      
      setSuccess('Letterhead uploaded successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error uploading letterhead:', error);
      setError('Failed to upload letterhead. Please try again.');
    } finally {
      setUploading(false);
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
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(createPageUrl('Settings'))}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">PDF Template Settings</h1>
          <p className="text-slate-500 mt-1">Configure PDF document templates for offers and invoices</p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="border-emerald-200 bg-emerald-50">
          <AlertDescription className="text-emerald-700">{success}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-6">
        {/* Letterhead Section */}
        <Card>
          <CardHeader>
            <CardTitle>PDF Letterhead (Briefpapier)</CardTitle>
            <CardDescription>Upload a PDF letterhead to use as background for all invoices and offers</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Enable Letterhead</Label>
              <Switch
                checked={template.letterhead_enabled || false}
                onCheckedChange={(checked) => setTemplate({ ...template, letterhead_enabled: checked })}
              />
            </div>

            {template.letterhead_image_url && (
              <div className="border rounded-lg p-4 bg-slate-50">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm font-medium">Current Letterhead</p>
                    <p className="text-xs text-slate-500">
                      Uploaded: {template.letterhead_upload_date ? new Date(template.letterhead_upload_date).toLocaleDateString() : 'Unknown'}
                    </p>
                  </div>
                </div>
                <img 
                  src={template.letterhead_image_url} 
                  alt="Letterhead" 
                  className="w-full max-w-md border rounded"
                  onError={(e) => {
                    console.error('Image failed to load:', template.letterhead_image_url);
                    e.target.style.display = 'none';
                  }}
                />
              </div>
            )}

            <div>
              <Label>Upload Letterhead Image</Label>
              <p className="text-xs text-slate-500 mb-2">Upload PNG or JPG image to use as page background (A4 proportions recommended)</p>
              <input
                type="file"
                accept="image/*"
                onChange={handleLetterheadUpload}
                className="hidden"
                id="letterhead-upload"
              />
              <Button 
                variant="outline"
                onClick={() => document.getElementById('letterhead-upload').click()}
                disabled={uploading}
              >
                <Upload className="h-4 w-4 mr-2" />
                {uploading ? 'Uploading...' : (template.letterhead_image_url ? 'Replace Letterhead' : 'Upload Letterhead')}
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Top Margin (mm)</Label>
                <Input
                  type="number"
                  value={template.margin_top_mm || 20}
                  onChange={(e) => setTemplate({ ...template, margin_top_mm: parseFloat(e.target.value) })}
                />
              </div>
              <div>
                <Label>Bottom Margin (mm)</Label>
                <Input
                  type="number"
                  value={template.margin_bottom_mm || 20}
                  onChange={(e) => setTemplate({ ...template, margin_bottom_mm: parseFloat(e.target.value) })}
                />
              </div>
              <div>
                <Label>Left Margin (mm)</Label>
                <Input
                  type="number"
                  value={template.margin_left_mm || 20}
                  onChange={(e) => setTemplate({ ...template, margin_left_mm: parseFloat(e.target.value) })}
                />
              </div>
              <div>
                <Label>Right Margin (mm)</Label>
                <Input
                  type="number"
                  value={template.margin_right_mm || 20}
                  onChange={(e) => setTemplate({ ...template, margin_right_mm: parseFloat(e.target.value) })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Company Info */}
        <Card>
          <CardHeader>
            <CardTitle>Company Information</CardTitle>
            <CardDescription>Details that appear on all documents</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Company Logo</Label>
              <div className="mt-2 flex items-center gap-4">
                {template.logo_url && (
                  <img src={template.logo_url} alt="Logo" className="h-16 object-contain" />
                )}
                <div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                    id="logo-upload"
                  />
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => document.getElementById('logo-upload').click()}
                    disabled={uploading}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {uploading ? 'Uploading...' : 'Upload Logo'}
                  </Button>
                </div>
              </div>
            </div>

            <div>
              <Label>Company Name</Label>
              <Input
                value={template.company_name}
                onChange={(e) => setTemplate({ ...template, company_name: e.target.value })}
              />
            </div>

            <div>
              <Label>Address</Label>
              <Textarea
                value={template.company_address}
                onChange={(e) => setTemplate({ ...template, company_address: e.target.value })}
                rows={3}
              />
            </div>

            <div>
              <Label>VAT ID</Label>
              <Input
                value={template.company_vat || ''}
                onChange={(e) => setTemplate({ ...template, company_vat: e.target.value })}
              />
            </div>

            <div>
              <Label>Registration Number</Label>
              <Input
                value={template.company_registration || ''}
                onChange={(e) => setTemplate({ ...template, company_registration: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Contact & Bank Details */}
        <Card>
          <CardHeader>
            <CardTitle>Contact & Banking</CardTitle>
            <CardDescription>Contact information and payment details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Phone</Label>
              <Input
                value={template.contact_phone || ''}
                onChange={(e) => setTemplate({ ...template, contact_phone: e.target.value })}
              />
            </div>

            <div>
              <Label>Email</Label>
              <Input
                value={template.contact_email || ''}
                onChange={(e) => setTemplate({ ...template, contact_email: e.target.value })}
              />
            </div>

            <div>
              <Label>Website</Label>
              <Input
                value={template.contact_website || ''}
                onChange={(e) => setTemplate({ ...template, contact_website: e.target.value })}
              />
            </div>

            <div>
              <Label>Bank Name</Label>
              <Input
                value={template.bank_name || ''}
                onChange={(e) => setTemplate({ ...template, bank_name: e.target.value })}
              />
            </div>

            <div>
              <Label>IBAN</Label>
              <Input
                value={template.bank_iban || ''}
                onChange={(e) => setTemplate({ ...template, bank_iban: e.target.value })}
              />
            </div>

            <div>
              <Label>BIC/SWIFT</Label>
              <Input
                value={template.bank_bic || ''}
                onChange={(e) => setTemplate({ ...template, bank_bic: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Styling & Options */}
        <Card>
          <CardHeader>
            <CardTitle>Design & Layout</CardTitle>
            <CardDescription>Customize the appearance of your documents</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Primary Color</Label>
              <div className="flex gap-2 mt-2">
                <Input
                  type="color"
                  value={template.primary_color}
                  onChange={(e) => setTemplate({ ...template, primary_color: e.target.value })}
                  className="w-20 h-10"
                />
                <Input
                  value={template.primary_color}
                  onChange={(e) => setTemplate({ ...template, primary_color: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label>Secondary Color</Label>
              <div className="flex gap-2 mt-2">
                <Input
                  type="color"
                  value={template.secondary_color}
                  onChange={(e) => setTemplate({ ...template, secondary_color: e.target.value })}
                  className="w-20 h-10"
                />
                <Input
                  value={template.secondary_color}
                  onChange={(e) => setTemplate({ ...template, secondary_color: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label>Show VAT Column in Table</Label>
              <Switch
                checked={template.show_vat_column}
                onCheckedChange={(checked) => setTemplate({ ...template, show_vat_column: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>Show Net/Gross Breakdown</Label>
              <Switch
                checked={template.show_net_gross}
                onCheckedChange={(checked) => setTemplate({ ...template, show_net_gross: checked })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <Card>
          <CardHeader>
            <CardTitle>Footer Text</CardTitle>
            <CardDescription>Legal disclaimers or additional information</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={template.footer_text || ''}
              onChange={(e) => setTemplate({ ...template, footer_text: e.target.value })}
              rows={5}
              placeholder="e.g., All prices include applicable taxes. Terms and conditions apply."
            />
          </CardContent>
        </Card>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => setShowPreview(true)}>
          <Eye className="h-4 w-4 mr-2" />
          Preview
        </Button>
        <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving...' : 'Save Template'}
        </Button>
      </div>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Template Preview</DialogTitle>
          </DialogHeader>
          <div className="bg-slate-100 p-4">
            <PDFDocumentTemplate 
              document={sampleDocument}
              lineItems={sampleLineItems}
              template={template}
            />
          </div>
          <div className="flex justify-end pt-4">
            <Button onClick={() => setShowPreview(false)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}