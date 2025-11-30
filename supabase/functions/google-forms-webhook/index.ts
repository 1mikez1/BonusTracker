// Supabase Edge Function: Google Forms Webhook Handler
// Handles Google Forms webhook events for form submissions

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS configuration - can be restricted via ALLOWED_ORIGINS environment variable
// Format: comma-separated list of origins, e.g., "https://example.com,https://app.example.com"
// Default: "*" (allows all origins) - change this in production for better security
const allowedOrigins = Deno.env.get("ALLOWED_ORIGINS")?.split(",").map(o => o.trim()) || ["*"];
const origin = Deno.env.get("ORIGIN") || "*"; // For backward compatibility

const corsHeaders = {
  "Access-Control-Allow-Origin": origin, // Default to * for backward compatibility
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

// Name normalization - removes accents, handles common variations
function normalizeName(name: string): string {
  if (!name) return '';
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD') // Decompose accented characters
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[.,\-_]/g, ' ') // Replace punctuation with space
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

// Calculate similarity between two strings (0-1)
function calculateSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  
  const s1 = normalizeName(str1);
  const s2 = normalizeName(str2);
  
  if (s1 === s2) return 1.0;
  if (!s1 || !s2) return 0;
  
  // If one contains the other (and they're not too different in length), high similarity
  if (s1.length > 0 && s2.length > 0) {
    if (s1.includes(s2) || s2.includes(s1)) {
      const lengthRatio = Math.min(s1.length, s2.length) / Math.max(s1.length, s2.length);
      return 0.85 + (lengthRatio * 0.1); // 0.85-0.95 based on length similarity
    }
  }
  
  // Simple Levenshtein-like similarity
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  const editDistance = levenshteinDistance(s1, s2);
  const similarity = 1 - (editDistance / Math.max(longer.length, 1));
  
  return Math.max(0, Math.min(1, similarity)); // Clamp between 0 and 1
}

