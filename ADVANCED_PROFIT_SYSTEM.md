# Advanced Profit System - Implementation Guide

## 📋 Panoramica

Sistema avanzato per gestire profitti dinamici e personalizzati per cliente, con supporto per:
- Profitto base per app (generico)
- Profitto personalizzato per cliente (override manuale)
- Profitti dinamici basati su condizioni (tier, volume, tempo)
- Storico completo di tutte le variazioni

## 🗄️ Schema Database

### Modifiche a `promotions`

**Nuovi campi**:
- `base_profit_client` (numeric): Profitto base per cliente (default)
- `base_profit_owner` (numeric): Profitto base per owner (default)
- `dynamic_profit_allowed` (boolean): Se `true`, permette override per cliente
- `detailed_conditions` (jsonb): Condizioni dettagliate per calcolo dinamico

**Campi esistenti mantenuti**:
- `client_reward`: Mantenuto per backward compatibility (mappato a `base_profit_client`)
- `our_reward`: Mantenuto per backward compatibility (mappato a `base_profit_owner`)

### Modifiche a `client_apps`

**Nuovi campi**:
- `profit_client_overridden` (numeric): Override manuale profitto cliente
- `profit_owner_overridden` (numeric): Override manuale profitto owner
- `profit_last_update` (timestamptz): Timestamp ultimo aggiornamento profitto
- `changed_by` (uuid): Operatore che ha fatto l'ultima modifica

**Campi esistenti mantenuti**:
- `profit_client`: Mantenuto, ma ora usa override se presente
- `profit_us`: Mantenuto, ma ora usa override se presente

### Nuova tabella `profit_changes`

**Audit log completo**:
- `id` (uuid, PK)
- `client_app_id` (uuid, FK → client_apps)
- `profit_type` (text): 'client', 'owner', 'both'
- `old_client_profit` (numeric)
- `new_client_profit` (numeric)
- `old_owner_profit` (numeric)
- `new_owner_profit` (numeric)
- `changed_by` (uuid, FK → auth.users)
- `change_reason` (text): Motivo del cambiamento
- `metadata` (jsonb): Dati aggiuntivi
- `created_at` (timestamptz)

## 🔄 Logica di Calcolo Profitti

### Priorità (in ordine)

1. **Override Manuale** (`profit_client_overridden` / `profit_owner_overridden`)
   - Se presente, ha la massima priorità
   - Usato per casi speciali (es. Revolut con profitti variabili)

2. **Profitto Dinamico** (se `dynamic_profit_allowed = true`)
   - Applica condizioni da `detailed_conditions`
   - Esempi: moltiplicatori per tier, bonus volume, early bird

3. **Profitto Base** (`base_profit_client` / `base_profit_owner`)
   - Profitto standard per tutti i clienti
   - Fallback se nessun override o dinamico

### Esempio: Revolut con Profitti Variabili

```sql
-- Promotion con dynamic_profit_allowed = true
UPDATE promotions
SET 
  base_profit_client = 50.00,
  base_profit_owner = 50.00,
  dynamic_profit_allowed = true,
  detailed_conditions = '{
    "tier_multipliers": {
      "TOP": 1.2,
      "Tier 1": 1.1,
      "Tier 2": 1.0,
      "20IQ": 0.9
    }
  }'::jsonb
WHERE name = 'Revolut Standard';

-- Cliente TOP tier ottiene: 50.00 * 1.2 = 60.00
-- Cliente Tier 2 ottiene: 50.00 * 1.0 = 50.00
-- Cliente con override manuale: usa override (es. 70.00)
```

## 🔧 Funzione RPC: `get_profit_for_client`

### Utilizzo

```sql
SELECT get_profit_for_client(
  'app-uuid'::uuid,
  'client-uuid'::uuid
);
```

### Response

```json
{
  "client_app_id": "uuid",
  "promotion_id": "uuid",
  "base_client_profit": 50.00,
  "base_owner_profit": 50.00,
  "client_profit": 60.00,
  "owner_profit": 60.00,
  "client_overridden": false,
  "owner_overridden": false,
  "dynamic_allowed": true,
  "source": "dynamic"
}
```

### Source Values

- `"override"`: Usa override manuale
- `"dynamic"`: Usa calcolo dinamico
- `"base"`: Usa profitto base

## 📊 Storico Variazioni

### Trigger Automatico

Ogni volta che `profit_client_overridden`, `profit_owner_overridden`, `profit_client`, o `profit_us` cambiano:
1. Viene creato un record in `profit_changes`
2. Viene aggiornato `profit_last_update`
3. Viene salvato `changed_by` (se disponibile)

### Query Storico

