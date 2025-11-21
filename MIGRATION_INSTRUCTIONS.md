# Migration Instructions for Promotions Fields

## Step 1: Run the Database Migration

Before running the data migration script, you need to add the new columns to the `promotions` table.

### Option A: Using Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `supabase/migrations/0002_add_promotions_fields.sql`
4. Click **Run** to execute the migration

### Option B: Using Supabase CLI

If you have Supabase CLI installed:

```bash
supabase db push
```

This will apply all pending migrations.

## Step 2: Run the Data Migration

After the database migration is complete, run the data migration script:

```bash
npx tsx scripts/migrate-all-data.ts
```

The script will now successfully populate all fields including:
- `is_active` (from CSV "ATTIVA" column)
- `profit_type` (from CSV "Tipo Profit" column)
- `expense` (from CSV "Spesa" column)
- `max_invites` (from CSV "Numero inviti" column)

## What the Migration Adds

The migration adds the following columns to the `promotions` table:

- `is_active` (boolean) - Explicit active/inactive flag from CSV
- `profit_type` (text) - Type of profit: CASH or VOUCHER
- `expense` (numeric) - Expense amount (Spesa)
- `max_invites` (integer) - Maximum number of invites allowed

These fields will be populated from the CSV file when you run the migration script.

