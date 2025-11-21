# Data Migration Scripts

This directory contains scripts for migrating data from Excel files to Supabase.

## Migration Script: `migrate-excel-to-supabase.ts`

### Prerequisites

1. **Export Excel sheets as CSV files:**
   - Export each relevant sheet from your Excel workbooks (NEW-J, New - BH, Guide app)
   - Place CSV files in a `data/` directory at the project root
   - Recommended file names:
     - `CLIENTI.csv` - Client data from New - BH
     - `INVITI.csv` - Referral links from NEW-J or New - BH
     - `PROMOZIONI.csv` - Promotions from New - BH
     - `REVOLUT.csv`, `BBVA.csv`, etc. - Per-app client progress sheets
     - `GuideMessages.csv` - Message templates from Guide app
     - `MAIL.csv` - Credentials from New - BH
     - `Link_pagamenti.csv` - Payment links from New - BH
     - `RTP_slot_sisal.csv` - Slots data from NEW-J

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set environment variables:**
   ```bash
   export SUPABASE_URL="your-supabase-url"
   export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
   ```

   Or create a `.env.local` file:
   ```
   SUPABASE_URL=your-supabase-url
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

### Usage

1. **Customize the script:**
   - Open `migrate-excel-to-supabase.ts`
   - Update column mappings to match your actual CSV structure
   - Adjust data transformations as needed

2. **Run the migration:**
   ```bash
   npx tsx scripts/migrate-excel-to-supabase.ts
   ```

### Migration Scripts

#### 1. `migrate-all-data.ts` - Complete Migration
The script performs the following steps in order:

1. **Tiers** - Creates default client tiers (TOP, TIER 1, TIER 2, 20IQ)
2. **Apps** - Creates app records for all platforms
3. **Clients** - Migrates client data from CLIENTI.csv
4. **Client-Apps** - Creates client_apps records from per-app sheets
5. **Referral Links** - Migrates referral links and usage counts
6. **Message Templates** - Imports guide messages

#### 2. `import-message-templates-from-csv.ts` - Message Templates Only
Dedicated script for importing message templates from `Data/Guide app - Guide.csv`.

**Usage**:
```bash
npx tsx scripts/import-message-templates-from-csv.ts
```

**Features**:
- Parses CSV without headers (3 columns: App, Step, Content)
- Normalizes app names and matches with database apps
- Detects Onboard templates (sets `app_id = NULL`)
- Calculates `step_order` sequentially per app
- Prevents duplicates (idempotent)
- Cleans content (removes extra quotes)

**CSV Structure**:
- Column 1: App name (empty = same app as previous row)
- Column 2: Step name
- Column 3: Message content

**Output**:
- Onboard templates: `app_id = NULL`, name = step name
- App-specific templates: `app_id` set, name = "App - Step"

#### 3. `import-client-tiers-from-csv.ts` - Client Tier Assignments
Dedicated script for importing client tier assignments from `Data/New - BH/New - BH - TIER CLIENTI.csv`.

**Usage**:
```bash
npx tsx scripts/import-client-tiers-from-csv.ts
```

**Features**:
- Parses CSV with headers (columns: TOP, TIER 1, TIER 2, 20 IQ, EXTRA)
- Matches client names to existing clients in database
- Updates `tier_id` field in `clients` table
- Supports fuzzy matching for name variations
- Provides detailed summary of processed/updated/not found clients
- Idempotent (can be safely re-run)

**CSV Structure**:
- Headers: `TOP`, `TIER 1`, `TIER 2`, `20 IQ`, `EXTRA`
- Each row contains client names in format "Nome Cognome" or "Nome"
- Names are matched against `clients.name` and `clients.surname`

**Tier Mapping**:
- `TOP` → `TOP` tier
- `TIER 1` → `Tier 1` tier
- `TIER 2` → `Tier 2` tier
- `20 IQ` → `20IQ` tier
- `EXTRA` → Skipped (not a tier)

**Output**:
- Updates `clients.tier_id` for matched clients
- Reports total processed, updated, and not found clients
- Shows tier distribution after import

### Customization

The script is a template. You'll need to customize:

- **CSV column mappings**: Update the field mappings in each migration function to match your actual CSV column names
- **Data transformations**: Add logic to parse and normalize data from your Excel format
- **Relationships**: Adjust how client-app relationships are established
- **Error handling**: Enhance error handling for your specific data quality issues

### Security Notes

- The script uses the Supabase **service role key**, which bypasses Row Level Security (RLS)
- **Never commit** the service role key to version control
- Run this script in a secure environment
- Consider encrypting passwords before storing in the `credentials` table (see security requirements in the specification)

### Troubleshooting

- **Missing CSV files**: The script will skip missing files and log warnings
- **Duplicate data**: The script uses `upsert` operations to handle duplicates gracefully
- **Foreign key errors**: Ensure parent records (apps, clients, tiers) are created before child records
- **Data type mismatches**: Check that numeric fields are properly parsed (use `parseFloat` or `parseInt`)

### Next Steps

After migration:

1. Verify data integrity in Supabase dashboard
2. Spot-check several records against original Excel files
3. Test the web application to ensure data displays correctly
4. Set up authentication and RLS policies (if not already done)

