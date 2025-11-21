# Vercel Deployment Guide

This guide will help you deploy the BonusTracker app to Vercel.

## ✅ Fixed Issues

1. **Fixed duplicate scripts section** in `package.json`
2. **Moved `pg` to devDependencies** - This package is only used in migration scripts, not in the production app
3. **Created `vercel.json`** - Configuration file for Vercel
4. **Created `.vercelignore`** - Excludes unnecessary files from deployment

## 📋 Pre-Deployment Checklist

### 1. Environment Variables

You **must** set these environment variables in your Vercel project settings:

1. Go to your Vercel project → Settings → Environment Variables
2. Add the following variables:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

**Important:** 
- These are public variables (prefixed with `NEXT_PUBLIC_`) and will be exposed to the browser
- Do NOT add `SUPABASE_SERVICE_ROLE_KEY` to Vercel - it's only for local migration scripts

### 2. Node.js Version

The project requires Node.js 18 or higher. Vercel should detect this automatically from `package.json`, but you can verify in:
- Vercel Dashboard → Settings → General → Node.js Version (should be 18.x or higher)

## 🚀 Deployment Steps

### Option 1: Deploy via Vercel CLI

1. Install Vercel CLI (if not already installed):
   ```bash
   npm i -g vercel
   ```

2. Login to Vercel:
   ```bash
   vercel login
   ```

3. Deploy:
   ```bash
   vercel
   ```
   
   For production:
   ```bash
   vercel --prod
   ```

### Option 2: Deploy via GitHub Integration

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Click "New Project"
4. Import your GitHub repository
5. Vercel will auto-detect Next.js
6. Add environment variables (see above)
7. Click "Deploy"

## 🔍 Troubleshooting

### Build Errors

If you encounter build errors:

1. **Check environment variables** - Make sure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set
2. **Check Node.js version** - Ensure it's 18+ in Vercel settings
3. **Check build logs** - Review the build output in Vercel dashboard for specific errors

### Common Issues

#### "Module not found" errors
- Make sure all dependencies are in `dependencies` (not just `devDependencies`)
- Run `npm install` locally to verify all packages install correctly

#### "Environment variable not found"
- Double-check variable names (case-sensitive)
- Ensure variables are set for the correct environment (Production, Preview, Development)

#### "Build timeout"
- The build should complete quickly for this app
- If it times out, check for infinite loops or heavy computations during build

## 📝 Notes

- **Migration scripts** (`scripts/` folder) are excluded from deployment - they should only be run locally
- **Data files** (CSV, Excel) are excluded from deployment
- **Supabase Edge Functions** are deployed separately to Supabase, not Vercel
- The app uses **Next.js App Router** which is fully supported by Vercel

## 🔐 Security Reminders

- Never commit `.env.local` files
- Never expose `SUPABASE_SERVICE_ROLE_KEY` in the frontend
- Use Row Level Security (RLS) policies in Supabase to protect data
- Only use `NEXT_PUBLIC_*` variables for values that are safe to expose to the browser

## 📞 Need Help?

If you're still experiencing issues:
1. Check the build logs in Vercel dashboard
2. Verify all environment variables are set correctly
3. Ensure your Supabase project is accessible and RLS policies are configured

