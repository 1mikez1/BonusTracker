// Supabase Edge Function: Calendly Webhook Handler
// Handles Calendly webhook events for appointment bookings

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface CalendlyEvent {
  event: string; // 'invitee.created', 'invitee.canceled', etc.
  payload: {
    event_type: {
      uuid: string;
      name: string;
      kind: string;
    };
    invitee: {
      uuid: string;
      name: string;
      email: string;
      text_reminder_number?: string;
      questions_and_answers?: Array<{
        question: string;
        answer: string;
      }>;
    };
    scheduled_event: {
      uuid: string;
      name: string;
      start_time: string;
      end_time: string;
    };
  };
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
    const event: CalendlyEvent = await req.json();
    log('info', 'Received Calendly webhook', { event: event.event });

    // Only process 'invitee.created' events
    if (event.event !== "invitee.created") {
      log('info', `Ignoring event type: ${event.event}`);
      return new Response(
        JSON.stringify({ message: "Event ignored" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { invitee, scheduled_event } = event.payload;

    // Extract data
    const fullName = invitee.name || '';
    const email = invitee.email || '';
    const phone = invitee.text_reminder_number || '';
    
    // Parse name (assume "First Last" format)
    const nameParts = fullName.trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || null;

    if (!firstName) {
      log('warn', 'Missing name in Calendly event');
      return new Response(
        JSON.stringify({ error: "Missing name" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    log('info', 'Processing Calendly booking', {
      name: fullName,
      email,
      phone,
      eventName: scheduled_event.name
    });

    // Step 1: Find or create client (deduplication by email or phone)
    let clientId: string | null = null;
    let clientCreated = false;

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
        log('info', 'Found existing client', { clientId, name: existingClient.name });
        
        // Update client if new information is available
        const updateData: any = {};
        if (email && !existingClient.email) updateData.email = email;
        if (phone && !existingClient.contact) updateData.contact = phone;
        if (lastName && !existingClient.surname) updateData.surname = lastName;

        if (Object.keys(updateData).length > 0) {
          const { error: updateError } = await supabase
            .from('clients')
            .update(updateData)
            .eq('id', clientId);

          if (updateError) {
            log('warn', 'Error updating client', updateError);
          } else {
            log('info', 'Updated client with new information');
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

    // Step 3: Create request with type "onboarding" and status "scheduled"
    const requestNotes = [
      `Calendly Event: ${scheduled_event.name}`,
      `Scheduled: ${scheduled_event.start_time}`,
      `Event UUID: ${scheduled_event.uuid}`,
      invitee.questions_and_answers?.length 
        ? `Q&A: ${JSON.stringify(invitee.questions_and_answers)}`
        : null
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
        request_type: 'onboarding',
        status: 'scheduled',
        webhook_source: 'calendly',
        webhook_payload: event as any,
        notes: requestNotes || null,
        external_form_id: `calendly_${invitee.uuid}`
      })
      .single();

    if (requestError) {
      log('error', 'Error creating request', requestError);
      throw requestError;
    }

    log('info', 'Created onboarding request', { requestId: newRequest.id });

    // Step 4: Return success response
    return new Response(
      JSON.stringify({
        success: true,
        clientId,
        clientCreated,
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

