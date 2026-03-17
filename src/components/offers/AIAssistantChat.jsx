import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Loader2, Send, Mic, MicOff, Sparkles, CheckCircle2,
  AlertCircle, RotateCcw, Bot, User
} from 'lucide-react';

export default function AIAssistantChat({ formData, customers, boats, onTasksGenerated, onDescriptionGenerated, existingTasks = [] }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [generatedTasks, setGeneratedTasks] = useState(null);
  const [generatedDescription, setGeneratedDescription] = useState('');
  const [speechSupported, setSpeechSupported] = useState(false);

  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    // Check Web Speech API support
    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
      setSpeechSupported(true);
    }

    // Welcome message
    setMessages([{
      role: 'assistant',
      content: 'Hallo! Ich bin Ihr KI-Angebots-Assistent. Bitte beschreiben Sie die gewünschten Serviceleistungen oder fügen Sie ein Gesprächsprotokoll/Transkript ein. Ich werde gezielte Rückfragen stellen, falls Informationen fehlen.',
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

  const sendMessage = async (textOverride) => {
    const text = (textOverride || inputText).trim();
    if (!text) return;

    const userMessage = { role: 'user', content: text };
    const newMessages = [...messages.filter(m => m.type !== 'intro'), userMessage];
    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);
    setError(null);
    setGeneratedTasks(null);

    try {
      // Build history for context (exclude intro)
      const history = newMessages.slice(0, -1).map(m => ({
        role: m.role,
        content: m.content
      }));

      const result = await base44.functions.invoke('processOfferAssistantInteraction', {
        user_input: text,
        conversation_history: history,
        offer_details: getOfferDetails(),
        language: formData?.language || 'German'
      });

      const data = result.data;

      if (!data.message) {
        throw new Error('Keine Antwort vom KI-Assistenten erhalten.');
      }

      const assistantMessage = {
        role: 'assistant',
        content: data.message,
        type: data.response_type
      };

      setMessages(prev => [...prev, assistantMessage]);

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

  const toggleVoice = () => {
    if (!speechSupported) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = formData?.language === 'German' ? 'de-DE'
      : formData?.language === 'Italian' ? 'it-IT'
      : formData?.language === 'Croatian' ? 'hr-HR'
      : formData?.language === 'Slovenian' ? 'sl-SI'
      : 'en-US';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);

    recognition.onresult = (event) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setInputText(prev => prev + (prev ? ' ' : '') + transcript);
    };

    recognition.onerror = () => {
      setIsListening(false);
      setError('Sprachaufnahme fehlgeschlagen. Bitte erneut versuchen.');
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const applyTasks = () => {
    if (!generatedTasks) return;

    const tasksWithPrices = generatedTasks.map(task => ({
      ...task,
      unit_type: task.unit_type || (task.item_type === 'Labor' ? 'Hour' : 'Piece'),
      unit_price: task.unit_price || 70,
      total_amount: (task.quantity || 1) * (task.unit_price || 70)
    }));

    const finalTasks = existingTasks?.length > 0
      ? [...existingTasks, ...tasksWithPrices]
      : tasksWithPrices;

    onTasksGenerated(finalTasks);

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
  };

  return (
    <div className="flex flex-col h-full space-y-3">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
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
            <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-green-800">
              <Sparkles className="h-4 w-4" />
              {generatedTasks.length} Tasks generiert
            </div>
            <div className="flex gap-2">
              {generatedTasks.map((t, i) => (
                <Badge key={i} variant="outline" className="text-xs bg-white">
                  {t.item_type}
                </Badge>
              ))}
            </div>
          </div>
          <div className="space-y-1 max-h-36 overflow-y-auto">
            {generatedTasks.map((task, i) => (
              <div key={i} className="flex items-start justify-between text-xs bg-white rounded p-2 border border-green-100">
                <div>
                  <span className="font-medium text-slate-800">{task.title}</span>
                  {task.description && (
                    <p className="text-slate-500 mt-0.5 line-clamp-1">{task.description}</p>
                  )}
                </div>
                <div className="text-right ml-3 flex-shrink-0">
                  <span className="text-slate-600">{task.quantity} {task.unit_type || (task.item_type === 'Labor' ? 'Std.' : 'Stk.')}</span>
                  {task.unit_price && (
                    <div className="text-green-700 font-medium">€{task.unit_price}/Einheit</div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <Button
            onClick={applyTasks}
            className="w-full bg-green-600 hover:bg-green-700"
            size="sm"
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            {generatedTasks.length} Tasks in Angebot übernehmen
          </Button>
        </div>
      )}

      {/* Input Area */}
      <div className="space-y-2">
        <div className="relative">
          <Textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Servicebeschreibung, Gesprächsnotizen oder Transkript eingeben... (Strg+Enter zum Senden)"
            rows={3}
            disabled={isLoading}
            className="pr-12 resize-none"
          />
          {speechSupported && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={toggleVoice}
              className={`absolute right-2 bottom-2 h-8 w-8 ${isListening ? 'text-red-500 bg-red-50' : 'text-slate-400'}`}
              title={isListening ? 'Aufnahme stoppen' : 'Spracheingabe starten'}
            >
              {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
          )}
        </div>

        {isListening && (
          <div className="flex items-center gap-2 text-xs text-red-600 animate-pulse">
            <div className="w-2 h-2 bg-red-500 rounded-full" />
            Sprachaufnahme aktiv... Sprechen Sie jetzt.
          </div>
        )}

        <div className="flex gap-2">
          <Button
            onClick={() => sendMessage()}
            disabled={isLoading || !inputText.trim()}
            className="flex-1 bg-purple-600 hover:bg-purple-700"
          >
            {isLoading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Verarbeite...</>
            ) : (
              <><Send className="h-4 w-4 mr-2" />Senden</>
            )}
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={resetConversation}
            title="Gespräch zurücksetzen"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-slate-400 text-center">Strg+Enter zum Senden • Gespräch läuft iterativ bis alle Infos vorhanden sind</p>
      </div>
    </div>
  );
}