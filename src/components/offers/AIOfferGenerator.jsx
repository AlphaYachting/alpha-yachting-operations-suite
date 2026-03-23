import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import AIAssistantChat from './AIAssistantChat';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Sparkles, AlertCircle, FileText, Upload, Trash2, Edit2, DollarSign, Percent, Bot } from 'lucide-react';
import { processExtractedPosition } from './priceParser';
import { calculateFinalPrice } from './markupCalculator';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

export default function AIOfferGenerator({ formData, customers, boats, jobs, onTasksGenerated, onDescriptionGenerated, existingTasks = [] }) {
  const [mode, setMode] = useState('text'); // 'text', 'pdf', or 'assistant'
  const [prompt, setPrompt] = useState('');
  const [defaultUnitPrice, setDefaultUnitPrice] = useState(70);
  const [detailedExplanations, setDetailedExplanations] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingTasks, setPendingTasks] = useState([]);
  const [pendingDescription, setPendingDescription] = useState('');
  const [keepExisting, setKeepExisting] = useState(true);
  
  // PDF mode states
  const [pdfFile, setPdfFile] = useState(null);
  const [extracting, setExtracting] = useState(false);
  const [extractedPositions, setExtractedPositions] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [showCreateConfirm, setShowCreateConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  
  // Markup controls
  const [markupEnabled, setMarkupEnabled] = useState(false);
  const [markupPercent, setMarkupPercent] = useState(20);
  const [rounding, setRounding] = useState('None');

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Please enter a description of the work needed');
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      const customer = customers.find(c => c.id === formData.customer_id);
      const boat = boats.find(b => b.id === formData.boat_id);
      const job = jobs.find(j => j.id === formData.job_id);

      const languageMap = {
        'German': 'German (Deutsch)',
        'English': 'English',
        'Italian': 'Italian (Italiano)',
        'Slovenian': 'Slovenian (Slovenščina)',
        'Croatian': 'Croatian (Hrvatski)'
      };

      const context = `
IMPORTANT: Generate ALL content in ${languageMap[formData.language] || 'German'}.

Customer: ${customer?.company_name || `${customer?.first_name} ${customer?.last_name}`}
${boat ? `Boat: ${boat.vessel_name} (${boat.manufacturer} ${boat.model}, ${boat.year})` : ''}
${boat?.engine_manufacturer ? `Engine: ${boat.engine_manufacturer} ${boat.engine_model || ''}` : ''}
${job ? `Related Job: ${job.title}` : ''}

Work Description:
${prompt}

---

Generate a professional service offer task list. Follow these rules carefully:

## TASK SPLITTING RULE (CRITICAL)
Whenever a job involves both a material/product AND the work to install/apply it, you MUST create TWO separate tasks:
1. A "Material" task for the product itself
2. A "Labor" task for the installation/application work
Example: "Change engine oil" → Task 1: "Motoröl 15W-40 5L" (Material, 5 Liter) + Task 2: "Motoröl wechseln" (Labor, hours)

## MATERIAL TASK TITLES
Material task titles MUST be the product/article name ONLY — no verbs, no "Installation von", no "Einbau von".
✓ CORRECT: "Kraftstofffilter Volvo Penta", "Antifouling Farbe 5L", "Motoröl 15W-40"
✗ WRONG: "Installation des Kraftstofffilters", "Antifouling auftragen", "Motoröl wechseln"

## LABOR TASK TITLES
Labor task titles describe the work action — use a verb or action phrase.
✓ CORRECT: "Kraftstofffilter wechseln", "Antifouling auftragen", "Motoröl wechseln", "Inspektion Motorraum"

## item_type CLASSIFICATION
- "Chapter": a section heading to group tasks visually. Use it to divide the offer into logical sections (e.g. "1. Motorservice", "2. Elektrik"). A Chapter has NO price, quantity, or description.
- "Material": physical products, parts, consumables, oil, filters, paint, antifouling, anodes, belts, hoses, sealants, adhesives, spare parts
- "Labor": any work performed by a technician — service, inspection, installation, repair, diagnostics, travel, commissioning

## CHAPTER HEADINGS (OPTIONAL)
If the work involves multiple clearly separate areas (e.g. engine + electrical + rigging), you MAY insert Chapter headings to group them. A Chapter entry has ONLY a title — no quantity, no unit_price, no description.

## DESCRIPTIONS
${detailedExplanations
  ? 'Write a detailed technical description:\n  • Use bullet points with "• " at the start of each point\n  • Put each bullet point on a new line\n  • Group related steps under clear subtopics\n  • Keep each bullet point concise and complete'
  : 'Write a short, clear description (1-2 sentences) that a non-technical customer can understand. No bullet points needed for simple items.'}
- For Material tasks: describe the product specification (e.g. brand, spec, quantity details)
- For Labor tasks: describe what work is done and why

## QUANTITIES & UNITS
- Labor: quantity = estimated hours, unit_type = "Hour"
- Material: quantity = realistic amount, unit_type = "Piece" / "Liter" / "Kilogram" / "Set" / "Square Meter" etc.

## PRICING
- unit_price: Set ONLY if a price is explicitly stated in the input text.
  * Per-unit price given (e.g. "70 €/h"): use directly
  * Lump sum for multiple units (e.g. "1.050 € for 15 m²"): unit_price = 1050 / 15 = 70
  * No price mentioned: return null (do NOT estimate)
- total_price: The total as stated in the input text (before division)

## CLIENT DESCRIPTION
Also generate a short professional client-facing summary (3-5 sentences) describing the scope of work, what will be done, and the benefit for the customer. Write in a professional but approachable tone in ${languageMap[formData.language] || 'German'}.

REMEMBER: Write ALL content (titles, descriptions, client description) in ${languageMap[formData.language] || 'German'}.
`.trim();

      const response = await base44.integrations.Core.InvokeLLM({
        prompt: context,
        response_json_schema: {
          type: 'object',
          properties: {
            client_description: {
              type: 'string',
              description: 'A brief, professional description for the client explaining the issue and proposed solution (2-4 sentences)'
            },
            tasks: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string' },
                  item_type: { type: 'string', enum: ['Labor', 'Material'], description: 'Labor = service/work, Material = physical parts/consumables/products' },
                  unit_type: { type: 'string' },
                  quantity: { type: 'number' },
                  unit_price: { type: 'number', description: 'Per-unit price. If total price is given for qty>1, divide total by quantity. Only if price is stated in input.' },
                  total_price: { type: 'number', description: 'Total price for this position as stated in the input text' }
                },
                required: ['title', 'quantity']
              }
            }
          },
          required: ['client_description', 'tasks']
        }
      });

      if (response.tasks && Array.isArray(response.tasks)) {
        const tasksWithPrices = response.tasks.map(task => {
          const unitPrice = (task.unit_price != null && task.unit_price > 0)
            ? task.unit_price
            : defaultUnitPrice;
          const isMaterial = task.item_type === 'Material';
          return {
            ...task,
            item_type: task.item_type || 'Labor',
            unit_type: task.unit_type || (isMaterial ? 'Piece' : 'Hour'),
            unit_price: unitPrice,
            total_amount: task.quantity * unitPrice
          };
        });
        
        // Check if there are existing tasks
        if (existingTasks && existingTasks.length > 0) {
          setPendingTasks(tasksWithPrices);
          setPendingDescription(response.client_description || '');
          setShowConfirmDialog(true);
          setGenerating(false);
        } else {
          // No existing tasks, apply directly
          onTasksGenerated(tasksWithPrices);
          if (response.client_description && onDescriptionGenerated) {
            onDescriptionGenerated(response.client_description);
          }
          setGenerating(false);
          setPrompt('');
        }
      } else {
        throw new Error('Invalid response from AI');
      }
    } catch (err) {
      console.error('AI generation error:', err);
      setError(err.message || 'Failed to generate tasks. Please try again.');
      setGenerating(false);
    }
  };

  const handleConfirmApply = () => {
    const finalTasks = keepExisting 
      ? [...existingTasks, ...pendingTasks]
      : pendingTasks;
    
    onTasksGenerated(finalTasks);
    
    if (pendingDescription && onDescriptionGenerated) {
      onDescriptionGenerated(pendingDescription);
    }
    
    setShowConfirmDialog(false);
    setPendingTasks([]);
    setPendingDescription('');
    setPrompt('');
    setKeepExisting(true);
  };

  const handlePdfUpload = (e) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setPdfFile(file);
      setError(null);
      setExtractedPositions([]);
      setShowPreview(false);
    } else {
      setError('Please upload a valid PDF file');
    }
  };

  const handleExtractAndPreview = async () => {
    if (!pdfFile) {
      setError('Please select a PDF file first');
      return;
    }

    setExtracting(true);
    setError(null);

    try {
      // Step 1: Upload file
      const { file_url } = await base44.integrations.Core.UploadFile({ file: pdfFile });

      // Step 2: Extract structured data
      const extractionSchema = {
        type: 'object',
        properties: {
          positions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                description: { type: 'string' },
                quantity: { type: 'number' },
                unit: { type: 'string' },
                unit_price_raw: { type: 'string' },
                total_price_raw: { type: 'string' },
                group: { type: 'string' },
                source_excerpt: { type: 'string' },
                confidence: { type: 'string', enum: ['High', 'Medium', 'Low'] }
              },
              required: ['title']
            }
          },
          general_description: { type: 'string' }
        },
        required: ['positions']
      };

      const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url,
        json_schema: extractionSchema
      });

      if (result.status === 'error') {
        setError(result.details || 'Failed to extract data from PDF. This may be an image-based PDF.');
        setExtracting(false);
        return;
      }

      const positions = result.output?.positions || [];
      
      if (positions.length === 0) {
        setError('No positions found in PDF. This may be an image-based PDF where text extraction is not possible.');
        setExtracting(false);
        return;
      }

      // Normalize positions with price parsing
      const normalizedPositions = positions.map((pos, idx) => {
        const processed = processExtractedPosition(pos, defaultUnitPrice);
        return {
          id: `extracted-${idx}`,
          title: pos.title || 'Untitled Position',
          description: pos.description || '',
          quantity: pos.quantity || 1,
          unit: pos.unit || 'Piece',
          group: pos.group || '',
          source_excerpt: pos.source_excerpt || '',
          confidence: pos.confidence || 'Medium',
          unit_price: processed.unit_price,
          total_amount: processed.total_amount,
          unit_price_extracted: processed.unit_price_extracted,
          total_price_extracted: processed.total_price_extracted,
          price_confidence: processed.price_confidence,
          price_source: processed.price_source,
          currency_detected: processed.currency_detected
        };
      });

      setExtractedPositions(normalizedPositions);
      if (result.output?.general_description) {
        setPendingDescription(result.output.general_description);
      }
      setShowPreview(true);
      setExtracting(false);
    } catch (err) {
      console.error('PDF extraction error:', err);
      setError(err.message || 'Failed to extract data from PDF. Please try again.');
      setExtracting(false);
    }
  };

  const handleDeletePosition = (id) => {
    setExtractedPositions(prev => prev.filter(p => p.id !== id));
  };

  const handleEditPosition = (position) => {
    setEditingRow(position);
  };

  const handleSaveEdit = () => {
    if (editingRow) {
      setExtractedPositions(prev => 
        prev.map(p => p.id === editingRow.id ? editingRow : p)
      );
      setEditingRow(null);
    }
  };

  const handleCreateFromPreview = () => {
    if (extractedPositions.length === 0) {
      setError('No positions to create');
      return;
    }
    setShowCreateConfirm(true);
  };

  const handleConfirmCreate = () => {
    if (confirmText.toUpperCase() !== 'CONFIRM') {
      setError('Please type CONFIRM to proceed');
      return;
    }

    const tasksToCreate = extractedPositions.map(pos => {
      // Apply markup if enabled
      const finalUnitPrice = markupEnabled 
        ? calculateFinalPrice(pos.unit_price, markupPercent, rounding)
        : pos.unit_price;
      
      return {
        title: pos.title,
        description: pos.description,
        quantity: pos.quantity,
        unit_type: pos.unit,
        unit_price: finalUnitPrice,
        total_amount: finalUnitPrice * pos.quantity
      };
    });

    const finalTasks = keepExisting 
      ? [...existingTasks, ...tasksToCreate]
      : tasksToCreate;

    onTasksGenerated(finalTasks);
    
    if (pendingDescription && onDescriptionGenerated) {
      onDescriptionGenerated(pendingDescription);
    }

    // Reset
    setShowCreateConfirm(false);
    setConfirmText('');
    setPdfFile(null);
    setExtractedPositions([]);
    setShowPreview(false);
    setKeepExisting(true);
  };

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Mode Selector */}
      <div className="flex gap-2 p-1 bg-slate-100 rounded-lg">
        <button
          onClick={() => setMode('text')}
          className={`flex-1 px-4 py-2 rounded text-sm font-medium transition-colors ${
            mode === 'text' 
              ? 'bg-white text-slate-900 shadow' 
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileText className="h-4 w-4 inline mr-2" />
          Generate from Text
        </button>
        <button
          onClick={() => setMode('pdf')}
          className={`flex-1 px-4 py-2 rounded text-sm font-medium transition-colors ${
            mode === 'pdf' 
              ? 'bg-white text-slate-900 shadow' 
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Upload className="h-4 w-4 inline mr-2" />
          Generate from PDF
        </button>
        <button
          onClick={() => setMode('assistant')}
          className={`flex-1 px-4 py-2 rounded text-sm font-medium transition-colors ${
            mode === 'assistant' 
              ? 'bg-white text-slate-900 shadow' 
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Bot className="h-4 w-4 inline mr-2" />
          KI-Assistent
        </button>
      </div>

      {mode === 'text' ? (
        <>
          <div className="space-y-2">
            <Label>Describe the Work Needed</Label>
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g., Annual engine service for a 40hp Yamaha outboard, including oil change, filter replacement, spark plugs, and general inspection..."
          rows={6}
          disabled={generating}
        />
        <p className="text-xs text-slate-500">
          Be specific about the type of work, equipment involved, and any special requirements
        </p>
      </div>

      <div className="space-y-2">
        <Label>Default Unit Price (€)</Label>
        <Input
          type="number"
          step="1"
          min="0"
          value={defaultUnitPrice}
          onChange={(e) => setDefaultUnitPrice(parseFloat(e.target.value) || 70)}
          disabled={generating}
        />
        <p className="text-xs text-slate-500">
          This price will be applied to all generated tasks (you can adjust individual tasks later)
        </p>
      </div>

      <div className="flex items-center gap-3 p-4 border border-slate-200 rounded-lg">
        <Checkbox
          id="detailed-explanations"
          checked={detailedExplanations}
          onCheckedChange={setDetailedExplanations}
          disabled={generating}
        />
        <div className="flex-1">
          <Label htmlFor="detailed-explanations" className="cursor-pointer font-medium">
            Generate detailed technical explanations
          </Label>
          <p className="text-xs text-slate-500 mt-1">
            Include technical specifications and procedures (recommended for technically knowledgeable clients)
          </p>
        </div>
      </div>

          <Button
            onClick={handleGenerate}
            disabled={generating || !prompt.trim()}
            className="w-full bg-purple-600 hover:bg-purple-700"
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating Tasks...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Tasks with AI
              </>
            )}
          </Button>
        </>
      ) : mode === 'assistant' ? (
        <AIAssistantChat
          formData={formData}
          customers={customers}
          boats={boats}
          onTasksGenerated={onTasksGenerated}
          onDescriptionGenerated={onDescriptionGenerated}
          existingTasks={existingTasks}
        />
      ) : (
        <>
          {/* PDF Upload Mode */}
          <div className="space-y-4">
            {/* Compact 2-column grid for controls */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Upload PDF</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept="application/pdf"
                    onChange={handlePdfUpload}
                    disabled={extracting}
                    className="w-full"
                  />
                  {pdfFile && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        setPdfFile(null);
                        setExtractedPositions([]);
                        setShowPreview(false);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {pdfFile && (
                  <p className="text-xs text-slate-600">
                    Selected: {pdfFile.name} ({(pdfFile.size / 1024).toFixed(1)} KB)
                  </p>
                )}
                <p className="text-xs text-slate-500">
                  Text-based PDF only. Image/scanned PDFs may not work.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Default Unit Price (€)</Label>
                <Input
                  type="number"
                  step="1"
                  min="0"
                  value={defaultUnitPrice}
                  onChange={(e) => setDefaultUnitPrice(parseFloat(e.target.value) || 70)}
                  disabled={extracting}
                  className="w-full"
                />
                <p className="text-xs text-slate-500">
                  Used when prices cannot be extracted
                </p>
              </div>
            </div>

            {/* Markup Settings (Pre-Extraction) - Full Width */}
            <div className="bg-slate-100 border border-slate-200 rounded-lg p-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Switch
                    id="pre-markup-toggle"
                    checked={markupEnabled}
                    onCheckedChange={setMarkupEnabled}
                  />
                  <Label htmlFor="pre-markup-toggle" className="text-sm font-medium cursor-pointer">
                    Apply Markup to Extracted Prices
                  </Label>
                </div>
                
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Percent className="h-4 w-4 text-slate-500" />
                    <Input
                      type="number"
                      min="0"
                      max="200"
                      step="5"
                      value={markupPercent}
                      onChange={(e) => setMarkupPercent(parseFloat(e.target.value) || 0)}
                      className="h-8 w-20"
                      placeholder="0"
                    />
                    <span className="text-sm text-slate-600">%</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-slate-600">Round:</Label>
                    <Select value={rounding} onValueChange={setRounding}>
                      <SelectTrigger className="w-24 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="None">None</SelectItem>
                        <SelectItem value="1€">1€</SelectItem>
                        <SelectItem value="5€">5€</SelectItem>
                        <SelectItem value="10€">10€</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            <Button
              onClick={handleExtractAndPreview}
              disabled={!pdfFile || extracting}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              {extracting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Extracting...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  Extract & Preview
                </>
              )}
            </Button>

            {/* Preview Table */}
            {showPreview && extractedPositions.length > 0 && (
              <div className="space-y-4">
                {/* Currency Warning */}
                {extractedPositions.some(p => p.currency_detected && p.currency_detected !== 'EUR') && (
                  <Alert className="bg-amber-50 border-amber-200">
                    <DollarSign className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-sm text-amber-800">
                      <strong>Currency Detected:</strong> Some positions have non-EUR currency ({
                        [...new Set(extractedPositions.map(p => p.currency_detected).filter(Boolean))].join(', ')
                      }). Please review and convert prices manually if needed.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Markup Status */}
                {markupEnabled && markupPercent > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-sm text-blue-800">
                      <Percent className="h-4 w-4" />
                      <span className="font-medium">Markup Active: +{markupPercent}% {rounding !== 'None' && `(rounded to ${rounding})`}</span>
                    </div>
                  </div>
                )}

                <div className="border rounded-lg bg-white overflow-x-auto">
                  <div className="max-h-[55vh] overflow-y-auto">
                    <Table className="min-w-[1100px]">
                      <TableHeader className="sticky top-0 bg-slate-50 z-10 shadow-sm">
                        <TableRow>
                          <TableHead className="w-[180px] font-medium text-slate-700 text-xs">Title</TableHead>
                          <TableHead className="w-[50px] text-center font-medium text-slate-700 text-xs">Qty</TableHead>
                          <TableHead className="w-[70px] font-medium text-slate-700 text-xs">Unit</TableHead>
                          <TableHead className="w-[90px] text-right font-medium text-slate-700 text-xs">Orig. Price (€)</TableHead>
                          <TableHead className="w-[90px] text-right font-medium text-slate-700 text-xs">New Price (€)</TableHead>
                          <TableHead className="w-[90px] text-right font-medium text-slate-700 text-xs">Orig. Total (€)</TableHead>
                          <TableHead className="w-[90px] text-right font-medium text-slate-700 text-xs">New Total (€)</TableHead>
                          <TableHead className="w-[220px] font-medium text-slate-700 text-xs">Description</TableHead>
                          <TableHead className="w-[70px] text-center font-medium text-slate-700 text-xs">Conf.</TableHead>
                          <TableHead className="w-[100px] text-center font-medium text-slate-700 text-xs sticky right-0 bg-slate-50 border-l border-slate-200">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                    <TableBody>
                      {extractedPositions.map((position) => {
                        // Calculate display prices with markup if enabled
                        const displayUnitPrice = markupEnabled 
                          ? calculateFinalPrice(position.unit_price, markupPercent, rounding)
                          : position.unit_price;
                        const displayTotal = displayUnitPrice * position.quantity;
                        
                        return (
                        <TableRow key={position.id} className="hover:bg-slate-50">
                          <TableCell className="align-top">
                            {editingRow?.id === position.id ? (
                              <Input
                                value={editingRow.title}
                                onChange={(e) => setEditingRow({...editingRow, title: e.target.value})}
                                className="h-8"
                              />
                            ) : (
                              <div>
                                <div className="font-medium text-sm leading-tight">{position.title}</div>
                                {position.group && (
                                  <Badge variant="outline" className="text-xs mt-1">
                                    {position.group}
                                  </Badge>
                                )}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-center align-top">
                            {editingRow?.id === position.id ? (
                              <Input
                                type="number"
                                value={editingRow.quantity}
                                onChange={(e) => setEditingRow({...editingRow, quantity: parseFloat(e.target.value) || 1})}
                                className="h-8 w-16"
                              />
                            ) : (
                              <span className="font-medium">{position.quantity}</span>
                            )}
                          </TableCell>
                          <TableCell className="align-top">
                            {editingRow?.id === position.id ? (
                              <Input
                                value={editingRow.unit}
                                onChange={(e) => setEditingRow({...editingRow, unit: e.target.value})}
                                className="h-8"
                              />
                            ) : (
                              <span className="text-sm text-slate-600">{position.unit}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right align-top">
                            <span className="text-slate-600 tabular-nums text-sm">
                              {position.price_confidence === 'None' ? '—' : position.unit_price.toFixed(2)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right align-top">
                            {editingRow?.id === position.id ? (
                              <Input
                                type="number"
                                step="0.01"
                                value={editingRow.unit_price}
                                onChange={(e) => {
                                  const price = parseFloat(e.target.value) || 0;
                                  setEditingRow({
                                    ...editingRow, 
                                    unit_price: price,
                                    total_amount: price * editingRow.quantity
                                  });
                                }}
                                className="h-8 text-right"
                              />
                            ) : (
                              <div className="flex items-center justify-end gap-2">
                                <span className="font-medium tabular-nums text-slate-900">
                                  {position.price_confidence === 'None' ? '—' : displayUnitPrice.toFixed(2)}
                                </span>
                                {position.price_confidence !== 'None' && position.price_confidence !== 'Low' && (
                                  <span 
                                    className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs ${
                                      position.price_confidence === 'High' 
                                        ? 'bg-green-100 text-green-700' 
                                        : 'bg-amber-100 text-amber-700'
                                    }`}
                                    title={`Price confidence: ${position.price_confidence}`}
                                  >
                                    {position.price_confidence === 'High' ? '✓' : '~'}
                                  </span>
                                )}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right align-top">
                            <span className="text-slate-600 tabular-nums text-sm">
                              {position.price_confidence === 'None' ? '—' : position.total_amount.toFixed(2)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right align-top">
                            <span className="font-semibold text-slate-900 tabular-nums">
                              {position.price_confidence === 'None' ? '—' : displayTotal.toFixed(2)}
                            </span>
                          </TableCell>
                          <TableCell className="align-top">
                           {editingRow?.id === position.id ? (
                             <Textarea
                               value={editingRow.description}
                               onChange={(e) => setEditingRow({...editingRow, description: e.target.value})}
                               className="min-h-[60px] text-xs"
                               rows={2}
                             />
                           ) : (
                             <div className="text-xs text-slate-600 leading-relaxed max-w-[220px] break-words line-clamp-3">
                               {position.description || '-'}
                             </div>
                           )}
                          </TableCell>
                          <TableCell className="text-center align-top">
                            <Badge
                              variant={
                                position.confidence === 'High' ? 'default' :
                                position.confidence === 'Medium' ? 'secondary' : 'outline'
                              }
                              className="text-xs"
                            >
                              {position.confidence}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center align-top sticky right-0 bg-white border-l border-slate-200">
                           {editingRow?.id === position.id ? (
                             <div className="flex items-center justify-center gap-1">
                               <Button 
                                 size="sm" 
                                 onClick={handleSaveEdit}
                                 className="h-7 px-2 bg-green-600 hover:bg-green-700 text-xs"
                               >
                                 Save
                               </Button>
                               <Button 
                                 size="sm" 
                                 variant="outline" 
                                 onClick={() => setEditingRow(null)}
                                 className="h-7 px-2 text-xs"
                               >
                                 Cancel
                               </Button>
                             </div>
                           ) : (
                             <div className="flex items-center justify-center gap-1">
                               <Button
                                 size="sm"
                                 variant="ghost"
                                 onClick={() => handleEditPosition(position)}
                                 className="h-7 w-7 p-0"
                                 title="Edit"
                               >
                                 <Edit2 className="h-3 w-3" />
                               </Button>
                               <Button
                                 size="sm"
                                 variant="ghost"
                                 onClick={() => handleDeletePosition(position.id)}
                                 className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                 title="Delete"
                               >
                                 <Trash2 className="h-3 w-3" />
                               </Button>
                             </div>
                           )}
                          </TableCell>
                        </TableRow>
                        );
                      })}
                    </TableBody>
                    </Table>
                    </div>
                    </div>

                    {/* Sticky Footer with Action Button */}
                    <div className="sticky bottom-0 bg-white border-t-2 border-slate-300 pt-3 pb-2 mt-4 shadow-lg">
                    <Button
                    onClick={handleCreateFromPreview}
                    className="w-full bg-green-600 hover:bg-green-700"
                    size="lg"
                    >
                    Create {extractedPositions.length} Position{extractedPositions.length !== 1 ? 's' : ''} from Preview
                    </Button>
                    </div>
                    </div>
                    )}
          </div>
        </>
      )}

      {/* Create Confirmation Dialog */}
      <Dialog open={showCreateConfirm} onOpenChange={setShowCreateConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Position Creation</DialogTitle>
            <DialogDescription>
              You are about to create {extractedPositions.length} position(s) in this offer.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {existingTasks && existingTasks.length > 0 && (
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="keep-existing-pdf"
                  checked={keepExisting}
                  onCheckedChange={setKeepExisting}
                />
                <label
                  htmlFor="keep-existing-pdf"
                  className="text-sm font-medium"
                >
                  Keep existing {existingTasks.length} task(s)
                </label>
              </div>
            )}
            
            <div className="space-y-2">
              <Label>Type CONFIRM to proceed</Label>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Type CONFIRM"
                className="font-mono"
              />
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {keepExisting && existingTasks?.length > 0
                  ? `${extractedPositions.length} new positions will be added to the existing ${existingTasks.length}.`
                  : `${extractedPositions.length} position(s) will be created${existingTasks?.length > 0 ? ', replacing existing tasks' : ''}.`
                }
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowCreateConfirm(false);
              setConfirmText('');
            }}>
              Cancel
            </Button>
            <Button 
              onClick={handleConfirmCreate} 
              disabled={confirmText.toUpperCase() !== 'CONFIRM'}
              className="bg-green-600 hover:bg-green-700"
            >
              Create Positions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Existing Task Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bestehende Tasks gefunden</DialogTitle>
            <DialogDescription>
              Es gibt bereits {existingTasks.length} Task(s) in diesem Angebot. 
              Möchten Sie die bestehenden Tasks behalten und die neuen hinzufügen?
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="keep-existing"
                checked={keepExisting}
                onCheckedChange={setKeepExisting}
              />
              <label
                htmlFor="keep-existing"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Bestehende Tasks behalten ({existingTasks.length} Task(s))
              </label>
            </div>
            
            <div className="text-sm text-slate-600">
              {keepExisting ? (
                <p>✓ Die {pendingTasks.length} neuen Task(s) werden zu den bestehenden hinzugefügt.</p>
              ) : (
                <p className="text-amber-600">⚠ Die bestehenden Tasks werden durch {pendingTasks.length} neue ersetzt.</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleConfirmApply} className="bg-blue-600 hover:bg-blue-700">
              Anwenden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}