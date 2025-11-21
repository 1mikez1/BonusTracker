# Environment Setup Guide

## Quick Setup

1. **Get your Supabase credentials:**
   - Go to https://app.supabase.com
   - Select your project (or create a new one)
   - Navigate to **Settings** > **API**
   - Copy the following values:
     - **Project URL** (e.g., `https://xxxxx.supabase.co`)
     - **anon/public key** (starts with `eyJ...`)

2. **Create environment file:**
   - Copy `.env.example` to `.env.local`
   - Fill in your Supabase credentials:

```bash
# On Windows (PowerShell)
Copy-Item .env.example .env.local

# On Mac/Linux
cp .env.example .env.local
```

3. **Edit `.env.local` and add your values:**
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

4. **For migration scripts, also add:**
```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

5. **Restart your development server:**
   - Stop the current server (Ctrl+C)
   - Run `npm run dev` again

## Important Notes

- **`.env.local`** is already in `.gitignore` - your credentials won't be committed
- **Never commit** `.env.local` to version control
- The `NEXT_PUBLIC_` prefix makes variables available in the browser
- The service role key should **only** be used in server-side scripts (migration scripts)

## Troubleshooting

### "Supabase client not initialized" error

This means your environment variables are not set. Check:

1. ✅ File is named `.env.local` (not `.env` or `.env.example`)
2. ✅ File is in the root directory (same level as `package.json`)
3. ✅ Variables start with `NEXT_PUBLIC_` for client-side access
4. ✅ No quotes around the values (unless the value itself contains quotes)
5. ✅ Restarted the dev server after creating/editing the file

### Example `.env.local` file:

```env
NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYxNjIzOTAyMiwiZXhwIjoxOTMxODE1MDIyfQ.example
```

### Verifying Setup

After setting up, you should:
1. See no "Supabase client not initialized" errors
2. Be able to log in (if you have users in Supabase Auth)
3. See data from your Supabase database (if you've run the migration script)

## Next Steps

1. **Run the database migration:**
   ```bash
   # Set service role key in environment
   $env:SUPABASE_URL="https://your-project-id.supabase.co"
   $env:SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
   
   # Run migration script
   npx tsx scripts/migrate-all-data.ts
   ```

2. **Create your first operator user:**
   - Go to Supabase Dashboard > Authentication > Users
   - Click "Add user" > "Create new user"
   - Set email and password
   - Use these credentials to log into the dashboard

3. **Test the application:**
   - Start dev server: `npm run dev`
   - Navigate to http://localhost:3000
   - You should be redirected to `/login` if not authenticated
   - Log in with your operator credentials

