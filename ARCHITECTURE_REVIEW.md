# BonusHub - Architettura Modulare Completa

## 📋 Indice

1. [Panoramica](#panoramica)
2. [Struttura Modulare](#struttura-modulare)
3. [Schema Database](#schema-database)
4. [Endpoint API](#endpoint-api)
5. [Modelli TypeScript](#modelli-typescript)
6. [Validazione](#validazione)
7. [Performance](#performance)

---

## 🎯 Panoramica

Questa revisione architetturale trasforma BonusHub in un sistema modulare con 7 aree funzionali distinte, ottimizzato per performance (<200ms Supabase REST) e accessibile da mobile e desktop.

### Obiettivi

- ✅ Struttura modulare con 7 aree ben definite
- ✅ Caricamento rapido (<200ms lato Supabase REST)
- ✅ Responsive design (mobile + desktop)
- ✅ Persistenza immediata di tutte le modifiche
- ✅ Nessuna ridondanza o duplicati
- ✅ Relazioni complete tra entità

---

## 🏗️ Struttura Modulare

### 1. Scheda Cliente (`/clients`)

**Scopo**: Profilo completo del cliente con tutte le informazioni correlate.

**Componenti**:
- Informazioni personali (editable)
- Financial Summary (auto-calculated)
- Apps Progress (completati/in corso)
- Apps Started (lista con editing)
- Apps Not Started (solo con promozioni attive)
- Credentials (CRUD)
- Debts (CRUD)
- Payment Links (CRUD)
- Action History (log delle azioni)
- Onboarding Status (stato onboarding per app)

**Dati**:
- `clients` (base)
- `client_apps` (relazioni app)
- `tiers` (tier assignment)
- `referral_link_debts` (debts)
- `credentials` (credenziali)
- `payment_links` (link pagamento)
- `action_logs` (storico azioni) ⭐ NUOVO
- `onboarding_steps` (stato onboarding) ⭐ NUOVO

**Performance**:
- Single query con relationship joins
- Caching con SWR
- Lazy loading per sezioni secondarie

---

### 2. Scheda Bonus/App (`/apps` e `/promotions`)

**Scopo**: Gestione completa di app e promozioni con tracking dettagliato.

**Componenti**:
- Lista App con indicatori attivi
- Dettaglio App con:
  - Promozioni attive/scadute
  - Clienti totali per app
  - Profitto totale
  - Scadenze promozioni ⭐ NUOVO
- Gestione Promozioni (CRUD completo)
- Analytics per app

**Dati**:
- `apps` (base)
- `promotions` (promozioni)
- `client_apps` (statistiche)
- `deadlines` (scadenze) ⭐ NUOVO

**Performance**:
- Aggregazioni calcolate via RPC functions
- Indexes su `app_id`, `is_active`, `end_date`

---

### 3. Storico Azioni/Logs (`/logs` o sezione in ogni pagina)

**Scopo**: Tracciamento completo di tutte le azioni del sistema.

**Componenti**:
- Tabella log con filtri:
  - Per cliente
  - Per app
  - Per tipo azione
  - Per data
- Dettaglio azione con:
  - Utente che ha eseguito
  - Timestamp
  - Valori prima/dopo (per updates)
  - Dettagli completi

**Dati**:
- `action_logs` ⭐ NUOVO

**Performance**:
- Partizionamento per data (opzionale)
- Indexes su `entity_type`, `entity_id`, `created_at`
- Paginazione obbligatoria

---

### 4. Dashboard Globale (`/`)

**Scopo**: Vista panoramica con KPIs e metriche in tempo reale.

**Componenti**:
- Metriche principali:
  - Total Clients
  - Active Apps
  - Total Profit (Our + Client)
  - Pending Requests
  - Active Debts
  - Upcoming Deadlines ⭐ NUOVO
  - Onboarding in Progress ⭐ NUOVO
- Grafici:
  - Profit trend (ultimi 30 giorni)
  - App distribution
  - Status pipeline
- Quick Actions:
  - New Signup
  - New Promotion
  - New Request

**Dati**:
- Aggregazioni da tutte le tabelle
- RPC functions per calcoli complessi

**Performance**:
- Single RPC call per tutte le metriche
- Caching 30 secondi
- Real-time updates via Supabase Realtime

---

### 5. Sistema Scadenze (`/deadlines`)

**Scopo**: Gestione centralizzata di tutte le scadenze (promozioni, bonus, pagamenti).

**Componenti**:
- Calendario scadenze
- Lista scadenze con filtri:
  - Tipo (promotion, bonus, payment)
  - Stato (upcoming, due, overdue)
  - App
  - Cliente
- Notifiche automatiche (future)

**Dati**:
- `deadlines` ⭐ NUOVO
- `promotions` (end_date)
- `client_apps` (completed_at, freeze_days)

**Performance**:
- Indexes su `deadline_date`, `status`, `entity_type`
- Query ottimizzate per range date

---

### 6. Sezione Onboarding (`/onboarding`)

**Scopo**: Gestione del processo di onboarding per ogni cliente-app.

**Componenti**:
- Lista onboarding in corso
- Dettaglio onboarding con:
  - Step completati/incompleti
  - Message templates per step
  - Progress bar
  - Next actions
- Template onboarding per app

**Dati**:
- `onboarding_steps` ⭐ NUOVO
- `client_apps.completed_steps` (già esistente)
- `message_templates` (templates per step)

**Performance**:
- Single query con joins
- Caching step templates

---

### 7. Sezione Profitto (`/profit`)

**Scopo**: Analisi dettagliata dei profitti (clienti e interni).

**Componenti**:
- Profit Summary:
  - Total Client Profit
  - Total Internal Profit
  - Net Profit
  - Per App breakdown
  - Per Cliente breakdown
  - Per Periodo (giornaliero/settimanale/mensile)
- Grafici:
  - Profit trend
  - App comparison
  - Client ranking
- Export dati (CSV/Excel)

**Dati**:
- `client_apps` (profit_client, profit_us)
- `referral_link_debts` (debts)
- Aggregazioni calcolate

**Performance**:
- RPC functions per aggregazioni
- Materialized views per report complessi (opzionale)

---

## 🗄️ Schema Database

### Tabelle Esistenti (da mantenere)

- `tiers`
- `clients`
- `apps`
- `promotions`
- `referral_links`
- `referral_link_debts`
- `client_apps`
- `requests`
- `credentials`
- `payment_links`
- `slots`
- `message_templates`

### Nuove Tabelle

#### 1. `action_logs` ⭐

Traccia tutte le azioni del sistema.

```sql
CREATE TABLE public.action_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id), -- Utente che ha eseguito l'azione
    action_type text NOT NULL, -- 'create', 'update', 'delete', 'status_change', etc.
    entity_type text NOT NULL, -- 'client', 'client_app', 'promotion', etc.
    entity_id uuid NOT NULL, -- ID dell'entità modificata
    old_values jsonb, -- Valori prima della modifica (per updates)
    new_values jsonb, -- Valori dopo la modifica
    description text, -- Descrizione leggibile dell'azione
    metadata jsonb, -- Dati aggiuntivi (IP, user agent, etc.)
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes per performance
CREATE INDEX idx_action_logs_entity ON public.action_logs(entity_type, entity_id);
CREATE INDEX idx_action_logs_created_at ON public.action_logs(created_at DESC);
CREATE INDEX idx_action_logs_user_id ON public.action_logs(user_id);
CREATE INDEX idx_action_logs_action_type ON public.action_logs(action_type);
```

#### 2. `deadlines` ⭐

Gestione centralizzata delle scadenze.

```sql
CREATE TYPE deadline_type AS ENUM (
    'promotion_end',
    'bonus_expiry',
    'payment_due',
    'freeze_end',
    'custom'
);

CREATE TYPE deadline_status AS ENUM (
    'upcoming',
    'due',
    'overdue',
    'completed',
    'cancelled'
);

CREATE TABLE public.deadlines (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    deadline_type deadline_type NOT NULL,
    deadline_date date NOT NULL,
    status deadline_status NOT NULL DEFAULT 'upcoming',
    title text NOT NULL,
    description text,
    -- Relazioni opzionali (una sola può essere non-null)
    promotion_id uuid REFERENCES public.promotions(id) ON DELETE CASCADE,
    client_app_id uuid REFERENCES public.client_apps(id) ON DELETE CASCADE,
    client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
    app_id uuid REFERENCES public.apps(id) ON DELETE CASCADE,
    -- Metadata
    metadata jsonb,
    notified boolean NOT NULL DEFAULT false, -- Per future notifiche
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    -- Constraint: almeno una relazione deve essere non-null
    CONSTRAINT deadlines_has_relation CHECK (
        promotion_id IS NOT NULL OR
        client_app_id IS NOT NULL OR
        client_id IS NOT NULL OR
        app_id IS NOT NULL
    )
);

-- Indexes
CREATE INDEX idx_deadlines_date ON public.deadlines(deadline_date);
CREATE INDEX idx_deadlines_status ON public.deadlines(status);
CREATE INDEX idx_deadlines_type ON public.deadlines(deadline_type);
CREATE INDEX idx_deadlines_promotion ON public.deadlines(promotion_id) WHERE promotion_id IS NOT NULL;
CREATE INDEX idx_deadlines_client_app ON public.deadlines(client_app_id) WHERE client_app_id IS NOT NULL;
```

#### 3. `onboarding_steps` ⭐

Stato dettagliato dell'onboarding per ogni cliente-app.

```sql
CREATE TYPE onboarding_step_status AS ENUM (
    'pending',
    'in_progress',
    'completed',
    'skipped',
    'blocked'
);

CREATE TABLE public.onboarding_steps (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_app_id uuid NOT NULL REFERENCES public.client_apps(id) ON DELETE CASCADE,
    step_name text NOT NULL, -- Nome dello step (es. "registrazione", "deposito")
    step_order integer NOT NULL, -- Ordine dello step (1, 2, 3, ...)
    status onboarding_step_status NOT NULL DEFAULT 'pending',
    message_template_id uuid REFERENCES public.message_templates(id), -- Template associato
    completed_at timestamptz,
    notes text,
    metadata jsonb, -- Dati aggiuntivi per lo step
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    -- Constraint: step unico per client_app
    CONSTRAINT onboarding_steps_unique UNIQUE (client_app_id, step_name)
);

-- Indexes
CREATE INDEX idx_onboarding_steps_client_app ON public.onboarding_steps(client_app_id);
CREATE INDEX idx_onboarding_steps_status ON public.onboarding_steps(status);
CREATE INDEX idx_onboarding_steps_order ON public.onboarding_steps(client_app_id, step_order);
```

### Modifiche a Tabelle Esistenti

#### `client_apps`
- ✅ Già ha `completed_steps` (JSONB) - mantenere
- Aggiungere trigger per creare `onboarding_steps` automaticamente quando si crea un `client_app`

#### `promotions`
- ✅ Già ha `end_date` - mantenere
- Aggiungere trigger per creare `deadlines` automaticamente quando `end_date` è impostato

---

## 🔌 Endpoint API

### Supabase REST (PostgREST)

Tutti gli endpoint seguono la sintassi PostgREST standard:

```typescript
// Esempio: Client profile completo
GET /rest/v1/clients?id=eq.{clientId}&select=*,tiers(*),client_apps(*,apps(*),promotions(*),referral_links(*)),referral_link_debts!creditor_client_id(*),referral_link_debts!debtor_client_id(*),credentials(*,apps(*)),payment_links(*,apps(*)),action_logs!entity_id(*),onboarding_steps(*,message_templates(*)))
```

### RPC Functions (per performance <200ms)

#### 1. `get_client_profile(client_id uuid)`

Restituisce il profilo completo del cliente in una singola chiamata.

```sql
CREATE OR REPLACE FUNCTION public.get_client_profile(client_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    result jsonb;
BEGIN
    SELECT jsonb_build_object(
        'client', row_to_json(c.*),
        'tier', row_to_json(t.*),
        'financial_summary', (
            SELECT jsonb_build_object(
                'total_client_profit', COALESCE(SUM(profit_client), 0),
                'total_internal_profit', COALESCE(SUM(profit_us), 0),
                'total_deposited', COALESCE(SUM(deposit_amount), 0),
                'owed_to_client', (
                    SELECT COALESCE(SUM(amount), 0)
                    FROM referral_link_debts
                    WHERE creditor_client_id = client_id AND status != 'settled'
                ),
                'owed_by_client', (
                    SELECT COALESCE(SUM(amount), 0)
                    FROM referral_link_debts
                    WHERE debtor_client_id = client_id AND status != 'settled'
                )
            )
            FROM client_apps
            WHERE client_id = get_client_profile.client_id
            AND status IN ('completed', 'paid')
        ),
        'apps_started', (
            SELECT jsonb_agg(row_to_json(ca.*))
            FROM client_apps ca
            WHERE ca.client_id = get_client_profile.client_id
        ),
        'onboarding_steps', (
            SELECT jsonb_agg(row_to_json(os.*))
            FROM onboarding_steps os
            JOIN client_apps ca ON ca.id = os.client_app_id
            WHERE ca.client_id = get_client_profile.client_id
        )
    ) INTO result
    FROM clients c
    LEFT JOIN tiers t ON t.id = c.tier_id
    WHERE c.id = get_client_profile.client_id;
    
    RETURN result;
END;
$$;
```

#### 2. `get_dashboard_metrics()`

Restituisce tutte le metriche della dashboard in una singola chiamata.

```sql
CREATE OR REPLACE FUNCTION public.get_dashboard_metrics()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    result jsonb;
BEGIN
    SELECT jsonb_build_object(
        'total_clients', (SELECT COUNT(*) FROM clients),
        'trusted_clients', (SELECT COUNT(*) FROM clients WHERE trusted = true),
        'active_apps', (SELECT COUNT(*) FROM apps WHERE is_active = true),
        'total_profit', (
            SELECT jsonb_build_object(
                'client', COALESCE(SUM(profit_client), 0),
                'internal', COALESCE(SUM(profit_us), 0)
            )
            FROM client_apps
            WHERE status IN ('completed', 'paid')
        ),
        'pending_requests', (SELECT COUNT(*) FROM requests WHERE status = 'new'),
        'active_debts', (
            SELECT COALESCE(SUM(amount), 0)
            FROM referral_link_debts
            WHERE status != 'settled'
        ),
        'upcoming_deadlines', (
            SELECT COUNT(*)
            FROM deadlines
            WHERE deadline_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
            AND status = 'upcoming'
        ),
        'onboarding_in_progress', (
            SELECT COUNT(DISTINCT client_app_id)
            FROM onboarding_steps
            WHERE status = 'in_progress'
        )
    ) INTO result;
    
    RETURN result;
END;
$$;
```

#### 3. `get_profit_analysis(start_date date, end_date date, group_by text)`

Analisi profitti con raggruppamento.

```sql
CREATE OR REPLACE FUNCTION public.get_profit_analysis(
    start_date date DEFAULT CURRENT_DATE - INTERVAL '30 days',
    end_date date DEFAULT CURRENT_DATE,
    group_by text DEFAULT 'day' -- 'day', 'week', 'month', 'app', 'client'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    result jsonb;
BEGIN
    -- Implementazione basata su group_by
    -- Esempio per group_by = 'day'
    IF group_by = 'day' THEN
        SELECT jsonb_agg(
            jsonb_build_object(
                'date', date_trunc('day', created_at)::date,
                'client_profit', SUM(profit_client),
                'internal_profit', SUM(profit_us),
                'total_profit', SUM(profit_client + profit_us)
            )
        ) INTO result
        FROM client_apps
        WHERE status IN ('completed', 'paid')
        AND created_at::date BETWEEN start_date AND end_date
        GROUP BY date_trunc('day', created_at)::date
        ORDER BY date_trunc('day', created_at)::date;
    END IF;
    
    -- Altri casi (week, month, app, client)...
    
    RETURN result;
END;
$$;
```

#### 4. `sync_deadlines_from_promotions()`

Sincronizza scadenze dalle promozioni.

```sql
CREATE OR REPLACE FUNCTION public.sync_deadlines_from_promotions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    created_count integer := 0;
BEGIN
    -- Crea deadlines per promozioni con end_date
    INSERT INTO deadlines (deadline_type, deadline_date, status, title, promotion_id)
    SELECT 
        'promotion_end',
        end_date,
        CASE 
            WHEN end_date < CURRENT_DATE THEN 'overdue'
            WHEN end_date = CURRENT_DATE THEN 'due'
            ELSE 'upcoming'
        END,
        'Scadenza promozione: ' || p.name || ' - ' || a.name,
        p.id
    FROM promotions p
    JOIN apps a ON a.id = p.app_id
    WHERE p.end_date IS NOT NULL
    AND p.is_active = true
    AND NOT EXISTS (
        SELECT 1 FROM deadlines d
        WHERE d.promotion_id = p.id
        AND d.deadline_type = 'promotion_end'
    )
    ON CONFLICT DO NOTHING;
    
    GET DIAGNOSTICS created_count = ROW_COUNT;
    RETURN created_count;
END;
$$;
```

---

## 📦 Modelli TypeScript

### Nuovi Tipi

```typescript
// types/database.ts (aggiunte)

export type ActionLog = {
  id: string;
  user_id: string | null;
  action_type: 'create' | 'update' | 'delete' | 'status_change' | 'custom';
  entity_type: 'client' | 'client_app' | 'promotion' | 'app' | 'referral_link' | 'debt' | 'request';
  entity_id: string;
  old_values: Json | null;
  new_values: Json | null;
  description: string | null;
  metadata: Json | null;
  created_at: string;
};

export type Deadline = {
  id: string;
  deadline_type: 'promotion_end' | 'bonus_expiry' | 'payment_due' | 'freeze_end' | 'custom';
  deadline_date: string; // date
  status: 'upcoming' | 'due' | 'overdue' | 'completed' | 'cancelled';
  title: string;
  description: string | null;
  promotion_id: string | null;
  client_app_id: string | null;
  client_id: string | null;
  app_id: string | null;
  metadata: Json | null;
  notified: boolean;
  created_at: string;
  updated_at: string;
};

export type OnboardingStep = {
  id: string;
  client_app_id: string;
  step_name: string;
  step_order: number;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped' | 'blocked';
  message_template_id: string | null;
  completed_at: string | null;
  notes: string | null;
  metadata: Json | null;
  created_at: string;
  updated_at: string;
};
```

---

## ✅ Validazione

### Constraints SQL

```sql
-- Validazione action_logs
ALTER TABLE public.action_logs
ADD CONSTRAINT action_logs_action_type_check
CHECK (action_type IN ('create', 'update', 'delete', 'status_change', 'custom'));

ALTER TABLE public.action_logs
ADD CONSTRAINT action_logs_entity_type_check
CHECK (entity_type IN ('client', 'client_app', 'promotion', 'app', 'referral_link', 'debt', 'request'));

-- Validazione deadlines
ALTER TABLE public.deadlines
ADD CONSTRAINT deadlines_date_not_past_check
CHECK (deadline_date >= CURRENT_DATE OR status = 'completed');

-- Validazione onboarding_steps
ALTER TABLE public.onboarding_steps
ADD CONSTRAINT onboarding_steps_step_order_positive
CHECK (step_order > 0);

-- Validazione client_apps (miglioramenti)
ALTER TABLE public.client_apps
ADD CONSTRAINT client_apps_profit_positive
CHECK (profit_client >= 0 AND profit_us >= 0);

ALTER TABLE public.client_apps
ADD CONSTRAINT client_apps_deposit_positive
CHECK (deposit_amount >= 0);
```

### Validazione Frontend

Usare Zod per validazione lato client:

```typescript
import { z } from 'zod';

export const clientSchema = z.object({
  name: z.string().min(1, 'Nome obbligatorio'),
  surname: z.string().optional(),
  contact: z.string().optional(),
  email: z.string().email('Email non valida').optional().or(z.literal('')),
  trusted: z.boolean(),
  tier_id: z.string().uuid().optional().nullable(),
});

export const promotionSchema = z.object({
  name: z.string().min(1, 'Nome obbligatorio'),
  client_reward: z.number().min(0, 'Reward non può essere negativo'),
  our_reward: z.number().min(0, 'Reward non può essere negativo'),
  deposit_required: z.number().min(0, 'Deposito non può essere negativo'),
  end_date: z.string().date().optional().nullable(),
});
```

---

## ⚡ Performance

### Obiettivi

- **<200ms** per query Supabase REST
- **<500ms** per RPC functions complesse
- **<100ms** per query semplici

### Strategie

1. **Indexes**: Tutti i foreign keys e campi filtrati
2. **RPC Functions**: Per aggregazioni complesse
3. **Caching**: SWR con revalidation 30s
4. **Pagination**: Obbligatoria per liste >50 items
5. **Lazy Loading**: Per sezioni secondarie
6. **Materialized Views**: Per report complessi (opzionale)

### Monitoring

```sql
-- Query per verificare performance
EXPLAIN ANALYZE
SELECT * FROM clients
WHERE id = '...'
AND ...;
```

---

## 📱 Responsive Design

### Breakpoints

- **Mobile**: < 768px
- **Tablet**: 768px - 1024px
- **Desktop**: > 1024px

### Componenti Responsive

- DataTable: Scroll orizzontale su mobile
- Forms: Stack verticale su mobile
- Dashboard: Grid responsive (1 col mobile, 2-3 col desktop)
- Sidebar: Collapsible su mobile

---

## 🔄 Migrazione

### Ordine di Applicazione

1. Creare nuove tabelle (`action_logs`, `deadlines`, `onboarding_steps`)
2. Creare RPC functions
3. Creare triggers per auto-popolazione
4. Aggiornare TypeScript types
5. Aggiornare frontend components
6. Test end-to-end

### Rollback Plan

Ogni migrazione è reversibile. Le nuove tabelle possono essere droppate senza impatto sulle esistenti.

---

## 📝 Prossimi Passi

1. ✅ Creare migrazioni SQL
2. ✅ Implementare RPC functions
3. ✅ Aggiornare TypeScript types
4. ✅ Creare componenti frontend
5. ✅ Test performance
6. ✅ Documentazione utente

---

**Versione**: 1.0.0  
**Data**: 2025-01-XX  
**Autore**: AI Development Team

