# Data Files Setup

## Important: CSV Files Are Gitignored

The `Data/` directory and all CSV/Excel files are gitignored to protect sensitive information (PII, passwords, etc.).

## For Local Development

1. **Create the Data directory:**
   ```bash
   mkdir -p Data/New\ -\ BH
   mkdir -p Data/New\ -\ J
   ```

2. **Place your CSV files in the Data directory:**
   - `Data/New - BH/New - BH - CLIENTI.csv`
   - `Data/New - BH/New - BH - TIER CLIENTI.csv`
   - `Data/New - BH/New - BH - Promozioni.csv`
   - `Data/New - BH/New - BH - Mail.csv`
   - `Data/New - BH/New - BH - MODULO.csv`
   - `Data/New - BH/New - BH - Inviti.csv`
   - `Data/New - BH/New - BH - Lista Bybit_kraken.csv`
   - `Data/New - BH/New - BH - Link_pagamenti.csv`
   - `Data/New - J/NEW - J - *.csv` (various app files)
   - `Data/Guide app - Guide.csv`

3. **Run migration scripts:**
   ```bash
   # Set environment variables first
   export SUPABASE_URL="your-supabase-url"
   export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
   
   # Run migrations
   npx tsx scripts/migrate-all-data.ts
   ```

## Why Gitignored?

- CSV files contain sensitive PII (names, emails, phone numbers)
- Some files contain plain text passwords
- These should never be committed to version control
- Each user/team should use their own data files

## Application Runtime

The application itself does NOT read from CSV files. It reads from Supabase database.
CSV files are only needed for:
- Initial data migration (one-time setup)
- Re-importing data if needed

After migration, the CSV files can be deleted or kept locally (but not committed).
