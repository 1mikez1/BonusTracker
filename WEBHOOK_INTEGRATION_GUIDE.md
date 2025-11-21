# Webhook Integration Guide - Calendly & Google Forms

## 📋 Panoramica

Questo documento descrive l'implementazione del sistema di integrazione webhook per:
- **Calendly**: Prenotazioni appuntamenti onboarding
- **Google Forms**: Invio form di richiesta

Ogni webhook crea/aggiorna automaticamente:
- Cliente (con deduplicazione)
- Request associata
- Tier assignment automatico
- Logging completo

## 🏗️ Architettura

### Componenti

1. **Supabase Edge Functions** (Deno):
   - `calendly-webhook`: Gestisce eventi Calendly
   - `google-forms-webhook`: Gestisce submission Google Forms

2. **Database Functions**:
   - `assign_auto_tier(client_id)`: Assegna tier automaticamente

3. **Database Schema**:
   - `requests` table estesa con:
     - `request_type`: 'onboarding' | 'submitted_form' | 'manual'
     - `webhook_source`: 'calendly' | 'google_forms' | null
     - `webhook_payload`: JSONB con payload originale
     - `email`: Email per matching
   - `request_status` enum esteso con 'scheduled'

## 🔄 Flusso Calendly

### Evento: `invitee.created`

Quando un utente prenota un appuntamento:

1. **Ricezione Webhook**
   ```
   POST /functions/v1/calendly-webhook
   ```

2. **Estrazione Dati**
   - Nome completo → `name`, `surname`
   - Email → `email`
   - Telefono → `contact`
   - Event details → `notes`

3. **Deduplicazione Cliente**
   - Cerca per `email` o `contact`
   - Se trovato → aggiorna con nuovi dati
   - Se non trovato → crea nuovo cliente

4. **Auto-Tier Assignment**
   - Chiama `assign_auto_tier(client_id)`
   - Assegna tier basato su regole business

5. **Creazione Request**
   - `request_type`: 'onboarding'
   - `status`: 'scheduled'
   - `webhook_source`: 'calendly'
   - `webhook_payload`: payload completo

### Esempio Payload Calendly

```json
{
  "event": "invitee.created",
  "payload": {
    "event_type": {
      "uuid": "event-uuid",
      "name": "Onboarding Call",
      "kind": "One-on-One"
    },
    "invitee": {
      "uuid": "invitee-uuid",
      "name": "Mario Rossi",
      "email": "mario.rossi@example.com",
      "text_reminder_number": "+39 123 456 7890",
      "questions_and_answers": [
        {
          "question": "Come ci hai conosciuto?",
          "answer": "Social media"
        }
      ]
    },
    "scheduled_event": {
      "uuid": "scheduled-event-uuid",
      "name": "Onboarding Call",
      "start_time": "2025-01-20T10:00:00Z",
      "end_time": "2025-01-20T10:30:00Z"
    }
  }
}
```

## 🔄 Flusso Google Forms

### Evento: Form Submission

Quando un utente invia un form:

1. **Ricezione Webhook**
   ```
   POST /functions/v1/google-forms-webhook
   ```

2. **Parsing Campi**
   - Estrae campi da `responses` object
   - Mapping flessibile (cerca per keyword)
   - Supporta vari formati di domande

3. **Deduplicazione Cliente**
   - Cerca per `email` o `contact` (telefono)
   - Se trovato → merge dati (aggiorna campi vuoti)
   - Se non trovato → crea nuovo cliente

4. **Auto-Tier Assignment**
   - Chiama `assign_auto_tier(client_id)`
   - Assegna tier basato su regole business

5. **Creazione Request**
   - `request_type`: 'submitted_form'
   - `status`: 'new'
   - `webhook_source`: 'google_forms'
   - `webhook_payload`: payload completo
   - `requested_apps_raw`: app richieste (se presente)

### Esempio Payload Google Forms

