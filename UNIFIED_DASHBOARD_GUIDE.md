# Unified Dashboard - Implementation Guide

## 📋 Panoramica

Dashboard unificata che mostra:
- Tutti i clienti
- Stato di ogni bonus
- Errori e problemi (rilevamento automatico)
- Bonus scaduti
- Mismatch
- Documenti incompleti
- Clienti in errore

## 🔍 Sistema Errori Automatico

### Tipi di Errori Rilevati

1. **Document Rejected** (`document_rejected`)
   - Severity: `critical`
   - Condizione: Request con `status = 'rejected'`

2. **Deadline Missed** (`deadline_missed`)
   - Severity: `critical`
   - Condizione: `deadline_at < NOW()` e `status NOT IN ('completed', 'paid', 'cancelled')`

3. **Referral Incoherent** (`referral_incoherent`)
   - Severity: `warning`
   - Condizione: `referral_link_id` esiste ma link non trovato in database

4. **Missing Steps** (`missing_steps`)
   - Severity: `warning`
   - Condizione: App ha step ma non tutti completati

5. **Note Error** (`note_error`)
   - Severity: `warning`
   - Condizione: Note contiene "errore", "error", "problema", "issue"

6. **Missing Deposit** (`missing_deposit`)
   - Severity: `warning`
   - Condizione: `status = 'registered'` ma `deposited = false`

7. **Status Mismatch** (`status_mismatch`)
   - Severity: `warning`
   - Condizione: `deposited = true` ma `status NOT IN ('deposited', 'waiting_bonus', 'completed', 'paid')`

8. **CSV Import Incoherent** (`csv_import_incoherent`)
   - Severity: `info`
   - Condizione: (Da implementare in base a logica specifica)

9. **Stale Update** (`stale_update`)
   - Severity: `info`
   - Condizione: (Già gestito in fast-check, può essere aggiunto qui)

## 🗄️ Schema Database

### Tabella `client_errors`

**Campi**:
- `id` (uuid, PK)
- `client_id` (uuid, FK → clients)
- `client_app_id` (uuid, FK → client_apps, nullable)
- `error_type` (enum): Tipo di errore
- `severity` (text): 'critical', 'warning', 'info'
- `title` (text): Titolo dell'errore
- `description` (text): Descrizione dettagliata
- `detected_at` (timestamptz): Quando è stato rilevato
- `resolved_at` (timestamptz, nullable): Quando è stato risolto
- `resolved_by` (uuid, FK → auth.users, nullable): Chi ha risolto
- `metadata` (jsonb): Dati aggiuntivi

**Constraint**: `UNIQUE (client_id, client_app_id, error_type, resolved_at)`
- Permette un errore per tipo per client/app, ma solo se non risolto
- Se risolto, può essere rilevato di nuovo

## 🔧 Funzioni SQL

### `detect_client_errors(client_id)`

Rileva tutti gli errori per un cliente specifico.

**Utilizzo**:
```sql
SELECT detect_client_errors('client-uuid');
```

**Ritorna**: Numero di errori rilevati

### `detect_all_client_errors()`

Rileva errori per tutti i clienti (batch processing).

**Utilizzo**:
```sql
SELECT detect_all_client_errors();
```

**Ritorna**: Numero totale di errori rilevati

## 📊 Dashboard UI

### Sezioni

1. **Summary Cards**
   - Critical Errors (rosso)
   - Warnings (arancione)
   - Overdue Deadlines (rosso)
   - Due in 48h (arancione)
   - Pending Requests (grigio)
   - Clients with Errors (rosso)

2. **Filters**
   - All errors
   - Critical only
   - Warnings only

3. **Clients with Errors**
   - Grid di card clienti con errori
   - Badge rosso con count errori
   - Link diretto al profilo cliente
   - Mostra critical/warnings count

4. **Recent Errors**
   - Lista dettagliata degli errori
   - Colore per severity
   - Link al cliente/app
   - Descrizione e metadata

5. **Overdue Deadlines**
   - Lista scadenze scadute
   - Days overdue
   - Link al cliente

### Export CSV

Il pulsante "Export CSV" esporta tutti gli errori filtrati in formato CSV con:
- Client Name
- App
- Error Type
- Severity
- Title
- Description
- Detected At

## 🚀 Utilizzo

### 1. Applicare Migration

