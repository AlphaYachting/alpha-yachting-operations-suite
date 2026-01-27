import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Save, RotateCcw, Download } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import LayoutCanvas from '@/components/pdf/LayoutCanvas';
import LayoutControls from '@/components/pdf/LayoutControls';
import LayoutValidation from '@/components/pdf/LayoutValidation';

const DEFAULT_LAYOUT = {
  page: { format: 'A4', orientation: 'portrait' },
  margins_mm: { top: 15, right: 12, bottom: 15, left: 12 },
  header: {
    height_mm: 45,
    blocks: {
      seller: { x_mm: 12, y_mm: 10, w_mm: 90, h_mm: 25 },
      buyer: { x_mm: 110, y_mm: 20, w_mm: 85, h_mm: 25 },
      meta: { x_mm: 110, y_mm: 10, w_mm: 85, h_mm: 10 }
    }
  },
  table: { x_mm: 12, y_mm: 60, w_mm: 186, header_height_mm: 8, row_height_mm: 7, repeat_header: true },
  totals: { keep_together: true, min_space_mm: 35 },
  footer: { height_mm: 20, page_numbers: { x_mm: 180, y_mm: 287 } }
};

export default function PDFLayoutEditor() {
  const navigate = useNavigate();
  const [template, setTemplate] = useState(null);
  const [layout, setLayout] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedBlock, setSelectedBlock] = useState(null);
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
        setLayout(defaultTemplate.pdf_layout_settings || DEFAULT_LAYOUT);
      } else {
        setLayout(DEFAULT_LAYOUT);
      }
    } catch (err) {
      console.error('Error loading template:', err);
      setError('Failed to load template');
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
        await base44.entities.PDFTemplate.update(templateId, { pdf_layout_settings: layout });
      } else {
        const created = await base44.entities.PDFTemplate.create({ pdf_layout_settings: layout, is_default: true });
        setTemplateId(created.id);
      }
      setSuccess('Layout saved successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error saving layout:', err);
      setError('Failed to save layout');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setLayout(DEFAULT_LAYOUT);
    setSelectedBlock(null);
  };

  const handleBlockChange = (blockName, data) => {
    if (blockName === 'seller' || blockName === 'buyer' || blockName === 'meta') {
      setLayout({
        ...layout,
        header: {
          ...layout.header,
          blocks: {
            ...layout.header.blocks,
            [blockName]: data
          }
        }
      });
    } else if (blockName === 'table') {
      setLayout({ ...layout, table: data });
    }
  };

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(createPageUrl('Settings'))}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">PDF Layout Editor</h1>
          <p className="text-slate-500 mt-1">Visually design your invoice and offer page layout</p>
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

      {/* Main editor grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left panel: Controls */}
        <div className="lg:col-span-1 order-3 lg:order-1">
          <LayoutControls
            layout={layout}
            onLayoutChange={setLayout}
            selectedBlock={selectedBlock}
            onSelectBlock={setSelectedBlock}
          />
        </div>

        {/* Center: Canvas */}
        <div className="lg:col-span-2 order-1 lg:order-2">
          <div className="bg-slate-50 p-4 rounded-lg">
            <LayoutCanvas
              layout={layout}
              onBlockChange={handleBlockChange}
              selectedBlock={selectedBlock}
              onSelectBlock={setSelectedBlock}
              showGrid={true}
              showGuides={true}
            />
          </div>
        </div>

        {/* Right panel: Validation */}
        <div className="lg:col-span-1 order-2 lg:order-3">
          <LayoutValidation layout={layout} />
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center pt-6 border-t">
        <Button variant="outline" onClick={handleReset}>
          <RotateCcw className="h-4 w-4 mr-2" />
          Reset to Defaults
        </Button>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => navigate(createPageUrl('PDFTemplateSettings'))}>
            Template Settings
          </Button>
          <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Layout'}
          </Button>
        </div>
      </div>
    </div>
  );
}