# Performance Audit & Optimierungsprotokoll
**Datum:** 2026-05-05  
**Scope:** Datenbankzugriffe Frontend — keine Datenstrukturänderungen

---

## 📋 Zusammenfassung der Probleme

| Priorität | Seite | Problem | Impact |
|-----------|-------|---------|--------|
| 🔴 Kritisch | `JobDetail` | 9× Full-Table-Scan bei jedem Seitenaufruf | Sehr hoch |
| 🟠 Mittel | `JobDetail` | Sort-Index-Init: N serielle DB-Writes + Re-Fetch | Hoch |
| 🟡 Niedrig | `Jobs` | Form-Daten werden beim Laden geladen, auch wenn Dialog nie öffnet | Mittel |

---

## 🔧 Änderung 1: `pages/JobDetail` — Gezielte Datenbankabfragen

### Vorher (Problem)
```js
// 9 parallele Full-Table-Scans — lädt die GESAMTE Datenbank
const [projectsData, allWOs, allTasks, customers, boats, ...] = await Promise.all([
  base44.entities.Job.list(),           // Alle Jobs ohne Limit
  base44.entities.WorkOrder.list(),      // Alle WorkOrders ohne Limit
  base44.entities.Task.list(),           // Alle Tasks ohne Limit
  base44.entities.TeamOrder.list(),      // Alle TeamOrders ohne Limit
  base44.entities.TimeEntry.list()       // Alle TimeEntries ohne Limit
  // ...
]);
// Dann client-seitiges Filtern
const projectWOs = allWOs.filter(wo => wo.job_id === projectId);
```

### Nachher (Fix)
```js
// Phase 1: Nur das spezifische Projekt + Stammdaten
const [currentProject, allWOs, customers, boats, locations, technicians] = await Promise.all([
  base44.entities.Job.filter({ id: projectId }).then(r => r?.[0]),  // 1 Record
  base44.entities.WorkOrder.filter({ job_id: projectId }),           // Nur dieses Projekt
  base44.entities.Customer.list('-created_date', 200),
  base44.entities.Boat.list('-created_date', 200),
  base44.entities.Location.list(),
  base44.entities.Technician.list(),
]);

// Phase 2: Nur WO-abhängige Daten (nach WO-IDs gefiltert)
const [allTasks, allTeamOrders, allTimeEntries] = await Promise.all([
  base44.entities.Task.filter({ work_order_id: { $in: woIds } }),
  base44.entities.TeamOrder.filter({ work_order_id: { $in: woIds } }),
  base44.entities.TimeEntry.filter({ work_order_id: { $in: woIds } }),
]);
```

### Erwartete Verbesserung
- Vorher: Lädt alle Records aller Entitäten → bei 200+ WOs, 1000+ Tasks: **10–30s**
- Nachher: Lädt nur Daten des einen Projekts → **1–3s**
- Geschätzte Reduktion: **70–90% weniger Daten**

---

## 🔧 Änderung 2: `pages/JobDetail` — Sort-Index-Init ohne Re-Fetch

### Vorher (Problem)
```js
// Seriell: Update → Warten → Re-Fetch (unnötiger extra DB-Call)
await Promise.all(initPromises);
const refreshedWOs = await base44.entities.WorkOrder.filter({ job_id: projectId }); // extra Fetch!
projectWOs = refreshedWOs;
```

### Nachher (Fix)
```js
// Optimistisches Update: sort_index direkt auf lokalen Objekten setzen
// Kein Re-Fetch nötig — lokale Objekte bereits aktuell
const updates = needsIndexInit.map((wo, idx) => {
  wo.sort_index = projectWOs.indexOf(wo) + 1;  // direkte Mutation
  return base44.entities.WorkOrder.update(wo.id, { sort_index: wo.sort_index }).catch(...);
});
await Promise.all(updates);
// Kein Re-Fetch
```

### Erwartete Verbesserung
- Spart 1 extra DB-Anfrage bei erster Seitenöffnung eines Projekts
- Bei N WorkOrders ohne sort_index: eliminiert den kompletten Re-Fetch

---

## 🔧 Änderung 3: `pages/Jobs` — Lazy Form-Daten

### Vorher (Problem)
```js
useEffect(() => {
  loadData().then(() => {
    loadFormData();  // Customers, Boats, Locations, Technicians — immer geladen!
  });
}, []);
```

### Nachher (Fix)
```js
useEffect(() => {
  loadData();
  // Form-Daten werden nur beim Dialog-Öffnen geladen (lazy)
}, []);

// Dialog-Handler lädt bereits lazy:
<Dialog onOpenChange={(open) => { if (open) loadFormData(); ... }}>
```

### Erwartete Verbesserung
- Spart 4 DB-Anfragen bei jedem Seitenladen der Projektliste
- Form-Daten werden nur geladen wenn der "Create/Edit"-Dialog geöffnet wird

---

## ✅ Was NICHT geändert wurde

- Keine Datenstruktur-Änderungen (Entities unverändert)
- Keine Änderungen an Business-Logik
- Kein bestehendes Feature entfernt
- WorkOrder-Sortierung identisch (sort_index Logik unverändert)
- Alle bestehenden State-Variablen erhalten
- `pages/WorkOrders` — bereits gut optimiert (Status-Filter + `$in`-Queries), keine Änderung nötig

---

## 📊 Verbleibende bekannte Slow-Paths (nicht in diesem Sprint)

| Seite | Problem | Empfehlung |
|-------|---------|------------|
| `WorkOrders.loadData` | Wird bei jedem `statusFilter`-Wechsel neu geladen | Caching oder debounce |
| `useLeadV3Data` | 500 Leads bei jedem Mount (30s Cache hilft) | Pagination |
| `BillingReview` | Unbekannt, nicht auditiert | Folge-Sprint |
| `DashboardV2` | Unbekannt, nicht auditiert | Folge-Sprint |

---

## 🧪 Testszenarien

### Test 1: `JobDetail` Ladezeit (Hauptoptimierung)
1. Projekt mit 5+ WorkOrders und 20+ Tasks öffnen
2. Browser-DevTools → Network → Ladezeit messen
3. **Erwartung**: Seite vollständig in < 3s geladen
4. **Vorher**: 10–30s je nach Datenbankgröße

### Test 2: `JobDetail` — WorkOrder-Reihenfolge korrekt
1. Projekt mit manuell geordneten WorkOrders öffnen
2. Reihenfolge per Drag & Drop ändern
3. Seite neu laden
4. **Erwartung**: Reihenfolge bleibt erhalten (sort_index korrekt)

### Test 3: `Jobs` Projektliste — kein Laden der Form-Daten beim Start
1. Network-Tab öffnen, `/Projects` aufrufen
2. Requests beobachten
3. **Erwartung**: Kein Request für Customers/Boats beim initialen Load
4. **Erwartung**: Request erscheint erst beim Klick auf "Create Project"

### Test 4: `Jobs` Form — Korrekte Daten im Formular
1. "Create Project" Dialog öffnen
2. Customer-Dropdown prüfen
3. **Erwartung**: Alle Kunden vorhanden, Dropdown funktioniert

### Test 5: Keine Regressionen
- WorkOrder Status ändern (Quick-Update)
- Task als erledigt markieren
- Projekt bearbeiten und speichern
- WorkOrder löschen