# Deploy Daily Fast-Check Edge Function

The Fast-Check page requires the `daily-fast-check` Edge Function to be deployed to Supabase.

## Quick Deploy (Dashboard Method - Recommended)

1. **Go to Supabase Dashboard**
   - Visit: https://app.supabase.com
   - Select your project

2. **Navigate to Edge Functions**
   - Click **Edge Functions** in the left sidebar
   - Click **Create a new function**

3. **Create the Function**
   - **Function name**: `daily-fast-check`
   - **Copy code** from: `supabase/functions/daily-fast-check/index.ts`
   - Paste into the editor

4. **Deploy**
   - Click **Deploy**
   - The function will be available at: `https://YOUR-PROJECT-REF.supabase.co/functions/v1/daily-fast-check`

5. **Environment Variables** (Auto-configured)
   - `SUPABASE_URL` - Automatically set by Supabase
   - `SUPABASE_SERVICE_ROLE_KEY` - Automatically set by Supabase
   - `ALLOWED_ORIGINS` (optional) - Set to restrict CORS, e.g., `https://yourdomain.com`

## Alternative: CLI Method

If you prefer using the CLI:

```bash
# 1. Link your project (if not already linked)
cd /Users/marco/Desktop/Projects/BonusTracker/BonusTracker
supabase link --project-ref YOUR-PROJECT-REF

# 2. Deploy the function
supabase functions deploy daily-fast-check
```

## Verify Deployment

After deployment, test the function:

1. Go to the Fast-Check page in your app: `/fast-check`
2. It should load without errors
3. You should see the top 5 critical issues (or "All Clear!" if none)

## Troubleshooting

**Error: "Failed to send a request to the Edge Function"**
- ✅ Function is not deployed → Deploy using steps above
- ✅ Function name mismatch → Ensure it's named exactly `daily-fast-check`
- ✅ CORS issues → Check `ALLOWED_ORIGINS` environment variable

**Error: "Missing Supabase credentials"**
- ✅ Environment variables are auto-set by Supabase
- ✅ If using CLI, ensure you're linked to the correct project

## Function Purpose

The `daily-fast-check` function scans your database for:
- 🔴 Overdue deadlines
- 🟠 Deadlines due in 48h
- 🟡 Stale updates (14+ days)
- 🔵 Missing deposits
- ⚪ Pending requests (7+ days old)

It returns the top 5 most critical issues prioritized by urgency.

