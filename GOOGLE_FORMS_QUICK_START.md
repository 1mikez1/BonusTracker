# Google Forms Integration - Quick Start

## 🚀 Quick Setup (5 minutes)

### Step 1: Get Your Supabase Webhook URL

1. Go to your Supabase Dashboard: https://app.supabase.com
2. Select your project
3. Go to **Edge Functions** → **google-forms-webhook**
4. If the function doesn't exist, deploy it first (see full guide: `GOOGLE_FORMS_SETUP.md`)
5. Copy your webhook URL:
   ```
   https://YOUR-PROJECT-REF.supabase.co/functions/v1/google-forms-webhook
   ```
   Replace `YOUR-PROJECT-REF` with your project reference (found in Settings → API)

### Step 2: Set Up Google Apps Script

1. **Open your Google Form**
2. Click **⋮** (three dots) → **Script editor**
3. **Delete existing code** and paste this:

```javascript
// ⚙️ CONFIGURATION - UPDATE THESE VALUES
const SUPABASE_FUNCTION_URL = 'https://YOUR-PROJECT-REF.supabase.co/functions/v1/google-forms-webhook';
const SUPABASE_ANON_KEY = 'YOUR-ANON-KEY'; // Optional

function onFormSubmit(e) {
  try {
    const form = FormApp.getActiveForm();
    const formResponse = e.response;
    
    if (!formResponse) {
      Logger.log('No form response found');
      return;
    }
    
    const payload = {
      formId: form.getId(),
      formName: form.getTitle(),
      timestamp: new Date().toISOString(),
      responses: {}
    };
    
    const itemResponses = formResponse.getItemResponses();
    itemResponses.forEach(function(itemResponse) {
      const item = itemResponse.getItem();
      payload.responses[item.getId().toString()] = {
        question: item.getTitle(),
        answer: itemResponse.getResponse()
      };
    });
    
    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    
    if (SUPABASE_ANON_KEY) {
      options.headers = {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      };
    }
    
    const response = UrlFetchApp.fetch(SUPABASE_FUNCTION_URL, options);
    const responseCode = response.getResponseCode();
    
    if (responseCode === 200) {
      Logger.log('✅ Successfully sent to webhook');
    } else {
      Logger.log('❌ Error: ' + responseCode);
      Logger.log(response.getContentText());
    }
    
  } catch (error) {
    Logger.log('❌ Error: ' + error.toString());
  }
}
```

4. **Update the URL** - Replace `YOUR-PROJECT-REF` with your actual Supabase project reference
5. **Save** (File → Save, name it "Webhook")
6. **Create Trigger**:
   - Click **Triggers** (⏰ icon)
   - **+ Add Trigger**
   - Function: `onFormSubmit`
   - Event: `On form submit`
   - **Save** and authorize

### Step 3: Test It!

1. Submit a test form
2. Check Google Apps Script logs (View → Logs)
3. Check BonusTracker → **Requests** page
4. You should see a new request! 🎉

## ✅ What Happens Next?

1. **Form submissions** → Appear in **Requests** page
2. **Click "Convert"** → Creates client record
3. **Requested apps** → Automatically linked to client

## 🔍 Troubleshooting

**Not seeing requests?**
- Check Google Apps Script logs for errors
- Verify webhook URL is correct
- Check Supabase Edge Function logs

**Need help?** See full guide: `GOOGLE_FORMS_SETUP.md`

