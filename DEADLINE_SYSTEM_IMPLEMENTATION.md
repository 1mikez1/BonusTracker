# Deadline System - Implementation Guide

## 📋 Panoramica

Sistema completo per tracciare e gestire le scadenze dei bonus con:
- Calcolo automatico delle deadline
- Pagina scadenze dedicata
- Alert visivi
- Fast-check giornaliero
- Aggiornamenti in real-time

## 🗄️ Schema Database

### Modifiche a `apps`

**Nuovo campo**:
- `deadline_days` (integer, default 0): Numero di giorni dalla data di inizio alla scadenza

### Modifiche a `client_apps`

**Nuovi campi**:
- `started_at` (timestamptz): Quando il cliente ha effettivamente iniziato l'app
- `deadline_at` (timestamptz): Scadenza calcolata automaticamente (`started_at + app.deadline_days`)

**Calcolo automatico**:
- Se `started_at` è NULL, usa `created_at`
- Se `deadline_days = 0`, `deadline_at = NULL` (nessuna scadenza)

### Funzioni SQL

#### `calculate_client_app_deadline(client_app_id)`

Calcola e aggiorna `deadline_at` per un `client_app` specifico.

#### `update_all_deadlines()`

Aggiorna tutte le deadline esistenti (utile dopo modifiche a `deadline_days`).

### Trigger Automatico

`trg_calculate_deadline`: Si attiva quando:
- `started_at` cambia
- `app_id` cambia (per ricalcolare con nuovo `deadline_days`)

## 📅 Pagina Scadenze (`/deadlines`)

### Categorie

1. **Overdue** (Rosso)
   - `deadline_at < NOW()`
   - `status NOT IN ('completed', 'paid', 'cancelled')`

2. **Due in 48h** (Arancione)
   - `deadline_at BETWEEN NOW() AND NOW() + 48h`
   - `status NOT IN ('completed', 'paid', 'cancelled')`

3. **In Progress** (Verde)
   - `deadline_at > NOW() + 48h`
   - `status NOT IN ('completed', 'paid', 'cancelled')`

4. **Completed** (Grigio)
   - `status IN ('completed', 'paid')`

### Sorting

1. Scaduti (più vecchi prima)
2. Imminenti (entro 48h)
3. In corso (resto)

### Features

- Filtri per categoria
- Summary cards con count
- Link diretto al profilo cliente
- Visualizzazione giorni rimanenti/overdue

## ⚡ Fast-Check Giornaliero (`/fast-check`)

### Top 5 Problemi

1. **Overdue Deadlines** (Priority 1)
   - Scadenze passate non completate

2. **Due Soon** (Priority 2)
   - Scadenze entro 48h

3. **Stale Updates** (Priority 3)
   - Nessun aggiornamento in 14+ giorni

4. **Missing Deposits** (Priority 4)
   - Status = registered ma deposit = false

5. **Pending Documents** (Priority 5)
   - Requests pending da 7+ giorni

### Edge Function

`daily-fast-check`: Restituisce JSON con top 5 problemi e statistiche.

## 🚀 Utilizzo

### 1. Applicare Migration

```bash
psql -f supabase/migrations/0026_add_deadline_tracking.sql
```

### 2. Configurare Deadline Days per App

```sql
-- Esempio: Revolut ha 30 giorni per completare
UPDATE apps
SET deadline_days = 30
WHERE name = 'Revolut';

-- Esempio: BBVA ha 45 giorni
UPDATE apps
SET deadline_days = 45
WHERE name = 'BBVA';
```

### 3. Impostare started_at

```sql
-- Quando un cliente inizia effettivamente l'app
UPDATE client_apps
SET started_at = NOW()
WHERE id = 'client-app-uuid';

-- La deadline viene calcolata automaticamente dal trigger
```

### 4. Ricalcolare Tutte le Deadline

```sql
-- Dopo modifiche a deadline_days
SELECT update_all_deadlines();
```

## 📊 Query Utili

```sql
-- Scadenze scadute
SELECT 
  ca.id,
  c.name || ' ' || COALESCE(c.surname, '') AS client_name,
  a.name AS app_name,
  ca.deadline_at,
  ca.status,
  EXTRACT(DAY FROM NOW() - ca.deadline_at)::integer AS days_overdue
FROM client_apps ca
JOIN clients c ON c.id = ca.client_id
JOIN apps a ON a.id = ca.app_id
WHERE ca.deadline_at < NOW()
AND ca.status NOT IN ('completed', 'paid', 'cancelled')
ORDER BY ca.deadline_at ASC;

-- Scadenze entro 48h
SELECT 
  ca.id,
  c.name || ' ' || COALESCE(c.surname, '') AS client_name,
  a.name AS app_name,
  ca.deadline_at,
  EXTRACT(HOUR FROM ca.deadline_at - NOW())::integer AS hours_until
FROM client_apps ca
JOIN clients c ON c.id = ca.client_id
JOIN apps a ON a.id = ca.app_id
WHERE ca.deadline_at BETWEEN NOW() AND NOW() + INTERVAL '48 hours'
AND ca.status NOT IN ('completed', 'paid', 'cancelled')
ORDER BY ca.deadline_at ASC;
```

## 🎨 Alert Visivi

### Badge Colori

- **Rosso** (#ef4444): Scaduti, Critical errors
- **Arancione** (#f59e0b): Entro 48h, Warnings
- **Verde** (#10b981): In corso, OK
- **Grigio** (#64748b): Completati

### Counters

I counters mostrano:
- `x errori`: Numero errori totali
- `y scadenze`: Numero scadenze scadute
- `z pending`: Numero richieste pending

## 🔄 Real-Time Updates

Le scadenze vengono aggiornate automaticamente quando:
- `started_at` cambia (trigger)
- `app_id` cambia (trigger)
- `deadline_days` cambia (richiede `update_all_deadlines()`)

---

**Versione**: 1.0.0  
**Data**: 2025-01-XX  
**Autore**: AI Development Team

