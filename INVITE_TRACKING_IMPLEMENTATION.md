# Sistema di Tracciamento Inviti e Flags - Implementazione

## 📋 Panoramica

Questo documento descrive l'implementazione del sistema strutturato per tracciare:
- Codice invito dell'app
- Chi ha invitato (InvitedBy = stringa / uuid)
- Flags (riscrivere, riscrive → booleani)
- Script/azioni effettuate su BH

## 🗄️ Schema Database

### Tabella `clients`

**Campi esistenti** (già presenti):
- `invited_by_client_id` (uuid | null) - UUID del cliente che ha invitato
- `invited_by_name` (text | null) - Nome del cliente che ha invitato (stringa)
- `needs_rewrite` (bool default false) - Flag RISCRIVERE
- `rewrite_j` (bool default false) - Flag esistente (mantenuto per compatibilità)
- `notes` (text | null) - Note purificate

**Campi aggiunti** (migration 0023):
- `rewritten` (bool default false) - Flag RISCRIVE (nuovo campo separato)

### Tabella `referral_links`

**Campi esistenti**:
- `url` (text NOT NULL) - URL del referral link
- `app_id` (uuid) - App collegata
- `owner_client_id` (uuid | null) - Cliente proprietario (usato come `linked_client`)

**Campi aggiunti** (migration 0023):
- `tipo_invito` (enum: 'manuale', 'referral', 'generato') - Tipo di invito

**Note**: 
- `linked_client` = `owner_client_id` (già esistente, mantenuto per backward compatibility)
- `linked_app` = `app_id` (già esistente)

## 🔍 Pattern di Parsing

Lo script `clean-notes-and-extract-flags.ts` riconosce e rimuove i seguenti pattern dalle note:

### 1. InvitedBy Pattern

Varianti riconosciute:
- `InvitedBy: X`
- `InvitedBy : X`
- `[Flags] InvitedBy: X`
- `InvitedBy = X`
- `InvitedBy: X | ...`

**Esempio**:
```
Note originale: "Cliente affidabile. [Flags] InvitedBy: Mario Rossi | RISCRIVERE"
Note pulita: "Cliente affidabile."
invited_by_name: "Mario Rossi"
```

### 2. RISCRIVERE Flag

Varianti riconosciute:
- `RISCRIVERE`
- `[Flags] RISCRIVERE`
- `| RISCRIVERE |`
- `RISCRIVERE |`
- `| RISCRIVERE`

**Esempio**:
```
Note originale: "Cliente da contattare | RISCRIVERE | Note aggiuntive"
Note pulita: "Cliente da contattare | Note aggiuntive"
needs_rewrite: true
```

### 3. RISCRIVE Flag

Varianti riconosciute:
- `RISCRIVE`
- `[Flags] RISCRIVE`
- `| RISCRIVE |`
- `RISCRIVE |`
- `| RISCRIVE`

**Esempio**:
```
Note originale: "Cliente completato | RISCRIVE"
Note pulita: "Cliente completato"
rewritten: true
```

### 4. Pattern Combinati

Lo script gestisce anche pattern combinati:
```
"[Flags] InvitedBy: Mario Rossi | RISCRIVERE | RISCRIVE"
```

Viene estratto:
- `invited_by_name`: "Mario Rossi"
- `needs_rewrite`: true
- `rewritten`: true
- `notes`: null (se rimane solo separatori)

## 🚀 Utilizzo

### 1. Applicare Migration

```bash
# Applicare la migration SQL
# (via Supabase Dashboard o CLI)
psql -f supabase/migrations/0023_add_invite_tracking_fields.sql
```

### 2. Test su 100 Record Random

```bash
# Test mode (dry run, no database updates)
npx tsx scripts/clean-notes-and-extract-flags.ts --test --limit=100
```

**Output atteso**:
- Log dettagliato di ogni client processato
- Statistiche di estrazione
- Nessuna modifica al database

### 3. Esecuzione Completa

```bash
# Processa tutti i clienti con note
npx tsx scripts/clean-notes-and-extract-flags.ts
```

**Output atteso**:
- Log completo salvato in `logs/clean-notes-YYYY-MM-DDTHH-MM-SS.log`
- Statistiche finali
- Database aggiornato

### 4. Processare Solo N Record

```bash
# Processa solo 50 record random
npx tsx scripts/clean-notes-and-extract-flags.ts --limit=50
```

## 📊 Logging

Tutte le operazioni sono loggate in:
- **Console**: Output in tempo reale
- **File log**: `logs/clean-notes-{timestamp}.log`

### Formato Log

