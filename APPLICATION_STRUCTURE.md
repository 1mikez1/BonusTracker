# BH Referral & Bonus Management Web App - Complete Application Structure

## Table of Contents

1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [Project Structure](#project-structure)
4. [File System Details](#file-system-details)
5. [Database Schema](#database-schema)
6. [Frontend Architecture](#frontend-architecture)
7. [Components Library](#components-library)
8. [Custom Hooks](#custom-hooks)
9. [Pages & Routes](#pages--routes)
10. [Features & Functionality](#features--functionality)
11. [Data Migration](#data-migration)
12. [Authentication & Security](#authentication--security)
13. [Environment Configuration](#environment-configuration)
14. [Development Workflow](#development-workflow)

---

## Project Overview

**BH Referral & Bonus Management Web App** is a comprehensive internal dashboard application designed to replace a multi-Excel-sheet system for managing referral-based signup flows and bonus farming across multiple financial, trading, and gambling applications.

### Core Purpose

- **Centralize** client management, referral link usage, promotions, debts, credentials, and prewritten guide messages
- **Track** the full lifecycle of each client on each app: requested, registered, deposited, waiting bonus, completed, paid
- **Manage** referral link owners, borrowers, and monetary debts
- **Maintain** a centralized library of message templates to assist clients
- **Support** client tiering (TOP, TIER 1, TIER 2, 20IQ) and trust flags
- **Track** payment URLs (SumUp, Amazon, etc.) and their usage

### Business Domain

The application manages:
- **Clients**: End users performing app registrations and bonuses
- **Apps**: Platforms offering bonuses (REVOLUT, BBVA, ISYBANK, BYBIT, KRAKEN, TRADING212, BUDDYBANK, SISAL, POKERSTARS, etc.)
- **Promotions**: Bonus offers with profitability and conditions
- **Referral Links**: Invite/referral links or codes for apps
- **Debts**: Monetary debts created when using others' referral links
- **Credentials**: Login credentials for accessing apps on behalf of clients
- **Payment Links**: URLs for deposits, payouts, or money movement
- **Message Templates**: Prewritten guide messages for client assistance

---

## Technology Stack

### Frontend
- **Framework**: Next.js 14.2.4 (React 18.3.1)
- **Language**: TypeScript 5.5.3
- **Styling**: CSS-in-JS (inline styles) + global CSS
- **State Management**: React Hooks (useState, useMemo, useEffect)
- **Data Fetching**: SWR 2.2.5 + Supabase JS Client
- **Routing**: Next.js App Router (file-based routing)

### Backend
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **API**: Supabase REST API (PostgREST)
- **Security**: Row Level Security (RLS)
- **Storage**: Supabase Storage (if needed)

### Development Tools
- **Package Manager**: npm
- **Build Tool**: Next.js built-in
- **Type Checking**: TypeScript
- **Linting**: ESLint + Next.js config
- **Migration Scripts**: TypeScript + tsx

### Key Dependencies
```json
{
  "@supabase/supabase-js": "^2.43.5",
  "next": "^14.2.4",
  "react": "^18.3.1",
  "react-dom": "^18.3.1",
  "swr": "^2.2.5",
  "csv-parse": "^5.6.0",
  "tsx": "^4.7.0"
}
```

---

## Project Structure

```
BonusTracker/
├── app/                          # Next.js App Router directory
│   ├── (auth)/                   # Authentication route group
│   │   └── login/
│   │       └── page.tsx          # Login page
│   ├── (dashboard)/              # Dashboard route group (protected)
│   │   ├── layout.tsx            # Dashboard layout with auth guard
│   │   ├── apps/
│   │   │   └── page.tsx          # Apps list page
│   │   ├── clients/
│   │   │   ├── page.tsx         # Clients list page
│   │   │   └── [id]/
│   │   │       └── page.tsx     # Client detail/profile page
│   │   ├── debts/
│   │   │   └── page.tsx         # Debts management page
│   │   ├── message-templates/
│   │   │   └── page.tsx         # Message templates library
│   │   ├── payment-links/
│   │   │   └── page.tsx         # Payment links page
│   │   ├── pipeline/
│   │   │   └── page.tsx         # Kanban board (pipeline view)
│   │   ├── promotions/
│   │   │   └── page.tsx         # Promotions management page
│   │   ├── referral-links/
│   │   │   └── page.tsx         # Referral links page
│   │   ├── requests/
│   │   │   └── page.tsx         # Requests inbox (Google Form)
│   │   └── slots/
│   │       └── page.tsx         # Slots RTP page
│   ├── globals.css              # Global styles
│   ├── layout.tsx               # Root layout
│   └── page.tsx                 # Homepage/dashboard
├── components/                   # Reusable UI components
│   ├── ConfirmationModal.tsx    # Confirmation dialog component
│   ├── DataTable.tsx            # Generic data table component
│   ├── EmptyState.tsx            # Empty state component
│   ├── EnvWarning.tsx            # Environment warning component
│   ├── ErrorMessage.tsx         # Error message component
│   ├── FiltersBar.tsx            # Filter bar component
│   ├── InlineList.tsx           # Inline list component
│   ├── LoadingSpinner.tsx       # Loading spinner component
│   ├── MetricCard.tsx            # Metric card component
│   ├── Pagination.tsx           # Pagination component
│   ├── SectionHeader.tsx        # Section header component
│   ├── Sidebar.tsx              # Navigation sidebar
│   └── StatusBadge.tsx          # Status badge component
├── lib/                          # Utility libraries and hooks
│   ├── auth.ts                  # Authentication hook (useAuth)
│   ├── demoData.ts              # Demo data for offline mode
│   ├── supabaseClient.ts        # Supabase client initialization
│   ├── useSupabaseData.ts       # Data fetching hook with SWR
│   └── useSupabaseMutations.ts  # Mutation hook (insert/update/delete)
├── scripts/                      # Migration and utility scripts
│   ├── migrate-all-data.ts      # Complete data migration script
│   ├── migrate-excel-to-supabase.ts  # Legacy migration script
│   └── README.md                # Scripts documentation
├── supabase/                     # Supabase configuration and migrations
│   └── migrations/              # SQL migration files
│       ├── 0001_init_schema.sql              # Initial database schema
│       ├── 0002_add_promotions_fields.sql    # Promotions enhancements
│       ├── 0003_fix_message_templates_structure.sql
│       ├── 0004_cleanup_misclassified_templates.sql
│       ├── 0005_remove_revolut_other_onboard.sql
│       ├── 0006_add_step_order_to_message_templates.sql
│       ├── 0007_fix_apps_and_message_templates.sql
│       ├── 0008_cleanup_duplicate_message_templates.sql
│       └── 0009_reset_message_templates.sql
├── types/                        # TypeScript type definitions
│   └── database.ts               # Supabase database types
├── Data/                         # CSV data files for migration
│   ├── Guide app - Guide.csv
│   ├── New - BH/
│   │   ├── New - BH - CLIENTI.csv
│   │   ├── New - BH - Inviti.csv
│   │   ├── New - BH - Link_pagamenti.csv
│   │   ├── New - BH - Lista Bybit_kraken.csv
│   │   ├── New - BH - Mail.csv
│   │   ├── New - BH - MODULO.csv
│   │   ├── New - BH - Promozioni.csv
│   │   └── New - BH - TIER CLIENTI.csv
│   └── New - J/
│       ├── NEW - J - BBVA.csv
│       ├── NEW - J - BUDDYBANK.csv
│       ├── NEW - J - BYBIT.csv
│       ├── NEW - J - Inviti.csv
│       ├── NEW - J - ISYBANK.csv
│       ├── NEW - J - KRAKEN.csv
│       ├── NEW - J - POKERSTARS.csv
│       ├── NEW - J - REVOLUT.csv
│       ├── NEW - J - RTP slot sisal.csv
│       ├── NEW - J - SISAL.csv
│       └── NEW - J - TRADING212.csv
├── .env.local                    # Environment variables (not in git)
├── next.config.mjs               # Next.js configuration
├── package.json                  # Dependencies and scripts
├── tsconfig.json                 # TypeScript configuration
├── next-env.d.ts                 # Next.js type definitions
└── README                        # Project README
```

---

## File System Details

### Root Level Files

#### Configuration Files
- **`package.json`**: Project dependencies, scripts, and metadata
- **`tsconfig.json`**: TypeScript compiler configuration
- **`next.config.mjs`**: Next.js framework configuration
- **`.env.local`**: Environment variables (Supabase credentials)

#### Documentation Files
- **`README`**: Main project documentation
- **`APPLICATION_DEFECTS_ANALYSIS.json`**: Defect analysis document
- **`FIXES_IMPLEMENTED.md`**: List of implemented fixes
- **`IMPLEMENTATION_STATUS.md`**: Current implementation status
- **`MIGRATION_GUIDE.md`**: Data migration guide
- **`QUICK_SETUP.md`**: Quick setup instructions
- **`SETUP_ENVIRONMENT.md`**: Environment setup guide

### App Directory (`app/`)

#### Root Layout (`app/layout.tsx`)
- Root HTML structure
- Global metadata
- Global CSS import
- Provider setup (if needed)

#### Homepage (`app/page.tsx`)
- Main dashboard landing page
- Key metrics display:
  - Total Clients
  - Active Apps
  - Total Profit
  - Pending Requests
  - Active Debts
- Quick navigation links
- Real-time data from Supabase

#### Authentication (`app/(auth)/login/page.tsx`)
- Login form with email/password
- Supabase Auth integration
- Redirect handling after login
- Session management

#### Dashboard Layout (`app/(dashboard)/layout.tsx`)
- Authentication guard
- Sidebar navigation
- Environment warning (if Supabase not configured)
- Loading states
- Redirect to login if not authenticated

### Dashboard Pages

#### 1. Clients Page (`app/(dashboard)/clients/page.tsx`)
**Purpose**: List and manage all clients

**Features**:
- Table view with columns: Name, Tier, Trusted, Total Apps, Total Profit, Invited By, Created At
- Filters: Tier, Trusted status, App, Status
- Search functionality
- Click row to view client detail
- Metrics: Total Clients, Trusted Clients, Clients with Apps

**Data Sources**:
- `clients` table (with `tiers` join)
- `client_apps` table (for aggregations)

#### 2. Client Detail Page (`app/(dashboard)/clients/[id]/page.tsx`)
**Purpose**: Comprehensive client profile view

**Sections**:
1. **Personal Information**
   - Full name, contact, email
   - Trusted status
   - Tier assignment
   - Invited by
   - Joined date
   - **Editable**: Inline edit form for all personal info

2. **Financial Summary** (Auto-calculated)
   - Money Redeemed (total client profit)
   - Total Deposited
   - Our Profit (total internal profit)
   - Owed to Client
   - Owed by Client

3. **Apps Progress**
   - Apps Completed
   - Apps In Progress
   - Total Apps Started
   - Available Apps
   - Apps Not Started

4. **Client Notes**
   - Internal notes section
   - **Editable**: Add/edit notes

5. **Apps Started**
   - List of all `client_apps` for this client
   - Each app shows:
     - App name
     - Status badge
     - Promotion info
     - Referral link
     - Deposit amount
     - Client profit (auto from promotion)
     - Internal profit (auto from promotion)
     - Start date
     - Notes
   - **Editable**: 
     - App status
     - Deposit amount
     - Profits (auto-filled from promotion)
     - Deposited/Finished flags
     - App notes

6. **Available Apps Not Started**
   - Shows only apps with active promotions
   - "View Messages" button linking to message templates
   - Clickable app boxes

7. **Credentials Section**
   - Table of credentials
   - **Actions**: Add, Edit, Delete
   - Password encryption (base64 for MVP)

8. **Debts Section**
   - Table of debts (as creditor or debtor)
   - **Actions**: Add, Edit, Delete
   - Status management

9. **Payment Links Section**
   - Table of payment links
   - **Actions**: Add, Edit, Delete
   - Usage tracking

**Key Features**:
- Automatic profit calculation from promotions
- Real-time financial summary updates
- Full CRUD operations for related records
- Confirmation modals for deletions

#### 3. Apps Page (`app/(dashboard)/apps/page.tsx`)
**Purpose**: List and manage all apps

**Features**:
- Table view with columns: Name, Type, Active Bonus, Promotions, Total Clients, Total Profit
- **Active Bonus Tracker**: Shows if app has active promotions
- **Promotions Display**: Detailed promotion cards with:
  - Active/Expired status
  - Profit type (CASH/VOUCHER)
  - Client reward, Our reward
  - Deposit required, Expense
  - Max invites, Deadline
  - Time to get bonus
- Filters: App type, Active bonus status
- Search functionality
- Metrics: Total Apps, Active Apps, Apps with Active Bonus

#### 4. Promotions Page (`app/(dashboard)/promotions/page.tsx`)
**Purpose**: Manage all promotions

**Features**:
- Table view with all promotion details
- **Inline Editing**: Edit all promotion fields directly in table
- Filters: App, Status (All/Active/Expired)
- Metrics: Total Promotions, Active Promotions, Total Client Reward, Total Our Reward
- Active status calculation based on dates and `is_active` flag

#### 5. Pipeline Page (`app/(dashboard)/pipeline/page.tsx`)
**Purpose**: Kanban board view of client apps by status

**Features**:
- **Columns**: requested, registered, deposited, waiting_bonus, completed, paid, cancelled
- **Drag-and-Drop**: Move cards between columns (updates status)
- **Card Information**:
  - Client name (clickable → profile)
  - App name
  - Deposit amount
  - Status badge
  - Notes
- **Filters**: App filter dropdown
- **Search**: Filter by client name, app name, notes, deposit amount
- Real-time status updates

#### 6. Requests Page (`app/(dashboard)/requests/page.tsx`)
**Purpose**: Inbox for Google Form submissions

**Features**:
- Table view with columns: Requester (full name, clickable if client exists), Contact, Requested Apps, Status, Received, Actions
- **Add Client Profile Button**: Create new client directly from requests page
- **Client Matching**: Automatically finds existing clients by name and contact
- **Status Management**: new, contacted, converted, rejected
- **Convert Action**: Convert request to client and create client_apps
- Filters: Status
- Search functionality

#### 7. Referral Links Page (`app/(dashboard)/referral-links/page.tsx`)
**Purpose**: Manage referral links

**Features**:
- Table view with columns: App, URL, Owner, Current Uses, Max Uses, Active, Notes
- Filters: App, Active status, Owner
- Usage tracking
- Link management

#### 8. Debts Page (`app/(dashboard)/debts/page.tsx`)
**Purpose**: View and manage referral link debts

**Features**:
- Table view with columns: App, Referral Link, Creditor, Debtor, Amount, Status, Created At
- Filters: Status, Creditor, Debtor, App
- Settlement actions
- Debt tracking

#### 9. Payment Links Page (`app/(dashboard)/payment-links/page.tsx`)
**Purpose**: Manage payment URLs

**Features**:
- Table view with columns: Provider, URL, Amount, Purpose, Client, App, Used, Created At, Used At
- Filters: Provider, Used status, App, Client
- Usage tracking
- Link management

#### 10. Slots Page (`app/(dashboard)/slots/page.tsx`)
**Purpose**: List RTP slot data

**Features**:
- Table view with columns: Name, Provider, RTP Percentage, Notes
- Sorting by RTP percentage (descending)
- Slot information display

#### 11. Message Templates Page (`app/(dashboard)/message-templates/page.tsx`)
**Purpose**: Searchable library of prewritten messages

**Features**:
- **App Selection View**: Grid of app boxes (green = active, red = expired)
- **Onboard Section**: Generic templates (Spiegazione + registrazione modulo, etc.)
- **App Templates View**: 
  - Grouped by step
  - Sorted by `step_order`
  - Copy-to-clipboard functionality
  - Template name and content display
- **URL Parameter Support**: Direct linking to specific app templates
- **Active Status**: Determined by active promotions

---

## Components Library

### UI Components (`components/`)

#### 1. `DataTable.tsx`
**Purpose**: Generic, reusable data table component

**Props**:
- `data`: Array of row data
- `columns`: Column definitions with `key`, `header`, and optional `render`
- `onRowClick`: Optional row click handler

**Features**:
- Responsive table layout
- Custom column rendering
- Row click handling
- Styled with inline CSS

#### 2. `LoadingSpinner.tsx`
**Purpose**: Loading indicator component

**Props**:
- `size`: 'small' | 'medium' | 'large'
- `message`: Optional loading message

**Features**:
- CSS keyframe animation
- Multiple sizes
- Optional message display

#### 3. `ErrorMessage.tsx`
**Purpose**: Error display with retry functionality

**Props**:
- `error`: Error object or message
- `onRetry`: Optional retry callback

**Features**:
- Error message display
- Retry button
- User-friendly error formatting

#### 4. `EmptyState.tsx`
**Purpose**: Empty state display

**Props**:
- `title`: Empty state title
- `message`: Empty state message
- `action`: Optional action button

**Features**:
- Contextual empty messages
- Optional action buttons
- Consistent styling

#### 5. `StatusBadge.tsx`
**Purpose**: Status badge component

**Props**:
- `status`: Status string

**Features**:
- Color-coded statuses
- Consistent badge styling
- Status mapping for different entities

#### 6. `SectionHeader.tsx`
**Purpose**: Page section header

**Props**:
- `title`: Section title
- `description`: Optional description

**Features**:
- Consistent header styling
- Optional description text

#### 7. `FiltersBar.tsx`
**Purpose**: Filter bar container

**Features**:
- Flexible filter layout
- Children components (selects, inputs, buttons)
- Responsive design

#### 8. `MetricCard.tsx`
**Purpose**: Metric display card

**Props**:
- `title`: Metric title
- `value`: Metric value
- `icon`: Optional icon
- `trend`: Optional trend indicator

**Features**:
- Consistent metric styling
- Optional icons and trends
- Responsive layout

#### 9. `Sidebar.tsx`
**Purpose**: Navigation sidebar

**Features**:
- Main navigation links
- Active route highlighting
- Responsive design
- Logout functionality

#### 10. `ConfirmationModal.tsx`
**Purpose**: Confirmation dialog

**Props**:
- `isOpen`: Modal visibility
- `title`: Modal title
- `message`: Modal message
- `confirmLabel`: Confirm button text
- `cancelLabel`: Cancel button text
- `onConfirm`: Confirm callback
- `onCancel`: Cancel callback
- `variant`: 'danger' | 'warning' | 'info'

**Features**:
- Custom styling per variant
- Click-outside-to-close
- Accessible modal

#### 11. `Pagination.tsx`
**Purpose**: Pagination component

**Status**: Created but not yet fully implemented

#### 12. `EnvWarning.tsx`
**Purpose**: Environment variable warning

**Features**:
- Warns when Supabase is not configured
- Allows demo mode
- Setup instructions

#### 13. `InlineList.tsx`
**Purpose**: Inline list display

**Features**:
- Compact list rendering
- Custom item rendering

---

## Custom Hooks

### Data Hooks (`lib/`)

#### 1. `useSupabaseData.ts`
**Purpose**: Data fetching hook with SWR integration

**Features**:
- Automatic caching and revalidation
- Relationship joins (PostgREST syntax)
- Advanced filtering (eq, neq, gt, gte, lt, lte, ilike, like, in, is)
- Pagination support (limit, offset)
- Error handling and retry logic
- Loading states
- Demo mode support

**Usage**:
```typescript
const { data, isLoading, error, mutate } = useSupabaseData({
  table: 'clients',
  select: '*, tiers(*)',
  filters: { trusted: { eq: true } },
  order: { column: 'created_at', ascending: false }
});
```

#### 2. `useSupabaseMutations.ts`
**Purpose**: Mutation operations hook

**Features**:
- Insert operations
- Update operations
- Delete operations
- Optimistic updates
- Error handling
- Automatic cache invalidation

**Usage**:
```typescript
const { insert, update, remove } = useSupabaseMutations('clients', undefined, mutateClients);
```

#### 3. `auth.ts` (useAuth hook)
**Purpose**: Authentication state management

**Features**:
- Session checking
- User state
- Loading states
- Error handling

**Usage**:
```typescript
const { user, loading, error } = useAuth();
```

### Client Utilities

#### `supabaseClient.ts`
**Purpose**: Supabase client initialization

**Features**:
- Environment variable handling
- Client singleton pattern
- Demo mode detection
- Error handling for missing config

---

## Database Schema

### Tables Overview

#### 1. `tiers`
Client priority categories (TOP, TIER 1, TIER 2, 20IQ)

**Status**: ✅ Populated with 4 tiers (TOP, Tier 1, Tier 2, 20IQ)

**Columns**:
- `id` (uuid, PK)
- `name` (text, unique, not null) - Values: "TOP", "Tier 1", "Tier 2", "20IQ"
- `priority` (integer, not null) - Values: 1 (TOP), 2 (Tier 1), 3 (Tier 2), 4 (20IQ)
- `notes` (text) - Description of tier characteristics

**Populated Values**:
- TOP (priority 1): "Highest tier clients, ultra reliable, fast, high volume."
- Tier 1 (priority 2): "Very good clients, high reliability and speed."
- Tier 2 (priority 3): "Average clients, normal priority."
- 20IQ (priority 4): "Lowest priority clients (slow, unreliable, problematic)."

#### 2. `clients`
End users/clients performing app registrations

**Columns**:
- `id` (uuid, PK)
- `name` (text, not null)
- `surname` (text)
- `contact` (text)
- `email` (text)
- `trusted` (boolean, not null, default false)
- `tier_id` (uuid, FK → tiers)
- `invited_by_client_id` (uuid, FK → clients)
- `notes` (text)
- `created_at` (timestamptz, not null, default now())

#### 3. `apps`
Platforms offering bonuses

**Columns**:
- `id` (uuid, PK)
- `name` (text, unique, not null)
- `app_type` (text)
- `country` (text)
- `is_active` (boolean, not null, default true)
- `notes` (text)

#### 4. `promotions`
Bonus offers for each app

**Columns**:
- `id` (uuid, PK)
- `app_id` (uuid, FK → apps, not null)
- `name` (text, not null)
- `client_reward` (numeric(12,2), not null, default 0)
- `our_reward` (numeric(12,2), not null, default 0)
- `deposit_required` (numeric(12,2), not null, default 0)
- `freeze_days` (integer)
- `time_to_get_bonus` (text)
- `start_date` (date)
- `end_date` (date)
- `terms_conditions` (text)
- `notes` (text)
- `profit_type` (text) - CASH/VOUCHER
- `expense` (numeric(12,2))
- `max_invites` (integer)
- `is_active` (boolean, not null, default true)

#### 5. `referral_links`
Invite/referral links or codes

**Columns**:
- `id` (uuid, PK)
- `app_id` (uuid, FK → apps, not null)
- `url` (text, not null)
- `owner_client_id` (uuid, FK → clients)
- `max_uses` (integer)
- `current_uses` (integer, not null, default 0)
- `is_active` (boolean, not null, default true)
- `notes` (text)

#### 6. `referral_link_debts`
Debts created when using others' referral links

**Columns**:
- `id` (uuid, PK)
- `referral_link_id` (uuid, FK → referral_links, not null)
- `creditor_client_id` (uuid, FK → clients, not null)
- `debtor_client_id` (uuid, FK → clients)
- `amount` (numeric(12,2), not null)
- `status` (text, not null) - 'open', 'partial', 'settled'
- `description` (text)
- `created_at` (timestamptz, not null, default now())
- `settled_at` (timestamptz)

#### 7. `client_apps`
Join table: each client doing each app

**Columns**:
- `id` (uuid, PK)
- `client_id` (uuid, FK → clients, not null)
- `app_id` (uuid, FK → apps, not null)
- `promotion_id` (uuid, FK → promotions)
- `referral_link_id` (uuid, FK → referral_links)
- `invited_by_client_id` (uuid, FK → clients)
- `status` (text, not null) - 'requested', 'registered', 'deposited', 'waiting_bonus', 'completed', 'paid', 'cancelled'
- `deposited` (boolean, not null, default false)
- `finished` (boolean, not null, default false)
- `deposit_amount` (numeric(12,2))
- `profit_client` (numeric(12,2)) - Auto-filled from promotion
- `profit_us` (numeric(12,2)) - Auto-filled from promotion
- `created_at` (timestamptz, not null, default now())
- `completed_at` (timestamptz)
- `notes` (text)
- **Constraint**: unique (client_id, app_id)

#### 8. `requests`
Incoming requests from Google Form

**Columns**:
- `id` (uuid, PK)
- `external_form_id` (text)
- `client_id` (uuid, FK → clients)
- `name` (text, not null)
- `contact` (text)
- `requested_apps_raw` (text)
- `notes` (text)
- `status` (text, not null) - 'new', 'contacted', 'converted', 'rejected'
- `created_at` (timestamptz, not null, default now())
- `processed_at` (timestamptz)

#### 9. `credentials`
Login credentials for apps

**Columns**:
- `id` (uuid, PK)
- `client_id` (uuid, FK → clients, not null)
- `app_id` (uuid, FK → apps, not null)
- `email` (text, not null)
- `username` (text)
- `password_encrypted` (text, not null) - Base64 encoded (MVP)
- `notes` (text)
- `created_at` (timestamptz, not null, default now())

#### 10. `payment_links`
Payment URLs (SumUp, Amazon, etc.)

**Columns**:
- `id` (uuid, PK)
- `provider` (text, not null)
- `url` (text, not null)
- `amount` (numeric(12,2))
- `purpose` (text)
- `client_id` (uuid, FK → clients)
- `app_id` (uuid, FK → apps)
- `used` (boolean, not null, default false)
- `created_at` (timestamptz, not null, default now())
- `used_at` (timestamptz)

#### 11. `slots`
Slots with RTP (especially for SISAL)

**Columns**:
- `id` (uuid, PK)
- `name` (text, not null)
- `provider` (text)
- `rtp_percentage` (numeric(5,2), not null)
- `notes` (text)

#### 12. `message_templates`
Prefabricated guide messages

**Columns**:
- `id` (uuid, PK)
- `name` (text, not null)
- `app_id` (uuid, FK → apps) - NULL for generic templates
- `step` (text)
- `step_order` (integer) - Order within app
- `language` (text)
- `content` (text, not null)
- `notes` (text)
- **Constraint**: unique (name, COALESCE(app_id::text, 'NULL'))

### Relationships

- `clients.tier_id` → `tiers.id`
- `clients.invited_by_client_id` → `clients.id`
- `promotions.app_id` → `apps.id`
- `referral_links.app_id` → `apps.id`
- `referral_links.owner_client_id` → `clients.id`
- `referral_link_debts.referral_link_id` → `referral_links.id`
- `referral_link_debts.creditor_client_id` → `clients.id`
- `referral_link_debts.debtor_client_id` → `clients.id`
- `client_apps.client_id` → `clients.id`
- `client_apps.app_id` → `apps.id`
- `client_apps.promotion_id` → `promotions.id`
- `client_apps.referral_link_id` → `referral_links.id`
- `client_apps.invited_by_client_id` → `clients.id`
- `requests.client_id` → `clients.id`
- `credentials.client_id` → `clients.id`
- `credentials.app_id` → `apps.id`
- `payment_links.client_id` → `clients.id`
- `payment_links.app_id` → `apps.id`
- `message_templates.app_id` → `apps.id`

---

## Features & Functionality

### Core Features

#### 1. Client Management
- **List View**: Filterable, searchable table of all clients
- **Detail View**: Comprehensive client profile with:
  - Personal information (editable)
  - Financial summary (auto-calculated)
  - Apps progress tracking
  - Related records (credentials, debts, payment links)
  - Full CRUD operations
- **Client Creation**: From requests or manual entry
- **Client Matching**: Automatic matching by name and contact

#### 2. App & Promotion Management
- **Apps List**: View all apps with active bonus tracking
- **Promotions Management**: 
  - Inline editing
  - Active/expired status
  - Profit tracking (client/us)
  - Deadline management
- **Active Bonus Tracker**: Real-time status of promotions

#### 3. Pipeline (Kanban Board)
- **Visual Workflow**: Drag-and-drop status updates
- **Filtering**: By app, search functionality
- **Real-time Updates**: Status changes reflected immediately
- **Quick Navigation**: Click client name to view profile

#### 4. Request Management
- **Inbox**: Google Form submissions
- **Client Matching**: Automatic client detection
- **Conversion**: Convert requests to clients and client_apps
- **Client Creation**: Add new client profiles directly
- **Status Tracking**: new → contacted → converted/rejected

#### 5. Financial Tracking
- **Automatic Profit Calculation**: 
  - Profits auto-filled from promotions when status is 'completed' or 'paid'
  - Manual override available
- **Financial Summary**: 
  - Money Redeemed (client profit)
  - Total Deposited
  - Our Profit (internal profit)
  - Owed to Client
  - Owed by Client
- **Real-time Updates**: Summary updates automatically with changes

#### 6. Message Templates
- **App-based Organization**: Templates grouped by app
- **Onboard Section**: Generic templates
- **Step Ordering**: Templates sorted by step_order
- **Copy Functionality**: One-click copy to clipboard
- **Active Status**: Shows active vs expired apps

#### 7. Referral Link Management
- **Usage Tracking**: Current uses vs max uses
- **Owner Management**: Track link ownership
- **Active Status**: Enable/disable links
- **App Association**: Links tied to specific apps

#### 8. Debt Management
- **Debt Tracking**: Creditor/debtor relationships
- **Status Management**: open, partial, settled
- **Settlement Tracking**: Settlement dates
- **App Association**: Debts linked to referral links and apps

#### 9. Credential Management
- **Secure Storage**: Base64 encryption (MVP)
- **Client Association**: Credentials tied to clients and apps
- **CRUD Operations**: Full create, read, update, delete
- **Password Security**: Encrypted storage

#### 10. Payment Link Management
- **Provider Tracking**: SumUp, Amazon, etc.
- **Usage Tracking**: Used/unused status
- **Purpose Tracking**: Deposit, payout, movement
- **Client/App Association**: Links tied to specific clients and apps

### Advanced Features

#### 1. Automatic Profit Population
When a client app's status is set to 'completed' or 'paid':
- `profit_client` is automatically set from `promotion.client_reward`
- `profit_us` is automatically set from `promotion.our_reward`
- Manual override available if needed

#### 2. Financial Summary Automation
The client profile's financial summary automatically calculates:
- Total client profit from all completed/paid apps
- Total internal profit from all completed/paid apps
- Total deposited amounts
- Total owed to client (from debts where client is creditor)
- Total owed by client (from debts where client is debtor)

#### 3. Active Promotion Detection
Promotions are considered active if:
- `is_active = true`
- Current date is between `start_date` and `end_date` (if set)
- Used to filter "Available Apps" on client profile

#### 4. Client Matching Logic
In the Requests page:
- Exact match: name + contact
- Partial match: first name + contact
- Automatic linking if match found

#### 5. Relationship Joins
Efficient data fetching using PostgREST relationship syntax:
- `select: '*, apps(*), clients!client_id(*)'`
- Explicit relationship naming for ambiguous foreign keys
- In-memory joins when Supabase doesn't support multiple joins to same table

---

## Data Migration

### Migration Scripts

#### `scripts/migrate-all-data.ts`
**Purpose**: Complete data migration from CSV files

**Features**:
- Migrates all data from Excel CSV exports
- Handles Italian date formats (DD/MM/YYYY)
- Handles Italian numeric formats (comma as decimal)
- BOM (Byte Order Mark) handling
- Duplicate prevention (idempotent)
- Error handling and retry logic
- Progress logging

**Migration Steps**:
1. Tiers
2. Apps
3. Clients (from CLIENTI and TIER CLIENTI)
4. Promotions
5. Referral Links
6. Client Apps (from per-app sheets)
7. Requests (MODULO)
8. Credentials (MAIL)
9. Debts (Lista Bybit/kraken)
10. Payment Links
11. Slots (RTP slot sisal)
12. Message Templates (Guide app - Guide.csv)

**Special Handling**:
- **Message Templates**: Hierarchical CSV parsing (no headers, App/Step/Content structure)
- **Promotions**: Retry logic for missing columns (graceful degradation)
- **Debts**: Automatic referral link creation if missing
- **Credentials**: Client lookup by email, then name
- **Client Apps**: Status inference from deposited/finished flags

### Migration Files

Located in `supabase/migrations/`:
- `0001_init_schema.sql`: Initial database schema
- `0002_add_promotions_fields.sql`: Added profit_type, expense, max_invites, is_active
- `0003_fix_message_templates_structure.sql`: Fixed message templates structure
- `0004_cleanup_misclassified_templates.sql`: Cleaned up misclassified templates
- `0005_remove_revolut_other_onboard.sql`: Removed Revolut "Other" templates
- `0006_add_step_order_to_message_templates.sql`: Added step_order column
- `0007_fix_apps_and_message_templates.sql`: Fixed app active status and template classifications
- `0008_cleanup_duplicate_message_templates.sql`: Removed duplicates
- `0009_reset_message_templates.sql`: Reset and unique constraint

---

## Authentication & Security

### Authentication Flow

1. **Login Page** (`/login`)
   - Email/password form
   - Supabase Auth integration
   - Redirect to intended page after login
   - Session persistence

2. **Auth Guard** (`app/(dashboard)/layout.tsx`)
   - Checks authentication status
   - Redirects to `/login` if not authenticated
   - Shows loading spinner during check
   - Allows demo mode if Supabase not configured

3. **Session Management** (`lib/auth.ts`)
   - `useAuth` hook for session state
   - Automatic session checking
   - Error handling

### Row Level Security (RLS)

All tables have RLS enabled with policies:
- **Authenticated users**: Full read/write access
- **Unauthenticated users**: No access

### Credential Security

- **Encryption**: Base64 encoding (MVP)
- **Storage**: Encrypted passwords in `password_encrypted` column
- **Future**: Edge Function for decryption (service role key only)

### Environment Variables

**Frontend** (`.env.local`):
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Public anon key

**Backend/Scripts** (not in frontend):
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key (scripts only)

---

## Environment Configuration

### Required Environment Variables

```env
# Frontend (public)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Backend/Scripts (not exposed to frontend)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

### Demo Mode

If environment variables are not set:
- Application runs in demo mode
- Uses `lib/demoData.ts` for sample data
- Shows `EnvWarning` component
- All features work but data is not persisted

---

## Development Workflow

### Setup

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Configure Environment**:
   - Create `.env.local`
   - Add Supabase credentials

3. **Run Database Migrations**:
   - Apply migrations in `supabase/migrations/`
   - Or use Supabase SQL editor

4. **Migrate Data** (optional):
   ```bash
   npx tsx scripts/migrate-all-data.ts
   ```

5. **Start Development Server**:
   ```bash
   npm run dev
   ```

### Development Commands

- `npm run dev`: Start development server
- `npm run build`: Build for production
- `npm run start`: Start production server
- `npm run lint`: Run ESLint

### Code Organization

- **Pages**: `app/(dashboard)/*/page.tsx`
- **Components**: `components/*.tsx`
- **Hooks**: `lib/*.ts`
- **Types**: `types/*.ts`
- **Migrations**: `supabase/migrations/*.sql`
- **Scripts**: `scripts/*.ts`

### Best Practices

1. **Component Reusability**: Use shared components from `components/`
2. **Data Fetching**: Always use `useSupabaseData` hook
3. **Mutations**: Use `useSupabaseMutations` hook
4. **Error Handling**: Use `ErrorMessage` component
5. **Loading States**: Use `LoadingSpinner` component
6. **Empty States**: Use `EmptyState` component
7. **Type Safety**: Use TypeScript types from `types/database.ts`
8. **Relationship Joins**: Use PostgREST syntax in `select` queries

---

## Mandatory Implementation Rules

### Core Requirements

1. **Relationship Joins MUST be Used Everywhere**
   - All database reads MUST use PostgREST relationship syntax
   - Example: `select: '*, apps(*), clients!client_id(*), promotions(*)'`
   - Explicit relationship naming for ambiguous foreign keys
   - Never fetch related data separately and join in memory

2. **Data Fetching Requirements**
   - All reads MUST use `useSupabaseData` hook
   - All mutations MUST use `useSupabaseMutations` hook
   - Server-side filtering MUST be used (not client-side filtering)
   - Pagination MUST be implemented for large datasets

3. **Optimistic Updates**
   - All mutations MUST use optimistic updates
   - Rollback on error
   - Revalidate SWR keys after mutations

4. **UI State Management**
   - Every page MUST have proper loading states (LoadingSpinner)
   - Every page MUST have proper error states (ErrorMessage)
   - Every page MUST have proper empty states (EmptyState)
   - No hardcoded values anywhere

5. **Authentication**
   - Authentication guard REQUIRED in dashboard layout
   - Redirect to login if not authenticated
   - Show loading spinner during auth check

6. **Responsive Design**
   - All pages MUST be responsive
   - Mobile-friendly layouts
   - Accessible components

### Supabase Backend Requirements

#### Relationship Join Examples

```typescript
// client_apps with all relationships
select: '*, apps(*), clients!client_id(*), promotions(*), referral_links(*)'

// clients with tier and inviter
select: '*, tiers(*), clients!invited_by_client_id(*)'

// referral_links with owner and app
select: '*, clients!owner_client_id(*), apps(*)'
```

#### Server Filtering Support

Supported filter operators in `useSupabaseData`:
- `eq` - Equal
- `neq` - Not equal
- `gt` - Greater than
- `gte` - Greater than or equal
- `lt` - Less than
- `lte` - Less than or equal
- `ilike` - Case-insensitive like
- `like` - Case-sensitive like
- `in` - In array
- `is` - Is null/not null
- `not.is` - Not null check

#### Pagination

```typescript
useSupabaseData({
  table: 'clients',
  limit: 20,
  offset: page * 20
});
```

#### Realtime Subscriptions (Required)

Must implement for:
- `client_apps` (for pipeline updates)
- `requests` (for new inbox entries)

---

## Defects & Implementation Status

### Critical Defects (Priority 1-5)

#### DEF-001: Relationship Joins Missing ⚠️ PARTIALLY FIXED
**Status**: Hook supports joins, but pages not fully migrated
**Impact**: High performance issue
**Action**: Refactor all pages to use relationship joins

#### DEF-007: Authentication ✅ FIXED
**Status**: Fully implemented
**Files**: `lib/auth.ts`, `app/(dashboard)/layout.tsx`
**Impact**: Critical security - RESOLVED

#### DEF-002: Error UI ✅ COMPONENT CREATED, ⚠️ NEEDS INTEGRATION
**Status**: ErrorMessage component exists, needs full integration
**Impact**: High UX issue
**Action**: Integrate ErrorMessage into all pages

#### DEF-003: Loading States ✅ COMPONENT CREATED, ⚠️ NEEDS INTEGRATION
**Status**: LoadingSpinner component exists, needs full integration
**Impact**: High UX issue
**Action**: Integrate LoadingSpinner into all pages

#### DEF-004: Homepage Real Data ✅ FIXED
**Status**: Fully implemented
**Impact**: Medium - RESOLVED

### High Priority Defects (Priority 6-10)

#### DEF-013: Relationship Hook Support ⚠️ PARTIALLY FIXED
**Status**: Hook supports joins, but syntax needs verification
**Impact**: High
**Action**: Test and verify relationship join syntax works correctly

#### DEF-006: Pagination ⚠️ FOUNDATION READY, NOT INTEGRATED
**Status**: Hook supports limit/offset, Pagination component created but not used
**Impact**: Medium
**Action**: Integrate Pagination component into all list pages

#### DEF-018: Optimistic Updates ⚠️ NOT IMPLEMENTED
**Status**: useSupabaseMutations exists but no optimistic updates
**Impact**: Medium
**Action**: Add optimistic update logic to mutations hook

#### DEF-016: Server-Side Filtering ⚠️ PARTIALLY FIXED
**Status**: Hook supports filters, but pages still use client-side filtering
**Impact**: Medium
**Action**: Migrate all filters to server-side

### Medium Priority Defects (Priority 11-15)

#### DEF-012: Analytics Dashboard ❌ NOT IMPLEMENTED
**Status**: Not started
**Impact**: Medium
**Action**: Create dedicated `/analytics` page with charts and KPIs

#### DEF-020: KPIs ❌ NOT IMPLEMENTED
**Status**: Not started
**Impact**: Medium
**Action**: Implement KPI calculations and display

#### DEF-008: Real-time Updates ❌ NOT IMPLEMENTED
**Status**: Not started
**Impact**: Medium
**Action**: Add Supabase realtime subscriptions

#### DEF-011: Empty States ✅ COMPONENT CREATED, ⚠️ NEEDS INTEGRATION
**Status**: EmptyState component exists, needs full integration
**Impact**: Low
**Action**: Integrate EmptyState into all pages

### Low Priority Defects (Priority 16-20)

#### DEF-005: Type Safety ⚠️ PARTIAL
**Status**: Basic types exist, needs improvement
**Impact**: Low

#### DEF-009: Form Validation ⚠️ BASIC
**Status**: Basic validation exists
**Impact**: Low

#### DEF-010: Confirmation Modals ✅ IMPLEMENTED
**Status**: ConfirmationModal component exists and is used
**Impact**: Low - RESOLVED

#### DEF-014: Data Export ❌ NOT IMPLEMENTED
**Status**: Not started
**Impact**: Low

#### DEF-015: Search Functionality ⚠️ PARTIAL
**Status**: Basic search exists, needs server-side implementation
**Impact**: Low

#### DEF-017: Performance Optimization ⚠️ ONGOING
**Status**: Relationship joins will improve performance
**Impact**: Low

#### DEF-019: Accessibility ⚠️ BASIC
**Status**: Basic accessibility, needs improvement
**Impact**: Low

---

## Priority Fix Order

Based on severity and impact, the following order should be followed:

1. **DEF-001**: Relationship Joins (Critical - Performance)
2. **DEF-007**: Authentication ✅ (Completed)
3. **DEF-002**: Error UI Integration (High - UX)
4. **DEF-003**: Loading States Integration (High - UX)
5. **DEF-004**: Homepage Real Data ✅ (Completed)
6. **DEF-013**: Relationship Hook Verification (High - Foundation)
7. **DEF-006**: Pagination Integration (Medium - Scalability)
8. **DEF-018**: Optimistic Updates (Medium - UX)
9. **DEF-016**: Server-Side Filtering (Medium - Performance)
10. **DEF-012**: Analytics Dashboard (Medium - Features)
11. **DEF-020**: KPIs (Medium - Features)
12. **DEF-008**: Real-time Updates (Medium - Features)
13. **DEF-011**: Empty States Integration (Low - UX)
14. **DEF-005**: Type Safety Improvements (Low - DX)
15. **DEF-009**: Form Validation Enhancement (Low - UX)
16. **DEF-010**: Confirmation Modals ✅ (Completed)
17. **DEF-014**: Data Export (Low - Features)
18. **DEF-015**: Server-Side Search (Low - Performance)
19. **DEF-017**: Performance Optimization (Low - Ongoing)
20. **DEF-019**: Accessibility Improvements (Low - Compliance)

---

## Page-Specific Requirements

### Homepage (`app/page.tsx`)

**Required Metrics** (MUST be from Supabase, not hardcoded):
- Trusted clients count
- Active pipeline apps (non-cancelled, non-paid)
- Open debts total (sum in €)
- Pending requests (new status count)
- Today's onboarding (grouped by app)
- Promo expirations (upcoming)
- Unused payment links count

**Implementation Status**: ✅ Fully implemented with real data

### Clients List (`app/(dashboard)/clients/page.tsx`)

**Required Features**:
- Full table: name, tier, trusted, total apps, total profit, invited_by, created_at
- Filters: tier, trusted, app, status (server-side)
- Server-side search
- Pagination
- Relationship joins: `select: '*, tiers(*), clients!invited_by_client_id(*)'`

**Implementation Status**: ⚠️ Partially implemented - needs server-side filtering

### Client Profile (`app/(dashboard)/clients/[id]/page.tsx`)

**Required Sections** (9 total):
1. Personal Info (editable)
2. Financial Summary (auto-calculated)
3. Apps Progress
4. Notes (editable)
5. Apps Started (with inline editing)
6. Apps Not Started (only active promotions)
7. Credentials CRUD
8. Debts CRUD
9. Payment Links CRUD

**Auto-calculation Rules**:
- `profit_client` auto-filled from `promotions.client_reward` when status is 'completed' or 'paid'
- `profit_us` auto-filled from `promotions.our_reward` when status is 'completed' or 'paid'
- Financial Summary auto-calculates from related records

**Implementation Status**: ✅ Fully implemented

### Apps List (`app/(dashboard)/apps/page.tsx`)

**Required Display**:
- name, type, active bonus indicator, promotions count, total clients, profit
- Active bonus tracker (based on active promotions)
- Relationship joins: `select: '*, promotions(*)'`

**Implementation Status**: ✅ Fully implemented

### Promotions Page (`app/(dashboard)/promotions/page.tsx`)

**Required Features**:
- Inline editing for all fields
- Active calculation: `is_active = true AND start_date <= today <= end_date`
- Relationship joins: `select: '*, apps(*)'`

**Implementation Status**: ✅ Fully implemented

### Pipeline (`app/(dashboard)/pipeline/page.tsx`)

**Required Features**:
- Drag & drop between 7 statuses
- Status change triggers Supabase UPDATE
- MUST use optimistic update
- MUST revalidate SWR keys
- Relationship joins: `select: '*, apps(*), clients!client_id(*)'`
- Real-time updates (subscription)

**Implementation Status**: ⚠️ Drag-drop works, but needs optimistic updates and realtime

### Requests Page (`app/(dashboard)/requests/page.tsx`)

**Required Features**:
- Google Form inbox display
- Client matching: name + contact → match existing client
- Convert request to client + client_apps
- Add Client Profile button
- Full name display (name + surname)
- Clickable names (link to profile if client exists)
- Relationship joins: `select: '*, clients(*)'`

**Implementation Status**: ✅ Fully implemented

### Message Templates (`app/(dashboard)/message-templates/page.tsx`)

**Required Features**:
- Group by APP → STEP → step_order
- Copy-to-clipboard functionality
- Onboard section (generic templates)
- Active status based on promotions
- URL parameter support for direct linking

**Implementation Status**: ✅ Fully implemented

---

## Future Enhancements

### Planned Features

1. **Pagination**: Full pagination implementation across all list pages
2. **Real-time Updates**: Supabase realtime subscriptions for pipeline and requests
3. **Analytics Dashboard**: Dedicated `/analytics` page with charts and KPIs
4. **Export Functionality**: CSV/Excel export for all tables
5. **Advanced Filtering**: More filter options with saved filter presets
6. **Role-based Access**: Admin vs operator roles with different permissions
7. **Notifications**: Promo expiration alerts and system notifications
8. **Google Forms Integration**: Direct API integration instead of CSV import
9. **Advanced Encryption**: Proper encryption for credentials (Edge Function)
10. **Audit Logging**: Track all changes with user and timestamp

### Technical Debt

1. **Password Encryption**: Upgrade from base64 to proper encryption (AES-256)
2. **Error Handling**: More comprehensive error handling with error boundaries
3. **Type Safety**: More strict TypeScript types with better inference
4. **Testing**: Unit and integration tests (Jest, React Testing Library)
5. **Performance**: Optimize large data sets with virtual scrolling
6. **Accessibility**: Improve a11y compliance (ARIA labels, keyboard navigation)
7. **Internationalization**: Multi-language support (Italian/English)

---

## Conclusion

This application provides a comprehensive solution for managing referral-based bonus farming operations, replacing the previous Excel-based system with a modern, secure, and scalable web application. The architecture is designed for extensibility and maintainability, with clear separation of concerns and reusable components.

### Current Status Summary

- ✅ **Authentication**: Fully implemented and secure
- ✅ **Core Features**: All major features implemented
- ⚠️ **Performance**: Relationship joins partially implemented, needs completion
- ⚠️ **UX Polish**: Loading/Error/Empty states need full integration
- ❌ **Advanced Features**: Analytics, realtime, pagination pending

### Next Steps

1. Complete relationship joins migration (DEF-001)
2. Integrate loading/error/empty states everywhere (DEF-002, DEF-003, DEF-011)
3. Implement optimistic updates (DEF-018)
4. Add server-side filtering everywhere (DEF-016)
5. Create analytics dashboard (DEF-012, DEF-020)
6. Add realtime subscriptions (DEF-008)
7. Implement pagination (DEF-006)

For questions or contributions, refer to the main `README` file or contact the development team.

