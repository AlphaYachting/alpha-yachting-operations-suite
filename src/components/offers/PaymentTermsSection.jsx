import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

const DEFAULT_RETENTION_TEXT_BY_LANG = {
  German: `Eigentumsvorbehalt:\nAlle gelieferten Waren und Leistungen bleiben bis zur vollständigen Bezahlung ausschließliches Eigentum von Alpha Yachting. Der Auftraggeber ist nicht berechtigt, die Waren zu veräußern, zu verpfänden oder anderweitig darüber zu verfügen, solange das Eigentum nicht übertragen wurde.`,
  English: `Retention of Title:\nAll delivered goods and services remain the sole property of Alpha Yachting until full payment has been received. The customer has no right to sell, pledge, or otherwise dispose of the goods until ownership has been transferred.`,
  Italian: `Riserva di proprietà:\nTutte le merci e i servizi consegnati rimangono di esclusiva proprietà di Alpha Yachting fino al pagamento completo. Il cliente non ha il diritto di vendere, impegnare o altrimenti disporre delle merci fino al trasferimento della proprietà.`,
  Slovenian: `Pridržek lastninske pravice:\nVso dobavljeno blago in storitve ostanejo izključna last podjetja Alpha Yachting do popolnega plačila. Naročnik nima pravice prodajati, zastavljati ali kako drugače razpolagati z blagom, dokler ni lastninska pravica prenesena.`,
  Croatian: `Zadržaj prava vlasništva:\nSva isporučena roba i usluge ostaju isključivo vlasništvo tvrtke Alpha Yachting do potpune uplate. Kupac nema pravo prodavati, zalagati ni na drugi način raspolagati robom dok se vlasništvo ne prenese.`,
};

const UI_LABELS = {
  German: {
    cardTitle: 'Zahlungsbedingungen & Rechtliches',
    paymentMethod: 'Zahlungsart',
    fullPayment: 'Vollständige Zahlung',
    downpayment: 'Anzahlung',
    installments: 'Ratenzahlung',
    downpaymentPct: 'Anzahlung %',
    downpaymentAmt: 'Anzahlungsbetrag',
    scheduleLabel: 'Zahlungsplan (Freitext)',
    schedulePlaceholderDown: (pct) => `z. B. ${pct} % Anzahlung, ${100 - pct} % Restzahlung bei Fertigstellung`,
    schedulePlaceholderInst: 'z. B. 33 % bei Auftrag, 33 % bei 50 % Fertigstellung, 34 % bei Ablieferung',
    retentionToggle: 'Eigentumsvorbehalt einschließen',
    retentionLabel: 'Rechtstext (Eigentumsvorbehalt)',
    retentionPlaceholder: 'Rechtstext eingeben...',
  },
  English: {
    cardTitle: 'Payment Terms & Legal',
    paymentMethod: 'Payment Method',
    fullPayment: 'Full Payment',
    downpayment: 'Downpayment',
    installments: 'Installments',
    downpaymentPct: 'Downpayment %',
    downpaymentAmt: 'Downpayment Amount',
    scheduleLabel: 'Payment Schedule Description',
    schedulePlaceholderDown: (pct) => `e.g., ${pct}% downpayment upon order, ${100 - pct}% upon completion`,
    schedulePlaceholderInst: 'e.g., 33% upon order, 33% at 50% completion, 34% upon final delivery',
    retentionToggle: 'Include Retention of Title Clause',
    retentionLabel: 'Legal Text (Retention of Title)',
    retentionPlaceholder: 'Enter legal text...',
  },
  Italian: {
    cardTitle: 'Termini di pagamento e aspetti legali',
    paymentMethod: 'Metodo di pagamento',
    fullPayment: 'Pagamento completo',
    downpayment: 'Acconto',
    installments: 'Rate',
    downpaymentPct: 'Acconto %',
    downpaymentAmt: 'Importo acconto',
    scheduleLabel: 'Descrizione piano di pagamento',
    schedulePlaceholderDown: (pct) => `es. ${pct}% di acconto, ${100 - pct}% al completamento`,
    schedulePlaceholderInst: 'es. 33% all\'ordine, 33% al 50% di completamento, 34% alla consegna',
    retentionToggle: 'Includi riserva di proprietà',
    retentionLabel: 'Testo legale (riserva di proprietà)',
    retentionPlaceholder: 'Inserire il testo legale...',
  },
  Slovenian: {
    cardTitle: 'Plačilni pogoji in pravne določbe',
    paymentMethod: 'Način plačila',
    fullPayment: 'Celotno plačilo',
    downpayment: 'Predplačilo',
    installments: 'Obroki',
    downpaymentPct: 'Predplačilo %',
    downpaymentAmt: 'Znesek predplačila',
    scheduleLabel: 'Opis plačilnega načrta',
    schedulePlaceholderDown: (pct) => `npr. ${pct} % predplačilo, ${100 - pct} % ob dokončanju`,
    schedulePlaceholderInst: 'npr. 33 % ob naročilu, 33 % pri 50 % dokončanosti, 34 % ob dostavi',
    retentionToggle: 'Vključi pridržek lastninske pravice',
    retentionLabel: 'Pravno besedilo (pridržek lastninske pravice)',
    retentionPlaceholder: 'Vnesite pravno besedilo...',
  },
  Croatian: {
    cardTitle: 'Uvjeti plaćanja i pravne odredbe',
    paymentMethod: 'Način plaćanja',
    fullPayment: 'Plaćanje u cijelosti',
    downpayment: 'Predujam',
    installments: 'Rate',
    downpaymentPct: 'Predujam %',
    downpaymentAmt: 'Iznos predujma',
    scheduleLabel: 'Opis plana plaćanja',
    schedulePlaceholderDown: (pct) => `npr. ${pct} % predujam, ${100 - pct} % po završetku`,
    schedulePlaceholderInst: 'npr. 33 % pri narudžbi, 33 % pri 50 % dovršenosti, 34 % pri isporuci',
    retentionToggle: 'Uključi zadržaj prava vlasništva',
    retentionLabel: 'Pravni tekst (zadržaj prava vlasništva)',
    retentionPlaceholder: 'Unesite pravni tekst...',
  },
};

