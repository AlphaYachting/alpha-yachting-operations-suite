import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Paperclip, Send, Loader2, FileText, Bot, User, Mic, Square } from 'lucide-react';

export default function RepairOrderChat({ data, onExtracted }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hallo! Lade Dokumente hoch (Bootsschein/Zulassung, Ausweis, bestehende Angebote) oder beschreibe den Auftrag bzw. die gewünschte Einlagerung. Ich lese die Daten aus und fülle das Formular.' }
  ]);
  const [input, setInput] = useState('');
  const [pendingFiles, setPendingFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const fileRef = useRef(null);
  const scrollRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const file = new File([blob], 'aufnahme.webm', { type: blob.type });
        setTranscribing(true);
        try {
          const { file_url } = await base44.integrations.Core.UploadFile({ file });
          const transcript = await base44.integrations.Core.TranscribeAudio({ audio_url: file_url });
          const text = typeof transcript === 'string' ? transcript : (transcript?.text || '');
          setInput((prev) => (prev ? prev + ' ' : '') + text.trim());
        } catch (err) {
          setMessages((m) => [...m, { role: 'assistant', content: 'Fehler bei der Spracherkennung: ' + err.message }]);
        }
        setTranscribing(false);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch (err) {
      setMessages((m) => [...m, { role: 'assistant', content: 'Mikrofon-Zugriff nicht möglich: ' + err.message }]);
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setLoading(true);
    try {
      const uploaded = [];
      for (const file of files) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        uploaded.push({ name: file.name, url: file_url });
      }
      setPendingFiles((prev) => [...prev, ...uploaded]);
    } catch (err) {
      setMessages((m) => [...m, { role: 'assistant', content: 'Fehler beim Hochladen: ' + err.message }]);
    }
    setLoading(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const send = async () => {
    if (!input.trim() && pendingFiles.length === 0) return;
    const userContent = input.trim() || (pendingFiles.length > 0 ? `${pendingFiles.length} Dokument(e) hochgeladen` : '');
    const fileUrls = pendingFiles.map((f) => f.url);
    const historyForApi = messages.map((m) => ({ role: m.role, content: m.content }));

    setMessages((m) => [...m, { role: 'user', content: userContent, files: pendingFiles }]);
    setInput('');
    setPendingFiles([]);
    setLoading(true);

    try {
      const res = await base44.functions.invoke('extractRepairOrderData', {
        file_urls: fileUrls,
        current_data: data,
        user_message: input.trim(),
        chat_history: historyForApi
      });
      const payload = res.data;
      if (payload?.error) throw new Error(payload.error);

      const extracted = payload.extracted || {};
      // Merge: only overwrite fields where AI returned a non-empty value
      const merged = { ...data };
      Object.entries(extracted).forEach(([k, v]) => {
        if (v === null || v === undefined || v === '') return;
        if (typeof v === 'number' && v === 0) return;
        if (Array.isArray(v) && v.length === 0) return;
        if (k === 'work_description_append') return;
        merged[k] = v;
      });

      // Append new work items as structured list lines (never overwrite existing ones)
      const appendLines = (existing, addition) => {
        const existingLines = (existing || '').split('\n').map((l) => l.trim()).filter(Boolean);
        const newLines = (addition || '').split('\n').map((l) => l.trim()).filter(Boolean)
          .map((l) => (l.startsWith('-') || l.startsWith('•') ? l : `- ${l}`))
          .filter((l) => !existingLines.includes(l));
        return [...existingLines, ...newLines].join('\n');
      };

      if (extracted.storage_services_notes) {
        merged.storage_services_notes = appendLines(data.storage_services_notes, extracted.storage_services_notes);
      }
      if (extracted.work_description_append) {
        merged.work_description = appendLines(data.work_description, extracted.work_description_append);
      }
      if (Array.isArray(extracted.storage_services)) {
        merged.storage_services = Array.from(new Set([...(data.storage_services || []), ...extracted.storage_services]));
      }
      // Merge new document URLs
      merged.extracted_documents = [...(data.extracted_documents || []), ...fileUrls];
      onExtracted(merged);

      setMessages((m) => [...m, { role: 'assistant', content: payload.assistant_message || 'Daten wurden übernommen.' }]);
    } catch (err) {
      setMessages((m) => [...m, { role: 'assistant', content: 'Fehler: ' + err.message }]);
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col h-[600px] border rounded-lg bg-white">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0"><Bot className="h-4 w-4 text-blue-600" /></div>}
            <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-800'}`}>
              <p className="whitespace-pre-wrap">{msg.content}</p>
              {msg.files?.length > 0 && (
                <div className="mt-2 space-y-1">
                  {msg.files.map((f, fi) => (
                    <div key={fi} className="flex items-center gap-1 text-xs opacity-80"><FileText className="h-3 w-3" />{f.name}</div>
                  ))}
                </div>
              )}
            </div>
            {msg.role === 'user' && <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0"><User className="h-4 w-4 text-white" /></div>}
          </div>
        ))}
        {loading && (
          <div className="flex gap-2 justify-start">
            <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center"><Bot className="h-4 w-4 text-blue-600" /></div>
            <div className="bg-slate-100 rounded-lg px-3 py-2 flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Lese Dokumente…</div>
          </div>
        )}
      </div>

      {pendingFiles.length > 0 && (
        <div className="px-4 py-2 border-t flex flex-wrap gap-2">
          {pendingFiles.map((f, i) => (
            <span key={i} className="inline-flex items-center gap-1 bg-slate-100 rounded px-2 py-1 text-xs"><FileText className="h-3 w-3" />{f.name}</span>
          ))}
        </div>
      )}

      <div className="p-3 border-t flex items-end gap-2">
        <input ref={fileRef} type="file" multiple accept="image/*,.pdf" className="hidden" onChange={handleFiles} />
        <Button variant="outline" size="icon" className="flex-shrink-0" onClick={() => fileRef.current?.click()} disabled={loading || recording || transcribing}><Paperclip className="h-4 w-4" /></Button>
        <Button
          variant={recording ? 'destructive' : 'outline'}
          size="icon"
          className="flex-shrink-0"
          onClick={recording ? stopRecording : startRecording}
          disabled={loading || transcribing}
          title={recording ? 'Aufnahme stoppen' : 'Spracheingabe'}
        >
          {transcribing ? <Loader2 className="h-4 w-4 animate-spin" /> : recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </Button>
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !loading) {
              e.preventDefault();
              send();
            }
          }}
          rows={2}
          placeholder={recording ? 'Aufnahme läuft…' : transcribing ? 'Transkribiere…' : 'Nachricht schreiben… (Enter zum Senden, Shift+Enter für neue Zeile)'}
          disabled={loading}
          className="flex-1 min-h-[44px] max-h-40 resize-none text-sm"
        />
        <Button className="flex-shrink-0" onClick={send} disabled={loading}><Send className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}