```json
{
  "formId": "form-123",
  "formName": "Richiesta Bonus",
  "timestamp": "2025-01-20T10:00:00Z",
  "responses": {
    "question-1": {
      "question": "Nome e Cognome",
      "answer": "Mario Rossi"
    },
    "question-2": {
      "question": "Email",
      "answer": "mario.rossi@example.com"
    },
    "question-3": {
      "question": "Telefono",
      "answer": "+39 123 456 7890"
    },
    "question-4": {
      "question": "Quali app ti interessano?",
      "answer": "Revolut, BBVA, Kraken"
    }
  }
}
```

## 🔍 Deduplicazione Cliente

### Strategia

1. **Prima ricerca**: Per `email` (se presente)
2. **Seconda ricerca**: Per `contact` (telefono, se email non trovato)
3. **Merge**: Se trovato, aggiorna solo campi vuoti
4. **Creazione**: Se non trovato, crea nuovo cliente

### Logica Merge

```typescript
if (existingClient) {
  // Merge: aggiorna solo campi vuoti
  if (email && !existingClient.email) updateData.email = email;
  if (phone && !existingClient.contact) updateData.contact = phone;
  if (lastName && !existingClient.surname) updateData.surname = lastName;
  
  // Name mismatch: log ma non aggiorna (mantiene esistente)
  if (firstName !== existingClient.name) {
    log('warn', 'Name mismatch');
  }
}
```

## 🎯 Auto-Tier Assignment

### Regole Business

La funzione `assign_auto_tier(client_id)` assegna tier basato su:

1. **Trusted Client** → `Tier 1`
2. **Completion Rate >= 80%** + **>= 3 apps** → `Tier 1`
3. **Completion Rate >= 50%** → `Tier 2`
4. **Completion Rate < 50%** → `20IQ`
5. **Nuovo Cliente** (nessun app) → `Tier 2` (default)

### Completion Rate

```
completion_rate = (completed_apps / total_apps) * 100
```

Dove:
- `completed_apps`: `client_apps` con `status IN ('completed', 'paid')`
- `total_apps`: Tutti i `client_apps` del cliente

## 📊 Logging

### Formato Log

Ogni webhook logga:
- Timestamp
- Level (info, warn, error)
- Message
- Data (opzionale)

### Esempio Log

```
[2025-01-20T10:00:00Z] [INFO] Received Calendly webhook
[2025-01-20T10:00:00Z] [INFO] Processing Calendly booking { name: "Mario Rossi", email: "mario@example.com" }
[2025-01-20T10:00:00Z] [INFO] Found existing client { clientId: "uuid-here", name: "Mario" }
[2025-01-20T10:00:00Z] [INFO] Assigned tier to client
[2025-01-20T10:00:00Z] [INFO] Created onboarding request { requestId: "uuid-here" }
```

### Response Logs

I log vengono inclusi nella response (ultimi 10):

```json
{
  "success": true,
  "clientId": "uuid",
  "clientCreated": false,
  "requestId": "uuid",
  "logs": [...]
}
```

## 🚀 Setup

### 1. Applicare Migrations

```bash
# Applicare migration 0024 (webhook support)
psql -f supabase/migrations/0024_add_webhook_support.sql

# Applicare migration 0025 (auto-tier function)
psql -f supabase/migrations/0025_add_auto_tier_function.sql
```

### 2. Deploy Edge Functions

```bash
# Deploy Calendly webhook
supabase functions deploy calendly-webhook

# Deploy Google Forms webhook
supabase functions deploy google-forms-webhook
```

### 3. Configurare Webhook URLs

#### Calendly

1. Vai a Calendly → Settings → Integrations → Webhooks
2. Aggiungi webhook:
   - URL: `https://{project-ref}.supabase.co/functions/v1/calendly-webhook`
   - Events: `invitee.created`
   - Secret: (opzionale, per validazione)

#### Google Forms

1. Vai a Google Apps Script
2. Crea script che invia POST a:
   - URL: `https://{project-ref}.supabase.co/functions/v1/google-forms-webhook`
   - Trigger: On form submit

### 4. Environment Variables

Le Edge Functions usano:
- `SUPABASE_URL`: Auto-iniettato da Supabase
- `SUPABASE_SERVICE_ROLE_KEY`: Auto-iniettato da Supabase

## 🧪 Testing

