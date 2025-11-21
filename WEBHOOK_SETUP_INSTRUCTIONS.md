# Webhook Setup Instructions - Quick Start

## 🚀 Setup Rapido

### 1. Applicare Migrations

```bash
# Via Supabase Dashboard SQL Editor o CLI
psql -f supabase/migrations/0024_add_webhook_support.sql
psql -f supabase/migrations/0025_add_auto_tier_function.sql
```

### 2. Deploy Edge Functions

```bash
# Assicurati di avere Supabase CLI installato
npm install -g supabase

# Login
supabase login

# Link al progetto
supabase link --project-ref YOUR-PROJECT-REF

# Deploy functions
supabase functions deploy calendly-webhook
supabase functions deploy google-forms-webhook
```

### 3. Ottenere Function URLs

Dopo il deploy, le URLs saranno:
- Calendly: `https://YOUR-PROJECT-REF.supabase.co/functions/v1/calendly-webhook`
- Google Forms: `https://YOUR-PROJECT-REF.supabase.co/functions/v1/google-forms-webhook`

## 📅 Calendly Setup

### Step 1: Configurare Webhook in Calendly

1. Vai a [Calendly Settings](https://calendly.com/integrations/webhooks)
2. Clicca "Add Webhook Subscription"
3. Configura:
   - **URL**: `https://YOUR-PROJECT-REF.supabase.co/functions/v1/calendly-webhook`
   - **Events**: Seleziona `invitee.created`
   - **Signing Key**: (Opzionale, per validazione)
4. Salva

### Step 2: Test

Prenota un appuntamento di test e verifica:
- Cliente creato/aggiornato in database
- Request creata con `request_type = 'onboarding'` e `status = 'scheduled'`
- Tier assegnato automaticamente

## 📝 Google Forms Setup

### Step 1: Creare Google Apps Script

1. Apri il tuo Google Form
2. Clicca "..." (tre punti) → "Script editor"
3. Incolla il codice da `supabase/functions/google-forms-webhook/google-apps-script-example.js`
4. Aggiorna:
   - `SUPABASE_FUNCTION_URL`: URL della tua function
   - `SUPABASE_ANON_KEY`: (Opzionale) Anon key per auth

### Step 2: Creare Trigger

1. Nel Google Apps Script editor:
   - Clicca "Triggers" (orologio icon) → "Add Trigger"
   - **Function**: `onFormSubmit`
   - **Event**: "On form submit"
   - **Failure notification**: "Immediately"
2. Salva

### Step 3: Test

1. Usa la funzione `testWebhook()` per test manuale
2. Invia un form di test e verifica:
   - Cliente creato/aggiornato in database
   - Request creata con `request_type = 'submitted_form'` e `status = 'new'`
   - Tier assegnato automaticamente

## ✅ Verifica Setup

### Query Database

```sql
-- Verificare webhook recenti
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

-- Verificare clienti creati da webhook
SELECT 
  c.id,
  c.name,
  c.email,
  c.contact,
  t.name AS tier,
  c.created_at
FROM clients c
LEFT JOIN tiers t ON t.id = c.tier_id
WHERE c.created_at > NOW() - INTERVAL '1 day'
ORDER BY c.created_at DESC;
```

### Logs Edge Functions

```bash
# Visualizzare logs Calendly
supabase functions logs calendly-webhook

# Visualizzare logs Google Forms
supabase functions logs google-forms-webhook
```

## 🔧 Troubleshooting

### Calendly Webhook non riceve eventi

1. Verifica URL webhook in Calendly settings
2. Controlla logs: `supabase functions logs calendly-webhook`
3. Verifica che l'evento sia `invitee.created`

### Google Forms non invia webhook

1. Verifica trigger in Google Apps Script
2. Controlla logs script: View → Logs
3. Testa manualmente con `testWebhook()`

### Cliente duplicato

1. Verifica deduplicazione funziona (email/contact matching)
2. Controlla che email/contact siano popolati correttamente
3. Query per trovare duplicati:
   ```sql
   SELECT email, contact, COUNT(*) 
   FROM clients 
   WHERE email IS NOT NULL OR contact IS NOT NULL
   GROUP BY email, contact 
   HAVING COUNT(*) > 1;
   ```

### Tier non assegnato

1. Verifica funzione `assign_auto_tier` esiste:
   ```sql
   SELECT proname FROM pg_proc WHERE proname = 'assign_auto_tier';
   ```
2. Testa manualmente:
   ```sql
   SELECT assign_auto_tier('CLIENT-UUID-HERE');
   ```

## 📊 Monitoring

### Dashboard Metrics

Le requests create da webhook appaiono automaticamente in:
- `/requests` page (filtra per `webhook_source`)
- Dashboard homepage (pending requests count)

### Logs

Tutti i webhook loggano:
- Timestamp
- Level (info/warn/error)
- Message
- Data (opzionale)

I log sono inclusi nella response JSON per debugging.

---

**Support**: Per problemi, controlla `WEBHOOK_INTEGRATION_GUIDE.md` per dettagli completi.

