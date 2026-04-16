import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Loader2, Send, Mic, MicOff, Sparkles, CheckCircle2,
  AlertCircle, RotateCcw, Bot, User, Bug, ChevronDown, ChevronUp,
  Paperclip, X, FileText, Image
} from 'lucide-react';

const VALID_UNIT_TYPES = ['Hour', 'Piece', 'Square Meter', 'Linear Meter', 'Liter', 'Kilogram', 'Set', 'Lump Sum', 'km', 'day', 'month', 'season', 'flat'];

export default function AIAssistantChat({ formData, customers, boats, onTasksGenerated, onDescriptionGenerated, existingTasks = [] }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [generatedTasks, setGeneratedTasks] = useState(null);
  const [generatedDescription, setGeneratedDescription] = useState('');
  const [speechSupported, setSpeechSupported] = useState(false);
  const [lastDebug, setLastDebug] = useState(null);
  const [showDebug, setShowDebug] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState([]); // [{name, url, type}]
  const [uploading, setUploading] = useState(false);

  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
      setSpeechSupported(true);
    }
    setMessages([{
      role: 'assistant',
      content: 'Hallo! Ich bin Ihr KI-Angebots-Assistent. Bitte beschreiben Sie die gewünschten Serviceleistungen oder fügen Sie ein Gesprächsprotokoll/Transkript ein. Sie können auch Dateien (Fotos, Dokumente) anhängen. Ich werde gezielte Rückfragen stellen, falls Informationen fehlen.',
      type: 'intro'
    }]);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const getOfferDetails = () => {
    const customer = customers?.find(c => c.id === formData?.customer_id);
    const boat = boats?.find(b => b.id === formData?.boat_id);
    return {
      customer_name: customer
        ? (customer.company_name || `${customer.first_name || ''} ${customer.last_name || ''}`.trim())
        : '',
      boat_name: boat?.vessel_name || '',
      boat_details: boat
        ? `${boat.manufacturer || ''} ${boat.model || ''} ${boat.year ? `(${boat.year})` : ''}, ${boat.length_m ? `${boat.length_m}m` : ''}, Motor: ${boat.engine_manufacturer || ''} ${boat.engine_model || ''}`.trim()
        : ''
    };
  };

  const handleFileAttach = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    setError(null);
    try {
      const uploaded = await Promise.all(files.map(async (file) => {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        return { name: file.name, url: file_url, type: file.type };
      }));
      setAttachedFiles(prev => [...prev, ...uploaded]);
    } catch (err) {
      setError('Datei-Upload fehlgeschlagen: ' + err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeFile = (idx) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const sendMessage = async (textOverride) => {
    const text = (textOverride || inputText).trim();
    if (!text && attachedFiles.length === 0) return;

    const fileUrls = attachedFiles.map(f => f.url);
    const fileNames = attachedFiles.map(f => f.name).join(', ');
    const displayContent = text + (fileNames ? `\n📎 ${fileNames}` : '');

    const userMessage = { role: 'user', content: displayContent };
    const newMessages = [...messages.filter(m => m.type !== 'intro'), userMessage];
    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setAttachedFiles([]);
    setIsLoading(true);
    setError(null);
    setGeneratedTasks(null);

    try {
      const history = newMessages.slice(0, -1).map(m => ({
        role: m.role,
        content: m.content
      }));

      const result = await base44.functions.invoke('processOfferAssistantInteraction', {
        user_input: text || '(Datei angehängt)',
        file_urls: fileUrls.length > 0 ? fileUrls : undefined,
        conversation_history: history,
        offer_details: getOfferDetails(),
        language: formData?.language || 'German'
      });

      const data = result.data;

      if (data._debug) setLastDebug(data._debug);

      if (!data.message) {
        throw new Error('Keine Antwort vom KI-Assistenten erhalten.');
      }

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.message,
        type: data.response_type
      }]);

      if (data.response_type === 'tasks_ready' && data.tasks?.length > 0) {
        setGeneratedTasks(data.tasks);
        setGeneratedDescription(data.client_description || '');
      }
    } catch (err) {
      console.error('AI Assistant error:', err);
      setError(err.message || 'Fehler beim Verarbeiten der Anfrage. Bitte versuchen Sie es erneut.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      sendMessage();
    }
  };

  const getSpeechLang = () => {
    const map = { German: 'de-DE', Italian: 'it-IT', Croatian: 'hr-HR', Slovenian: 'sl-SI' };
    return map[formData?.language] || 'en-US';
  };

  const toggleVoice = () => {
    if (!speechSupported) return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      setInterimText('');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = getSpeechLang();
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => { setIsListening(false); setInterimText(''); };

    recognition.onresult = (event) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      if (final) {
        setInputText(prev => prev + (prev ? ' ' : '') + final.trim());
        setInterimText('');
      } else {
        setInterimText(interim);
      }
    };

    recognition.onerror = () => {
      setIsListening(false);
      setInterimText('');
      setError('Sprachaufnahme fehlgeschlagen. Bitte erneut versuchen.');
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const applyTasks = () => {
    if (!generatedTasks) return;

    const tasksWithPrices = generatedTasks.map(task => {
      if (task.item_type === 'Chapter') {
        return { title: task.title, item_type: 'Chapter', quantity: 0, unit_price: 0, total_amount: 0 };
      }
      // Normalize unit_type to a valid enum value
      const rawUnit = task.unit_type || '';
      const validUnit = VALID_UNIT_TYPES.find(u => u.toLowerCase() === rawUnit.toLowerCase()) 
        || (task.item_type === 'Labor' ? 'Hour' : 'Piece');
      return {
        ...task,
        unit_type: validUnit,
        // No fallback price — leave as 0 if KI didn't provide one, user sets it manually
        unit_price: task.unit_price || 0,
        total_amount: (task.quantity || 1) * (task.unit_price || 0)
      };
    });

    onTasksGenerated(existingTasks?.length > 0
      ? [...existingTasks, ...tasksWithPrices]
      : tasksWithPrices);

    if (generatedDescription && onDescriptionGenerated) {
      onDescriptionGenerated(generatedDescription);
    }

    setGeneratedTasks(null);
    resetConversation();
  };

  const resetConversation = () => {
    setMessages([{
      role: 'assistant',
      content: 'Gespräch zurückgesetzt. Beschreiben Sie die gewünschten Leistungen.',
      type: 'intro'
    }]);
    setGeneratedTasks(null);
    setGeneratedDescription('');
    setError(null);
    setAttachedFiles([]);
  };

  return (
    <div className="flex flex-col h-full space-y-3">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {lastDebug?.prompt_source?.includes('truncated') && (
        <Alert className="border-amber-300 bg-amber-50">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 text-xs">
            <strong>Warnung:</strong> Ihr System-Prompt ist zu lang ({lastDebug.prompt_source.match(/\d+/)?.[0]} Zeichen) und wurde gekürzt.{' '}
            <a href="/AIAssistantSettings" className="underline font-medium">→ Prompt kürzen</a>
          </AlertDescription>
        </Alert>
      )}

      {lastDebug && (
        <div className="border border-slate-200 rounded-lg bg-slate-50 text-xs">
          <button
            onClick={() => setShowDebug(v => !v)}
            className="w-full flex items-center justify-between px-3 py-2 text-slate-500 hover:text-slate-700"
          >
            <span className="flex items-center gap-1.5">
              <Bug className="h-3 w-3" />
              Debug: {lastDebug.llm_ms}ms LLM / {lastDebug.total_ms}ms gesamt
              {lastDebug.prompt_source?.includes('truncated') && <span className="text-amber-600 font-medium">⚠ gekürzt</span>}
            </span>
            {showDebug ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
          {showDebug && (
            <div className="px-3 pb-3 space-y-1 font-mono text-slate-600 border-t border-slate-200 pt-2">
              <div>Quelle: <span className="text-slate-800">{lastDebug.prompt_source}</span></div>
              <div>Länge: <span className={lastDebug.prompt_length > 3000 ? 'text-red-600 font-bold' : 'text-slate-800'}>{lastDebug.prompt_length} Zeichen</span></div>
              <div>Verlauf: <span className="text-slate-800">{lastDebug.history_used} Nachrichten</span></div>
              <div>LLM: <span className="text-slate-800">{lastDebug.llm_ms}ms</span></div>
            </div>
          )}
        </div>
      )}

      {/* Chat Messages */}
      <div className="flex-1 border border-slate-200 rounded-lg bg-slate-50 p-3 overflow-y-auto min-h-[300px] max-h-[400px] space-y-3">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Bot className="h-4 w-4 text-purple-600" />
              </div>
            )}
            <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
              msg.role === 'user'
                ? 'bg-slate-800 text-white rounded-br-sm'
                : msg.type === 'tasks_ready'
                  ? 'bg-green-50 border border-green-200 text-green-900 rounded-bl-sm'
                  : 'bg-white border border-slate-200 text-slate-800 rounded-bl-sm'
            }`}>
              {msg.type === 'tasks_ready' && (
                <div className="flex items-center gap-1 mb-1 font-medium text-green-700">
                  <CheckCircle2 className="h-4 w-4" />
                  Angebot bereit
                </div>
              )}
              {msg.content}
            </div>
            {msg.role === 'user' && (
              <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                <User className="h-4 w-4 text-slate-600" />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-2 justify-start">
            <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
              <Bot className="h-4 w-4 text-purple-600" />
            </div>
            <div className="bg-white border border-slate-200 rounded-xl rounded-bl-sm px-3 py-2">
              <Loader2 className="h-4 w-4 animate-spin text-purple-500" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Generated Tasks Preview */}
      {generatedTasks && (
        <div className="border border-green-200 rounded-lg bg-green-50 p-3 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-green-800">
            <Sparkles className="h-4 w-4" />
            {generatedTasks.length} Tasks generiert
          </div>
          <div className="space-y-1 max-h-36 overflow-y-auto">
            {generatedTasks.map((task, i) => (
              <div key={i} className="flex items-start justify-between text-xs bg-white rounded p-2 border border-green-100">
                <div>
                  <span className="font-medium text-slate-800">{task.title}</span>
                  {task.description && <p className="text-slate-500 mt-0.5 line-clamp-1">{task.description}</p>}
                </div>
                <div className="text-right ml-3 flex-shrink-0">
                  <span className="text-slate-600">{task.quantity} {task.unit_type || (task.item_type === 'Labor' ? 'Std.' : 'Stk.')}</span>
                  {task.unit_price > 0 && (
                    <div className="text-green-700 font-medium">€{task.unit_price}/Einheit</div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <Button onClick={applyTasks} className="w-full bg-green-600 hover:bg-green-700" size="sm">
            <CheckCircle2 className="h-4 w-4 mr-2" />
            {generatedTasks.length} Tasks in Angebot übernehmen
          </Button>
        </div>
      )}

      {/* Attached Files Preview */}
      {attachedFiles.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attachedFiles.map((f, i) => (
            <div key={i} className="flex items-center gap-1 bg-blue-50 border border-blue-200 rounded-lg px-2 py-1 text-xs text-blue-800">
              {f.type?.startsWith('image/') ? <Image className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
              <span className="max-w-[140px] truncate">{f.name}</span>
              <button onClick={() => removeFile(i)} className="ml-1 hover:text-red-600">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input Area */}
      <div className="space-y-2">
        <div className="relative">
          <Textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isListening ? '🎙 Sprachaufnahme läuft...' : 'Servicebeschreibung, Gesprächsnotizen oder Transkript eingeben... (Strg+Enter zum Senden)'}
            rows={3}
            disabled={isLoading}
            className="pr-20 resize-none"
          />
          <div className="absolute right-2 bottom-2 flex gap-1">
            {/* File Upload Button */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading || uploading}
              className="h-8 w-8 text-slate-400 hover:text-blue-600"
              title="Datei anhängen"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
            </Button>
            {/* Voice Button */}
            {speechSupported && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={toggleVoice}
                className={`h-8 w-8 ${isListening ? 'text-red-500 bg-red-50' : 'text-slate-400'}`}
                title={isListening ? 'Aufnahme stoppen' : 'Spracheingabe starten'}
              >
                {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
            )}
          </div>
        </div>

        {/* Interim voice transcript */}
        {isListening && interimText && (
          <div className="text-xs text-slate-500 italic px-2">
            {interimText}
          </div>
        )}

        {isListening && !interimText && (
          <div className="flex items-center gap-2 text-xs text-red-600 animate-pulse">
            <div className="w-2 h-2 bg-red-500 rounded-full" />
            Sprachaufnahme aktiv... Sprechen Sie jetzt.
          </div>
        )}

        <div className="flex gap-2">
          <Button
            onClick={() => sendMessage()}
            disabled={isLoading || (!inputText.trim() && attachedFiles.length === 0)}
            className="flex-1 bg-purple-600 hover:bg-purple-700"
          >
            {isLoading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Verarbeite...</>
            ) : (
              <><Send className="h-4 w-4 mr-2" />Senden</>
            )}
          </Button>
          <Button variant="outline" size="icon" onClick={resetConversation} title="Gespräch zurücksetzen">
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-slate-400 text-center">Strg+Enter zum Senden • 📎 Dateien/Fotos anhängbar</p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,application/pdf,.xlsx,.xls,.csv,.doc,.docx"
        onChange={handleFileAttach}
        className="hidden"
      />
    </div>
  );
}