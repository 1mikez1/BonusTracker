// Supabase Edge Function: Google Forms Webhook Handler
// Handles Google Forms webhook events for form submissions

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface GoogleFormsPayload {
  formId: string;
  formName: string;
  timestamp: string;
  responses: {
    [questionId: string]: {
      question: string;
      answer: string | string[];
    };
  };
  // Common field mappings (adjust based on your form structure)
  name?: string;
  email?: string;
  phone?: string;
  contact?: string;
  requestedApps?: string;
  notes?: string;
}

interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  data?: any;
}

const logs: LogEntry[] = [];

function log(level: 'info' | 'warn' | 'error', message: string, data?: any) {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    data
  };
  logs.push(entry);
  console.log(`[${entry.timestamp}] [${level.toUpperCase()}] ${message}`, data || '');
}

// Helper function to extract field from responses
function extractField(
  responses: GoogleFormsPayload['responses'],
  possibleKeys: string[]
): string | null {
  for (const key of possibleKeys) {
    const lowerKey = key.toLowerCase();
    for (const [questionId, response] of Object.entries(responses)) {
      const questionLower = response.question.toLowerCase();
      if (questionLower.includes(lowerKey) || questionId === key) {
        const answer = Array.isArray(response.answer) 
          ? response.answer.join(', ') 
          : response.answer;
        if (answer && answer.trim()) {
          return answer.trim();
        }
      }
    }
  }
  return null;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !supabaseServiceKey) {
      log('error', 'Missing Supabase credentials');
      return new Response(
        JSON.stringify({ error: "Missing Supabase credentials" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse webhook payload
    const payload: GoogleFormsPayload = await req.json();
    log('info', 'Received Google Forms webhook', { formId: payload.formId, formName: payload.formName });

    // Extract fields from responses
    const fullName = payload.name || extractField(payload.responses, ['nome', 'name', 'nome e cognome', 'full name']) || '';
    const email = payload.email || extractField(payload.responses, ['email', 'mail', 'e-mail']) || '';
    const phone = payload.phone || payload.contact || extractField(payload.responses, ['telefono', 'phone', 'cellulare', 'contact', 'contatto']) || '';
    const requestedApps = payload.requestedApps || extractField(payload.responses, ['app', 'apps', 'applicazioni', 'bonus', 'app richieste']) || '';
    const notes = payload.notes || extractField(payload.responses, ['note', 'notes', 'messaggio', 'message', 'altro']) || '';

    if (!fullName) {
      log('warn', 'Missing name in Google Forms submission');
      return new Response(
        JSON.stringify({ error: "Missing name" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse name (assume "First Last" format)
    const nameParts = fullName.trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || null;

    log('info', 'Processing Google Forms submission', {
      name: fullName,
      email,
      phone,
      requestedApps
    });

    // Step 1: Find or create client (deduplication by email or phone)
    let clientId: string | null = null;
    let clientCreated = false;
    let clientMerged = false;

    if (email || phone) {
      // Try to find existing client by email or phone
      let query = supabase
        .from('clients')
        .select('id, name, surname, email, contact')
        .limit(1);

      if (email) {
        query = query.eq('email', email);
      } else if (phone) {
        query = query.eq('contact', phone);
      }

      const { data: existingClient, error: findError } = await query.maybeSingle();

      if (findError && findError.code !== 'PGRST116') {
        log('error', 'Error finding client', findError);
        throw findError;
      }

      if (existingClient) {
        clientId = existingClient.id;
        clientMerged = true;
        log('info', 'Found existing client', { clientId, name: existingClient.name });
        
        // Merge: Update client with new information
        const updateData: any = {};
        if (email && !existingClient.email) updateData.email = email;
        if (phone && !existingClient.contact) updateData.contact = phone;
        if (lastName && !existingClient.surname) updateData.surname = lastName;
        if (firstName && existingClient.name !== firstName) {
          // Name mismatch - log but don't update (keep existing)
          log('warn', 'Name mismatch', {
            existing: existingClient.name,
            new: firstName
          });
        }

        if (Object.keys(updateData).length > 0) {
          const { error: updateError } = await supabase
            .from('clients')
            .update(updateData)
            .eq('id', clientId);

          if (updateError) {
            log('warn', 'Error updating client', updateError);
          } else {
            log('info', 'Merged client with new information');
          }
        }
      }
    }

    // Create client if not found
    if (!clientId) {
      const { data: newClient, error: createError } = await supabase
        .from('clients')
        .select('id')
        .insert({
          name: firstName,
          surname: lastName,
          email: email || null,
          contact: phone || null,
          trusted: false,
          tier_id: null, // Will be assigned by auto-tier function
        })
        .single();

      if (createError) {
        log('error', 'Error creating client', createError);
        throw createError;
      }

      clientId = newClient.id;
      clientCreated = true;
      log('info', 'Created new client', { clientId, name: firstName });
    }

    // Step 2: Assign tier automatically
    if (clientId) {
      const { error: tierError } = await supabase.rpc('assign_auto_tier', {
        p_client_id: clientId
      });

      if (tierError) {
        log('warn', 'Error assigning tier', tierError);
        // Non-fatal, continue
      } else {
        log('info', 'Assigned tier to client');
      }
    }

    // Step 3: Create request with type "submitted_form" and status "new"
    const requestNotes = [
      `Google Form: ${payload.formName}`,
      `Form ID: ${payload.formId}`,
      notes ? `Notes: ${notes}` : null,
      `Full responses: ${JSON.stringify(payload.responses)}`
    ].filter(Boolean).join('\n');

    const { data: newRequest, error: requestError } = await supabase
      .from('requests')
      .select('id')
      .insert({
        client_id: clientId,
        name: firstName,
        surname: lastName,
        email: email || null,
        contact: phone || null,
        requested_apps_raw: requestedApps || null,
        request_type: 'submitted_form',
        status: 'new',
        webhook_source: 'google_forms',
        webhook_payload: payload as any,
        notes: requestNotes || null,
        external_form_id: `google_forms_${payload.formId}_${payload.timestamp}`
      })
      .single();

    if (requestError) {
      log('error', 'Error creating request', requestError);
      throw requestError;
    }

    log('info', 'Created form submission request', { requestId: newRequest.id });

    // Step 4: Return success response
    return new Response(
      JSON.stringify({
        success: true,
        clientId,
        clientCreated,
        clientMerged,
        requestId: newRequest.id,
        logs: logs.slice(-10) // Return last 10 log entries
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    log('error', 'Webhook processing failed', error);
    return new Response(
      JSON.stringify({
        error: error.message || "Internal server error",
        logs: logs.slice(-10)
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

