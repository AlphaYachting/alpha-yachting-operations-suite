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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Save, Upload, Eye, Beaker, Columns3, Droplet } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import PDFDocumentTemplate from '@/components/pdf/PDFDocumentTemplate';
import PDFDiagnostics from '@/components/pdf/PDFDiagnostics';

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
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [templateId, setTemplateId] = useState(null);

  useEffect(() => {
    loadTemplate();
  }, []);

  const loadTemplate = async () => {
    try {
      const templates = await base44.entities.PDFTemplate.list();
      const defaultTemplate = templates.find(t => t.is_default) || templates[0];
      
      if (defaultTemplate) {
        console.log('Loaded template:', defaultTemplate);
        console.log('Letterhead URL:', defaultTemplate.letterhead_url);
        console.log('Letterhead Image URL:', defaultTemplate.letterhead_image_url);
        console.log('Letterhead Enabled:', defaultTemplate.letterhead_enabled);
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

  const handleFooterGraphicUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    try {
      const result = await base44.integrations.Core.UploadFile({ file });
      setTemplate({ ...template, footer_graphic_url: result.file_url });
      setSuccess('Footer graphic uploaded successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error uploading footer graphic:', error);
      setError('Failed to upload footer graphic');
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
        letterhead_url: result.file_url,
        letterhead_enabled: true
      };
      
      setTemplate(updatedTemplate);
      
      // Save to database immediately
      if (templateId) {
        await base44.entities.PDFTemplate.update(templateId, updatedTemplate);
        // Reload to confirm save
        await loadTemplate();
      } else {
        const created = await base44.entities.PDFTemplate.create(updatedTemplate);
        setTemplateId(created.id);
        await loadTemplate();
      }
      
      setSuccess('Letterhead uploaded and saved successfully!');
      setTimeout(() => setSuccess(''), 3000);
      
      e.target.value = '';
    } catch (error) {
      console.error('Error uploading letterhead:', error);
      setError(`Failed to upload letterhead: ${error.message || 'Unknown error'}`);
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

            {template.letterhead_url && (
              <div className="border rounded-lg p-4 bg-slate-50">
                <p className="text-sm font-medium mb-3">Current Letterhead</p>
                <img 
                  src={template.letterhead_url} 
                  alt="Letterhead" 
                  className="w-full max-w-md border rounded"
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
                {uploading ? 'Uploading...' : (template.letterhead_url ? 'Replace Letterhead' : 'Upload Letterhead')}
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
              <Label>Logo Height (mm)</Label>
              <Input
                type="number"
                min="5"
                max="100"
                value={template.logo_height_mm || 20}
                onChange={(e) => setTemplate({ ...template, logo_height_mm: parseFloat(e.target.value) })}
              />
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

        {/* Watermark Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Droplet className="h-5 w-5" />
              Watermark Settings
            </CardTitle>
            <CardDescription>Add watermarks like DRAFT, PAID, or CONFIDENTIAL</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Enable Watermark</Label>
              <Switch
                checked={template.watermark_enabled || false}
                onCheckedChange={(checked) => setTemplate({ ...template, watermark_enabled: checked })}
              />
            </div>

            {template.watermark_enabled && (
              <>
                <div>
                  <Label>Watermark Text</Label>
                  <Input
                    value={template.watermark_text || 'DRAFT'}
                    onChange={(e) => setTemplate({ ...template, watermark_text: e.target.value })}
                    placeholder="e.g., DRAFT, PAID, CONFIDENTIAL"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Opacity (0.0 - 1.0)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="1"
                      step="0.05"
                      value={template.watermark_opacity ?? 0.1}
                      onChange={(e) => setTemplate({ ...template, watermark_opacity: parseFloat(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label>Angle (degrees)</Label>
                    <Input
                      type="number"
                      value={template.watermark_angle ?? -45}
                      onChange={(e) => setTemplate({ ...template, watermark_angle: parseFloat(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded border border-slate-200">
                  <p className="text-xs text-slate-600">Preview:</p>
                  <div style={{
                    position: 'relative',
                    width: '100%',
                    height: '120px',
                    border: '1px solid #ddd',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      fontSize: '48pt',
                      fontWeight: 'bold',
                      color: '#ccc',
                      opacity: template.watermark_opacity ?? 0.1,
                      transform: `rotate(${template.watermark_angle ?? -45}deg)`,
                      whiteSpace: 'nowrap'
                    }}>
                      {template.watermark_text || 'DRAFT'}
                    </div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Table Column Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Columns3 className="h-5 w-5" />
              Table Column Settings
            </CardTitle>
            <CardDescription>Customize column widths and alignment</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <p className="text-sm font-medium mb-3">Column Widths (%)</p>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {['index', 'description', 'quantity', 'unit', 'unit_price', 'vat', 'total'].map((col) => (
                  <div key={col}>
                    <Label className="text-xs capitalize">{col === 'unit_price' ? 'Unit Price' : col}</Label>
                    <Input
                      type="number"
                      min="1"
                      max="100"
                      value={template.table_column_widths?.[col] || (col === 'description' ? 38 : col === 'index' ? 4 : 8)}
                      onChange={(e) => setTemplate({
                        ...template,
                        table_column_widths: {
                          ...template.table_column_widths,
                          [col]: parseFloat(e.target.value)
                        }
                      })}
                      className="text-sm"
                    />
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-2">Total should equal 100%</p>
            </div>

            <div>
              <p className="text-sm font-medium mb-3">Column Alignment</p>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {['index', 'description', 'quantity', 'unit', 'unit_price', 'vat', 'total'].map((col) => (
                  <div key={col}>
                    <Label className="text-xs capitalize">{col === 'unit_price' ? 'Unit Price' : col}</Label>
                    <Select
                      value={template.table_column_align?.[col] || (col === 'description' ? 'left' : 'right')}
                      onValueChange={(value) => setTemplate({
                        ...template,
                        table_column_align: {
                          ...template.table_column_align,
                          [col]: value
                        }
                      })}
                    >
                      <SelectTrigger className="text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="left">Left</SelectItem>
                        <SelectItem value="center">Center</SelectItem>
                        <SelectItem value="right">Right</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Page Break Rules */}
        <Card>
          <CardHeader>
            <CardTitle>Page Break Rules</CardTitle>
            <CardDescription>Control where content breaks across pages</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Break Before Totals</Label>
                <p className="text-xs text-slate-500">Insert page break before totals section</p>
              </div>
              <Switch
                checked={template.page_break_rules?.break_before_totals || false}
                onCheckedChange={(checked) => setTemplate({
                  ...template,
                  page_break_rules: { ...template.page_break_rules, break_before_totals: checked }
                })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Break Before Notes</Label>
                <p className="text-xs text-slate-500">Insert page break before notes section</p>
              </div>
              <Switch
                checked={template.page_break_rules?.break_before_notes || false}
                onCheckedChange={(checked) => setTemplate({
                  ...template,
                  page_break_rules: { ...template.page_break_rules, break_before_notes: checked }
                })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Keep Totals with Items</Label>
                <p className="text-xs text-slate-500">Prevent separation of totals from last item</p>
              </div>
              <Switch
                checked={template.page_break_rules?.keep_totals_with_items !== false}
                onCheckedChange={(checked) => setTemplate({
                  ...template,
                  page_break_rules: { ...template.page_break_rules, keep_totals_with_items: checked }
                })}
              />
            </div>

            <div>
              <Label>Min Lines Before Break</Label>
              <p className="text-xs text-slate-500 mb-2">Minimum line items before page break is allowed</p>
              <Input
                type="number"
                min="1"
                max="20"
                value={template.page_break_rules?.min_lines_before_break || 3}
                onChange={(e) => setTemplate({
                  ...template,
                  page_break_rules: { ...template.page_break_rules, min_lines_before_break: parseFloat(e.target.value) }
                })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Footer & Typography */}
        <Card>
          <CardHeader>
            <CardTitle>Footer & Typography</CardTitle>
            <CardDescription>Customize text styling and footer content</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Font Selection */}
            <div className="space-y-2">
              <Label>Font Family</Label>
              <Select value={template.font_family || 'Arial'} onValueChange={(value) => setTemplate({ ...template, font_family: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Arial">Arial</SelectItem>
                  <SelectItem value="Helvetica">Helvetica</SelectItem>
                  <SelectItem value="Times New Roman">Times New Roman</SelectItem>
                  <SelectItem value="Georgia">Georgia</SelectItem>
                  <SelectItem value="Courier New">Courier New</SelectItem>
                  <SelectItem value="Verdana">Verdana</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Font Sizes */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Body Text Size (pt)</Label>
                <Input
                  type="number"
                  min="8"
                  max="14"
                  value={template.font_size_body || 11}
                  onChange={(e) => setTemplate({ ...template, font_size_body: parseFloat(e.target.value) })}
                />
              </div>
              <div>
                <Label>Heading Size (pt)</Label>
                <Input
                  type="number"
                  min="12"
                  max="24"
                  value={template.font_size_heading || 18}
                  onChange={(e) => setTemplate({ ...template, font_size_heading: parseFloat(e.target.value) })}
                />
              </div>
              <div>
                <Label>Company Name Size (pt)</Label>
                <Input
                  type="number"
                  min="14"
                  max="32"
                  value={template.font_size_company_name || 20}
                  onChange={(e) => setTemplate({ ...template, font_size_company_name: parseFloat(e.target.value) })}
                />
              </div>
            </div>

            {/* Spacing */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Line Spacing (1.0 - 2.5)</Label>
                <Input
                  type="number"
                  min="1"
                  max="2.5"
                  step="0.1"
                  value={template.line_spacing || 1.5}
                  onChange={(e) => setTemplate({ ...template, line_spacing: parseFloat(e.target.value) })}
                />
              </div>
              <div>
                <Label>Paragraph Spacing (pt)</Label>
                <Input
                  type="number"
                  min="5"
                  max="30"
                  value={template.paragraph_spacing || 15}
                  onChange={(e) => setTemplate({ ...template, paragraph_spacing: parseFloat(e.target.value) })}
                />
              </div>
            </div>

            {/* Footer Text */}
            <div>
              <Label>Footer Text</Label>
              <p className="text-xs text-slate-500 mb-2">Legal disclaimers or additional information shown at the bottom of documents</p>
              <Textarea
                value={template.footer_text || ''}
                onChange={(e) => setTemplate({ ...template, footer_text: e.target.value })}
                rows={3}
                placeholder="e.g., All prices include applicable taxes. Terms and conditions apply."
              />
            </div>

            {/* Custom Footer */}
            <div>
              <Label>Custom Footer Content</Label>
              <p className="text-xs text-slate-500 mb-2">Additional custom content for the footer (e.g., company website, copyright)</p>
              <Textarea
                value={template.custom_footer || ''}
                onChange={(e) => setTemplate({ ...template, custom_footer: e.target.value })}
                rows={3}
                placeholder="e.g., © 2026 Alpha Yachting. www.alphayachting.com"
              />
            </div>

            {/* Footer Graphic */}
            <div>
              <Label>Footer Graphic</Label>
              <p className="text-xs text-slate-500 mb-3">Upload a graphic or image to display above the footer text (e.g., company logo, seal, or decorative element)</p>
              {template.footer_graphic_url && (
                <div className="mb-4 p-3 border rounded-lg bg-slate-50">
                  <p className="text-sm font-medium mb-2">Current Footer Graphic</p>
                  <img 
                    src={template.footer_graphic_url} 
                    alt="Footer Graphic" 
                    className="max-h-20 object-contain"
                    onError={(e) => {
                      console.error('Footer graphic failed to load:', template.footer_graphic_url);
                      e.target.style.display = 'none';
                    }}
                  />
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={handleFooterGraphicUpload}
                className="hidden"
                id="footer-graphic-upload"
              />
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => document.getElementById('footer-graphic-upload').click()}
                disabled={uploading}
              >
                <Upload className="h-4 w-4 mr-2" />
                {uploading ? 'Uploading...' : (template.footer_graphic_url ? 'Replace Footer Graphic' : 'Upload Footer Graphic')}
              </Button>
            </div>

            <div>
              <Label>Footer Graphic Height (mm)</Label>
              <Input
                type="number"
                min="5"
                max="100"
                value={template.footer_graphic_height_mm || 25}
                onChange={(e) => setTemplate({ ...template, footer_graphic_height_mm: parseFloat(e.target.value) })}
              />
            </div>
          </CardContent>
        </Card>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center">
        <Button variant="outline" onClick={() => setShowDiagnostics(true)}>
          <Beaker className="h-4 w-4 mr-2" />
          Run PDF Diagnostics
        </Button>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setShowPreview(true)}>
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>
          <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Template'}
          </Button>
        </div>
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

      {/* Diagnostics Dialog */}
      <Dialog open={showDiagnostics} onOpenChange={setShowDiagnostics}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>PDF Export Diagnostics</DialogTitle>
          </DialogHeader>
          <PDFDiagnostics />
        </DialogContent>
      </Dialog>
    </div>
  );
}