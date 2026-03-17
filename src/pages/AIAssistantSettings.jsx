import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, RefreshCw, Bot, Info, Plus, Trash2, AlertCircle, CheckCircle2 } from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';

const LANGUAGES = ['German', 'English', 'Italian', 'Slovenian', 'Croatian'];

const DEFAULT_PROMPT = `Du bist ein erfahrener Meerestechnik-Spezialist und Angebotsersteller für eine professionelle Bootsservicefirma (Alpha Yachting).

Deine Aufgabe ist es, durch ein strukturiertes Gespräch alle notwendigen Informationen zu sammeln, um ein vollständiges, professionelles Serviceangebot zu erstellen.

## DEINE ROLLE
- Analysiere Kundenbeschreibungen, Gesprächsnotizen oder Transkripte von Serviceanfragen.
- Stelle gezielte Rückfragen, wenn wichtige Informationen fehlen.
- Generiere am Ende strukturierte Angebotstasks (Labor + Material getrennt).

## FEHLENDE INFORMATIONEN PRÜFEN
Bevor du Tasks generierst, stelle sicher, dass du folgendes weißt:
1. Bootstyp, Hersteller, Modell und Länge (falls relevant)
2. Motorentyp und -modell (für Motorarbeiten)
3. Art und Umfang der gewünschten Arbeit
4. Besondere Kundenwünsche oder Einschränkungen

## TASK-GENERIERUNG REGELN (WICHTIG)
Wenn du genug Informationen hast (response_type = "tasks_ready"):
- Trenne IMMER Material von Arbeitsleistung in separate Tasks
- Material-Tasks: Nur Produktname als Titel (keine Verben)
- Labor-Tasks: Aktionsbeschreibung als Titel (mit Verb)
- Verwende realistische Stundenansätze für Bootsservice

## ANTWORTFORMAT
Antworte IMMER im angegebenen JSON-Format. Stelle maximal 2 Rückfragen auf einmal.`;

