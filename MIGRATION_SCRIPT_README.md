# Complete Data Migration Script

## Overview

The `scripts/migrate-all-data.ts` script is a comprehensive migration tool that automatically processes all your Excel CSV exports and imports them into Supabase.

## What It Does

This script migrates data from **all** your CSV files in a single run:

### Data Sources Processed

1. **TIER CLIENTI.csv** → Creates clients and assigns tiers
2. **MODULO.csv** → Creates request records
3. **Per-app sheets** (REVOLUT, BBVA, BYBIT, etc.) → Creates client-app workflows
4. **Inviti.csv** → Creates referral links
5. **Mail.csv** → Creates credentials (with basic encryption)
6. **Promozioni.csv** → Creates promotions
7. **Lista Bybit_kraken.csv** → Creates debt records
8. **Link_pagamenti.csv** → Creates payment links
9. **RTP slot sisal.csv** → Creates slot records
10. **Guide.csv** → Creates message templates

## Prerequisites

1. ✅ Supabase project created and schema migrated
2. ✅ CSV files exported to `Data/` directory
3. ✅ Environment variables set (see below)

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Environment Variables

**Windows PowerShell:**
```powershell
$env:SUPABASE_URL="https://your-project.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
```

**Windows CMD:**
```cmd
set SUPABASE_URL=https://your-project.supabase.co
set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**Linux/Mac:**
```bash
export SUPABASE_URL=https://your-project.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 3. Verify File Structure

Ensure your CSV files are in this structure:

```
BonusTracker/
└── Data/
    ├── Guide app - Guide.csv
    ├── New - BH/
    │   ├── New - BH - Inviti.csv
    │   ├── New - BH - Link_pagamenti.csv
    │   ├── New - BH - Lista Bybit_kraken.csv
    │   ├── New - BH - Mail.csv
    │   ├── New - BH - MODULO.csv
    │   ├── New - BH - Promozioni.csv
    │   └── New - BH - TIER CLIENTI.csv
    └── New - J/
        ├── NEW - J - BBVA.csv
        ├── NEW - J - BUDDYBANK.csv
        ├── NEW - J - BYBIT.csv
        ├── NEW - J - Inviti.csv
        ├── NEW - J - ISYBANK.csv
        ├── NEW - J - KRAKEN.csv
        ├── NEW - J - POKERSTARS.csv
        ├── NEW - J - REVOLUT.csv
        ├── NEW - J - RTP slot sisal.csv
        ├── NEW - J - SISAL.csv
        └── NEW - J - TRADING212.csv
```

## Running the Script

```bash
npx tsx scripts/migrate-all-data.ts
```

## Migration Steps

The script runs in this order:

1. **Tiers** - Creates TOP, TIER 1, TIER 2, 20IQ
2. **Apps** - Creates all app records (REVOLUT, BBVA, etc.)
3. **Clients** - Creates clients from TIER CLIENTI and assigns tiers
4. **Requests** - Creates request records from MODULO
5. **Client-Apps** - Creates workflow records from per-app sheets
6. **Referral Links** - Creates referral links from Inviti
7. **Credentials** - Creates credentials from Mail (with basic encryption)
8. **Promotions** - Creates promotions from Promozioni
9. **Debts** - Creates debt records from Lista Bybit_kraken
10. **Payment Links** - Creates payment links from Link_pagamenti
11. **Slots** - Creates slot records from RTP slot sisal
12. **Message Templates** - Creates templates from Guide

## Data Mapping

### Client-Apps Status Mapping

The script automatically determines status from CSV flags:

- `Completata = TRUE` + `Ricevuta = TRUE` → `paid`
- `Completata = TRUE` → `completed`
- `Ricevuta = TRUE` → `waiting_bonus`
- `Conto aperto = TRUE` → `registered`
- Otherwise → `requested`

### Date Parsing

Italian date format (DD/MM/YYYY) is automatically converted to ISO format (YYYY-MM-DD).

### Numeric Parsing

Handles Italian number format (comma as decimal separator) and currency symbols.

## Error Handling

- **Missing files**: Script continues with a warning
- **Missing data**: Skips empty rows with a warning
- **Duplicate records**: Uses `upsert` to avoid duplicates
- **Foreign key errors**: Logs error and continues

## Output

The script provides detailed progress output:

```
🚀 Starting complete Excel to Supabase migration...

📊 Step 1: Migrating tiers...
  ✓ Tier TOP ready
  ✓ Tier TIER 1 ready
  ✓ Tier TIER 2 ready
  ✓ Tier 20IQ ready

📱 Step 2: Migrating apps...
  ✓ App REVOLUT ready
  ✓ App BBVA ready
  ...

✅ Migration completed successfully!

📊 Summary:
  - Tiers: 4
  - Apps: 19
  - Clients: 150
```

## Troubleshooting

### "File not found" warnings

- Check that CSV files are in the correct `Data/` directory
- Verify file names match exactly (case-sensitive on Linux/Mac)

### "App not found" warnings

- The script creates apps automatically, but if you see this, check the app name normalization

### Foreign key errors

- Ensure parent records (clients, apps) are created before child records
- The script handles this automatically, but complex relationships may need manual review

### Duplicate key errors

- The script uses `upsert` to handle duplicates
- If you see these errors, the data may have conflicting unique constraints

## Post-Migration

After running the script:

1. **Review data** in Supabase Table Editor
2. **Check relationships** - Some complex relationships may need manual linking
3. **Verify counts** - Compare record counts with your Excel files
4. **Test application** - Use the dashboard to verify data displays correctly

## Customization

If you need to customize the migration:

1. Open `scripts/migrate-all-data.ts`
2. Modify column mappings in each migration function
3. Adjust data parsing logic as needed
4. Run the script again (it uses `upsert` so it's safe to re-run)

## Notes

- **Credentials encryption**: Currently uses base64 encoding. For production, implement proper encryption.
- **Referral links**: Complex CSV structure may require manual review for some links
- **Client matching**: Uses name + surname + contact for matching. Adjust if needed.
- **Re-running**: Safe to run multiple times - uses `upsert` to avoid duplicates

