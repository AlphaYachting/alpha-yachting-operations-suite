// Mobile app translations (de ↔ en)
// Usage: import { t } from '@/lib/mobileTranslations'; t('key', 'en')

const strings = {
  // ── TeamMobileHome ──
  noTechnicianLinked: { de: 'Kein Techniker-Profil verknüpft', en: 'No technician profile linked' },
  noTechnicianHint: { de: 'Diesem Konto ist noch kein Techniker-Profil zugeordnet. Bitte einen Administrator kontaktieren.', en: 'No technician profile is linked to this account. Please contact an administrator.' },
  tryAgain: { de: 'Erneut versuchen', en: 'Try again' },
  noBoatAssigned: { de: 'Kein Boot zugeordnet', en: 'No boat assigned' },
  overdue: { de: 'Überfällig', en: 'Overdue' },
  today: { de: 'Heute', en: 'Today' },
  next7Days: { de: 'Nächste 7 Tage', en: 'Next 7 Days' },
  later: { de: 'Später', en: 'Later' },
  readyToInvoice: { de: 'Bereit zur Abrechnung', en: 'Ready to Invoice' },
  noOpenWOs: { de: 'Keine offenen Aufträge', en: 'No open work orders' },
  allDoneOrNothing: { de: 'Alles erledigt oder nichts zugeteilt', en: 'All done or nothing assigned' },
  kpiToday: { de: 'Heute', en: 'Today' },
  kpiUpcoming: { de: 'Anstehend', en: 'Upcoming' },
  kpiOpenTasks: { de: 'Offene Tasks', en: 'Open Tasks' },
  offlineCache: { de: 'Offline — Daten aus Cache.', en: 'Offline — data from cache.' },
  capture: { de: 'Capture', en: 'Capture' },
  authenticating: { de: 'Authentifizierung...', en: 'Authenticating...' },
  tasksLabel: { de: 'tasks', en: 'tasks' },
  taskSingular: { de: 'Task', en: 'Task' },
  taskPlural: { de: 'Tasks', en: 'Tasks' },

  // ── QuickCaptureModal ──
  voiceListening: { de: 'Höre zu... sprich jetzt', en: 'Listening... speak now' },
  voiceEnded: { de: 'Aufnahme beendet — weiter tippen oder neu starten', en: 'Voice ended — continue typing or restart' },
  voiceError: { de: 'Sprachfehler — tippen oder erneut versuchen', en: 'Voice error — type or try again' },
  voiceNotSupported: { de: 'Spracheingabe nicht unterstützt', en: 'Voice not supported in this browser' },
  micDenied: { de: 'Mikrofon-Zugriff verweigert', en: 'Microphone access denied' },
  networkError: { de: 'Netzwerkfehler – bitte später versuchen', en: 'Network error – please try later' },
  textVoiceMode: { de: 'Text / Sprache', en: 'Text / Voice' },
  photoMode: { de: 'Foto', en: 'Photo' },
  receiptMode: { de: 'Rechnung', en: 'Invoice' },
  stopRecording: { de: 'Aufnahme stoppen', en: 'Stop recording' },
  startRecording: { de: 'Spracheingabe starten', en: 'Start recording' },
  recordAgain: { de: 'Erneut aufnehmen', en: 'Record again' },
  enterText: { de: 'Bitte zuerst Text eingeben', en: 'Please enter text first' },
  uploadReceipt: { de: 'Bitte zuerst eine Rechnung hochladen', en: 'Please upload an invoice first' },
  processing: { de: 'Verarbeite…', en: 'Processing…' },
  saveToReview: { de: 'In Review ablegen', en: 'Save to Review' },
  analyzeAndCheck: { de: 'Analysieren & Prüfen', en: 'Analyze & Review' },
  receiptPhotoPlaceholder: { de: 'Optionale Notiz zur Rechnung, z.B. "Victron-Rechnung für Blümel, Marina Vrsar"…', en: 'Optional note about invoice, e.g. "Victron invoice for Müller, Marina Vrsar"…' },
  textPlaceholder: { de: 'Was ist passiert? z.B. "Blümel, Hochdruckreiniger in Vrsar gelassen"…', en: 'What happened? e.g. "Left high-pressure cleaner at Müller\'s, Marina Vrsar"…' },
  photoUploadFailed: { de: 'Foto-Upload fehlgeschlagen', en: 'Photo upload failed' },
  receiptUploadFailed: { de: 'Rechnung-Upload fehlgeschlagen', en: 'Invoice upload failed' },
  quickCaptureTitle: { de: 'Quick Capture', en: 'Quick Capture' },
  reviewResult: { de: '— Ergebnis prüfen', en: '— Review Result' },
  parsedResult: { de: 'Geparstes Ergebnis', en: 'Parsed Result' },
  dailyReport: { de: 'Tagesbericht', en: 'Daily Report' },
  visitsLabel: { de: 'Besuche', en: 'Visits' },
  visitSingular: { de: 'Besuch', en: 'Visit' },
  visit: { de: 'Besuch', en: 'Visit' },
  hours: { de: 'Stunden', en: 'Hours' },
  workLabel: { de: 'Arbeit', en: 'Work' },
  whatWasDone: { de: 'Was wurde gemacht?', en: 'What was done?' },
  customerLabel: { de: 'Kunde', en: 'Customer' },
  boatLabel: { de: 'Boot', en: 'Boat' },
  noMatchTap: { de: 'Keine — zum Suchen tippen', en: 'None — tap to search' },
  searchCustomer: { de: 'Kunde suchen...', en: 'Search customer...' },
  searchBoat: { de: 'Boot suchen...', en: 'Search boat...' },
  clearNone: { de: '— Löschen / Keine', en: '— Clear / None' },
  noResults: { de: 'Keine Ergebnisse', en: 'No results' },
  newCustomerBanner: { de: 'Neuen Kunden anlegen', en: 'Create new customer' },
  customerCreated: { de: '✓ Kunde angelegt', en: '✓ Customer created' },
  customerLinked: { de: 'Kunde wurde angelegt und verknüpft.', en: 'Customer created and linked.' },
  nameRequired: { de: 'Name ist erforderlich', en: 'Name is required' },
  customerCreateFailed: { de: 'Fehler beim Anlegen:', en: 'Error creating:' },
  customerCreatedToast: { de: 'Kunde angelegt!', en: 'Customer created!' },
  namePlaceholder: { de: 'Name *', en: 'Name *' },
  phonePlaceholder: { de: 'Telefon', en: 'Phone' },
  emailPlaceholder: { de: 'E-Mail', en: 'Email' },
  boatOptionalPlaceholder: { de: 'Boot (optional)', en: 'Boat (optional)' },
  createNow: { de: 'Kunden jetzt anlegen', en: 'Create customer now' },
  creating: { de: 'Wird angelegt…', en: 'Creating…' },
  editText: { de: 'Text bearbeiten', en: 'Edit text' },
  save: { de: 'Speichern', en: 'Save' },
  saved: { de: 'Einträge gespeichert', en: 'Entries saved' },
  saveFailed: { de: 'Fehler beim Speichern', en: 'Failed to save' },
  linkedTo: { de: 'Verknüpft mit:', en: 'Linked to:' },
  classification: { de: 'Klassifizierung', en: 'Classification' },
  selectType: { de: 'Typ wählen...', en: 'Select type...' },
  suggestedDest: { de: '→ Vorgeschlagenes Ziel:', en: '→ Suggested destination:' },
  aiUnavailable: { de: 'KI nicht verfügbar — Eintrag unklassifiziert gespeichert.', en: 'AI unavailable — entry saved unclassified.' },
  autoDetected: { de: 'Auto-erkannt:', en: 'Auto-detected:' },
  confidence: { de: 'confidence', en: 'confidence' },
  selectBoat: { de: 'Boot wählen (optional)', en: 'Select boat (optional)' },
  noneNotMatched: { de: 'Keine / Nicht erkannt', en: 'None / Not matched' },
  autoBoat: { de: 'Auto:', en: 'Auto:' },
  multipleSignals: { de: '⚡ Mehrere Signale erkannt:', en: '⚡ Multiple signals detected:' },

  // QuickCapture type config
  qcMaterialParts: { de: 'Material / Teile', en: 'Material / Parts' },
  qcToolEquipment: { de: 'Werkzeug / Ausrüstung', en: 'Tool / Equipment' },
  qcTaskCandidate: { de: 'Task-Kandidat', en: 'Task Candidate' },
  qcCustomerRequest: { de: 'Kundenwunsch', en: 'Customer Request' },
  qcProjectIntake: { de: 'Projektaufnahme', en: 'Project Intake' },
  qcInternalNote: { de: 'Interne Notiz', en: 'Internal Note' },

  // QuickCapture photos
  uploadPhotoHint: { de: 'Rechnung / Lieferschein fotografieren', en: 'Take photo of invoice / delivery note' },
  uploadingPhoto: { de: 'Wird hochgeladen…', en: 'Uploading…' },

  // ── TeamWorkOrderDetail ──
  woDetails: { de: 'Arbeitsauftrag Details', en: 'Work Order Details' },
  stopTimer: { de: 'Stop', en: 'Stop' },
  woTimer: { de: 'WO Timer', en: 'WO Timer' },
  trackingFullWO: { de: 'Arbeitszeit läuft', en: 'Tracking work time' },
  woId: { de: 'Arbeitsauftrag ID', en: 'Work Order ID' },
  requirementsList: { de: 'Anforderungen & Packliste', en: 'Requirements & Packing List' },
  locationLabel: { de: 'STANDORT', en: 'LOCATION' },
  openMaps: { de: 'Route öffnen →', en: 'Open Maps →' },
  teamLabel: { de: 'Team', en: 'Team' },
  reopen: { de: 'Wieder öffnen', en: 'Reopen' },
  markDone: { de: 'Erledigt', en: 'Mark Done' },
  notesLabel: { de: 'Notizen:', en: 'Notes:' },
  noTasksYet: { de: 'Noch keine Tasks zugewiesen', en: 'No tasks assigned yet' },
  woDescription: { de: 'Beschreibung', en: 'Description' },
  safetyNotes: { de: 'Sicherheitshinweise', en: 'Safety Notes' },
  docPhotos: { de: 'Dokumentationsfotos', en: 'Documentation Photos' },
  workNotes: { de: 'Arbeitsnotizen', en: 'Work Notes' },
  leaveNote: { de: 'Notiz hinterlassen...', en: 'Leave a note...' },
  addNote: { de: 'Notiz hinzufügen', en: 'Add Note' },
  noNotesYet: { de: 'Noch keine Notizen', en: 'No notes yet' },
  justNow: { de: 'Gerade eben', en: 'Just now' },
  loading: { de: 'Laden...', en: 'Loading...' },
  woNotFound: { de: 'Arbeitsauftrag nicht gefunden', en: 'Work order not found' },
  noRequirements: { de: 'Noch keine Anforderungen', en: 'No requirements added yet' },
  packed: { de: 'Gepackt:', en: 'Packed:' },
  packedButton: { de: 'Gepackt', en: 'Packed' },
  resetButton: { de: 'Reset', en: 'Reset' },

  // ── TeamTaskDetail ──
  taskDetails: { de: 'Task Details', en: 'Task Details' },
  scheduled: { de: 'Geplant', en: 'Scheduled' },
  boatDetails: { de: 'Boot Details', en: 'Boat Details' },
  boatAccess: { de: 'Zugang & Position', en: 'Boat Position & Access' },
  accessDetails: { de: 'Zugangsdetails', en: 'Access Details' },
  boatConditions: { de: 'Boot-Zustand', en: 'Boat Conditions' },
  safetyNotices: { de: 'Wichtige Sicherheitshinweise', en: 'Important Security & Safety Notices' },
  specialRequirements: { de: 'Spezielle Anforderungen:', en: 'Special Requirements:' },
  marinaPhone: { de: 'Marina Tel:', en: 'Marina Phone:' },
  startTask: { de: 'Start', en: 'Start' },
  doneTask: { de: 'Erledigt', en: 'Done' },
  taskNotFound: { de: 'Task nicht gefunden', en: 'Task not found' },
  timeTracking: { de: 'Zeiterfassung', en: 'Time Tracking' },
  currentSession: { de: 'Aktuelle Session', en: 'Current Session' },
  totalLoggedToday: { de: 'Heute gesamt', en: 'Total Logged Today' },
  saveTime: { de: 'Zeit speichern', en: 'Save Time' },

  // ── TeamCalendar ──
  myCalendar: { de: 'Mein Kalender', en: 'My Calendar' },
  calendarToday: { de: 'Heute', en: 'Today' },
  loadingCalendar: { de: 'Kalender wird geladen...', en: 'Loading calendar...' },
  statusColors: { de: 'Status-Farben', en: 'Status Colors' },
  statusScheduled: { de: 'Geplant', en: 'Scheduled' },
  statusInProgress: { de: 'In Arbeit', en: 'In Progress' },
  statusCompleted: { de: 'Erledigt', en: 'Completed' },
  statusWaitingParts: { de: 'Warten auf Teile', en: 'Waiting for Parts' },
  moreLabel: { de: 'mehr', en: 'more' },

  // ── ClockInOutBanner ──
  clockIn: { de: 'Kommen — Einstempeln', en: 'Clock In' },
  clockingIn: { de: 'Wird eingestempelt...', en: 'Clocking in...' },
  viewTimeRecords: { de: 'Zeitaufzeichnungen ansehen →', en: 'View time records →' },
  activeSince: { de: 'Aktiv seit', en: 'Active since' },
  clockOut: { de: 'Gehen — Ausstempeln', en: 'Clock Out' },
  clockingOut: { de: 'Wird ausgestempelt...', en: 'Clocking out...' },
  history: { de: 'Verlauf', en: 'History' },
  clockedInAt: { de: 'Eingestempelt um', en: 'Clocked in at' },
  noGps: { de: 'kein GPS verfügbar', en: 'no GPS available' },
  clockInError: { de: 'Fehler beim Einstempeln', en: 'Clock-in error' },
  clockedOut: { de: 'Ausgestempelt —', en: 'Clocked out —' },
  clockOutError: { de: 'Fehler beim Ausstempeln', en: 'Clock-out error' },
  clockInSuccess: { de: 'Eingestempelt um', en: 'Clocked in at' },

  // ── SyncStatus ──
  youAreOffline: { de: 'Du bist offline', en: 'You\'re offline' },
  changesWillSync: { de: 'Änderungen werden synchronisiert wenn online', en: 'Changes will sync when online' },
  pendingChanges: { de: 'ausstehende Änderungen', en: 'pending changes' },
  readyToSync: { de: 'Bereit zum Sync', en: 'Ready to sync' },
  syncNow: { de: 'Jetzt syncen', en: 'Sync Now' },
  syncing: { de: 'Sync läuft...', en: 'Syncing...' },
  syncResults: { de: 'Sync-Ergebnisse:', en: 'Sync Results:' },
  synced: { de: 'synchronisiert', en: 'synced' },
  failed: { de: 'fehlgeschlagen', en: 'failed' },

  // ── MobileHeaderWithWelcome ──
  tasksHeader: { de: 'tasks', en: 'tasks' },
};

