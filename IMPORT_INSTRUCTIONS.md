# Message Templates Import - Execution Instructions

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

2. **CSV File**: `Data/Guide app - Guide.csv` ✅ (confirmed to exist)

3. **Current State**: 
   - `message_templates` table: **0 rows** (empty, ready for import)
   - Script: `scripts/import-message-templates-from-csv.ts` ✅ (ready)

## Execution Steps

### Step 1: Set Environment Variables
Set the `SUPABASE_SERVICE_ROLE_KEY` environment variable with your service role key.

**⚠️ SECURITY WARNING**: Never commit the service role key to git!

### Step 2: Execute the Script
```bash
npx tsx scripts/import-message-templates-from-csv.ts
```

### Step 3: Verify Results
After execution, verify:
- Console output shows number of templates imported
- Database has templates (run SQL queries below)
- No errors in console

### Step 4: Test Idempotency
Re-run the script:
```bash
npx tsx scripts/import-message-templates-from-csv.ts
```

Expected: Template count should NOT double (updates existing, doesn't create duplicates)

## Validation Queries

After import, run these SQL queries to verify:

```sql
-- Total templates
SELECT COUNT(*) AS total_templates FROM message_templates;

-- Generic vs app-specific
SELECT
  COUNT(*) FILTER (WHERE app_id IS NULL) AS generic_templates,
  COUNT(*) FILTER (WHERE app_id IS NOT NULL) AS app_specific_templates
FROM message_templates;

-- Sample templates
SELECT name, app_id, step, step_order, language, LENGTH(content) AS content_length
FROM message_templates
ORDER BY app_id NULLS FIRST, step_order
LIMIT 50;

-- Check for duplicates
SELECT name, app_id, COUNT(*)
FROM message_templates
GROUP BY name, app_id
HAVING COUNT(*) > 1;
-- Should return 0 rows
```

## Frontend Validation

1. Start dev server: `npm run dev`
2. Navigate to `/message-templates`
3. Verify:
   - Apps grid shows apps with templates
   - Onboard section shows generic templates
   - App-specific templates are grouped by step
   - Templates are ordered by `step_order`
   - Copy-to-clipboard works

## Expected Results

- **Total Templates**: ~200-500 templates (depends on CSV)
- **Generic Templates**: ~3-5 (Onboard templates)
- **App-Specific Templates**: Rest of templates linked to apps
- **No Duplicates**: Uniqueness constraint on (name, app_id) preserved
- **Idempotent**: Re-running doesn't create duplicates

