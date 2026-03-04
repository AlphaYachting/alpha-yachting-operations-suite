import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Sparkles, Upload, Loader2, X } from 'lucide-react';

/**
 * SupplierAIParser
 * Standalone component that extracts supplier data from PDF or text
 * and calls onDataExtracted(data) with pre-filled form fields.
 * No side effects on existing supplier logic.
 */
export default function SupplierAIParser({ onDataExtracted, onCancel }) {
  const [mode, setMode] = useState('text'); // 'text' | 'pdf'
  const [textInput, setTextInput] = useState('');
  const [pdfFile, setPdfFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const extractFromText = async () => {
    if (!textInput.trim()) return;
    setLoading(true);
    setError('');
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Extract supplier/company information from the following text and return it as structured data.
        
Text:
${textInput}

Extract:
- supplier_name: company/supplier name
- country: country (short name or code)
- phone: primary phone number
- email: email address
- website_url: website URL
- address: physical address
- vat_oib: VAT number or OIB/tax number
- type: classify as PRODUCT (sells products), WORK (provides services/labor), or BOTH
- tags: array of relevant category tags (e.g. Electronics, Engine Parts, Rigging, Safety Equipment)
- internal_notes: any other useful information

Return only what is clearly present in the text. Use empty string for missing fields and empty array for missing tags.`,
        response_json_schema: {
          type: 'object',
          properties: {
            supplier_name: { type: 'string' },
            country: { type: 'string' },
            phone: { type: 'string' },
            email: { type: 'string' },
            website_url: { type: 'string' },
            address: { type: 'string' },
            vat_oib: { type: 'string' },
            type: { type: 'string' },
            tags: { type: 'array', items: { type: 'string' } },
            internal_notes: { type: 'string' }
          }
        }
      });
      onDataExtracted(result);
    } catch (e) {
      setError('Extraction failed. Please try again.');
    }
    setLoading(false);
  };

  const extractFromPDF = async () => {
    if (!pdfFile) return;
    setLoading(true);
    setError('');
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: pdfFile });
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Extract supplier/company information from this document and return structured data.

Extract:
- supplier_name: company/supplier name
- country: country (short name or code)
- phone: primary phone number
- email: email address
- website_url: website URL
- address: physical address
- vat_oib: VAT number or OIB/tax number
- type: classify as PRODUCT (sells products), WORK (provides services/labor), or BOTH
- tags: array of relevant category tags (e.g. Electronics, Engine Parts, Rigging, Safety Equipment)
- internal_notes: any other useful information

Return only what is clearly present in the document. Use empty string for missing fields and empty array for missing tags.`,
        file_urls: [file_url],
        response_json_schema: {
          type: 'object',
          properties: {
            supplier_name: { type: 'string' },
            country: { type: 'string' },
            phone: { type: 'string' },
            email: { type: 'string' },
            website_url: { type: 'string' },
            address: { type: 'string' },
            vat_oib: { type: 'string' },
            type: { type: 'string' },
            tags: { type: 'array', items: { type: 'string' } },
            internal_notes: { type: 'string' }
          }
        }
      });
      onDataExtracted(result);
    } catch (e) {
      setError('PDF extraction failed. Please try again.');
    }
    setLoading(false);
  };

  return (
    <div className="space-y-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-600" />
          <span className="font-semibold text-purple-800 text-sm">AI Supplier Parser</span>
        </div>
        <button onClick={onCancel} className="text-slate-400 hover:text-slate-600">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Mode Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setMode('text')}
          className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${
            mode === 'text' ? 'bg-purple-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          Paste Text
        </button>
        <button
          onClick={() => setMode('pdf')}
          className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${
            mode === 'pdf' ? 'bg-purple-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          Upload PDF
        </button>
      </div>

      {/* Text Mode */}
      {mode === 'text' && (
        <div className="space-y-2">
          <Label className="text-xs text-slate-600">Paste email, website text, or any supplier information</Label>
          <Textarea
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Paste supplier info here... (company name, address, phone, email, website, VAT number, etc.)"
            rows={5}
            className="text-sm"
          />
          <Button
            onClick={extractFromText}
            disabled={loading || !textInput.trim()}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white"
          >
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analyzing...</> : <><Sparkles className="w-4 h-4 mr-2" /> Extract & Fill Form</>}
          </Button>
        </div>
      )}

      {/* PDF Mode */}
      {mode === 'pdf' && (
        <div className="space-y-2">
          <Label className="text-xs text-slate-600">Upload a PDF with supplier information</Label>
          <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-purple-300 rounded-lg cursor-pointer bg-white hover:bg-purple-50 transition-colors">
            <Upload className="w-6 h-6 text-purple-400 mb-1" />
            <span className="text-sm text-slate-500">{pdfFile ? pdfFile.name : 'Click to select PDF'}</span>
            <input
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
            />
          </label>
          <Button
            onClick={extractFromPDF}
            disabled={loading || !pdfFile}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white"
          >
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analyzing PDF...</> : <><Sparkles className="w-4 h-4 mr-2" /> Extract & Fill Form</>}
          </Button>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      <p className="text-xs text-slate-400">AI will pre-fill the form. You can review and edit before saving.</p>
    </div>
  );
}