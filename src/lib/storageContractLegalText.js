/**
 * Static multilingual legal text blocks for Storage Contracts.
 * These are FIXED contractual clauses — do NOT generate at runtime via AI.
 * Languages: de, en, hr, sl
 *
 * Each section key maps to sections 8–16 of the contract.
 * Sections 1–7 are dynamic (filled from wizard data).
 */

export const COMPANY_HEADER = {
  name: 'AQS GROUP d.o.o. / Alpha Yachting',
  address: 'Bužinija 32A, 52466 Novigrad, Kroatien / Croatia',
  oib: 'HR69074711745',
  email: 'info@alpha-yachting.hr',
  web: 'www.alpha-yachting.hr',
};

export const REQUIRED_SECTION_KEYS = [
  'customerObligations',
  'providerObligations',
  'liabilityInsurance',
  'access',
  'pickupRelease',
  'termination',
  'dataProtection',
  'finalProvisions',
];

export const LEGAL_TEXT = {
  de: {
    sectionTitles: {
      customerData: '1. Auftraggeber (Kunde)',
      boatData: '2. Bootsdaten',
      trailerData: '3. Trailer / Transportmittel',
      storageType: '4. Lagerart und Lagerdauer',
      pricing: '5. Preise und Zahlungsbedingungen',
      additionalServices: '6. Zusatzleistungen / Serviceaufträge',
      boatCondition: '7. Bootszustand bei Übergabe',
      customerObligations: '8. Pflichten des Auftraggebers',
      providerObligations: '9. Pflichten des Lagerhalters',
      liabilityInsurance: '10. Haftung und Versicherung',
      access: '11. Zugang zum Boot während der Lagerung',
      pickupRelease: '12. Abholung und Herausgabe des Bootes',
      termination: '13. Kündigung / Vorzeitige Beendigung',
      dataProtection: '14. Datenschutz',
      finalProvisions: '15. Schlussbestimmungen',
      specialAgreements: '16. Besondere Vereinbarungen und Unterschriften',
    },
    customerObligations: `Der Auftraggeber verpflichtet sich:
a) Das Boot in einem ordnungsgemäßen und sicheren Zustand zur Einlagerung zu übergeben. Lose Teile, Segel, Masten, Ausleger und sonstige abnehmbare Ausrüstungsgegenstände sind vor der Übergabe zu sichern oder zu entfernen.
b) Alle relevanten Informationen über das Boot, insbesondere über bestehende Schäden, gefährliche Stoffe oder besondere Anforderungen, vollständig und wahrheitsgemäß mitzuteilen.
c) Das Boot ausreichend versichert zu halten (Haftpflicht- und Kaskoversicherung). Den aktuellen Versicherungsnachweis auf Verlangen vorzulegen.
d) Das Lagerobjekt nicht ohne ausdrückliche schriftliche Zustimmung des Lagerhalters zu verändern, zu reparieren oder Dritte damit zu beauftragen.
e) Alle Gebühren und Entgelte fristgerecht zu bezahlen.
f) Den Lagerhalter unverzüglich über Änderungen der Kontaktdaten, des Versicherungsschutzes oder der Eigentumsrechte zu informieren.
g) Das Lagergelände nur zu den genehmigten Zeiten und unter Beachtung aller Sicherheits- und Hausordnungsvorschriften zu betreten.`,

    providerObligations: `Der Lagerhalter verpflichtet sich:
a) Das übergebene Boot sorgfältig und sachgemäß zu lagern und gegen unbefugten Zugriff Dritter zu sichern.
b) Das Lagergelände in einem ordnungsgemäßen und sicheren Zustand zu erhalten.
c) Den Auftraggeber unverzüglich zu informieren, wenn am Boot Schäden, Mängel oder sonstige besondere Umstände festgestellt werden.
d) Das Boot nur auf ausdrückliche Anweisung des Auftraggebers zu bewegen, es sei denn, dies ist aus Sicherheitsgründen oder im Rahmen genehmigter Serviceleistungen erforderlich.
e) Die vereinbarten Zusatzleistungen fachgerecht und im vereinbarten Zeitrahmen durchzuführen.
f) Den Auftraggeber über wesentliche Änderungen der Lager- oder Betriebsbedingungen rechtzeitig zu informieren.`,

    liabilityInsurance: `1. Der Lagerhalter haftet für Schäden am eingelagerten Boot, die durch nachgewiesenes Verschulden des Lagerhalters oder seiner Erfüllungsgehilfen verursacht werden, bis zur Höhe des nachgewiesenen Schadens, maximal jedoch bis zu einem Betrag von EUR 50.000 pro Schadensereignis, sofern nicht eine höhere Haftung gesetzlich zwingend vorgeschrieben ist.

2. Der Lagerhalter haftet nicht für:
- Schäden durch höhere Gewalt (Sturm, Hochwasser, Erdbeben, Blitzschlag, etc.)
- Schäden durch Diebstahl, sofern keine grobe Fahrlässigkeit des Lagerhalters vorliegt
- Schäden, die durch den mangelhaften Zustand des Bootes bei der Übergabe entstanden sind
- Schäden durch unsachgemäße Handlungen des Auftraggebers oder von ihm beauftragter Dritter
- Schäden durch unzureichenden oder fehlenden Versicherungsschutz des Auftraggebers

3. Der Auftraggeber ist verpflichtet, das Boot während der gesamten Lagerdauer auf eigene Kosten ausreichend zu versichern (mindestens Haftpflichtversicherung, empfohlen: Kaskoversicherung). Der Lagerhalter ist berechtigt, den aktuellen Versicherungsnachweis vor Übernahme des Bootes zu verlangen.

4. Schadensersatzansprüche des Auftraggebers verjähren innerhalb von einem Jahr ab dem Zeitpunkt, an dem der Auftraggeber von dem Schaden Kenntnis erlangt hat oder hätte erlangen müssen.`,

    access: `1. Der Auftraggeber hat das Recht, sein Boot während der regulären Öffnungszeiten des Lagergeländes (Mo–Fr 08:00–17:00, Sa 08:00–13:00 Uhr oder nach gesonderter Vereinbarung) zu besichtigen und daran Arbeiten vorzunehmen.

2. Besuche außerhalb der regulären Öffnungszeiten sowie die Beauftragung Dritter mit Arbeiten am Boot sind vorab schriftlich mit dem Lagerhalter zu vereinbaren.

3. Bei Betreten des Lagergeländes sind alle geltenden Sicherheits- und Hausordnungsvorschriften strikt einzuhalten. Das Lagergelände ist ausschließlich mit Zustimmung des Lagerhalters zu betreten.

4. Der Lagerhalter kann den Zugang zum Lagergelände aus sicherheitsrelevanten oder betrieblichen Gründen vorübergehend einschränken. In dringenden Fällen (z.B. Notfallreparaturen) wird der Lagerhalter den Auftraggeber so schnell wie möglich benachrichtigen.`,

    pickupRelease: `1. Das Boot wird zum vereinbarten Abholtermin herausgegeben. Der Auftraggeber hat die Abholung mindestens 48 Stunden im Voraus schriftlich oder per E-Mail anzukündigen.

2. Bei Abholung des Bootes sind alle offenen Gebühren und Entgelte vorab vollständig zu begleichen. Der Lagerhalter ist berechtigt, die Herausgabe des Bootes bis zur vollständigen Bezahlung zu verweigern (Zurückbehaltungsrecht).

3. Der Auftraggeber hat das Boot bei der Übernahme unverzüglich auf sichtbare Schäden zu prüfen und etwaige Mängel sofort schriftlich zu protokollieren. Später geltend gemachte Schäden, die bei ordnungsgemäßer Prüfung erkennbar gewesen wären, können nicht dem Lagerhalter angelastet werden.

4. Bei verspäteter Abholung ist der Lagerhalter berechtigt, ab dem vereinbarten Abholtermin Lagergebühren in voller Höhe zu berechnen. Übersteigt die Verzögerung 30 Tage, ist der Lagerhalter berechtigt, das Boot auf Kosten des Auftraggebers anderweitig unterzustellen oder zu sichern.`,

    termination: `1. Dieser Vertrag endet automatisch mit Ablauf der vereinbarten Lagerdauer, sofern keine Verlängerungsvereinbarung getroffen wird.

2. Eine vorzeitige Kündigung durch den Auftraggeber ist mit einer Frist von 30 Tagen schriftlich möglich. In diesem Fall werden bereits bezahlte Lagergebühren anteilig, abzüglich einer Bearbeitungsgebühr von EUR 50,00, rückerstattet.

3. Der Lagerhalter ist berechtigt, diesen Vertrag aus wichtigem Grund fristlos zu kündigen, insbesondere wenn:
- Der Auftraggeber mit der Zahlung von Gebühren mehr als 30 Tage in Verzug ist
- Das Boot einen unsicheren Zustand aufweist, der trotz Mahnung nicht behoben wird
- Der Auftraggeber wesentliche Vertragspflichten wiederholt verletzt

4. Im Falle einer fristlosen Kündigung durch den Lagerhalter ist der Auftraggeber verpflichtet, das Boot innerhalb von 14 Tagen nach Kündigung abzuholen.`,

    dataProtection: `1. Der Lagerhalter erhebt und verarbeitet personenbezogene Daten des Auftraggebers ausschließlich zur Erfüllung dieses Vertrages und zur Wahrnehmung berechtigter Interessen im Rahmen der gesetzlichen Bestimmungen (DSGVO / GDPR).

2. Die Daten werden nicht an Dritte weitergegeben, sofern dies nicht zur Vertragserfüllung notwendig oder gesetzlich vorgeschrieben ist.

3. Der Auftraggeber hat das Recht auf Auskunft, Berichtigung, Löschung und Einschränkung der Verarbeitung seiner personenbezogenen Daten gemäß DSGVO. Anfragen richten Sie bitte an: info@alpha-yachting.hr.

4. Personenbezogene Daten werden nach Ablauf der gesetzlichen Aufbewahrungsfristen gelöscht.`,

    finalProvisions: `1. Dieser Vertrag unterliegt ausschließlich dem Recht der Republik Kroatien. Im Falle von Streitigkeiten aus diesem Vertrag ist, soweit gesetzlich zulässig, das Gericht am Sitz des Lagerhalters zuständig.

2. Änderungen und Ergänzungen dieses Vertrages bedürfen der Schriftform und der Unterzeichnung durch beide Vertragsparteien.

3. Sollten einzelne Bestimmungen dieses Vertrages unwirksam oder undurchführbar sein oder werden, so berührt dies die Wirksamkeit der übrigen Bestimmungen nicht. Die unwirksame Bestimmung ist durch eine wirksame zu ersetzen, die dem wirtschaftlichen Zweck der unwirksamen Bestimmung am nächsten kommt.

4. Die Vertragsparteien erkennen an, diesen Vertrag vollständig gelesen, verstanden und aus freiem Willen unterzeichnet zu haben.

5. Dieser Vertrag wird in zwei gleichlautenden Ausfertigungen erstellt. Jede Partei erhält ein Exemplar.`,
  },

  en: {
    sectionTitles: {
      customerData: '1. Client (Customer)',
      boatData: '2. Vessel Data',
      trailerData: '3. Trailer / Transport Equipment',
      storageType: '4. Type and Duration of Storage',
      pricing: '5. Prices and Payment Terms',
      additionalServices: '6. Additional Services / Service Orders',
      boatCondition: '7. Vessel Condition at Handover',
      customerObligations: '8. Customer Obligations',
      providerObligations: '9. Storage Provider Obligations',
      liabilityInsurance: '10. Liability and Insurance',
      access: '11. Access to the Vessel During Storage',
      pickupRelease: '12. Pickup and Release of the Vessel',
      termination: '13. Termination / Early Ending',
      dataProtection: '14. Data Protection',
      finalProvisions: '15. Final Provisions',
      specialAgreements: '16. Special Agreements and Signatures',
    },
    customerObligations: `The customer undertakes:
a) To deliver the vessel in a proper and safe condition for storage. Loose parts, sails, masts, outriggers and other removable equipment must be secured or removed prior to handover.
b) To provide complete and accurate information about the vessel, particularly regarding existing damage, hazardous materials or special requirements.
c) To maintain adequate insurance for the vessel (liability and hull insurance) throughout the storage period, and to provide proof of insurance upon request.
d) Not to modify, repair or have the stored vessel modified or repaired by third parties without the express written consent of the storage provider.
e) To pay all fees and charges promptly.
f) To notify the storage provider immediately of any changes to contact details, insurance coverage or ownership rights.
g) To access the storage premises only during approved hours and in compliance with all safety and house rules.`,

    providerObligations: `The storage provider undertakes:
a) To store the delivered vessel carefully and professionally and to protect it from unauthorized access by third parties.
b) To maintain the storage premises in a proper and safe condition.
c) To notify the customer immediately if damage, defects or other special circumstances are discovered on the vessel.
d) To move the vessel only on the express instruction of the customer, unless this is necessary for safety reasons or in the context of approved service work.
e) To carry out agreed additional services professionally and within the agreed timeframe.
f) To inform the customer in a timely manner of any significant changes to storage or operating conditions.`,

    liabilityInsurance: `1. The storage provider is liable for damage to the stored vessel caused by proven fault of the storage provider or its agents, up to the amount of the proven damage, but not exceeding EUR 50,000 per loss event, unless a higher liability is mandatorily required by law.

2. The storage provider is not liable for:
- Damage caused by force majeure (storm, flooding, earthquake, lightning, etc.)
- Damage caused by theft, unless the storage provider was grossly negligent
- Damage arising from the defective condition of the vessel at the time of handover
- Damage caused by improper actions of the customer or third parties commissioned by the customer
- Damage resulting from inadequate or missing insurance coverage of the customer

3. The customer is obliged to maintain adequate insurance for the vessel throughout the entire storage period at their own expense (at minimum liability insurance; hull insurance recommended). The storage provider is entitled to demand proof of current insurance before accepting the vessel.

4. Claims for damages by the customer become statute-barred within one year from the date on which the customer became aware or should have become aware of the damage.`,

    access: `1. The customer has the right to inspect their vessel and carry out work on it during the regular opening hours of the storage facility (Mon–Fri 08:00–17:00, Sat 08:00–13:00, or as otherwise agreed).

2. Visits outside regular opening hours and the commissioning of third parties to carry out work on the vessel must be agreed in advance in writing with the storage provider.

3. All applicable safety and house rules must be strictly observed when entering the storage premises. The premises may only be accessed with the consent of the storage provider.

4. The storage provider may temporarily restrict access to the storage premises for safety or operational reasons. In urgent cases (e.g. emergency repairs), the storage provider will notify the customer as quickly as possible.`,

    pickupRelease: `1. The vessel will be released at the agreed collection date. The customer must announce collection at least 48 hours in advance in writing or by email.

2. All outstanding fees and charges must be paid in full before collection of the vessel. The storage provider is entitled to withhold the vessel until full payment has been made (right of retention).

3. The customer must immediately inspect the vessel for visible damage upon collection and document any defects in writing on the spot. Damage claimed at a later date that would have been recognizable during a proper inspection cannot be attributed to the storage provider.

4. In the event of late collection, the storage provider is entitled to charge storage fees in full from the agreed collection date. If the delay exceeds 30 days, the storage provider is entitled to have the vessel stored or secured elsewhere at the customer's expense.`,

    termination: `1. This agreement automatically ends upon expiry of the agreed storage period, unless an extension agreement is reached.

2. Early termination by the customer is possible with 30 days' written notice. In such case, fees already paid will be refunded on a pro-rata basis, less an administrative fee of EUR 50.00.

3. The storage provider is entitled to terminate this agreement without notice for good cause, in particular if:
- The customer is more than 30 days overdue with payment of fees
- The vessel is in an unsafe condition that is not remedied despite notice
- The customer repeatedly breaches material contractual obligations

4. In the event of termination without notice by the storage provider, the customer is obliged to collect the vessel within 14 days of termination.`,

    dataProtection: `1. The storage provider collects and processes the customer's personal data exclusively for the purpose of fulfilling this agreement and for legitimate interests within the framework of legal provisions (GDPR).

2. Data will not be passed on to third parties unless this is necessary for the performance of the contract or required by law.

3. The customer has the right to access, rectify, erase and restrict the processing of their personal data in accordance with the GDPR. Please direct requests to: info@alpha-yachting.hr.

4. Personal data will be deleted after the expiry of the statutory retention periods.`,

    finalProvisions: `1. This agreement is subject exclusively to the law of the Republic of Croatia. In the event of disputes arising from this agreement, the court at the registered seat of the storage provider shall have jurisdiction, to the extent permitted by law.

2. Amendments and additions to this agreement must be made in writing and signed by both parties.

3. Should individual provisions of this agreement be or become invalid or unenforceable, this shall not affect the validity of the remaining provisions. The invalid provision shall be replaced by a valid one that comes closest to the economic purpose of the invalid provision.

4. The parties acknowledge that they have read, understood and signed this agreement of their own free will.

5. This agreement is drawn up in two identical copies. Each party receives one copy.`,
  },

  hr: {
    sectionTitles: {
      customerData: '1. Naručitelj (Klijent)',
      boatData: '2. Podaci o plovilu',
      trailerData: '3. Prikolica / Transportna oprema',
      storageType: '4. Vrsta i trajanje skladištenja',
      pricing: '5. Cijene i uvjeti plaćanja',
      additionalServices: '6. Dodatne usluge / Servisni nalozi',
      boatCondition: '7. Stanje plovila pri predaji',
      customerObligations: '8. Obveze naručitelja',
      providerObligations: '9. Obveze skladištara',
      liabilityInsurance: '10. Odgovornost i osiguranje',
      access: '11. Pristup plovilu tijekom skladištenja',
      pickupRelease: '12. Preuzimanje i predaja plovila',
      termination: '13. Raskid / Prijevremeni završetak',
      dataProtection: '14. Zaštita podataka',
      finalProvisions: '15. Završne odredbe',
      specialAgreements: '16. Posebni sporazumi i potpisi',
    },
    customerObligations: `Naručitelj se obvezuje:
a) Predati plovilo u ispravnom i sigurnom stanju za skladištenje. Dijelovi koji su slobodni, jedra, jarboli, privjesci i ostala oprema koja se može ukloniti moraju biti osigurani ili uklonjeni prije predaje.
b) Potpuno i istinito obavijestiti o svim relevantnim podacima o plovilu, posebice o postojećim oštećenjima, opasnim tvarima ili posebnim zahtjevima.
c) Plovilo durante cjelokupnog trajanja skladištenja odgovarajuće osigurati (odgovornost i kasko osiguranje) i na zahtjev predočiti aktualni dokaz o osiguranju.
d) Bez izričitog pisanog pristanka skladištara ne modificirati, ne popravljati ili ne povjeravati to trećim osobama pohranjena plovila.
e) Pravovremeno plaćati sve naknade i pristojbe.
f) Skladištara odmah obavijestiti o promjenama kontaktnih podataka, pokrića osiguranja ili vlasničkih prava.
g) Na prostor za skladištenje ulaziti samo u odobreno radno vrijeme i u skladu sa svim sigurnosnim propisima i kućnim redom.`,

    providerObligations: `Skladištar se obvezuje:
a) Predano plovilo pažljivo i stručno skladištiti te ga zaštititi od neovlaštenog pristupa trećih osoba.
b) Prostor za skladištenje održavati u ispravnom i sigurnom stanju.
c) Naručitelja odmah obavijestiti ako se na plovilu utvrde oštećenja, nedostaci ili drugi posebni okolnosti.
d) Plovilo premještati samo na izričitu uputu naručitelja, osim ako je to potrebno iz sigurnosnih razloga ili u okviru odobrenih servisnih radova.
e) Dogovorene dodatne usluge stručno i u dogovorenom vremenskom okviru izvesti.
f) Naručitelja pravovremeno obavijestiti o bitnim promjenama uvjeta skladištenja ili poslovanja.`,

    liabilityInsurance: `1. Skladištar odgovara za štete na uskladištenom plovilu koje su nastale dokazanom krivnjom skladištara ili njegovih pomoćnika, do visine dokazane štete, no maksimalno do iznosa od 50.000 EUR po štetnom događaju, osim ako zakonski nije obvezno propisana viša odgovornost.

2. Skladištar ne odgovara za:
- Štete nastale višom silom (oluja, poplava, potres, udar groma i sl.)
- Štete nastale krađom, osim ako skladištar nije bio grubo nemaran
- Štete nastale zbog neispravnog stanja plovila pri predaji
- Štete nastale nepravilnim postupanjem naručitelja ili trećih osoba koje je on angažirao
- Štete nastale zbog neadekvatnog ili nepostojećeg osiguranja naručitelja

3. Naručitelj je dužan plovilo za cjelokupno trajanje skladištenja na vlastiti trošak odgovarajuće osigurati (minimalno osiguranje od odgovornosti, preporuča se kasko osiguranje). Skladištar je ovlašten zahtijevati aktualni dokaz o osiguranju prije preuzimanja plovila.

4. Odštetni zahtjevi naručitelja zastarijevaju u roku od jedne godine od trenutka kada je naručitelj saznao ili morao saznati za štetu.`,

    access: `1. Naručitelj ima pravo pregledati plovilo i na njemu obavljati radove za vrijeme redovnog radnog vremena prostora za skladištenje (pon–pet 08:00–17:00, sub 08:00–13:00 ili prema posebnom dogovoru).

2. Posjete izvan redovnog radnog vremena te angažiranje trećih osoba za radove na plovilu moraju se unaprijed pisano dogovoriti sa skladištarom.

3. Pri ulasku na prostor za skladištenje strogo se moraju poštivati svi važeći sigurnosni propisi i kućni red. Na prostor se smije ulaziti isključivo uz suglasnost skladištara.

4. Skladištar može iz sigurnosnih ili operativnih razloga privremeno ograničiti pristup prostoru za skladištenje. U hitnim slučajevima (npr. hitni popravci) skladištar će naručitelja obavijestiti što je prije moguće.`,

    pickupRelease: `1. Plovilo se predaje u dogovorenom terminu preuzimanja. Naručitelj mora preuzimanje najaviti najmanje 48 sati unaprijed pisanim putem ili e-mailom.

2. Sve dospjele naknade i pristojbe moraju se platiti u potpunosti prije preuzimanja plovila. Skladištar je ovlašten uskratiti predaju plovila do potpunog plaćanja (pravo zadržavanja).

3. Naručitelj je dužan plovilo odmah po preuzimanju pregledati radi vidljivih oštećenja i eventualne nedostatke odmah pisano zabilježiti. Oštećenja koja su naknadno prijavljena, a bila su vidljiva pri urednom pregledu, ne mogu se pripisati skladištaru.

4. U slučaju zakašnjelog preuzimanja, skladištar je ovlašten naplaćivati naknade za skladištenje u punom iznosu od dogovorenog termina preuzimanja. Ako zakašnjenje prelazi 30 dana, skladištar je ovlašten plovilo na trošak naručitelja privremeno smjestiti na drugo mjesto ili ga osigurati.`,

    termination: `1. Ovaj ugovor automatski prestaje istekom dogovorenog trajanja skladištenja, osim ako se ne postigne sporazum o produljenju.

2. Prijevremeni otkaz od strane naručitelja moguć je uz pisanu obavijest 30 dana unaprijed. U tom slučaju već plaćene naknade za skladištenje vraćaju se razmjerno, uz odbitak administrativne naknade od 50,00 EUR.

3. Skladištar je ovlašten raskinuti ovaj ugovor bez otkaznog roka iz opravdanog razloga, posebno ako:
- Naručitelj kasni s plaćanjem naknada više od 30 dana
- Plovilo ima neispravno stanje koje se unatoč opomeni ne otkloni
- Naručitelj ponavljano krši bitne ugovorne obveze

4. U slučaju raskida bez otkaznog roka od strane skladištara, naručitelj je dužan plovilo preuzeti u roku od 14 dana od raskida.`,

    dataProtection: `1. Skladištar prikuplja i obrađuje osobne podatke naručitelja isključivo u svrhu ispunjenja ovog ugovora i zaštite legitimnih interesa u okviru zakonskih odredbi (GDPR / Uredba EU 2016/679).

2. Podaci se ne dostavljaju trećim stranama, osim ako je to nužno za izvršenje ugovora ili zakonski propisano.

3. Naručitelj ima pravo pristupa, ispravka, brisanja i ograničenja obrade svojih osobnih podataka sukladno GDPR-u. Upite šaljite na: info@alpha-yachting.hr.

4. Osobni podaci brišu se nakon isteka zakonskih rokova čuvanja.`,

    finalProvisions: `1. Ovaj ugovor podliježe isključivo pravu Republike Hrvatske. U slučaju sporova iz ovog ugovora, nadležan je sud prema sjedištu skladištara, u mjeri u kojoj je to zakonski dopušteno.

2. Izmjene i dopune ovog ugovora zahtijevaju pisanu formu i potpis obiju ugovornih strana.

3. U slučaju da pojedinim odredbama ovog ugovora nedostaje pravna valjanost ili budu neprovedive, to ne utječe na valjanost ostalih odredbi. Nevažeća odredba zamjenjuje se valjanom koja je najbliža gospodarskoj svrsi nevažeće odredbe.

4. Ugovorne strane potvrđuju da su ovaj ugovor u cijelosti pročitale, razumjele i slobodnom voljom potpisale.

5. Ovaj ugovor sastavlja se u dva istovjetna primjerka. Svaka strana dobiva jedan primjerak.`,
  },

  sl: {
    sectionTitles: {
      customerData: '1. Naročnik (Stranka)',
      boatData: '2. Podatki o plovilu',
      trailerData: '3. Prikolica / Transportna oprema',
      storageType: '4. Vrsta in trajanje skladiščenja',
      pricing: '5. Cene in plačilni pogoji',
      additionalServices: '6. Dodatne storitve / Servisni nalogi',
      boatCondition: '7. Stanje plovila ob predaji',
      customerObligations: '8. Obveznosti naročnika',
      providerObligations: '9. Obveznosti skladiščarja',
      liabilityInsurance: '10. Odgovornost in zavarovanje',
      access: '11. Dostop do plovila med skladiščenjem',
      pickupRelease: '12. Prevzem in izročitev plovila',
      termination: '13. Odpoved / Predčasna prekinitev',
      dataProtection: '14. Varstvo podatkov',
      finalProvisions: '15. Končne določbe',
      specialAgreements: '16. Posebni dogovori in podpisi',
    },
    customerObligations: `Naročnik se zavezuje:
a) Plovilo predati v brezhibnem in varnem stanju za skladiščenje. Prosti deli, jadra, jarboli, konzole in druga snemljiva oprema morajo biti pred predajo zavarована ali odstranjeni.
b) Popolnoma in resnično posredovati vse ustrezne informacije o plovilu, zlasti o obstoječih poškodbah, nevarnih snoveh ali posebnih zahtevah.
c) Plovilo ves čas trajanja skladiščenja ustrezno zavarovati (odgovornost in kasko zavarovanje) in na zahtevo predložiti veljavno potrdilo o zavarovanju.
d) Brez izrecnega pisnega soglasja skladiščarja ne spremeniti, popraviti ali zaupati tretjim osebam v popravilo uskladiščenega plovila.
e) Pravočasno plačevati vse pristojbine in nadomestila.
f) Skladiščarja nemudoma obvestiti o spremembi kontaktnih podatkov, zavarovalnega kritja ali lastninskih pravic.
g) V prostor za skladiščenje vstopati samo v odobrenem delovnem času in v skladu z vsemi varnostnimi predpisi in hišnim redom.`,

    providerObligations: `Skladiščar se zavezuje:
a) Predano plovilo skrbno in strokovno uskladiščiti ter ga zaščititi pred nepooblaščenim dostopom tretjih oseb.
b) Prostor za skladiščenje vzdrževati v brezhibnem in varnem stanju.
c) Naročnika nemudoma obvestiti, če se na plovilu ugotovijo poškodbe, napake ali druge posebne okoliščine.
d) Plovilo premakniti samo na izrecno navodilo naročnika, razen če je to potrebno iz varnostnih razlogov ali v okviru odobrenih servisnih del.
e) Dogovorjene dodatne storitve strokovno in v dogovorjenem časovnem okviru izvesti.
f) Naročnika pravočasno obvestiti o bistvenih spremembah pogojev skladiščenja ali poslovanja.`,

    liabilityInsurance: `1. Skladiščar odgovarja za škodo na uskladiščenem plovilu, ki je nastala z dokazano krivdo skladiščarja ali njegovih pomočnikov, do višine dokazane škode, vendar največ do zneska 50.000 EUR na škodni dogodek, razen če zakon obvezno ne predpisuje višje odgovornosti.

2. Skladiščar ne odgovarja za:
- Škodo, nastalo zaradi višje sile (nevihta, poplave, potres, udar strele ipd.)
- Škodo, nastalo zaradi kraje, razen če skladiščar ni bil hudo malomaren
- Škodo, nastalo zaradi brezhibnega stanja plovila ob predaji
- Škodo, nastalo zaradi nepravilnih ravnanj naročnika ali tretjih oseb, ki jih je angažiral
- Škodo, nastalo zaradi neustreznega ali neobstoječega zavarovanja naročnika

3. Naročnik je dolžan plovilo ves čas trajanja skladiščenja na lastne stroške ustrezno zavarovati (vsaj zavarovanje odgovornosti; priporoča se kasko zavarovanje). Skladiščar je upravičen zahtevati veljavno potrdilo o zavarovanju pred prevzemom plovila.

4. Odškodninski zahtevki naročnika zastarajo v enem letu od trenutka, ko je naročnik izvedel ali bi moral izvedeti za škodo.`,

    access: `1. Naročnik ima pravico pregledati plovilo in na njem opravljati dela v rednem delovnem času prostora za skladiščenje (pon–pet 08:00–17:00, sob 08:00–13:00 ali po posebnem dogovoru).

2. Obiske zunaj rednega delovnega časa in angažiranje tretjih oseb za dela na plovilu je treba vnaprej pisno dogovoriti s skladiščarjem.

3. Pri vstopu v prostor za skladiščenje je treba strogo upoštevati vse veljavne varnostne predpise in hišni red. V prostore je dovoljeno vstopati le s soglasjem skladiščarja.

4. Skladiščar lahko iz varnostnih ali operativnih razlogov začasno omeji dostop do prostora za skladiščenje. V nujnih primerih (npr. nujni popravki) bo skladiščar naročnika obvestil čim prej.`,

    pickupRelease: `1. Plovilo se izroči ob dogovorjenem terminu prevzema. Naročnik mora prevzem najaviti vsaj 48 ur vnaprej pisno ali po e-pošti.

2. Vse zapadle pristojbine in nadomestila je treba v celoti plačati pred prevzemom plovila. Skladiščar je upravičen zavrniti izročitev plovila do popolnega plačila (pravica zadržanja).

3. Naročnik je dolžan plovilo ob prevzemu nemudoma pregledati za vidne poškodbe in morebitne napake takoj pisno zabeležiti. Poškodb, ki so bile prijavljene pozneje, pa so bile vidne pri rednem pregledu, ni mogoče pripisati skladiščarju.

4. V primeru zamude pri prevzemu je skladiščar upravičen zaračunavati pristojbine za skladiščenje v polnem znesku od dogovorjenega termina prevzema. Če zamuda preseže 30 dni, je skladiščar upravičen plovilo na stroške naročnika shraniti na drugem mestu ali ga zavarovati.`,

    termination: `1. Ta pogodba samodejno preneha po poteku dogovorjenega trajanja skladiščenja, razen če se ne doseže sporazum o podaljšanju.

2. Predčasna odpoved s strani naročnika je mogoča z 30-dnevnim pisnim odpovednim rokom. V tem primeru se že plačane pristojbine za skladiščenje vrnejo sorazmerno, zmanjšane za administrativno pristojbino v višini 50,00 EUR.

3. Skladiščar je upravičen to pogodbo brez odpovednega roka odpovedati iz utemeljenega razloga, zlasti če:
- Naročnik zamuja s plačilom pristojbin več kot 30 dni
- Plovilo kaže nevarno stanje, ki se kljub opominu ne odpravi
- Naročnik večkrat krši bistvene pogodbene obveznosti

4. V primeru odpovedi brez odpovednega roka s strani skladiščarja je naročnik dolžan prevzeti plovilo v 14 dneh od odpovedi.`,

    dataProtection: `1. Skladiščar zbira in obdeluje osebne podatke naročnika izključno za namen izpolnitve te pogodbe in varstva zakonitih interesov v okviru zakonskih določb (GDPR / Uredba EU 2016/679).

2. Podatkov se ne posreduje tretjim osebam, razen če je to nujno za izpolnitev pogodbe ali zakonsko predpisano.

3. Naročnik ima pravico do dostopa, popravka, izbrisa in omejitve obdelave svojih osebnih podatkov v skladu z GDPR. Prosimo, da zahteve naslovite na: info@alpha-yachting.hr.

4. Osebni podatki se izbrišejo po poteku zakonskih rokov hrambe.`,

    finalProvisions: `1. Ta pogodba je podvržena izključno pravu Republike Hrvaške. V primeru sporov iz te pogodbe je, v obsegu, ki ga zakon dopušča, pristojno sodišče po sedežu skladiščarja.

2. Spremembe in dopolnitve te pogodbe zahtevajo pisno obliko in podpis obeh pogodbenih strank.

3. Če posamezne določbe te pogodbe niso ali postanejo veljavne ali neizvedljive, to ne vpliva na veljavnost preostalih določb. Neveljavna določba se nadomesti z veljavno, ki je najbližja ekonomskemu namenu neveljavne določbe.

4. Pogodbeni stranki priznavata, da sta to pogodbo v celoti prebrali, razumeli in jo podpisali po lastni volji.

5. Ta pogodba se sestavi v dveh enakih izvodih. Vsaka stranka prejme en izvod.`,
  },
};

/**
 * Validate that all required legal text blocks exist for a given language.
 * Returns array of missing section keys (empty = all OK).
 */
export function validateLegalTextCompleteness(language) {
  const text = LEGAL_TEXT[language];
  if (!text) return [`Language "${language}" is not supported.`];
  const missing = [];
  for (const key of REQUIRED_SECTION_KEYS) {
    if (!text[key] || text[key].trim().length < 10) {
      missing.push(key);
    }
  }
  return missing;
}