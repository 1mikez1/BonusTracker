# Complete Migration Guide: Excel to Supabase Integration

This guide walks you through migrating your Excel data to Supabase and connecting it to the Bonus Tracker application.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Step 1: Set Up Supabase Project](#step-1-set-up-supabase-project)
3. [Step 2: Run Database Migration](#step-2-run-database-migration)
4. [Step 3: Configure Authentication](#step-3-configure-authentication)
5. [Step 4: Export Excel Data to CSV](#step-4-export-excel-data-to-csv)
6. [Step 5: Prepare Migration Script](#step-5-prepare-migration-script)
7. [Step 6: Run Data Migration](#step-6-run-data-migration)
8. [Step 7: Configure Application](#step-7-configure-application)
9. [Step 8: Test Integration](#step-8-test-integration)
10. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- Node.js 18+ installed
- Supabase account (free tier works)
- Access to your Excel files (NEW-J, New - BH, Guide app)
- Basic command line knowledge

---

## Step 1: Set Up Supabase Project

### 1.1 Create Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Sign up or log in
3. Click **"New Project"**
4. Fill in:
   - **Name**: `bonus-tracker` (or your preferred name)
   - **Database Password**: Create a strong password (save it!)
   - **Region**: Choose closest to you
   - **Pricing Plan**: Free tier is sufficient for MVP
5. Click **"Create new project"**
6. Wait 2-3 minutes for project to initialize

### 1.2 Get Your Project Credentials

1. In your Supabase dashboard, go to **Settings** → **API**
2. Copy these values (you'll need them later):
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon/public key** (starts with `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`)
   - **service_role key** (starts with `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`) - **Keep this secret!**

---

## Step 2: Run Database Migration

### 2.1 Access SQL Editor

1. In Supabase dashboard, go to **SQL Editor**
2. Click **"New query"**

### 2.2 Run Migration Script

1. Open the file: `supabase/migrations/0001_init_schema.sql`
2. Copy the entire contents
3. Paste into the SQL Editor in Supabase
4. Click **"Run"** (or press `Ctrl+Enter`)
5. Wait for success message: "Success. No rows returned"

### 2.3 Verify Tables Created

1. Go to **Table Editor** in Supabase dashboard
2. You should see all 12 tables:
   - `tiers`
   - `clients`
   - `apps`
   - `promotions`
   - `referral_links`
   - `referral_link_debts`
   - `client_apps`
   - `requests`
   - `credentials`
   - `payment_links`
   - `slots`
   - `message_templates`

---

## Step 3: Configure Authentication

### 3.1 Enable Email Authentication

1. Go to **Authentication** → **Providers** in Supabase
2. Ensure **Email** provider is enabled (default: enabled)
3. Configure email settings if needed (for production)

### 3.2 Create Your First Operator User

**Option A: Via Supabase Dashboard (Recommended for first user)**

1. Go to **Authentication** → **Users**
2. Click **"Add user"** → **"Create new user"**
3. Enter:
   - **Email**: your-email@example.com
   - **Password**: (create a strong password)
   - **Auto Confirm User**: ✅ (check this)
4. Click **"Create user"**

**Option B: Via Application (Self-registration)**

1. Users can sign up at `/login` page
2. You'll need to confirm them in Supabase dashboard (or enable auto-confirm)

### 3.3 Verify RLS Policies

1. Go to **Authentication** → **Policies**
2. Verify that all tables have policies allowing authenticated users
3. The migration script should have created these automatically

---

## Step 4: Export Excel Data to CSV

### 4.1 Create Data Directory

In your project root, create a `data` folder:

```bash
mkdir data
```

### 4.2 Export Each Excel Sheet

For each relevant sheet in your Excel files, export as CSV:

#### From "New - BH" workbook:

1. **CLIENTI sheet** → Save as `data/CLIENTI.csv`
   - Columns should include: name, surname, contact, email, trusted, tier, invited_by, notes

2. **INVITI sheet** → Save as `data/INVITI.csv`
   - Columns: App, URL, Owner, Max uses, Current uses, Active, Notes

3. **PROMOZIONI sheet** → Save as `data/PROMOZIONI.csv`
   - Columns: App, Name, Client reward, Our reward, Deposit required, End date, etc.

4. **MAIL sheet** → Save as `data/MAIL.csv`
   - Columns: Client, App, Email, Password, Notes
   - ⚠️ **Important**: Passwords will need encryption (see Step 5.5)

5. **Link_pagamenti sheet** → Save as `data/Link_pagamenti.csv`
   - Columns: Provider, URL, Amount, Purpose, Client, App, Used, Created date

6. **Lista Bybit/kraken sheet** → Save as `data/DEBTS.csv`
   - Columns: App, Link owner, Borrower, Amount, Status, Description

#### From "NEW-J" workbook:

7. **Per-app sheets** (REVOLUT, BBVA, ISYBANK, etc.) → Save as `data/REVOLUT.csv`, `data/BBVA.csv`, etc.
   - Columns: Client, Invited by, Deposited, Finished, Notes

8. **RTP slot sisal sheet** → Save as `data/SLOTS.csv`
   - Columns: Name, Provider, RTP percentage, Notes

#### From "Guide app" workbook:

9. **GuideMessages sheet** → Save as `data/GuideMessages.csv`
   - Columns: Name, App, Step, Language, Content, Notes

### 4.3 Verify CSV Files

Check that:
- All CSV files are in the `data/` folder
- Files are UTF-8 encoded (important for special characters)
- Headers match expected column names
- No empty rows at the top

---

## Step 5: Prepare Migration Script

### 5.1 Install Migration Dependencies

```bash
npm install csv-parse tsx --save-dev
```

### 5.2 Customize Migration Script

1. Open `scripts/migrate-excel-to-supabase.ts`
2. Review each migration function
3. **Update column mappings** to match your CSV headers

#### Example: Updating CLIENTI.csv mapping

Find this section:
```typescript
const clientData = {
  name: row.name || row['Client name'] || '',
  surname: row.surname || row['Surname'] || null,
  contact: row.contact || row['Contact'] || row['Telegram'] || null,
  // ...
};
```

Update based on your actual CSV headers:
```typescript
const clientData = {
  name: row['Nome'] || row['Name'] || '',  // Your actual column name
  surname: row['Cognome'] || row['Surname'] || null,
  contact: row['Telegram'] || row['WhatsApp'] || null,
  // ...
};
```

### 5.3 Handle Special Cases

#### Date Formatting
If your dates are in a different format:
```typescript
// Convert Excel date to ISO string
const excelDate = row['Created Date'];
const isoDate = new Date(excelDate).toISOString();
```

#### Boolean Values
Handle different boolean representations:
```typescript
const isTrusted = row['Trusted'] === 'TRUE' || 
                  row['Trusted'] === '1' || 
                  row['Trusted'] === 'Sì' || 
                  row['Trusted'] === 'Yes';
```

#### Numeric Values
Parse numbers correctly:
```typescript
const amount = row['Amount'] 
  ? parseFloat(row['Amount'].replace(/[€,\s]/g, '')) 
  : null;
```

### 5.4 Handle Credentials Encryption (Important!)

**Before migrating credentials**, you need to encrypt passwords. Options:

**Option A: Simple Base64 (Not secure, but works for MVP)**
```typescript
import * as crypto from 'crypto';

function encryptPassword(password: string): string {
  // Simple base64 encoding (NOT secure for production!)
  return Buffer.from(password).toString('base64');
}
```

**Option B: Proper Encryption (Recommended)**
```typescript
import * as crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'your-32-char-key-here';
const ALGORITHM = 'aes-256-cbc';

function encryptPassword(password: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(password, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}
```

Update the credentials migration section:
```typescript
const credentialData = {
  // ...
  password_encrypted: encryptPassword(row['Password']),
  // ...
};
```

### 5.5 Test CSV Reading

Add a test function to verify CSV structure:

```typescript
// Add this temporarily to test
function testCSV(filePath: string) {
  const rows = readCSV(filePath);
  console.log(`Found ${rows.length} rows in ${filePath}`);
  console.log('Headers:', Object.keys(rows[0] || {}));
  console.log('First row:', rows[0]);
}
```

Run it:
```typescript
testCSV('data/CLIENTI.csv');
```

---

## Step 6: Run Data Migration

### 6.1 Set Environment Variables

Create a `.env.local` file in project root:

```bash
# Supabase Configuration
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Optional: For password encryption
ENCRYPTION_KEY=your-32-character-encryption-key-here
```

**⚠️ Security Note**: 
- Never commit `.env.local` to git
- The service role key bypasses RLS - keep it secret!
- Add `.env.local` to `.gitignore`

### 6.2 Run Migration Script

```bash
npx tsx scripts/migrate-excel-to-supabase.ts
```

### 6.3 Monitor Migration Progress

The script will output:
```
Starting Excel to Supabase migration...

Migrating tiers...
✓ Tier TOP ready
✓ Tier TIER 1 ready
...

Migrating apps...
✓ App REVOLUT ready (uuid-here)
...

Migrating clients...
✓ Client John Doe ready (uuid-here)
...

✓ Migration completed!
```

### 6.4 Verify Data in Supabase

1. Go to Supabase **Table Editor**
2. Check each table:
   - `tiers` - Should have 4 tiers
   - `apps` - Should have your apps
   - `clients` - Should have your clients
   - `client_apps` - Should have client-app relationships
   - etc.

3. Spot-check a few records against your Excel files

### 6.5 Handle Errors

If you encounter errors:

- **Foreign key violations**: Ensure parent records (apps, clients) are created first
- **Duplicate key errors**: Script uses `upsert` - should handle duplicates
- **Data type errors**: Check numeric/date parsing
- **Missing columns**: Update column mappings in script

---

## Step 7: Configure Application

### 7.1 Update Environment Variables

In your `.env.local` file, add the public keys:

```bash
# Supabase Public Configuration (safe to expose in frontend)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Supabase Service Role (server-side only, keep secret!)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 7.2 Restart Development Server

```bash
# Stop current server (Ctrl+C)
npm run dev
```

The app should now connect to Supabase instead of demo mode.

### 7.3 Test Authentication

1. Go to `http://localhost:3000/login`
2. Log in with the operator account you created in Step 3.2
3. You should be redirected to the dashboard

---

## Step 8: Test Integration

### 8.1 Verify Data Display

1. **Clients Page** (`/clients`)
   - Should show your migrated clients
   - Filters should work
   - Click a client to see detail page

2. **Apps Page** (`/apps`)
   - Should show your apps
   - Promotions should be visible

3. **Pipeline** (`/pipeline`)
   - Should show client-apps in kanban columns
   - Try dragging a card to change status

4. **Referral Links** (`/referral-links`)
   - Should show your referral links
   - Usage counts should be correct

### 8.2 Test Write Operations

1. **Pipeline Drag-and-Drop**
   - Drag a card from "requested" to "registered"
   - Refresh page - status should persist

2. **Request Conversion**
   - Go to `/requests`
   - Click "Convert" on a request
   - Should create client and client_apps

3. **Debt Settlement**
   - Go to `/debts`
   - Click "Mark settled" on a debt
   - Status should update

### 8.3 Verify RLS Security

1. Open browser DevTools → Network tab
2. Try accessing data without authentication
3. Requests should fail (401/403) if RLS is working

---

## Troubleshooting

### Issue: "Module not found" errors

**Solution**: Ensure all dependencies are installed:
```bash
npm install
```

### Issue: "Invalid API key" or connection errors

**Solution**: 
- Verify `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`
- Ensure keys are from the same Supabase project
- Restart dev server after changing `.env.local`

### Issue: "RLS policy violation" errors

**Solution**:
- Ensure you're logged in (check Supabase Auth)
- Verify RLS policies are created (run migration SQL again)
- Check that policies allow authenticated users

### Issue: Data not showing after migration

**Solution**:
- Check Supabase Table Editor - is data there?
- Check browser console for errors
- Verify environment variables are set correctly
- Clear browser cache and refresh

### Issue: Migration script fails

**Solution**:
- Check CSV file encoding (should be UTF-8)
- Verify column names match script mappings
- Check for special characters in data
- Review error messages - they usually indicate the issue

### Issue: Passwords not decrypting

**Solution**:
- Ensure encryption method matches decryption method
- Store encryption key securely
- For MVP, consider using Supabase Edge Function for decryption

### Issue: Foreign key constraint errors

**Solution**:
- Ensure parent records exist (apps before client_apps)
- Check that IDs are correct UUIDs
- Verify relationships in Supabase dashboard

---

## Next Steps

After successful migration:

1. **Set up production environment**
   - Create production Supabase project
   - Configure custom domain
   - Set up email templates

2. **Enhance security**
   - Implement proper password encryption
   - Set up Edge Functions for sensitive operations
   - Configure backup strategies

3. **Optimize performance**
   - Add database indexes for frequent queries
   - Implement pagination for large tables
   - Add caching where appropriate

4. **Add features**
   - Bulk operations
   - Data export functionality
   - Advanced filtering
   - Analytics dashboard

---

## Quick Reference

### Important Files
- `supabase/migrations/0001_init_schema.sql` - Database schema
- `scripts/migrate-excel-to-supabase.ts` - Migration script
- `.env.local` - Environment variables (not in git)
- `data/*.csv` - Your exported Excel data

### Key Commands
```bash
# Install dependencies
npm install

# Run migration
npx tsx scripts/migrate-excel-to-supabase.ts

# Start dev server
npm run dev

# Build for production
npm run build
```

### Support Resources
- [Supabase Documentation](https://supabase.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- Project README: `README` file in project root

---

## Checklist

Before going live, verify:

- [ ] All tables created in Supabase
- [ ] RLS policies enabled and working
- [ ] At least one operator user created
- [ ] All CSV files exported and in `data/` folder
- [ ] Migration script customized for your CSV structure
- [ ] Migration script runs without errors
- [ ] Data visible in Supabase Table Editor
- [ ] Application connects to Supabase (not demo mode)
- [ ] Authentication works
- [ ] Write operations work (pipeline, requests, debts)
- [ ] Environment variables set correctly
- [ ] `.env.local` in `.gitignore`

---

**Congratulations!** Your Excel data is now in Supabase and integrated with the Bonus Tracker application. 🎉