### Test Calendly Webhook

```bash
curl -X POST https://{project-ref}.supabase.co/functions/v1/calendly-webhook \
  -H "Authorization: Bearer {anon-key}" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "invitee.created",
    "payload": {
      "event_type": {
        "uuid": "test-event",
        "name": "Test Event",
        "kind": "One-on-One"
      },
      "invitee": {
        "uuid": "test-invitee",
        "name": "Test User",
        "email": "test@example.com",
        "text_reminder_number": "+39 123 456 7890"
      },
      "scheduled_event": {
        "uuid": "test-scheduled",
        "name": "Test Event",
        "start_time": "2025-01-20T10:00:00Z",
        "end_time": "2025-01-20T10:30:00Z"
      }
    }
  }'
```

### Test Google Forms Webhook

```bash
curl -X POST https://{project-ref}.supabase.co/functions/v1/google-forms-webhook \
  -H "Authorization: Bearer {anon-key}" \
  -H "Content-Type: application/json" \
  -d '{
    "formId": "test-form",
    "formName": "Test Form",
    "timestamp": "2025-01-20T10:00:00Z",
    "responses": {
      "q1": {
        "question": "Nome e Cognome",
        "answer": "Test User"
      },
      "q2": {
        "question": "Email",
        "answer": "test@example.com"
      }
    }
  }'
```

## ✅ Verifica

### Query di Verifica

```sql
-- Verificare requests create da webhook
SELECT 
  id,
  name,
  request_type,
  status,
  webhook_source,
  created_at
FROM requests
WHERE webhook_source IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;

-- Verificare clienti con tier assegnato automaticamente
SELECT 
  c.id,
  c.name,
  c.email,
  c.contact,
  t.name AS tier_name,
  c.created_at
FROM clients c
LEFT JOIN tiers t ON t.id = c.tier_id
WHERE c.tier_id IS NOT NULL
ORDER BY c.created_at DESC
LIMIT 10;

-- Verificare deduplicazione (clienti con stesso email/contact)
SELECT 
  email,
  contact,
  COUNT(*) AS count
FROM clients
WHERE email IS NOT NULL OR contact IS NOT NULL
GROUP BY email, contact
HAVING COUNT(*) > 1;
```

## 🔒 Sicurezza

### Validazione Webhook

1. **Calendly**: Usa signature validation (opzionale)
2. **Google Forms**: Usa secret token (opzionale)
3. **Rate Limiting**: Configurato a livello Supabase
4. **CORS**: Abilitato per webhook endpoints

### Best Practices

- Logging completo per audit
- Error handling robusto
- Idempotenza (stesso webhook può essere processato multiple volte)
- Validazione input

## 📝 Customizzazione

### Modificare Auto-Tier Rules

Modifica la funzione `assign_auto_tier` in `0025_add_auto_tier_function.sql`:

```sql
-- Esempio: Aggiungere regola custom
IF client_record.invited_by_client_id IS NOT NULL THEN
    -- Cliente invitato da TOP tier -> Tier 1
    IF EXISTS (
        SELECT 1 FROM clients c
        JOIN tiers t ON t.id = c.tier_id
        WHERE c.id = client_record.invited_by_client_id
        AND t.name = 'TOP'
    ) THEN
        assigned_tier_id := tier_tier1_id;
    END IF;
END IF;
```

### Modificare Field Mapping (Google Forms)

Modifica `extractField` function in `google-forms-webhook/index.ts`:

```typescript
// Aggiungere nuove keyword
const email = extractField(payload.responses, [
  'email', 
  'mail', 
  'e-mail',
  'indirizzo email', // Nuovo
  'email address'   // Nuovo
]);
```

## 🎯 Prossimi Passi

1. ✅ Deploy Edge Functions
2. ✅ Configurare webhook URLs
3. ⏳ Test end-to-end
4. ⏳ Monitorare logs
5. ⏳ Aggiungere validazione signature (opzionale)
6. ⏳ Implementare retry logic (opzionale)

---

**Versione**: 1.0.0  
**Data**: 2025-01-XX  
**Autore**: AI Development Team