```
[2025-01-XX] [INFO] 🚀 Starting notes cleaning and flag extraction...
[2025-01-XX] [INFO]    Mode: TEST (dry run)
[2025-01-XX] [INFO]    Limit: 100
[2025-01-XX] [INFO] 
[2025-01-XX] [INFO] 📋 Step 1: Fetching clients...
[2025-01-XX] [INFO]    ✓ Fetched 188 clients with notes
[2025-01-XX] [INFO]    ✓ Sampling 100 random clients
[2025-01-XX] [INFO] 
[2025-01-XX] [INFO] 🔄 Step 2: Processing 100 clients...
[2025-01-XX] [INFO] 
[2025-01-XX] [INFO]    Client: Mario Rossi (uuid-here)
[2025-01-XX] [INFO]       InvitedBy: null → Mario Rossi
[2025-01-XX] [INFO]       needs_rewrite: false → true
[2025-01-XX] [INFO]       notes: "[Flags] InvitedBy: Mario Rossi | RISCRIVERE" → null
[2025-01-XX] [INFO] 
[2025-01-XX] [INFO] 📊 Step 3: Summary...
[2025-01-XX] [INFO]    ✓ Processed: 100
[2025-01-XX] [INFO]    ✓ Updated: 45
[2025-01-XX] [INFO]    ⚠ Skipped (no changes): 55
[2025-01-XX] [INFO]    ❌ Errors: 0
[2025-01-XX] [INFO] 
[2025-01-XX] [INFO]    📈 Extracted Flags:
[2025-01-XX] [INFO]       - InvitedBy names: 30
[2025-01-XX] [INFO]       - needs_rewrite flags: 20
[2025-01-XX] [INFO]       - rewritten flags: 15
[2025-01-XX] [INFO]       - Notes cleaned: 40
[2025-01-XX] [INFO]       - Notes emptied: 5
```

## ✅ Criteri di Pulizia

### Regole di Estrazione

1. **InvitedBy**: Estrae il nome dopo `InvitedBy:` (case-insensitive)
2. **RISCRIVERE**: Imposta `needs_rewrite = true` se trovato
3. **RISCRIVE**: Imposta `rewritten = true` se trovato
4. **Pulizia Note**: Rimuove tutti i pattern trovati e separatori residui

### Regole di Pulizia Note

1. Rimuove pattern `[Flags]`
2. Rimuove separatori `|` orfani
3. Rimuove spazi iniziali/finali
4. Se la nota diventa vuota o contiene solo separatori → `NULL`

### Esempi di Trasformazione

#### Esempio 1: Pattern Completo
```
Input:
  notes: "[Flags] InvitedBy: Mario Rossi | RISCRIVERE | Cliente affidabile"
  
Output:
  invited_by_name: "Mario Rossi"
  needs_rewrite: true
  rewritten: false
  notes: "Cliente affidabile"
```

#### Esempio 2: Solo Flags
```
Input:
  notes: "RISCRIVERE | RISCRIVE"
  
Output:
  invited_by_name: null
  needs_rewrite: true
  rewritten: true
  notes: null
```

#### Esempio 3: Solo InvitedBy
```
Input:
  notes: "InvitedBy: Luigi Bianchi | Note importanti"
  
Output:
  invited_by_name: "Luigi Bianchi"
  needs_rewrite: false
  rewritten: false
  notes: "Note importanti"
```

#### Esempio 4: Nessun Pattern
```
Input:
  notes: "Cliente da contattare per nuovo bonus"
  
Output:
  invited_by_name: null
  needs_rewrite: false
  rewritten: false
  notes: "Cliente da contattare per nuovo bonus"
```

## 🔄 Idempotenza

Lo script è **idempotente**:
- Può essere eseguito multiple volte senza effetti collaterali
- Salta i record che non hanno cambiamenti
- Non duplica dati già estratti

## 🧪 Test

### Test su 100 Record Random

```bash
# 1. Test mode (dry run)
npx tsx scripts/clean-notes-and-extract-flags.ts --test --limit=100

# 2. Verificare output e log
cat logs/clean-notes-*.log | tail -50

# 3. Se tutto OK, eseguire in produzione
npx tsx scripts/clean-notes-and-extract-flags.ts --limit=100
```

### Verifica Risultati

```sql
-- Verificare clienti con invited_by_name popolato
SELECT id, name, surname, invited_by_name, needs_rewrite, rewritten, notes
FROM clients
WHERE invited_by_name IS NOT NULL
LIMIT 10;

-- Verificare clienti con flags attivi
SELECT id, name, surname, needs_rewrite, rewritten
FROM clients
WHERE needs_rewrite = true OR rewritten = true
LIMIT 10;

-- Verificare note pulite (non dovrebbero contenere pattern)
SELECT id, name, notes
FROM clients
WHERE notes IS NOT NULL
AND (
  notes ILIKE '%InvitedBy%' OR
  notes ILIKE '%RISCRIVERE%' OR
  notes ILIKE '%RISCRIVE%'
)
LIMIT 10;
-- Dovrebbe restituire 0 righe dopo la pulizia
```

## 📝 Note Tecniche

### Compatibilità con Campi Esistenti

- `rewrite_j`: Campo esistente mantenuto per compatibilità
- `rewritten`: Nuovo campo aggiunto per tracciare RISCRIVE
- Se `rewritten` non esiste ancora, lo script usa `rewrite_j` come fallback

### Performance

- Query ottimizzate con indexes
- Processing batch per grandi volumi
- Logging asincrono per non bloccare l'esecuzione

### Sicurezza

- Usa `SUPABASE_SERVICE_ROLE_KEY` (bypassa RLS)
- Test mode per validazione prima della produzione
- Logging completo per audit trail

## 🎯 Prossimi Passi

1. ✅ Applicare migration 0023
2. ✅ Eseguire test su 100 record
3. ⏳ Verificare risultati
4. ⏳ Eseguire su tutti i record
5. ⏳ Aggiornare frontend per mostrare nuovi campi
6. ⏳ Implementare validazione per prevenire pattern nelle note future

---

**Versione**: 1.0.0  
**Data**: 2025-01-XX  
**Autore**: AI Development Team

