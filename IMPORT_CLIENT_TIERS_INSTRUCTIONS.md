# Client Tiers Import - Execution Instructions

## Prerequisites

1. **Environment Variables** (REQUIRED):
   ```powershell
   # Windows PowerShell
   $env:SUPABASE_URL="https://REDACTED_PROJECT_REF.supabase.co"
   $env:SUPABASE_SERVICE_ROLE_KEY="<your-service-role-key>"
   ```

   ```bash
   # macOS/Linux
   export SUPABASE_URL="https://REDACTED_PROJECT_REF.supabase.co"
   export SUPABASE_SERVICE_ROLE_KEY="<your-service-role-key>"
   ```

2. **CSV File**: `Data/New - BH/New - BH - TIER CLIENTI.csv` ✅ (confirmed to exist)

3. **Current State**: 
   - `tiers` table: **4 rows** (TOP, Tier 1, Tier 2, 20IQ) ✅
   - `clients` table: **188 rows** (ready for tier assignment)
   - Script: `scripts/import-client-tiers-from-csv.ts` ✅ (ready)

## CSV Structure

The CSV file has the following structure:
- **Headers**: `TOP`, `TIER 1`, `TIER 2`, `20 IQ`, `EXTRA`
- **Data**: Each row contains client names in the respective tier columns
- **Name Format**: "Nome Cognome" (e.g., "Raffaele Ciotola") or just "Nome"

Example:
```csv
TOP,TIER 1,TIER 2,20 IQ,,EXTRA
Raffaele Ciotola,Luisa Ciappellano,Pasquale Quercia,Jordan Rebecchi,,Noemi Allegra
Nicolo Penso,Alessandro Ferraioli,Mario Casaburi,Giorgia Cannella,,Martina Allegra
```

## Execution Steps

### Step 1: Set Environment Variables
Set the `SUPABASE_SERVICE_ROLE_KEY` environment variable with your service role key.

**⚠️ SECURITY WARNING**: Never commit the service role key to git!

### Step 2: Execute the Script
```bash
npx tsx scripts/import-client-tiers-from-csv.ts
```

### Step 3: Review Output
The script will:
1. Load tiers from database
2. Parse CSV file
3. Match client names to existing clients
4. Update `tier_id` for matched clients
5. Report summary (processed, updated, not found)

### Step 4: Verify Results
After execution, verify:
- Console output shows number of clients updated
- Database has clients with `tier_id` assigned
- No unexpected errors in console

## Validation Queries

After import, run these SQL queries to verify:

```sql
-- Total clients with tier assigned
SELECT COUNT(*) AS clients_with_tier
FROM clients
WHERE tier_id IS NOT NULL;

-- Tier distribution
SELECT 
  t.name AS tier_name,
  COUNT(c.id) AS client_count
FROM tiers t
LEFT JOIN clients c ON c.tier_id = t.id
GROUP BY t.id, t.name, t.priority
ORDER BY t.priority;

-- Clients without tier
SELECT COUNT(*) AS clients_without_tier
FROM clients
WHERE tier_id IS NULL;

-- Sample clients with tiers
SELECT 
  c.name,
  c.surname,
  t.name AS tier_name
FROM clients c
JOIN tiers t ON t.id = c.tier_id
ORDER BY t.priority, c.name
LIMIT 20;
```

## Matching Logic

The script uses the following matching strategy:

1. **Exact Match**: Matches `name` and `surname` (case-insensitive)
2. **Fuzzy Match**: If exact match fails, tries:
   - Match by `name` only
   - Match by `name` with partial `surname` match
   - Match by `name` where DB `surname` is NULL

3. **Not Found**: If no match is found, the client is reported in the "not found" list

## Expected Results

- **Total Processed**: ~50-100 clients (depends on CSV)
- **Successfully Updated**: Most clients should be matched and updated
- **Not Found**: Some clients may not be found if:
  - Name spelling differs between CSV and database
  - Client doesn't exist in database yet
  - Name format is different (e.g., "Nome" vs "Nome Cognome")

## Troubleshooting

### Clients Not Found
If many clients are not found:
1. Check name spelling in CSV vs database
2. Verify client exists in `clients` table
3. Check if name format matches (with/without surname)

### Tier Not Assigned
If tier is not assigned:
1. Verify tier exists in `tiers` table
2. Check tier name mapping (CSV column → database tier name)
3. Verify `tier_id` foreign key constraint

### Re-running the Script
The script is idempotent and can be safely re-run:
- It will update existing `tier_id` values
- It won't create duplicate assignments
- It will report current state

## Next Steps

After successful import:
1. Verify tier distribution in `/clients` page
2. Check that tier filter works correctly
3. Verify tier badges display correctly in client profiles



