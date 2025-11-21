# Quick Setup Guide

## Step 1: Create Environment File

Create a file named `.env.local` in the root directory (same folder as `package.json`):

```bash
# On Windows PowerShell
New-Item -Path .env.local -ItemType File

# On Mac/Linux
touch .env.local
```

## Step 2: Get Your Supabase Credentials

1. Go to https://app.supabase.com
2. Select your project (or create a new one)
3. Click **Settings** (gear icon) → **API**
4. Copy these values:
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **anon public** key (starts with `eyJ...`)

## Step 3: Add Credentials to `.env.local`

Open `.env.local` and add:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

**Example:**
```env
NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYxNjIzOTAyMiwiZXhwIjoxOTMxODE1MDIyfQ.example
```

## Step 4: Restart Development Server

**Important:** You must restart the server after creating/editing `.env.local`:

1. Stop the current server (press `Ctrl+C` in the terminal)
2. Start it again: `npm run dev`

## Step 5: Verify Setup

1. Open http://localhost:3000
2. You should see the dashboard (or be redirected to login)
3. If you see a yellow warning banner, Supabase is not configured yet
4. If you see "Supabase client not initialized" errors, check:
   - File is named exactly `.env.local` (not `.env` or `.env.example`)
   - File is in the root directory
   - Variables start with `NEXT_PUBLIC_`
   - No quotes around values
   - Server was restarted after creating the file

## Troubleshooting

### "Supabase client not initialized" Error

✅ **Checklist:**
- [ ] File is named `.env.local` (not `.env`)
- [ ] File is in root directory (same level as `package.json`)
- [ ] Variables are prefixed with `NEXT_PUBLIC_`
- [ ] No extra spaces or quotes around values
- [ ] Server was restarted after creating/editing the file

### Still Not Working?

1. **Verify file location:**
   ```bash
   # Should show .env.local
   ls .env.local
   ```

2. **Check file contents:**
   ```bash
   # On Windows
   type .env.local
   
   # On Mac/Linux
   cat .env.local
   ```

3. **Verify format:**
   - Each variable on its own line
   - No spaces around the `=` sign
   - No quotes unless the value itself needs them

4. **Restart the server completely:**
   - Close the terminal
   - Open a new terminal
   - Run `npm run dev` again

## Next Steps

Once environment variables are set:

1. **Run database migration** (if you haven't already):
   ```bash
   # Set service role key (for migration script only)
   $env:SUPABASE_URL="https://your-project-id.supabase.co"
   $env:SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
   
   npx tsx scripts/migrate-all-data.ts
   ```

2. **Create an operator user:**
   - Go to Supabase Dashboard → Authentication → Users
   - Click "Add user" → "Create new user"
   - Set email and password
   - Use these to log into the dashboard

3. **Test the application:**
   - Navigate to http://localhost:3000
   - You should be redirected to `/login` if not authenticated
   - Log in with your operator credentials

## Need More Help?

See `SETUP_ENVIRONMENT.md` for detailed instructions and troubleshooting.

