/**
 * Google Apps Script: Send Google Forms submissions to Supabase Webhook
 * 
 * Setup:
 * 1. Open your Google Form
 * 2. Click "..." → Script editor
 * 3. Paste this code
 * 4. Update SUPABASE_FUNCTION_URL with your Supabase function URL
 * 5. Create a trigger: Edit → Current project's triggers → Add trigger
 *    - Event: On form submit
 *    - Function: onFormSubmit
 * 
 * Note: This script requires the form to have a "Submit" button enabled.
 */

// ⚙️ CONFIGURATION
// IMPORTANT: Replace these placeholders with your actual Supabase credentials
// 1. Get your Supabase project URL from: https://app.supabase.com > Your Project > Settings > API
// 2. Get your anon key from: https://app.supabase.com > Your Project > Settings > API > anon public key
// 3. Get your function URL: https://YOUR-PROJECT-REF.supabase.co/functions/v1/google-forms-webhook

const SUPABASE_FUNCTION_URL = 'https://YOUR-PROJECT-REF.supabase.co/functions/v1/google-forms-webhook';
const SUPABASE_ANON_KEY = 'YOUR-ANON-KEY-HERE'; // Optional, if you want to add auth

/**
 * Trigger function: Called when form is submitted
 */
function onFormSubmit(e) {
  try {
    // Get form and response
    const form = FormApp.getActiveForm();
    const formResponse = e.response;
    
    if (!formResponse) {
      Logger.log('No form response found');
      return;
    }
    
    // Build payload
    const payload = {
      formId: form.getId(),
      formName: form.getTitle(),
      timestamp: new Date().toISOString(),
      responses: {}
    };
    
    // Extract all responses
    const itemResponses = formResponse.getItemResponses();
    itemResponses.forEach(function(itemResponse) {
      const item = itemResponse.getItem();
      const question = item.getTitle();
      const answer = itemResponse.getResponse();
      
      // Store response with question ID as key
      payload.responses[item.getId().toString()] = {
        question: question,
        answer: answer
      };
    });
    
    // Send to Supabase webhook
    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    
    // Add auth header if configured
    if (SUPABASE_ANON_KEY) {
      options.headers = {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      };
    }
    
    const response = UrlFetchApp.fetch(SUPABASE_FUNCTION_URL, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();
    
    if (responseCode === 200) {
      Logger.log('Successfully sent form submission to webhook');
      Logger.log('Response: ' + responseText);
    } else {
      Logger.log('Error sending to webhook: ' + responseCode);
      Logger.log('Response: ' + responseText);
      
      // Optional: Send email notification on error
      // MailApp.sendEmail({
      //   to: 'admin@example.com',
      //   subject: 'Webhook Error',
      //   body: 'Error sending form submission: ' + responseText
      // });
    }
    
  } catch (error) {
    Logger.log('Error in onFormSubmit: ' + error.toString());
    Logger.log(error.stack);
  }
}

/**
 * Test function: Manually trigger webhook with sample data
 */
function testWebhook() {
  const form = FormApp.getActiveForm();
  
  const payload = {
    formId: form.getId(),
    formName: form.getTitle(),
    timestamp: new Date().toISOString(),
    responses: {
      'test-question-1': {
        question: 'Nome e Cognome',
        answer: 'Test User'
      },
      'test-question-2': {
        question: 'Email',
        answer: 'test@example.com'
      },
      'test-question-3': {
        question: 'Telefono',
        answer: '+39 123 456 7890'
      }
    }
  };
  
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
  Logger.log('Test response: ' + response.getContentText());
}