export function t(key, lang = 'de') {
  const entry = strings[key];
  if (!entry) {
    console.warn(`Missing translation key: ${key}`);
    return key; // fallback: return key itself
  }
  return entry[lang] || entry['de'] || key;
}

// QuickCapture LLM prompt — language-aware
export function getQuickCapturePrompt(lang) {
  const systemPrompt = lang === 'en'
    ? `You are an operational classifier for a marine yacht service company (Alpha Yachting).

Parse this field note and extract ALL relevant information:
"___TEXT___"

CLASSIFICATION TYPES:
- material_entry: consumables/parts/materials left at customer
- tool_tracking: company equipment/machines/tools left on site
- task_candidate: work that needs to be done (cleaning, repair, inspection)
- customer_request: customer asked for new service
- project_intake: site visit/inspection with multiple work areas
- internal_note: informational only
- new_customer: user wants to create a new customer record
- daily_report: mechanic describes their work day across multiple boats/customers with hours worked ("was at...", "5 hours...", "then at...")

IMPORTANT daily_report detection: If the text describes multiple visits to different customers/boats with hours worked for each, set entry_type to "daily_report". Extract each visit into the visits array.

Extract: customer_name, boat_name, location, item_names, work_hints, urgency (low/normal/high/urgent), billable, short_summary (1 sentence), suggested_target.
For new_customer: intent_new_customer, new_customer_phone, new_customer_email, new_customer_boat.

For daily_report, fill the visits array. Each visit object has:
- customer_name: e.g. "Müller"
- boat_name: e.g. "Bavaria 38"
- work_description: e.g. "repaired engine" (short)
- hours: number of hours worked (e.g. 5, 2.5). "quarter hour" ≈ 0.25, "half hour" ≈ 0.5, "three-quarter hour" ≈ 0.75.
- location: marina or city if mentioned`
    : `You are an operational classifier for a marine yacht service company (Alpha Yachting).

          Parse this field note and extract ALL relevant information:
          "___TEXT___"

          CLASSIFICATION TYPES:
          - material_entry: consumables/parts/materials left at customer
          - tool_tracking: company equipment/machines/tools left on site
          - task_candidate: work that needs to be done (cleaning, repair, inspection)
          - customer_request: customer asked for new service
          - project_intake: site visit/inspection with multiple work areas
          - internal_note: informational only
          - new_customer: user wants to create a new customer record
          - daily_report: mechanic describes their work day across multiple boats/customers with hours worked ("war heute bei...", "5 Stunden...", "dann bei...")

          IMPORTANT daily_report detection: If the text describes multiple visits to different customers/boats with hours worked for each, set entry_type to "daily_report". Extract each visit into the visits array.

          Extract: customer_name, boat_name, location, item_names, work_hints, urgency (low/normal/high/urgent), billable, short_summary (1 sentence), suggested_target.
          For new_customer: intent_new_customer, new_customer_phone, new_customer_email, new_customer_boat.

          For daily_report, fill the visits array. Each visit object has:
          - customer_name: "Müller" or similar
          - boat_name: "Bavaria 38" or similar
          - work_description: "Motor repariert" or similar (short, in the language of the input)
          - hours: number of hours worked (e.g. 5, 2.5). If "Viertelstunde" ≈ 0.25, "halbe Stunde" ≈ 0.5, "dreiviertel Stunde" ≈ 0.75.
          - location: marina or city if mentioned`;

  return systemPrompt.replace('___TEXT___', '');
}

// Returns speech recognition language code for user language
export function getSpeechLang(lang) {
  return lang === 'en' ? 'en-US' : 'de-DE';
}