export default function AIAssistantSettings() {
  const [user, setUser] = useState(null);
  const [selectedLanguage, setSelectedLanguage] = useState('German');
  const [promptText, setPromptText] = useState('');
  const [configId, setConfigId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState(null);

  // Knowledge base (OfferTemplateComponent)
  const [components, setComponents] = useState([]);
  const [loadingComponents, setLoadingComponents] = useState(false);
  const [newComponent, setNewComponent] = useState({
    name: '', description: '', category: 'General Service', item_type: 'Labor',
    unit_type: 'Hour', quantity: 1, base_price_eur: null, tags: []
  });
  const [addingComponent, setAddingComponent] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        const userData = await base44.auth.me();
        setUser(userData);
        if (userData?.role !== 'admin') {
          setError('Diese Seite ist nur für Administratoren zugänglich.');
          setLoading(false);
          return;
        }
        await Promise.all([loadPrompt('German'), loadComponents()]);
      } catch (e) {
        setError('Fehler beim Laden der Einstellungen.');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const loadPrompt = async (language) => {
    setLoading(true);
    try {
      const key = `OfferAIAssistantPrompt_${language}`;
      const configs = await base44.entities.AppConfiguration.filter({ key });
      if (configs && configs.length > 0) {
        setPromptText(configs[0].value);
        setConfigId(configs[0].id);
      } else {
        setPromptText(language === 'German' ? DEFAULT_PROMPT : '');
        setConfigId(null);
      }
    } catch (e) {
      setPromptText(language === 'German' ? DEFAULT_PROMPT : '');
      setConfigId(null);
    } finally {
      setLoading(false);
    }
  };

  const loadComponents = async () => {
    setLoadingComponents(true);
    try {
      const items = await base44.entities.OfferTemplateComponent.list('-usage_count', 50);
      setComponents(items || []);
    } catch (e) {
      console.error('Could not load components', e);
    } finally {
      setLoadingComponents(false);
    }
  };

  const handleLanguageChange = async (lang) => {
    setSelectedLanguage(lang);
    await loadPrompt(lang);
  };

  const handleSavePrompt = async () => {
    setSaving(true);
    setError(null);
    setSaveSuccess(false);
    try {
      const key = `OfferAIAssistantPrompt_${selectedLanguage}`;
      if (configId) {
        await base44.entities.AppConfiguration.update(configId, {
          value: promptText,
          last_updated_by: user?.email
        });
      } else {
        const created = await base44.entities.AppConfiguration.create({
          key,
          value: promptText,
          description: `KI-Assistent System-Prompt für Angebotsassistenten (${selectedLanguage})`,
          type: 'prompt',
          last_updated_by: user?.email
        });
        setConfigId(created.id);
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e) {
      setError('Fehler beim Speichern: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleResetPrompt = () => {
    if (selectedLanguage === 'German') {
      setPromptText(DEFAULT_PROMPT);
    } else {
      setPromptText('');
    }
  };

  const handleAddComponent = async () => {
    if (!newComponent.name.trim()) return;
    setAddingComponent(true);
    try {
      const created = await base44.entities.OfferTemplateComponent.create({
        ...newComponent,
        tags: newComponent.tags.length > 0 ? newComponent.tags : undefined,
        is_active: true,
        usage_count: 0
      });
      setComponents(prev => [created, ...prev]);
      setNewComponent({
        name: '', description: '', category: 'General Service', item_type: 'Labor',
        unit_type: 'Hour', quantity: 1, base_price_eur: null, tags: []
      });
      setShowAddForm(false);
    } catch (e) {
      setError('Fehler beim Erstellen: ' + e.message);
    } finally {
      setAddingComponent(false);
    }
  };

  const handleDeleteComponent = async (id) => {
    try {
      await base44.entities.OfferTemplateComponent.delete(id);
      setComponents(prev => prev.filter(c => c.id !== id));
    } catch (e) {
      setError('Fehler beim Löschen: ' + e.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (user?.role !== 'admin') {
    return (
      <Alert variant="destructive" className="max-w-lg mx-auto mt-10">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Diese Seite ist nur für Administratoren zugänglich.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Bot className="h-6 w-6 text-purple-600" />
          KI-Angebots-Assistent Einstellungen
        </h1>
        <p className="text-slate-500 mt-1">
          System-Prompt und Wissensdatenbank für den konversationsbasierten Angebots-Assistenten
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Prompt Editor */}
      <Card>
        <CardHeader>
          <CardTitle>System-Prompt Konfiguration</CardTitle>
          <CardDescription>
            Definieren Sie, wie der KI-Assistent Serviceanfragen analysiert und Angebote erstellt.
            Dieser Prompt wird bei jedem Gespräch als Basis verwendet.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Label>Sprache:</Label>
            <Select value={selectedLanguage} onValueChange={handleLanguageChange}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map(lang => (
                  <SelectItem key={lang} value={lang}>{lang}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {configId && <Badge variant="outline" className="text-xs text-green-700 border-green-300">Gespeichert</Badge>}
            {!configId && <Badge variant="outline" className="text-xs text-amber-700 border-amber-300">Standard (nicht überschrieben)</Badge>}
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-slate-400" />
              <span className="text-xs text-slate-500">
                Bearbeiten Sie den Prompt. Änderungen werden sofort beim nächsten Gespräch aktiv.
              </span>
            </div>
            <Textarea
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              rows={18}
              className={`font-mono text-xs leading-relaxed ${promptText.length > 4000 ? 'border-red-400 focus:border-red-400' : ''}`}
              placeholder="System-Prompt für den KI-Assistenten..."
            />
            <div className={`flex items-center justify-between text-xs mt-1 ${promptText.length > 4000 ? 'text-red-600 font-medium' : 'text-slate-400'}`}>
              <span>{promptText.length} / 4000 Zeichen empfohlen</span>
              {promptText.length > 4000 && (
                <span className="flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Prompt zu lang! KI wird bei 4000 Zeichen abgeschnitten → schlechtere Ergebnisse
                </span>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleSavePrompt}
              disabled={saving || !promptText.trim()}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {saving ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Speichern...</>
              ) : saveSuccess ? (
                <><CheckCircle2 className="h-4 w-4 mr-2" />Gespeichert!</>
              ) : (
                <><Save className="h-4 w-4 mr-2" />Prompt speichern</>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={handleResetPrompt}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Standard wiederherstellen
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Knowledge Base */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Wissensdatenbank – Serviceleistungen</CardTitle>
              <CardDescription>
                Bewährte Serviceleistungen aus Ihren Angeboten. Der KI-Assistent nutzt diese als Preis- und Beschreibungsreferenz.
              </CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => setShowAddForm(!showAddForm)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-1" />
              Hinzufügen
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add Form */}
          {showAddForm && (
            <div className="border border-blue-200 bg-blue-50 rounded-lg p-4 space-y-3">
              <h4 className="font-medium text-blue-900 text-sm">Neue Serviceleistung</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Name *</Label>
                  <Input
                    value={newComponent.name}
                    onChange={e => setNewComponent(p => ({ ...p, name: e.target.value }))}
                    placeholder="z.B. Antifouling 10m Boot"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Typ</Label>
                  <Select value={newComponent.item_type} onValueChange={v => setNewComponent(p => ({ ...p, item_type: v }))}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Labor">Labor (Arbeit)</SelectItem>
                      <SelectItem value="Material">Material (Produkt)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Kategorie</Label>
                  <Select value={newComponent.category} onValueChange={v => setNewComponent(p => ({ ...p, category: v }))}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {['Mechanical', 'Electrical', 'Hull / GRP', 'Rigging', 'Plumbing', 'HVAC', 'Electronics', 'General Service', 'Safety', 'Other'].map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Einheitspreis (€)</Label>
                  <Input
                    type="number"
                    value={newComponent.base_price_eur || ''}
                    onChange={e => setNewComponent(p => ({ ...p, base_price_eur: parseFloat(e.target.value) || null }))}
                    placeholder="z.B. 70"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label className="text-xs">Beschreibung</Label>
                  <Textarea
                    value={newComponent.description}
                    onChange={e => setNewComponent(p => ({ ...p, description: e.target.value }))}
                    placeholder="Kurze Beschreibung der Leistung..."
                    rows={2}
                    className="text-sm"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAddComponent} disabled={addingComponent || !newComponent.name.trim()} className="bg-blue-600 hover:bg-blue-700">
                  {addingComponent ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3 mr-1" />}
                  Speichern
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowAddForm(false)}>Abbrechen</Button>
              </div>
            </div>
          )}

          {/* Component List */}
          {loadingComponents ? (
            <div className="flex items-center justify-center h-16">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            </div>
          ) : components.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">
              Noch keine Serviceleistungen gespeichert. Fügen Sie manuell hinzu oder speichern Sie Tasks aus bestehenden Angeboten.
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {components.map(comp => (
                <div key={comp.id} className="flex items-start justify-between p-3 border border-slate-100 rounded-lg bg-white hover:bg-slate-50">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-slate-900">{comp.name}</span>
                      <Badge variant="outline" className={`text-xs ${comp.item_type === 'Labor' ? 'text-blue-700 border-blue-200' : 'text-orange-700 border-orange-200'}`}>
                        {comp.item_type}
                      </Badge>
                      <Badge variant="outline" className="text-xs text-slate-500">{comp.category}</Badge>
                    </div>
                    {comp.description && (
                      <p className="text-xs text-slate-500 mt-0.5 truncate">{comp.description}</p>
                    )}
                    <div className="flex gap-3 mt-1 text-xs text-slate-400">
                      {comp.base_price_eur && <span>€{comp.base_price_eur}/{comp.unit_type || 'Std.'}</span>}
                      {comp.usage_count > 0 && <span>{comp.usage_count}× verwendet</span>}
                    </div>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleDeleteComponent(comp.id)}
                    className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50 flex-shrink-0 ml-2"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}