// Simple Levenshtein distance
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[str2.length][str1.length];
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
    // Get origin from request to validate against allowed origins
    const requestOrigin = req.headers.get("origin");
    const allowedOrigin = allowedOrigins.includes("*") || allowedOrigins.includes(requestOrigin || "")
      ? (requestOrigin || "*")
      : allowedOrigins[0] || "*";
    
    return new Response("ok", { 
      headers: {
        ...corsHeaders,
        "Access-Control-Allow-Origin": allowedOrigin
      }
    });
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
    // Handle Italian form structure: Nome, Cognome, Email, Telefono, app richieste, Note
    const firstName = extractField(payload.responses, ['nome', 'name', 'first name']) || '';
    const lastName = extractField(payload.responses, ['cognome', 'surname', 'last name']) || '';
    const fullName = payload.name || (firstName && lastName ? `${firstName} ${lastName}` : firstName || lastName || extractField(payload.responses, ['nome e cognome', 'full name', 'name']) || '');
    const email = payload.email || extractField(payload.responses, ['email', 'mail', 'e-mail']) || '';
    const phone = payload.phone || payload.contact || extractField(payload.responses, ['telefono', 'phone', 'cellulare', 'contact', 'contatto']) || '';
    
    // Handle requested apps - can be checkboxes (array) or single selection
    let requestedApps = payload.requestedApps || extractField(payload.responses, ['app richieste', 'app', 'apps', 'applicazioni', 'bonus']) || '';
    
    // If requestedApps is an array (from checkboxes), join them
    if (Array.isArray(requestedApps)) {
      requestedApps = requestedApps.join(', ');
    }
    
    const notes = payload.notes || extractField(payload.responses, ['note', 'notes', 'messaggio', 'message', 'altro']) || '';

    if (!fullName && !firstName) {
      log('warn', 'Missing name in Google Forms submission');
      return new Response(
        JSON.stringify({ error: "Missing name" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use extracted firstName/lastName if available, otherwise parse fullName
    let finalFirstName = firstName || '';
    let finalLastName = lastName || null;
    
    if (!finalFirstName && fullName) {
    // Parse name (assume "First Last" format)
    const nameParts = fullName.trim().split(/\s+/);
      finalFirstName = nameParts[0] || '';
      finalLastName = nameParts.slice(1).join(' ') || null;
    }

    log('info', 'Processing Google Forms submission', {
      name: fullName || `${finalFirstName} ${finalLastName || ''}`.trim(),
      firstName: finalFirstName,
      lastName: finalLastName,
      email,
      phone,
      requestedApps
    });

    // Step 1: Find or create client (deduplication by email, phone, or name)
    let clientId: string | null = null;
    let clientCreated = false;
    let clientMerged = false;
    let matchMethod: 'email' | 'phone' | 'name_exact' | 'name_fuzzy' | null = null;
    let matchConfidence: number = 1.0;

    // Helper function to find client by name (fuzzy matching)
    async function findClientByName(firstName: string, lastName: string | null): Promise<{ client: any; method: 'name_exact' | 'name_fuzzy'; confidence: number } | null> {
      const fullName = lastName ? `${firstName} ${lastName}` : firstName;
      const normalizedFirstName = normalizeName(firstName);
      const normalizedLastName = lastName ? normalizeName(lastName) : '';
      const normalizedFullName = normalizeName(fullName);

      log('info', 'Starting name matching', {
        searchingFor: fullName,
        normalized: normalizedFullName,
        firstName: normalizedFirstName,
        lastName: normalizedLastName
      });

      // Get all clients for fuzzy matching
      const { data: allClients, error: fetchError } = await supabase
        .from('clients')
        .select('id, name, surname, email, contact');

      if (fetchError || !allClients) {
        log('warn', 'Error fetching clients for name matching', fetchError);
        return null;
      }

      log('info', `Searching through ${allClients.length} clients for name match`);

      let bestMatch: { client: any; method: 'name_exact' | 'name_fuzzy'; confidence: number } | null = null;

      for (const client of allClients) {
        const clientFullName = client.surname 
          ? `${client.name} ${client.surname}` 
          : client.name;
        const normalizedClientFullName = normalizeName(clientFullName);
        const normalizedClientName = normalizeName(client.name || '');
        const normalizedClientSurname = normalizeName(client.surname || '');

        // Strategy 1: Exact full name match
        if (normalizedClientFullName === normalizedFullName) {
          return { client, method: 'name_exact', confidence: 1.0 };
        }

        // Strategy 2: Exact name + surname match
        if (normalizedClientName === normalizedFirstName && 
            (!lastName || normalizedClientSurname === normalizedLastName)) {
          if (!bestMatch || bestMatch.confidence < 0.95) {
            bestMatch = { client, method: 'name_exact', confidence: 0.95 };
          }
        }

        // Strategy 3: High similarity on full name (fuzzy match)
        const similarity = calculateSimilarity(clientFullName, fullName);
        if (similarity > 0.85 && (!bestMatch || bestMatch.confidence < similarity)) {
          bestMatch = { client, method: 'name_fuzzy', confidence: similarity };
        }

        // Strategy 4: Name matches + surname similarity
        if (normalizedClientName === normalizedFirstName && lastName) {
          const surnameSim = calculateSimilarity(client.surname || '', lastName);
          if (surnameSim > 0.8 && (!bestMatch || bestMatch.confidence < surnameSim * 0.9)) {
            bestMatch = { client, method: 'name_fuzzy', confidence: surnameSim * 0.9 };
          }
        }

        // Strategy 5: Partial match (one contains the other)
        if (normalizedClientFullName.includes(normalizedFullName) || 
            normalizedFullName.includes(normalizedClientFullName)) {
          const partialSim = Math.min(normalizedClientFullName.length, normalizedFullName.length) / 
                             Math.max(normalizedClientFullName.length, normalizedFullName.length);
          if (partialSim > 0.7 && (!bestMatch || bestMatch.confidence < partialSim)) {
            bestMatch = { client, method: 'name_fuzzy', confidence: partialSim };
          }
        }
      }

      // Log the best match found (even if below threshold)
      if (bestMatch) {
        log('info', 'Best name match found', {
          clientId: bestMatch.client.id,
          clientName: `${bestMatch.client.name} ${bestMatch.client.surname || ''}`.trim(),
          method: bestMatch.method,
          confidence: bestMatch.confidence,
          threshold: 0.70,
          passed: bestMatch.confidence > 0.70
        });
          } else {
        log('info', 'No name match found above threshold', {
          searchedName: fullName,
          threshold: 0.70
        });
      }

      // Only return if confidence is high enough (70% threshold - lowered to catch more matches)
      return bestMatch && bestMatch.confidence > 0.70 ? bestMatch : null;
    }

    // Try to find existing client - prioritize email, then phone, then name
    let existingClient: any = null;
    
    // First, try to find by email (most reliable)
    if (email) {
      const { data: clientByEmail, error: emailError } = await supabase
        .from('clients')
        .select('id, name, surname, email, contact')
        .eq('email', email)
        .limit(1)
        .maybeSingle();

      if (emailError && emailError.code !== 'PGRST116') {
        log('warn', 'Error finding client by email', emailError);
      } else if (clientByEmail) {
        existingClient = clientByEmail;
        matchMethod = 'email';
        log('info', 'Found existing client by email', { clientId: existingClient.id, email });
      }
    }
    
    // If not found by email and phone is provided, try phone
    if (!existingClient && phone) {
      const { data: clientByPhone, error: phoneError } = await supabase
        .from('clients')
        .select('id, name, surname, email, contact')
        .eq('contact', phone)
        .limit(1)
        .maybeSingle();

      if (phoneError && phoneError.code !== 'PGRST116') {
        log('warn', 'Error finding client by phone', phoneError);
      } else if (clientByPhone) {
        existingClient = clientByPhone;
        matchMethod = 'phone';
        log('info', 'Found existing client by phone', { clientId: existingClient.id, phone });
      }
    }

    // If not found by email/phone, try name matching (fuzzy)
    if (!existingClient && finalFirstName) {
      log('info', 'Attempting name-based matching', { 
        firstName: finalFirstName, 
        lastName: finalLastName,
        fullName: fullName || `${finalFirstName} ${finalLastName || ''}`.trim()
      });
      const nameMatch = await findClientByName(finalFirstName, finalLastName);
      if (nameMatch) {
        existingClient = nameMatch.client;
        matchMethod = nameMatch.method;
        matchConfidence = nameMatch.confidence;
        log('info', 'Found existing client by name', { 
          clientId: existingClient.id, 
          method: nameMatch.method,
          confidence: nameMatch.confidence,
          formName: fullName || `${finalFirstName} ${finalLastName || ''}`.trim(),
          dbName: `${existingClient.name} ${existingClient.surname || ''}`.trim()
        });
      } else {
        log('info', 'No name match found', { 
          searchedName: fullName || `${finalFirstName} ${finalLastName || ''}`.trim(),
          firstName: finalFirstName,
          lastName: finalLastName
        });
      }
    } else if (!existingClient && !finalFirstName) {
      log('warn', 'Cannot attempt name matching - no first name provided');
    }

    // DO NOT create clients or link requests automatically
    // Only flag potential matches in notes for user review
    // User must manually merge/accept requests to create/update clients
    if (existingClient) {
      clientMerged = true;
      log('info', 'Potential existing client match found - flagging in notes only (not linking)', { 
        potentialClientId: existingClient.id, 
        name: existingClient.name,
        matchedBy: matchMethod,
        confidence: matchConfidence,
        note: 'Request will be flagged but NOT linked. User must manually merge to link/update client.'
      });
      
      // Store potential match info for notes, but DON'T set clientId
      // This keeps requests separate until user explicitly merges
    } else {
      log('info', 'No existing client match found - request will be created as new (no auto-creation)');
    }

    // DO NOT create clients automatically
    // Requests stay separate until user manually merges them
    // This gives full control to the user

    // Step 3: Create request with type "submitted_form" and status "new"
    // Include email in notes so it can be extracted even if email column doesn't exist
    // Include potential client match info if found (but don't link)
    const potentialClientInfo = clientMerged && existingClient
      ? `Potential Match: ${existingClient.name}${existingClient.surname ? ` ${existingClient.surname}` : ''} (ID: ${existingClient.id}) - Matched by: ${matchMethod || 'unknown'}${matchMethod?.includes('fuzzy') ? ` (confidence: ${Math.round(matchConfidence * 100)}%)` : ''}`
      : null;
    
    const requestNotes = [
      `Google Form: ${payload.formName}`,
      `Form ID: ${payload.formId}`,
      email ? `Email: ${email}` : null,
      clientMerged ? `⚠️ POTENTIAL EXISTING CLIENT - ${potentialClientInfo} - Review and merge manually if correct` : null,
      notes ? `Notes: ${notes}` : null,
      `Full responses: ${JSON.stringify(payload.responses)}`
    ].filter(Boolean).join('\n');

    // Build request data - start with required fields that always exist
    // DO NOT set client_id - keep requests separate until user manually merges
    const requestData: any = {
      client_id: null, // Always null - user must manually merge to link
      name: fullName || `${finalFirstName} ${finalLastName || ''}`.trim(), // Use full name (requests table doesn't have separate surname)
      contact: phone || null,
      requested_apps_raw: requestedApps || null,
      status: 'new',
      notes: requestNotes || null,
      external_form_id: `google_forms_${payload.formId}_${payload.timestamp}`
    };

    // Add optional fields that may exist if migration 0024 has been applied
    // We'll try to insert them, but if they fail, we'll retry without them
    const optionalFields: any = {};
    if (email) {
      optionalFields.email = email;
    }
    optionalFields.request_type = 'submitted_form';
    optionalFields.webhook_source = 'google_forms';
    optionalFields.webhook_payload = payload;

    // Try inserting with optional fields first
    let newRequest: any = null;
    let requestError: any = null;
    
    const { data: requestWithOptional, error: errorWithOptional } = await supabase
      .from('requests')
      .insert({ ...requestData, ...optionalFields })
      .select('id')
      .single();

    if (errorWithOptional && (
      errorWithOptional.code === 'PGRST204' || 
      errorWithOptional.message?.includes('column') || 
      errorWithOptional.message?.includes('not found') ||
      errorWithOptional.message?.includes('Could not find')
    )) {
      // Column doesn't exist - retry without optional fields
      log('info', 'Optional columns not found, inserting without them', { error: errorWithOptional.message });
      const { data: requestBasic, error: errorBasic } = await supabase
        .from('requests')
        .insert(requestData)
        .select('id')
        .single();
      
      newRequest = requestBasic;
      requestError = errorBasic;
    } else {
      newRequest = requestWithOptional;
      requestError = errorWithOptional;
    }

    if (requestError) {
      log('error', 'Error creating request', requestError);
      throw requestError;
    }

    log('info', 'Created form submission request', { 
      requestId: newRequest.id,
      potentialMatch: clientMerged ? 'found (flagged in notes, not linked)' : 'none',
      clientStatus: clientMerged ? 'potential match found' : 'new request (no match)',
      requestedApps,
      note: 'Request is NOT linked to any client. User must manually merge to create/update client.'
    });

    // Step 4: Return success response
    // Get origin from request to validate against allowed origins
    const requestOrigin = req.headers.get("origin");
    const allowedOrigin = allowedOrigins.includes("*") || allowedOrigins.includes(requestOrigin || "")
      ? (requestOrigin || "*")
      : allowedOrigins[0] || "*";
    
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
        headers: { 
          ...corsHeaders, 
          "Access-Control-Allow-Origin": allowedOrigin,
          "Content-Type": "application/json" 
        },
      }
    );
  } catch (error: any) {
    log('error', 'Webhook processing failed', error);
    // Get origin from request to validate against allowed origins
    const requestOrigin = req.headers.get("origin");
    const allowedOrigin = allowedOrigins.includes("*") || allowedOrigins.includes(requestOrigin || "")
      ? (requestOrigin || "*")
      : allowedOrigins[0] || "*";
    
    return new Response(
      JSON.stringify({
        error: error.message || "Internal server error",
        logs: logs.slice(-10)
      }),
      {
        status: 500,
        headers: { 
          ...corsHeaders, 
          "Access-Control-Allow-Origin": allowedOrigin,
          "Content-Type": "application/json" 
        },
      }
    );
  }
});

