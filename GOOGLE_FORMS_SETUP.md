# Google Forms Integration Setup Guide

This guide will help you connect your Google Form to BonusTracker so that form submissions automatically create client records in your requests inbox.

## Overview

When someone submits your Google Form:
1. **Google Apps Script** sends the submission to your Supabase webhook
2. **Supabase Edge Function** processes the submission and creates a request record
3. **BonusTracker Dashboard** shows the request in the "Requests" page
4. **You convert** the request into a full client record

## Step 1: Deploy Supabase Edge Function

### Option A: Using Supabase CLI (Recommended)

1. Install Supabase CLI if you haven't:
   ```bash
   npm install -g supabase
   ```

2. Login to Supabase:
   ```bash
   supabase login
   ```

3. Link your project:
   ```bash
   cd /Users/marco/Desktop/Projects/BonusTracker/BonusTracker
   supabase link --project-ref YOUR-PROJECT-REF
   ```

4. Deploy the function:
   ```bash
   supabase functions deploy google-forms-webhook
   ```

### Option B: Using Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **Edge Functions** → **Create a new function**
3. Name it: `google-forms-webhook`
4. Copy the code from `supabase/functions/google-forms-webhook/index.ts`
5. Deploy the function

### Get Your Webhook URL

After deployment, your webhook URL will be:
```
https://YOUR-PROJECT-REF.supabase.co/functions/v1/google-forms-webhook
```

Replace `YOUR-PROJECT-REF` with your actual Supabase project reference ID.

## Step 2: Set Up Google Apps Script

1. **Open your Google Form**
   - Go to [Google Forms](https://forms.google.com)
   - Open the form you want to connect

2. **Open Script Editor**
   - Click the **three dots (⋮)** in the top right
   - Select **Script editor**

3. **Paste the Script Code**
   - Delete any existing code
   - Copy the code from `supabase/functions/google-forms-webhook/google-apps-script-example.js`
   - Paste it into the editor

4. **Update Configuration**
   - Replace `YOUR-PROJECT-REF` with your Supabase project reference
   - Replace `YOUR-ANON-KEY` with your Supabase anon key (optional, for auth)
   
   ```javascript
   const SUPABASE_FUNCTION_URL = 'https://YOUR-PROJECT-REF.supabase.co/functions/v1/google-forms-webhook';
   const SUPABASE_ANON_KEY = 'YOUR-ANON-KEY'; // Optional
   ```

5. **Save the Script**
   - Click **File** → **Save**
   - Name it: "Google Forms to Supabase Webhook"

6. **Create Trigger**
   - Click **Triggers** (clock icon) in the left sidebar
   - Click **+ Add Trigger** (bottom right)
   - Configure:
     - **Function to run**: `onFormSubmit`
     - **Event source**: `From form`
     - **Event type**: `On form submit`
   - Click **Save**
   - Authorize the script when prompted

7. **Test the Webhook** (Optional)
   - In the script editor, select `testWebhook` from the function dropdown
   - Click **Run** (▶️)
   - Check the logs to see if it worked

## Step 3: Configure Your Google Form

Your Google Form should have these fields (or similar):

- **Name** (required): Full name or "Nome e Cognome"
- **Email**: Email address
- **Phone/Contact**: "Telefono", "Phone", or "Contact"
- **Requested Apps**: List of apps they're interested in
- **Notes**: Any additional information

The webhook will automatically detect these fields using common keywords:
- Name: `nome`, `name`, `nome e cognome`, `full name`
- Email: `email`, `mail`, `e-mail`
- Phone: `telefono`, `phone`, `cellulare`, `contact`, `contatto`
- Apps: `app`, `apps`, `applicazioni`, `bonus`, `app richieste`
- Notes: `note`, `notes`, `messaggio`, `message`, `altro`

## Step 4: Test the Integration

1. **Submit a Test Form**
   - Fill out your Google Form with test data
   - Submit it

2. **Check Supabase Logs**
   - Go to Supabase Dashboard → **Edge Functions** → `google-forms-webhook`
   - Click **Logs** to see if the webhook was called

3. **Check BonusTracker**
   - Open your BonusTracker dashboard
   - Go to **Requests** page
   - You should see a new request with status "new"
   - The request will show:
     - Name and contact info
     - Requested apps
     - Source: "google_forms"

## Step 5: Convert Requests to Clients

1. **View Requests**
   - Go to **Requests** page in BonusTracker
   - Find the request you want to convert

2. **Convert to Client**
   - Click the **"Convert"** button on the request
   - Or click **"New Signup"** and select the request from the dropdown
   - The system will:
     - Create a new client (or merge with existing)
     - Create client_app records for requested apps
     - Update request status to "converted"

## Troubleshooting

### Webhook Not Receiving Submissions

1. **Check Google Apps Script Logs**
   - In Script Editor, go to **Executions** (clock icon)
   - Check for errors

2. **Check Supabase Function Logs**
   - Supabase Dashboard → Edge Functions → Logs
   - Look for errors or failed requests

3. **Verify Webhook URL**
   - Make sure the URL in Google Apps Script matches your Supabase function URL
   - Test the URL manually with a tool like Postman

### Requests Not Appearing

1. **Check Request Status**
   - Go to Requests page
   - Check if status filter is hiding new requests

2. **Check Database**
   - Supabase Dashboard → Table Editor → `requests` table
   - Look for records with `webhook_source = 'google_forms'`

### Field Mapping Issues

If fields aren't being detected correctly:

1. **Update Field Mapping**
   - Edit `supabase/functions/google-forms-webhook/index.ts`
   - Update the `extractField` function calls with your form's field names
   - Redeploy the function

2. **Use Direct Field Names**
   - In Google Apps Script, you can map fields directly:
   ```javascript
   payload.name = extractField(payload.responses, ['Your Exact Field Name']);
   ```

## Security Notes

- The webhook URL is public, but you can add authentication
- Consider adding rate limiting to prevent abuse
- The Supabase function uses service role key (keep it secret)

## Next Steps

Once set up:
- Form submissions will automatically appear in Requests
- You can convert them to clients with one click
- The system will track which form each submission came from
- All form data is preserved in the request notes

## Support

If you encounter issues:
1. Check the logs in both Google Apps Script and Supabase
2. Verify your Supabase project has the required database tables
3. Make sure the Edge Function has the correct environment variables

