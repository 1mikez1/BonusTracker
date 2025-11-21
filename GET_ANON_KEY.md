# How to Get Your Supabase Anon Key

You need to add the **anon public key** to your `.env.local` file. Here's how:

## Steps:

1. **Go to your Supabase Dashboard:**
   - Visit https://app.supabase.com
   - Select your project (the one with URL: `REDACTED_PROJECT_REF.supabase.co`)

2. **Navigate to API Settings:**
   - Click the **Settings** icon (gear) in the left sidebar
   - Click **API** in the settings menu

3. **Copy the anon public key:**
   - Look for the section labeled **Project API keys**
   - Find the key labeled **anon** or **public**
   - Click the **eye icon** to reveal it (if hidden)
   - Click **Copy** to copy the key

4. **Update `.env.local`:**
   - Open `.env.local` in your project root
   - Replace `your-anon-key-here` with the copied key
   - Save the file

5. **Restart your dev server:**
   - Stop the server (Ctrl+C)
   - Run `npm run dev` again

## Example `.env.local` format:

```env
NEXT_PUBLIC_SUPABASE_URL=https://REDACTED_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlicXdncHpxZ3lodGphaXFjYm5mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxMTQ1NjMsImV4cCI6MjA3ODY5MDU2M30.your-actual-key-here
```

**Important:** 
- The anon key is different from the service_role key
- The anon key is safe to use in frontend code (it's public)
- The service_role key should NEVER be exposed in frontend code