export default function PaymentTermsSection({ formData, updateField, totalAmount, language }) {
  const lang = language || formData.language || 'German';
  const L = UI_LABELS[lang] || UI_LABELS.German;
  const [downpaymentAmount, setDownpaymentAmount] = useState(0);

  // When language changes, reset retention_of_title_text to the new language default
  // ONLY if the current text matches any known default (i.e. was not manually edited)
  const prevLangRef = useRef(lang);
  useEffect(() => {
    if (prevLangRef.current === lang) return;
    prevLangRef.current = lang;
    const currentText = (formData.retention_of_title_text || '').trim();
    const isKnownDefault = Object.values(DEFAULT_RETENTION_TEXT_BY_LANG).some(
      t => t.trim() === currentText
    );
    if (isKnownDefault || !currentText) {
      updateField('retention_of_title_text', DEFAULT_RETENTION_TEXT_BY_LANG[lang] || DEFAULT_RETENTION_TEXT_BY_LANG.German);
    }
  }, [lang]);

  // Calculate downpayment amount when percentage or total changes
  useEffect(() => {
    if (formData.payment_terms_type === 'Downpayment' && formData.downpayment_percent) {
      const amount = Math.round((totalAmount * formData.downpayment_percent) / 100 * 100) / 100;
      setDownpaymentAmount(amount);
      updateField('downpayment_amount', amount);
    } else {
      setDownpaymentAmount(0);
      updateField('downpayment_amount', 0);
    }
  }, [formData.downpayment_percent, totalAmount, formData.payment_terms_type]);

  const pct = formData.downpayment_percent || 50;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{L.cardTitle}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Payment Type Selection */}
        <div className="space-y-2">
          <Label>{L.paymentMethod}</Label>
          <Select
            value={formData.payment_terms_type || 'Full'}
            onValueChange={(v) => updateField('payment_terms_type', v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Full">{L.fullPayment}</SelectItem>
              <SelectItem value="Downpayment">{L.downpayment}</SelectItem>
              <SelectItem value="Installments">{L.installments}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Downpayment Section */}
        {formData.payment_terms_type === 'Downpayment' && (
          <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{L.downpaymentPct}</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.downpayment_percent || ''}
                  onChange={(e) => updateField('downpayment_percent', parseFloat(e.target.value) || 0)}
                  placeholder="50"
                />
              </div>
              <div className="space-y-2">
                <Label>{L.downpaymentAmt}</Label>
                <div className="px-3 py-2 bg-white border border-slate-200 rounded-md">
                  <span className="font-semibold">€{downpaymentAmount.toFixed(2)}</span>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>{L.scheduleLabel}</Label>
              <Textarea
                value={formData.payment_schedule || ''}
                onChange={(e) => updateField('payment_schedule', e.target.value || '')}
                placeholder={L.schedulePlaceholderDown(pct)}
                rows={2}
              />
            </div>
          </div>
        )}

        {/* Installments Section */}
        {formData.payment_terms_type === 'Installments' && (
          <div className="space-y-4 p-4 bg-green-50 rounded-lg border border-green-200">
            <Label>{L.scheduleLabel}</Label>
            <Textarea
              value={formData.payment_schedule || ''}
              onChange={(e) => updateField('payment_schedule', e.target.value || '')}
              placeholder={L.schedulePlaceholderInst}
              rows={3}
            />
          </div>
        )}

        {/* Retention of Title */}
        <div className="border-t pt-6 space-y-4">
          <div className="flex items-center justify-between">
            <Label className="font-semibold">{L.retentionToggle}</Label>
            <Switch
              checked={formData.retention_of_title_enabled !== false}
              onCheckedChange={(checked) => updateField('retention_of_title_enabled', checked)}
            />
          </div>

          {formData.retention_of_title_enabled !== false && (
            <div className="space-y-2">
              <Label>{L.retentionLabel}</Label>
              <Textarea
                value={formData.retention_of_title_text || DEFAULT_RETENTION_TEXT_BY_LANG[lang] || DEFAULT_RETENTION_TEXT_BY_LANG.German}
                onChange={(e) => updateField('retention_of_title_text', e.target.value || '')}
                placeholder={L.retentionPlaceholder}
                rows={4}
                className="font-mono text-xs"
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}