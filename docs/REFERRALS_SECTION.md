# Sezione Referrals - Documentazione

## Panoramica

La sezione **Referrals** è un sistema completo per tracciare, gestire e analizzare i referral link delle varie app (es. Kraken, Revolut, ecc.). Fornisce:

- Raggruppamento per app e account
- Tracciamento dettagliato degli utilizzi
- Normalizzazione e validazione automatica degli URL
- Statistiche in tempo reale
- Interfaccia intuitiva con filtri e ordinamento

## Architettura

### Database Schema

#### Tabella `referral_links` (estesa)
- `account_name`: Nome dell'account per raggruppare i referral (es. "Luna", "Main Account")
- `code`: Codice referral estratto automaticamente dall'URL
- `status`: Enum (`active`, `inactive`, `redeemed`, `expired`)
- `normalized_url`: URL normalizzato e validato
- `url_validation_status`: Enum (`valid`, `invalid`, `needs_review`, `pending`)
- `last_used_at`: Timestamp dell'ultimo utilizzo

#### Tabella `referral_link_usages` (nuova)
Traccia ogni singolo utilizzo di un referral link:
- `referral_link_id`: Riferimento al referral link
- `client_id`: Cliente che ha usato il link (opzionale)
- `client_app_id`: Riferimento al client_app associato (opzionale)
- `used_at`: Data e ora dell'utilizzo
- `used_by`: Nome dell'operatore che ha registrato l'utilizzo (es. "Luna")
- `redeemed`: Boolean che indica se il bonus è stato riscosso
- `redeemed_at`: Data del riscatto (opzionale)
- `notes`: Note aggiuntive

### Funzioni Database

1. **`normalize_referral_url(url)`**: Normalizza gli URL (trim, http→https, validazione base)
2. **`extract_referral_code(url)`**: Estrae il codice referral da URL comuni
3. **`validate_referral_url(url)`**: Valida l'URL e restituisce lo stato
4. **`update_referral_link_stats(referral_link_id)`**: Aggiorna statistiche automaticamente
5. **Trigger `trg_update_referral_stats`**: Aggiorna automaticamente le stats quando viene aggiunto/modificato un usage

### View `referral_link_stats`
View aggregata che fornisce statistiche pre-calcolate:
- `unique_clients`: Numero di clienti unici
- `redeemed_count`: Numero di utilizzi riscossi
- `unredeemed_count`: Numero di utilizzi non riscossi
- `uses_last_7_days`: Utilizzi negli ultimi 7 giorni
- `uses_last_30_days`: Utilizzi negli ultimi 30 giorni

## Funzionalità

### 1. Filtri e Raggruppamento

- **Filtro per App**: Seleziona un'app specifica (es. "Kraken")
- **Filtro per Account**: Filtra per nome account (es. "Luna")
- **Filtro per Status**: `active`, `inactive`, `redeemed`, `expired`
- **Filtro per Validazione URL**: `valid`, `invalid`, `needs_review`, `pending`

### 2. Tabella Referral

La tabella mostra:
- **Account**: Nome account per raggruppamento
- **Code**: Codice referral
- **Link**: URL (clickable) con badge di validazione se necessario
- **Status**: Badge colorato per lo stato
- **Uses**: Numero di utilizzi (con max se presente)
- **Last Used**: Data ultimo utilizzo
- **Unique Clients**: Numero di clienti unici
- **Redeemed**: Contatore riscossi (visibile nel dettaglio)

**Colori delle righe**:
- Giallo: Mai usato (`current_uses === 0`)
- Blu: Completamente riscosso (`status === 'redeemed'`)
- Rosso: URL invalido (`url_validation_status === 'invalid'`)
- Bianco: Default

### 3. Modal di Dettaglio

Cliccando su una riga si apre un modal con:

**Informazioni Referral**:
- App, Account, Code, Status
- URL con badge di validazione
- Note

**Statistiche**:
- Total Uses
- Unique Clients
- Percentuale Redeemed
- Utilizzi ultimi 7 giorni

**Storia Utilizzi**:
Tabella con tutte le utilizzazioni:
- Data utilizzo
- Operatore (used_by)
- Cliente (link al profilo)
- App associata
- Stato riscatto
- Note

### 4. Normalizzazione URL

Gli URL vengono automaticamente:
- **Normalizzati**: Spazi rimossi, http→https, duplicati rimossi
- **Validati**: Controllo formato, protocollo, caratteri speciali
- **Codici estratti**: Estrazione automatica da pattern comuni:
  - `?ref=CODE` o `&ref=CODE`
  - `?code=CODE` o `&code=CODE`
  - `?referral=CODE` o `&referral=CODE`
  - `/ref/CODE` o `/referral/CODE`

**Stati di validazione**:
- ✅ **valid**: URL corretto
- ❌ **invalid**: URL malformato
- ⚠️ **needs_review**: Richiede revisione (spazi, protocollo mancante)
- ⏳ **pending**: In attesa di validazione

### 5. Contatore Automatico

