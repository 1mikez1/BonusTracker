# Quick Start Checklist

A condensed checklist for migrating Excel data to Supabase.

## ✅ Setup Checklist

### 1. Supabase Setup (15 minutes)
- [ ] Create Supabase account at [supabase.com](https://supabase.com)
- [ ] Create new project
- [ ] Copy Project URL and API keys (anon + service_role)
- [ ] Run SQL migration: Copy `supabase/migrations/0001_init_schema.sql` → Supabase SQL Editor → Run
- [ ] Verify 12 tables created in Table Editor

### 2. Export Excel to CSV (30 minutes)
- [ ] Create `data/` folder in project root
- [ ] Export CLIENTI sheet → `data/CLIENTI.csv`
- [ ] Export INVITI sheet → `data/INVITI.csv`
- [ ] Export PROMOZIONI sheet → `data/PROMOZIONI.csv`
- [ ] Export per-app sheets (REVOLUT, BBVA, etc.) → `data/REVOLUT.csv`, etc.
- [ ] Export GuideMessages → `data/GuideMessages.csv`
- [ ] Export other sheets as needed
- [ ] Verify CSV files are UTF-8 encoded

### 3. Configure Migration Script (30 minutes)
- [ ] Install dependencies: `npm install csv-parse tsx --save-dev`
- [ ] Open `scripts/migrate-excel-to-supabase.ts`
- [ ] Update column mappings to match your CSV headers
- [ ] Test CSV reading with sample file
- [ ] Add password encryption logic (if migrating credentials)

### 4. Run Migration (15 minutes)
- [ ] Create `.env.local` file:
  ```
  SUPABASE_URL=https://xxxxx.supabase.co
  SUPABASE_SERVICE_ROLE_KEY=eyJ...
  ```
- [ ] Run: `npx tsx scripts/migrate-excel-to-supabase.ts`
- [ ] Verify no errors in output
- [ ] Check Supabase Table Editor - data should be there

### 5. Configure Application (5 minutes)
- [ ] Update `.env.local` with public keys:
  ```
  NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
  ```
- [ ] Restart dev server: `npm run dev`
- [ ] App should connect to Supabase (not demo mode)

### 6. Authentication (5 minutes)
- [ ] Create operator user in Supabase: Authentication → Users → Add user
- [ ] Or sign up at `/login` page
- [ ] Log in and verify access

### 7. Test Everything (10 minutes)
- [ ] View clients page - data should show
- [ ] View pipeline - drag and drop should work
- [ ] Convert a request - should create client
- [ ] Settle a debt - status should update
- [ ] Copy message template - should work

## 🚨 Common Issues

| Issue | Quick Fix |
|-------|-----------|
| "Module not found" | Run `npm install` |
| "Invalid API key" | Check `.env.local` keys match Supabase dashboard |
| "RLS policy violation" | Ensure logged in + RLS policies exist |
| Data not showing | Check Supabase Table Editor - is data there? |
| Migration fails | Check CSV encoding (UTF-8) and column names |

## 📋 File Checklist

Before starting, ensure you have:
- [ ] `supabase/migrations/0001_init_schema.sql` - Database schema
- [ ] `scripts/migrate-excel-to-supabase.ts` - Migration script
- [ ] `data/` folder with CSV files
- [ ] `.env.local` file (not committed to git)

## ⏱️ Total Time Estimate

- **First time setup**: ~2 hours
- **Subsequent migrations**: ~30 minutes

## 📚 Full Documentation

See `MIGRATION_GUIDE.md` for detailed step-by-step instructions.