```sql
-- Storico completo per un client_app
SELECT 
  pc.*,
  u.email AS changed_by_email
FROM profit_changes pc
LEFT JOIN auth.users u ON u.id = pc.changed_by
WHERE pc.client_app_id = 'client-app-uuid'
ORDER BY pc.created_at DESC;

-- Ultime 10 variazioni
SELECT 
  ca.id,
  a.name AS app_name,
  c.name || ' ' || COALESCE(c.surname, '') AS client_name,
  pc.old_client_profit,
  pc.new_client_profit,
  pc.change_reason,
  pc.created_at
FROM profit_changes pc
JOIN client_apps ca ON ca.id = pc.client_app_id
JOIN apps a ON a.id = ca.app_id
JOIN clients c ON c.id = ca.client_id
ORDER BY pc.created_at DESC
LIMIT 10;
```

## 🚀 Utilizzo

### 1. Applicare Migration

```bash
psql -f supabase/migrations/0027_add_advanced_profit_system.sql
```

### 2. Importare Promozioni

```bash
npx tsx scripts/import-promotions-with-advanced-profits.ts
```

### 3. Configurare Profitti Dinamici

```sql
-- Esempio: Revolut con tier multipliers
UPDATE promotions
SET 
  dynamic_profit_allowed = true,
  detailed_conditions = '{
    "tier_multipliers": {
      "TOP": 1.2,
      "Tier 1": 1.1,
      "Tier 2": 1.0
    }
  }'::jsonb
WHERE app_id = (SELECT id FROM apps WHERE name = 'Revolut');
```

### 4. Override Manuale per Cliente

```sql
-- Override profitto per un cliente specifico
UPDATE client_apps
SET 
  profit_client_overridden = 70.00,
  profit_owner_overridden = 70.00,
  changed_by = auth.uid() -- UUID dell'operatore
WHERE id = 'client-app-uuid';
```

## 📝 Esempi di `detailed_conditions`

### Tier-Based Multipliers

```json
{
  "tier_multipliers": {
    "TOP": 1.2,
    "Tier 1": 1.1,
    "Tier 2": 1.0,
    "20IQ": 0.9
  }
}
```

### Volume-Based Bonus

```json
{
  "volume": {
    "threshold": 1000.00,
    "bonus": 10.00
  }
}
```

### Time-Based (Early Bird)

```json
{
  "time_based": {
    "early_bird_bonus": 5.00,
    "early_bird_deadline": "2025-02-01"
  }
}
```

### Combinato

```json
{
  "tier_multipliers": {
    "TOP": 1.2,
    "Tier 1": 1.1
  },
  "volume": {
    "threshold": 500.00,
    "bonus": 5.00
  },
  "time_based": {
    "early_bird_bonus": 3.00,
    "early_bird_deadline": "2025-02-01"
  }
}
```

## ✅ Validazione

### Query di Verifica

```sql
-- Promozioni con profitti dinamici
SELECT 
  p.name,
  a.name AS app_name,
  p.base_profit_client,
  p.base_profit_owner,
  p.dynamic_profit_allowed,
  p.detailed_conditions
FROM promotions p
JOIN apps a ON a.id = p.app_id
WHERE p.dynamic_profit_allowed = true;

-- Client apps con override
SELECT 
  ca.id,
  a.name AS app_name,
  c.name || ' ' || COALESCE(c.surname, '') AS client_name,
  ca.profit_client_overridden,
  ca.profit_owner_overridden,
  ca.profit_last_update
FROM client_apps ca
JOIN apps a ON a.id = ca.app_id
JOIN clients c ON c.id = ca.client_id
WHERE ca.profit_client_overridden IS NOT NULL 
   OR ca.profit_owner_overridden IS NOT NULL;

-- Storico variazioni (ultimi 30 giorni)
SELECT COUNT(*) AS total_changes
FROM profit_changes
WHERE created_at >= NOW() - INTERVAL '30 days';
```

## 🔒 Sicurezza

- **RLS**: Abilitato su `profit_changes`
- **Audit Trail**: Tutte le modifiche sono loggate
- **Changed By**: Traccia chi ha fatto la modifica (da `auth.users`)

## 🎯 Use Cases

### Use Case 1: Revolut con Profitti Variabili

```sql
-- 1. Configurare promotion
UPDATE promotions
SET 
  dynamic_profit_allowed = true,
  detailed_conditions = '{"tier_multipliers": {"TOP": 1.2, "Tier 1": 1.1}}'::jsonb
WHERE name = 'Revolut Standard';

-- 2. Cliente TOP ottiene automaticamente 20% in più
-- 3. Se necessario, override manuale per casi speciali
UPDATE client_apps
SET profit_client_overridden = 75.00
WHERE id = 'specific-client-app-uuid';
```

### Use Case 2: Tracking Variazioni

```sql
-- Vedere tutte le variazioni per un cliente
SELECT 
  pc.created_at,
  pc.old_client_profit,
  pc.new_client_profit,
  pc.change_reason,
  u.email AS changed_by
FROM profit_changes pc
LEFT JOIN auth.users u ON u.id = pc.changed_by
WHERE pc.client_app_id IN (
  SELECT id FROM client_apps WHERE client_id = 'client-uuid'
)
ORDER BY pc.created_at DESC;
```

---

**Versione**: 1.0.0  
**Data**: 2025-01-XX  
**Autore**: AI Development Team

