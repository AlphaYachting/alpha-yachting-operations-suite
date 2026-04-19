import React, { useState, useEffect } from 'react';
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
const DEFAULT_RETENTION_TEXT = DEFAULT_RETENTION_TEXT_BY_LANG.German;

export default function PaymentTermsSection({ formData, updateField, totalAmount, language }) {
  const lang = language || formData.language || 'German';
  const [downpaymentAmount, setDownpaymentAmount] = useState(0);

  // Calculate downpayment amount when percentage or total changes
  useEffect(() => {
    if (formData.payment_terms_type === 'Downpayment' && formData.downpayment_percent) {
      // totalAmount is already gross (incl. VAT) — no need to apply VAT again
      const amount = Math.round((totalAmount * formData.downpayment_percent) / 100 * 100) / 100;
      setDownpaymentAmount(amount);
      updateField('downpayment_amount', amount);
    } else {
      setDownpaymentAmount(0);
      updateField('downpayment_amount', 0);
    }
  }, [formData.downpayment_percent, totalAmount, formData.payment_terms_type]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment Terms & Legal</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Payment Type Selection */}
        <div className="space-y-2">
          <Label>Payment Method</Label>
          <Select 
            value={formData.payment_terms_type || 'Full'} 
            onValueChange={(v) => updateField('payment_terms_type', v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Full">Full Payment</SelectItem>
              <SelectItem value="Downpayment">Downpayment</SelectItem>
              <SelectItem value="Installments">Installments</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Downpayment Section */}
        {formData.payment_terms_type === 'Downpayment' && (
          <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{lang === 'German' ? 'Anzahlung %' : 'Downpayment %'}</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.downpayment_percent || ''}
                  onChange={(e) => updateField('downpayment_percent', parseFloat(e.target.value) || 0)}
                  placeholder="e.g., 50"
                />
              </div>
              <div className="space-y-2">
                <Label>{lang === 'German' ? 'Anzahlungsbetrag' : 'Downpayment Amount'}</Label>
                <div className="px-3 py-2 bg-white border border-slate-200 rounded-md">
                  <span className="font-semibold">€{downpaymentAmount.toFixed(2)}</span>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>{lang === 'German' ? 'Zahlungsplan (Freitext)' : 'Payment Schedule Description'}</Label>
              <Textarea
                value={formData.payment_schedule || ''}
                onChange={(e) => updateField('payment_schedule', e.target.value || '')}
                placeholder={lang === 'German'
                  ? `z. B. ${formData.downpayment_percent || 50} % Anzahlung, ${100 - (formData.downpayment_percent || 50)} % Restzahlung bei Fertigstellung`
                  : `e.g., ${formData.downpayment_percent || 50}% downpayment upon order, ${100 - (formData.downpayment_percent || 50)}% upon completion`}
                rows={2}
              />
            </div>
          </div>
        )}

        {/* Installments Section */}
        {formData.payment_terms_type === 'Installments' && (
          <div className="space-y-4 p-4 bg-green-50 rounded-lg border border-green-200">
            <Label>{lang === 'German' ? 'Zahlungsplan' : 'Payment Schedule Description'}</Label>
            <Textarea
              value={formData.payment_schedule || ''}
              onChange={(e) => updateField('payment_schedule', e.target.value || '')}
              placeholder={lang === 'German'
                ? 'z. B. 33 % bei Auftrag, 33 % bei 50 % Fertigstellung, 34 % bei Ablieferung'
                : 'e.g., 33% upon order, 33% at 50% completion, 34% upon final delivery'}
              rows={3}
            />
          </div>
        )}

        {/* Retention of Title */}
        <div className="border-t pt-6 space-y-4">
          <div className="flex items-center justify-between">
            <Label className="font-semibold">{lang === 'German' ? 'Eigentumsvorbehalt einschließen' : 'Include Retention of Title Clause'}</Label>
            <Switch
              checked={formData.retention_of_title_enabled !== false}
              onCheckedChange={(checked) => updateField('retention_of_title_enabled', checked)}
            />
          </div>

          {formData.retention_of_title_enabled !== false && (
            <div className="space-y-2">
              <Label>{lang === 'German' ? 'Rechtstext (Eigentumsvorbehalt)' : 'Legal Text (Retention of Title)'}</Label>
              <Textarea
                value={formData.retention_of_title_text || DEFAULT_RETENTION_TEXT_BY_LANG[lang] || DEFAULT_RETENTION_TEXT_BY_LANG.German}
                onChange={(e) => updateField('retention_of_title_text', e.target.value || '')}
                placeholder="Enter legal text..."
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