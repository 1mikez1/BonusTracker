# Message Templates Import - Validation Guide

## Pre-Execution Checklist

✅ **Script Ready**: `scripts/import-message-templates-from-csv.ts`  
✅ **CSV File**: `Data/Guide app - Guide.csv` (confirmed to exist)  
✅ **Database Schema**: `message_templates` table ready (0 rows currently)  
⚠️ **Environment Variables**: Need to be set before execution

## Execution Steps

### 1. Set Environment Variables

**PowerShell (Windows)**:
```powershell
$env:SUPABASE_URL="https://REDACTED_PROJECT_REF.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="<your-service-role-key>"
```

**Bash/Zsh (macOS/Linux)**:
```bash
export SUPABASE_URL="https://REDACTED_PROJECT_REF.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="<your-service-role-key>"
```

⚠️ **SECURITY**: Never commit the service role key to git!

### 2. Execute the Script

```bash
npx tsx scripts/import-message-templates-from-csv.ts
```

**Expected Console Output**:
```
📧 Importing message templates from CSV...

📋 Step 1: Loading apps from database...
  ✓ Loaded X apps (with normalized names)

📄 Step 2: Reading CSV file...
  ✓ Parsed Y rows from CSV

🔄 Step 3: Processing records...
  ⚠ App not found for "..." (if any)
  ...

✅ Import completed!
  ✓ Imported/Updated: Z templates
  ⚠ Skipped: W rows

📊 Step 4: Verifying import...
  ✓ Total templates: Z
  ✓ Onboard templates: A
  ✓ App-specific templates: B

🎉 Script completed successfully!
```

### 3. Validate Database State

Run these SQL queries to verify the import:

#### 3.1 Total Templates
```sql
SELECT COUNT(*) AS total_templates FROM message_templates;
```
**Expected**: > 0 (typically 200-500 depending on CSV)

#### 3.2 Generic vs App-Specific Distribution
```sql
SELECT
  COUNT(*) FILTER (WHERE app_id IS NULL) AS generic_templates,
  COUNT(*) FILTER (WHERE app_id IS NOT NULL) AS app_specific_templates
FROM message_templates;
```
**Expected**: 
- Generic templates: ~3-5 (Onboard templates)
- App-specific templates: Rest of templates

#### 3.3 Sample Templates
```sql
SELECT 
  name, 
  app_id, 
  step, 
  step_order, 
  language, 
  LENGTH(content) AS content_length
FROM message_templates
ORDER BY app_id NULLS FIRST, step_order
LIMIT 50;
```
**Verify**:
- Generic (Onboard) templates have `app_id = NULL`
- App-specific templates have valid `app_id`
- `step` and `step_order` are reasonable and monotonic within each group

#### 3.4 Check for Duplicates
```sql
SELECT name, app_id, COUNT(*)
FROM message_templates
GROUP BY name, app_id
HAVING COUNT(*) > 1;
```
**Expected**: 0 rows (no duplicates)

### 4. Test Idempotency

Re-run the script:
```bash
npx tsx scripts/import-message-templates-from-csv.ts
```

**Expected Behavior**:
- Total count in `message_templates` does NOT double
- Script updates existing templates instead of creating duplicates
- Console shows "Imported/Updated" count (updates, not new inserts)

**Verify**:
```sql
-- Before second run
SELECT COUNT(*) AS before_count FROM message_templates;

-- After second run (should be same or slightly higher if new templates found)
SELECT COUNT(*) AS after_count FROM message_templates;
```

### 5. Frontend Validation

#### 5.1 Start Dev Server
```bash
npm run dev
```

#### 5.2 Navigate to Message Templates Page
Open: `http://localhost:3000/message-templates`

#### 5.3 Verify UI Elements

**Apps Grid**:
- ✅ Shows apps that have templates
- ✅ Apps without templates are either hidden or shown as empty
- ✅ No crashes for apps without templates

**Onboard Section**:
- ✅ Generic templates (app_id = NULL) appear in dedicated "Onboard" section
- ✅ Should show ~3-5 templates (Spiegazione + registrazione modulo, Prenotazione FUP, etc.)

**App-Specific Templates**:
- ✅ Select an app (e.g., REVOLUT, BBVA, Kraken)
- ✅ Templates are grouped by `step`
- ✅ Within each step, templates are ordered by `step_order`
- ✅ Copy-to-clipboard button works on each template

**Edge Cases**:
- ✅ Page handles apps with no templates gracefully
- ✅ No errors in browser console
- ✅ Loading states work correctly

### 6. Spot-Check Content Integrity

Pick 3-5 apps and compare templates:

1. **Select an app** in the UI (e.g., REVOLUT)
2. **Open a template** and copy its content
3. **Compare with CSV**:
   - Open `Data/Guide app - Guide.csv`
   - Find the corresponding row
   - Verify:
     - Content matches (no truncation)
     - Line breaks preserved where important
     - No unwanted quotes or escape characters
     - Special characters (emojis, accents) display correctly

**Sample Apps to Check**:
- REVOLUT (should have multiple steps)
- BBVA (should have templates)
- Kraken (should have templates)
- Onboard (generic templates)

## Acceptance Criteria Checklist

- [ ] Script executes successfully with no unhandled errors
- [ ] `message_templates` table populated with realistic number (> 0)
- [ ] Clear split between generic (Onboard) and app-specific templates
- [ ] Re-running script is idempotent (no duplicates created)
- [ ] Uniqueness constraint on (name, app_id) preserved
- [ ] `/message-templates` page displays templates correctly
- [ ] Templates grouped by step and ordered by step_order
- [ ] Copy-to-clipboard functionality works
- [ ] No crashes for apps without templates
- [ ] Spot-checked templates match CSV content
- [ ] `DEVELOPMENT_PLAN.md` updated to mark task as COMPLETED

## Troubleshooting

### Script Fails with "Environment variables not set"
**Solution**: Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` before running

### Script Fails with "File not found"
**Solution**: Ensure `Data/Guide app - Guide.csv` exists in project root

### Script Fails with "App not found" warnings
**Solution**: This is expected for apps not in database. Script will skip those rows.

### Duplicates Created
**Solution**: Check uniqueness constraint on `message_templates` table. Re-run should update, not duplicate.

### Frontend Shows No Templates
**Solution**: 
- Verify templates exist in database (run SQL queries)
- Check browser console for errors
- Verify `useSupabaseData` hook is working correctly

## Post-Import Documentation Update

After successful import, update `DEVELOPMENT_PLAN.md`:

1. Change status from "✅ READY TO EXECUTE" to "✅ COMPLETED"
2. Add summary:
   - Number of templates imported
   - Number of generic vs app-specific templates
   - Any known limitations (e.g., skipped rows)

Example:
```markdown
### 1.2 Import Message Templates
**Status**: ✅ COMPLETED
**Implementation Notes**:
- Script `import-message-templates-from-csv.ts` executed successfully
- **Results**: 
  - Total templates imported: XXX
  - Generic (Onboard) templates: X
  - App-specific templates: XXX
  - Skipped rows: X (malformed CSV entries)
- Import is idempotent (re-running updates existing templates)
```

