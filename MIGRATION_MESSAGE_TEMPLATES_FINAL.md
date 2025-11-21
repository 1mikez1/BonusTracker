# Final Migration: Message Templates

## Overview
This guide provides the final, clean migration process for `message_templates` table.

## Step 1: Reset the Table

Execute the SQL migration to clear all existing data:

```sql
-- Run: supabase/migrations/0009_reset_message_templates.sql
TRUNCATE TABLE public.message_templates RESTART IDENTITY CASCADE;
```

Or execute it via Supabase Dashboard → SQL Editor.

## Step 2: Run the Migration Script

Run the complete migration script which will:

1. ✅ Migrate all apps first (to ensure appMap is populated)
2. ✅ Parse `Guide app - Guide.csv` correctly
3. ✅ Handle Onboard templates (app_id = NULL)
4. ✅ Skip "Other" and "introduction" steps
5. ✅ Calculate step_order correctly (1, 2, 3, ...)
6. ✅ Prevent duplicates using upsert
7. ✅ Match app names correctly (with normalization and partial matching)

```bash
npx tsx scripts/migrate-all-data.ts
```

## Expected Results

After migration, you should have:

- **Onboard Templates** (3 templates with `app_id = NULL`):
  - Spiegazione + registrazione modulo
  - Spiegazione + registrazione modulo LIGHT
  - Prenotazione FUP

- **App-Specific Templates** (with `app_id` set):
  - Each app should have its templates in correct order
  - No "Other" or "introduction" templates
  - No duplicates

## Verification

After migration, verify in Supabase:

```sql
-- Count total templates
SELECT COUNT(*) FROM public.message_templates;

-- Count Onboard templates
SELECT COUNT(*) FROM public.message_templates WHERE app_id IS NULL;

-- Count per app
SELECT a.name, COUNT(mt.id) as template_count
FROM public.apps a
LEFT JOIN public.message_templates mt ON mt.app_id = a.id
GROUP BY a.name
ORDER BY template_count DESC;

-- Check for duplicates
SELECT name, app_id, COUNT(*) as count
FROM public.message_templates
GROUP BY name, app_id
HAVING COUNT(*) > 1;
```

## Troubleshooting

If you see duplicates or incorrect data:

1. Run the reset SQL again: `0009_reset_message_templates.sql`
2. Check the CSV file path: `Data/Guide app - Guide.csv`
3. Verify app names in the CSV match the apps in the database
4. Check the console output for warnings about unmatched apps

## Notes

- The migration uses `upsert` to prevent duplicates
- Step order is calculated sequentially as templates appear in CSV
- Onboard templates are identified by step name or content keywords
- App matching uses normalization and partial matching for flexibility

