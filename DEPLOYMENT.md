# Deployment Guide

## Vercel (Recommended - Easiest & Free)

### Prerequisites
1. Push your code to GitHub, GitLab, or Bitbucket
2. Create a Vercel account at [vercel.com](https://vercel.com)

### Deployment Steps

1. **Sign in to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Sign in with your GitHub/GitLab/Bitbucket account

2. **Import Project**
   - Click "Add New Project"
   - Select your repository
   - Vercel will auto-detect Next.js

3. **Configure Environment Variables**
   - Add your Supabase environment variables in Vercel:
     - `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anonymous/public key
   - To add: Project Settings → Environment Variables → Add New
   - Make sure to add them for Production, Preview, and Development environments
   - You can find these values in your Supabase dashboard under Settings → API

4. **Deploy**
   - Click "Deploy"
   - Wait 1-2 minutes for the build to complete
   - Your app will be live at `your-project-name.vercel.app`

5. **Custom Domain (Optional)**
   - Go to Project Settings → Domains
   - Add your custom domain
   - Follow DNS configuration instructions

### Vercel Free Plan Limits
- ✅ Unlimited deployments
- ✅ 100GB bandwidth/month
- ✅ Automatic HTTPS
- ✅ Preview deployments for PRs
- ✅ Global CDN
- ✅ Serverless functions (100GB-hours/month)

---

## Firebase Hosting (Alternative)

### Prerequisites
1. Install Firebase CLI: `npm install -g firebase-tools`
2. Create a Firebase project at [firebase.google.com](https://firebase.google.com)

### Setup Steps

1. **Initialize Firebase**
   ```bash
   firebase login
   firebase init hosting
   ```

2. **Configure Firebase**
   - Select your Firebase project
   - Public directory: `.next` (or `out` if using static export)
   - Configure as single-page app: No
   - Set up automatic builds: Yes (if using GitHub)

3. **Build and Deploy**
   ```bash
   npm run build
   firebase deploy --only hosting
   ```

### Firebase Free Plan Limits
- ⚠️ 10GB storage
- ⚠️ 360MB/day bandwidth
- ⚠️ For Next.js server features, requires Firebase Functions (more complex setup)

---

## Recommendation

**Use Vercel** - It's specifically designed for Next.js, requires zero configuration, and the free plan is more generous for Next.js applications. Your project already has `vercel.json` configured, making it ready to deploy immediately.