```bash
psql -f supabase/migrations/0028_add_error_detection_system.sql
```

### 2. Rilevare Errori

**Manualmente** (dalla dashboard):
- Clicca "Detect Errors"
- Attendi completamento
- Errori appaiono automaticamente

**Automaticamente** (cron job):
```sql
-- Eseguire giornalmente
SELECT detect_all_client_errors();
```

**Per un cliente specifico**:
```sql
SELECT detect_client_errors('client-uuid');
```

### 3. Risolvere Errori

```sql
-- Marcare errore come risolto
UPDATE client_errors
SET 
  resolved_at = NOW(),
  resolved_by = auth.uid()
WHERE id = 'error-uuid';
```

## 📝 Esempi di Errori

### Esempio 1: Deadline Missed

```json
{
  "error_type": "deadline_missed",
  "severity": "critical",
  "title": "Deadline Missed: Revolut",
  "description": "Bonus deadline has passed but status is not completed or paid.",
  "metadata": {
    "deadline_at": "2025-01-15T00:00:00Z",
    "current_status": "waiting_bonus",
    "days_overdue": 5
  }
}
```

### Esempio 2: Missing Steps

```json
{
  "error_type": "missing_steps",
  "severity": "warning",
  "title": "Missing Steps: BBVA",
  "description": "Some onboarding steps are not completed.",
  "metadata": {
    "total_steps": 5,
    "completed_steps": 3
  }
}
```

### Esempio 3: Note Error

```json
{
  "error_type": "note_error",
  "severity": "warning",
  "title": "Error in Notes: Kraken",
  "description": "Notes contain error-related keywords.",
  "metadata": {
    "note_preview": "Cliente ha riscontrato un errore durante..."
  }
}
```

## ✅ Query di Verifica

```sql
-- Errori per cliente
SELECT 
  ce.*,
  c.name || ' ' || COALESCE(c.surname, '') AS client_name
FROM client_errors ce
JOIN clients c ON c.id = ce.client_id
WHERE ce.client_id = 'client-uuid'
AND ce.resolved_at IS NULL
ORDER BY ce.severity, ce.detected_at DESC;

-- Statistiche errori
SELECT 
  severity,
  error_type,
  COUNT(*) AS count
FROM client_errors
WHERE resolved_at IS NULL
GROUP BY severity, error_type
ORDER BY severity, count DESC;

-- Clienti con più errori
SELECT 
  c.id,
  c.name || ' ' || COALESCE(c.surname, '') AS client_name,
  COUNT(*) AS error_count,
  COUNT(*) FILTER (WHERE ce.severity = 'critical') AS critical_count
FROM client_errors ce
JOIN clients c ON c.id = ce.client_id
WHERE ce.resolved_at IS NULL
GROUP BY c.id, c.name, c.surname
ORDER BY critical_count DESC, error_count DESC
LIMIT 10;
```

## 🔄 Automazione

### Cron Job (Edge Function)

Crea un Edge Function che viene chiamata giornalmente:

```typescript
// supabase/functions/daily-error-detection/index.ts
// Chiama detect_all_client_errors() e invia notifiche se necessario
```

### Trigger Automatico

Gli errori possono essere rilevati automaticamente quando:
- Un `client_app` viene aggiornato (trigger su UPDATE)
- Una `request` cambia status (trigger su UPDATE)
- Una deadline passa (cron job giornaliero)

## 🎯 Badge e Counters

### Badge Rossi

I badge rossi appaiono su:
- Summary cards per critical errors e overdue deadlines
- Client cards quando hanno errori critical
- Error items con severity = 'critical'

### Counters

I counters mostrano:
- `x errori`: Numero totale errori (filtrati)
- `y scadenze`: Numero scadenze scadute
- `z pending`: Numero richieste pending

## 📤 Export CSV

Il CSV esportato contiene:
- Client Name
- App Name
- Error Type
- Severity
- Title
- Description
- Detected At

Formato:
```csv
"Client Name","App","Error Type","Severity","Title","Description","Detected At"
"Mario Rossi","Revolut","deadline_missed","critical","Deadline Missed: Revolut","Bonus deadline has passed...","2025-01-20 10:00:00"
```

---

**Versione**: 1.0.0  
**Data**: 2025-01-XX  
**Autore**: AI Development Team