Il contatore degli utilizzi si aggiorna automaticamente tramite:
- **Trigger database**: Ogni volta che viene aggiunto/modificato un `referral_link_usage`
- **Funzione `update_referral_link_stats`**: Ricalcola:
  - `current_uses`
  - `unique_clients` (conteggio DISTINCT)
  - `last_used_at`
  - `status` (auto-aggiornato se raggiunge `max_uses`)

## Importazione Dati

### Script di Importazione CSV

```bash
npx tsx scripts/import-referrals-from-csv.ts path/to/referrals.csv
```

### Formato CSV

Il CSV deve contenere le seguenti colonne:

| Colonna | Tipo | Obbligatorio | Descrizione |
|---------|------|--------------|-------------|
| `appName` | string | ✅ | Nome dell'app (es. "Kraken") |
| `accountName` | string | ❌ | Nome account per raggruppamento |
| `code` | string | ❌ | Codice referral (estratto automaticamente se mancante) |
| `referralUrl` | string | ✅ | URL del referral link |
| `status` | enum | ❌ | `active`, `inactive`, `redeemed`, `expired` (default: `active`) |
| `usedAt` | ISO date | ❌ | Data utilizzo (formato ISO) |
| `usedBy` | string | ❌ | Nome operatore (es. "Luna") |
| `customerName` | string | ❌ | Nome cliente che ha usato il link |
| `redeemed` | boolean | ❌ | `true`/`false` (default: `false`) |
| `notes` | string | ❌ | Note aggiuntive |

### Esempio CSV

```csv
appName,accountName,code,referralUrl,status,usedAt,usedBy,customerName,redeemed,notes
Kraken,Luna,ABC123,https://kraken.com/ref/ABC123,active,2025-01-15T10:00:00Z,Luna,Mario Rossi,true,First usage
Kraken,Main,XYZ789,https://kraken.com/?ref=XYZ789,active,,,,,
Revolut,Luna,,https://revolut.com/referral/john123,active,2025-01-16T14:30:00Z,Luna,Luigi Bianchi,false,
```

## Utilizzo

### Accesso alla Sezione

1. Naviga su `/referrals` dalla sidebar
2. Seleziona un'app dal filtro (opzionale)
3. Usa i filtri per trovare referral specifici
4. Clicca su una riga per vedere i dettagli completi

### Aggiungere un Nuovo Referral

Attualmente i referral possono essere aggiunti:
- Tramite script di importazione CSV
- Manualmente nel database (o tramite API future)

### Registrare un Utilizzo

Gli utilizzi vengono registrati:
- Automaticamente quando un `client_app` viene creato con un `referral_link_id`
- Manualmente inserendo un record in `referral_link_usages`

## API Future (Da Implementare)

```typescript
// GET /api/referrals
// Query params: appId, accountName, status, validationStatus
GET /api/referrals?appId=xxx&status=active

// GET /api/referrals/:id
GET /api/referrals/123e4567-e89b-12d3-a456-426614174000

// GET /api/referrals/:id/usages
GET /api/referrals/123e4567-e89b-12d3-a456-426614174000/usages

// POST /api/referrals
POST /api/referrals
Body: { appId, accountName, url, code?, status?, notes? }

// PUT /api/referrals/:id
PUT /api/referrals/123e4567-e89b-12d3-a456-426614174000
Body: { accountName?, code?, status?, notes? }

// POST /api/referrals/:id/usages
POST /api/referrals/123e4567-e89b-12d3-a456-426614174000/usages
Body: { clientId?, usedBy?, redeemed?, notes? }
```

## Migrazione

Per applicare la migrazione:

```bash
# Se usi Supabase CLI
supabase migration up

# Oppure applica manualmente il file:
# supabase/migrations/0033_enhance_referral_tracking.sql
```

La migrazione:
1. Aggiunge le nuove colonne a `referral_links`
2. Crea la tabella `referral_link_usages`
3. Crea le funzioni di normalizzazione e validazione
4. Crea il trigger per aggiornamento automatico
5. Crea la view `referral_link_stats`
6. Normalizza gli URL esistenti

## Note Tecniche

- **Performance**: Gli indici sono ottimizzati per query frequenti su `account_name`, `code`, `status`, `used_at`
- **RLS**: La tabella `referral_link_usages` ha RLS abilitato (solo utenti autenticati)
- **Validazione**: La validazione URL è eseguita lato database per consistenza
- **Statistiche**: Le statistiche sono calcolate on-demand, non cached (per dati sempre aggiornati)

## Troubleshooting

### URL non vengono normalizzati
- Verifica che la migrazione sia stata applicata
- Controlla i log del database per errori nella funzione `normalize_referral_url`

### Contatori non si aggiornano
- Verifica che il trigger `trg_update_referral_stats` sia attivo
- Esegui manualmente: `SELECT update_referral_link_stats('referral-link-id')`

### Importazione CSV fallisce
- Verifica che i nomi delle app nel CSV corrispondano esattamente a quelli nel database
- Controlla il formato delle date (ISO 8601)
- Verifica che le colonne obbligatorie siano presenti


