'use client';

import { useMemo, useState } from 'react';
import { SectionHeader } from '@/components/SectionHeader';
import { DataTable } from '@/components/DataTable';
import { FiltersBar } from '@/components/FiltersBar';
import { useSupabaseData } from '@/lib/useSupabaseData';
import { useSupabaseMutations } from '@/lib/useSupabaseMutations';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { StatusBadge } from '@/components/StatusBadge';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorMessage } from '@/components/ErrorMessage';
import { EmptyState } from '@/components/EmptyState';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { NewSignupModal } from '@/components/NewSignupModal';
import { Toast } from '@/components/Toast';

export default function RequestsPage() {
  const router = useRouter();
  
  const {
    data: requests,
    isLoading: requestsLoading,
    error: requestsError,
    mutate: mutateRequests,
    isDemo
  } = useSupabaseData({
    table: 'requests',
    order: { column: 'created_at', ascending: false },
    select: '*, clients(*)'
  });
  
  const {
    data: clients,
    isLoading: clientsLoading,
    error: clientsError,
    mutate: mutateClients
  } = useSupabaseData({ table: 'clients' });
  
  const {
    data: apps,
    isLoading: appsLoading,
    error: appsError
  } = useSupabaseData({ table: 'apps' });
  
  const {
    data: clientApps,
    isLoading: clientAppsLoading,
    error: clientAppsError,
    mutate: mutateClientApps
  } = useSupabaseData({ table: 'client_apps' });
  
  const {
    data: tiers,
    isLoading: tiersLoading,
    error: tiersError
  } = useSupabaseData({ table: 'tiers' });
  
  const { mutate: updateRequest, remove: deleteRequest } = useSupabaseMutations('requests');
  const { insert: insertClient, mutate: updateClient } = useSupabaseMutations('clients');
  const { insert: insertClientApp } = useSupabaseMutations('client_apps');

  const isLoading = requestsLoading || clientsLoading || appsLoading || clientAppsLoading || tiersLoading;
  const error = requestsError || clientsError || appsError || clientAppsError || tiersError;

  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showNewSignupModal, setShowNewSignupModal] = useState(false);
  const [convertRequestId, setConvertRequestId] = useState<string | null>(null);
  const [convertRequestData, setConvertRequestData] = useState<any>(null);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergeRequestData, setMergeRequestData] = useState<any>(null);
  
  // Toast notification state
  const [toast, setToast] = useState<{
    isOpen: boolean;
    message: string;
    type: 'success' | 'error' | 'info';
  }>({
    isOpen: false,
    message: '',
    type: 'success'
  });
  

  // Helper function to check if request is from existing client
  const isExistingClientRequest = (request: any): { isExisting: boolean; clientId: string | null; matchMethod?: string } => {
    // If request is converted, don't show as existing client
    if (request.status === 'converted') {
      return { isExisting: false, clientId: request.client_id };
    }
    
    // First check if explicitly linked
    if (request.client_id) {
      return { isExisting: true, clientId: request.client_id };
    }
    
    // Check notes for POTENTIAL EXISTING CLIENT flag (from webhook)
    if (request.notes && request.notes.includes('POTENTIAL EXISTING CLIENT')) {
      // Try to extract client ID from notes - webhook format: "Potential Match: Name (ID: uuid)"
      // Try multiple patterns to catch different formats
      const idPatterns = [
        /\(ID:\s*([a-f0-9-]{36})\)/i,  // (ID: uuid) - most common format
        /ID:\s*([a-f0-9-]{36})/i,      // ID: uuid
        /Potential Match:.*?\(ID:\s*([a-f0-9-]{36})\)/i  // Full match line
      ];
      
      let potentialClientId: string | null = null;
      for (const pattern of idPatterns) {
        const match = request.notes.match(pattern);
        if (match && match[1]) {
          potentialClientId = match[1];
          break;
        }
      }
      
      // Try to extract match method from notes
      const matchMethodMatch = request.notes.match(/Matched by: (\w+)/);
      const matchMethod = matchMethodMatch ? matchMethodMatch[1] : undefined;
      
      console.log('Extracting client from POTENTIAL EXISTING CLIENT flag:', {
        potentialClientId,
        matchMethod,
        notesPreview: request.notes.substring(0, 200)
      });
      
      // If we found a client ID in notes, verify it exists and return it
      if (potentialClientId && Array.isArray(clients)) {
        const client = clients.find((c: any) => c.id === potentialClientId);
        if (client) {
          console.log('Found existing client by ID from notes:', client.id, client.name);
          return { isExisting: true, clientId: client.id, matchMethod };
        } else {
          console.warn('Client ID found in notes but not in clients array:', potentialClientId);
        }
      }
      
      // Fallback: Try to find client by name/contact
      if (Array.isArray(clients) && request.name && request.contact) {
        const client = clients.find((c: any) => {
          const nameMatch = c.name.toLowerCase() === request.name.toLowerCase();
          const contactMatch = c.contact === request.contact;
          return nameMatch && contactMatch;
        });
        if (client) {
          console.log('Found existing client by name+contact fallback:', client.id, client.name);
          return { isExisting: true, clientId: client.id, matchMethod };
        }
      }
      
      // Flagged as potential match but couldn't find client - still show as existing for review
      console.warn('POTENTIAL EXISTING CLIENT flagged but client not found', {
        potentialClientId,
        requestName: request.name,
        requestContact: request.contact
      });
      return { isExisting: true, clientId: null, matchMethod };
    }
    
    // Legacy check for old format
    if (request.notes && request.notes.includes('EXISTING CLIENT')) {
      const matchMethodMatch = request.notes.match(/Matched by: (\w+)/);
      const matchMethod = matchMethodMatch ? matchMethodMatch[1] : undefined;
      
      if (Array.isArray(clients) && request.name && request.contact) {
        const client = clients.find((c: any) => {
          const nameMatch = c.name.toLowerCase() === request.name.toLowerCase();
          const contactMatch = c.contact === request.contact;
          return nameMatch && contactMatch;
        });
        if (client) {
          return { isExisting: true, clientId: client.id, matchMethod };
        }
      }
      return { isExisting: true, clientId: null, matchMethod };
    }
    
    return { isExisting: false, clientId: null };
  };

  // Helper function to check if requested apps already exist for client
  const getDuplicateApps = (request: any, clientId: string | null): any[] => {
    // Don't show duplicate apps warning if request is converted
    if (request.status === 'converted') {
      return [];
    }
    
    if (!clientId || !Array.isArray(clientApps) || !Array.isArray(apps) || !request.requested_apps_raw) {
      return [];
    }
    
    const requestedAppsText = request.requested_apps_raw.toLowerCase();
    const clientAppIds = clientApps
      .filter((ca: any) => ca.client_id === clientId)
      .map((ca: any) => ca.app_id);
    
    const duplicateApps = apps.filter((app: any) => {
      const isRequested = requestedAppsText.includes(app.name.toLowerCase());
      const alreadyExists = clientAppIds.includes(app.id);
      return isRequested && alreadyExists;
    });
    
    return duplicateApps;
  };

  const filteredRows = useMemo(() => {
    if (!Array.isArray(requests)) return [];
    return requests.filter((request: any) => {
      if (statusFilter !== 'all' && request.status !== statusFilter) {
        return false;
      }
      if (search) {
        const haystack = `${request.name} ${request.contact ?? ''} ${request.requested_apps_raw ?? ''}`.toLowerCase();
        if (!haystack.includes(search.toLowerCase())) {
          return false;
        }
      }
      return true;
    });
  }, [requests, statusFilter, search]);

  const handleConvertRequest = async (requestId: string) => {
    if (isDemo) {
      alert('Conversion is disabled in demo mode. Connect Supabase to enable this feature.');
      return;
    }

    const request = requests.find((r: any) => r.id === requestId);
    if (!request) return;

    try {
      // Check if client already exists (by name + contact)
      let client = clients.find(
        (c: any) => c.name.toLowerCase() === request.name.toLowerCase() && c.contact === request.contact
      );

      // Create client if doesn't exist
      if (!client) {
        const [name, ...surnameParts] = request.name.split(' ');
        const surname = surnameParts.join(' ') || null;
        client = await insertClient({
          name,
          surname,
          contact: request.contact ?? null,
          email: null,
          trusted: false,
          tier_id: null,
          invited_by_client_id: null,
          notes: `Converted from request ${requestId}`
        });
        await mutateClients();
      }

      // Parse requested apps (simple parsing - can be enhanced)
      const requestedAppsText = request.requested_apps_raw?.toLowerCase() || '';
      const matchedApps = apps.filter((app: any) => requestedAppsText.includes(app.name.toLowerCase()));

      // Create client_apps for each matched app
      for (const app of matchedApps) {
        await insertClientApp({
          client_id: client.id,
          app_id: app.id,
          status: 'requested',
          deposited: false,
          finished: false
        });
      }

      // Update request status
      await updateRequest({ status: 'converted', client_id: client.id, processed_at: new Date().toISOString() }, requestId);
      await mutateRequests();
      await mutateClientApps();

      alert(`Request converted! Created client and ${matchedApps.length} app workflow(s).`);
    } catch (error) {
      console.error('Failed to convert request:', error);
      alert('Failed to convert request. Please try again.');
    }
  };

  const handleConvertRequestToSignup = async (requestId: string) => {
    if (isDemo) {
      setToast({
        isOpen: true,
        message: 'Conversion is disabled in demo mode. Connect Supabase to enable this feature.',
        type: 'error'
      });
      return;
    }

    const request = requests.find((r: any) => r.id === requestId);
    if (!request) return;

    try {
      // Extract email from request
      const formEmail = extractFormEmail(request);
      const formNote = extractFormNote(request.notes || '');

      // Check if client already exists (by name + contact)
      let client = Array.isArray(clients) ? clients.find(
        (c: any) => c.name.toLowerCase() === request.name.toLowerCase() && c.contact === request.contact
      ) : null;

      // Create or update client
      if (!client) {
        const [name, ...surnameParts] = request.name.split(' ');
        const surname = surnameParts.join(' ') || null;
        
        const clientData: any = {
          name: name.trim(),
          surname: surname,
          contact: request.contact || null,
          email: formEmail || null,
          trusted: false,
          tier_id: null,
          invited_by_client_id: null,
          notes: formNote || `Converted from request ${requestId}`
        };
        console.log('💾 Creating new client with data:', {
          name: clientData.name,
          email: clientData.email,
          hasEmail: !!clientData.email,
          emailType: typeof clientData.email,
          emailValue: clientData.email
        });
        client = await insertClient(clientData);
        await mutateClients();
        
        // Verify email was saved by fetching the client again
        const supabase = getSupabaseClient();
        if (supabase) {
          const { data: verifyClient } = await supabase.from('clients').select('id, name, email').eq('id', client.id).single();
          console.log('✅ Client created and verified:', { 
            id: client.id, 
            email: (client as any).email,
            verifiedEmail: verifyClient?.email 
          });
        } else {
          console.log('✅ Client created:', { 
            id: client.id, 
            email: (client as any).email
          });
        }
      } else {
        // Update existing client with email if not already present
        const updateData: any = {};
        if (formEmail) {
          const existingEmail = client.email || '';
          if (existingEmail) {
            const existingEmails = existingEmail.split('\n').map(e => e.replace(/\s*\(.*?\)\s*/g, '').trim()).filter(Boolean);
            if (!existingEmails.includes(formEmail)) {
              updateData.email = `${existingEmail}\n${formEmail}`;
            }
          } else {
            updateData.email = formEmail;
          }
        }
        if (formNote) {
          const existingNotes = client.notes || '';
          updateData.notes = existingNotes ? `${existingNotes}\n\n${formNote}` : formNote;
        }
        if (Object.keys(updateData).length > 0) {
          await updateClient(updateData, client.id);
          await mutateClients();
        }
      }

      // Parse requested apps and create client_apps with status 'requested'
      const requestedAppNames = parseRequestedApps(request);
      let createdAppsCount = 0;
      const unmatchedApps: string[] = [];

      if (requestedAppNames.length > 0 && Array.isArray(apps)) {
        // Helper function for app name matching with common typo corrections
        const findMatchingApp = (requestedName: string): any | null => {
          if (!Array.isArray(apps)) return null;
          
          const normalizedRequested = requestedName.toLowerCase().trim();
          
          const typoMappings: { [key: string]: string } = {
            'revoult': 'revolut',
            'revolute': 'revolut',
            'revolutt': 'revolut',
            'kraken exchange': 'kraken',
            'by bit': 'bybit',
            'b b v a': 'bbva',
            'buddy bank': 'buddybank',
            'isy bank': 'isybank',
            'isbank': 'isybank',
            'sisal casino': 'sisal',
            'poker stars': 'pokerstars',
            'trading 212': 'trading212',
          };
          
          const correctedName = typoMappings[normalizedRequested] || normalizedRequested;
          
          // Strategy 1: Exact match (case-insensitive) with corrected name
          let match = apps.find((app: any) => 
            app.name.toLowerCase().trim() === correctedName
          );
          if (match) return match;
          
          // Strategy 2: Contains match (either direction)
          match = apps.find((app: any) => {
            const appName = app.name.toLowerCase().trim();
            return appName.includes(correctedName) || correctedName.includes(appName);
          });
          if (match) return match;
          
          return null;
        };

        for (const appName of requestedAppNames) {
          const matchedApp = findMatchingApp(appName);
          
          if (matchedApp) {
            // Check if client_app already exists
            const existingClientApp = Array.isArray(clientApps) 
              ? clientApps.find((ca: any) => ca.client_id === client.id && ca.app_id === matchedApp.id)
              : null;
            
            if (!existingClientApp) {
              await insertClientApp({
                client_id: client.id,
                app_id: matchedApp.id,
                status: 'requested',
                deposited: false,
                finished: false,
                started_at: new Date().toISOString()
              });
              createdAppsCount++;
            }
          } else {
            unmatchedApps.push(appName);
          }
        }
        
        if (createdAppsCount > 0) {
          await mutateClientApps();
        }
      }

      // Update request status
      await updateRequest({ status: 'converted', client_id: client.id, processed_at: new Date().toISOString() }, requestId);
      await mutateRequests();

      let message = 'Request converted to signup successfully!';
      if (createdAppsCount > 0) {
        message += ` Created ${createdAppsCount} app workflow(s) with status "requested".`;
      }
      if (unmatchedApps.length > 0) {
        message += ` Could not match: ${unmatchedApps.join(', ')}.`;
      }
      
      setToast({
        isOpen: true,
        message,
        type: unmatchedApps.length > 0 ? 'info' : 'success'
      });

      // Redirect to client profile after a short delay to show the toast
      setTimeout(() => {
        router.push(`/clients/${client.id}`);
      }, 1500);
    } catch (error: any) {
      console.error('Failed to convert request to signup:', error);
      setToast({
        isOpen: true,
        message: `Failed to convert request: ${error?.message || 'Unknown error'}`,
        type: 'error'
      });
    }
  };

  const handleUpdateStatus = async (requestId: string, newStatus: string) => {
    if (isDemo) {
      alert('Status updates are disabled in demo mode.');
      return;
    }

    try {
      await updateRequest({ status: newStatus as any }, requestId);
      await mutateRequests();
    } catch (error) {
      console.error('Failed to update status:', error);
      alert('Failed to update status. Please try again.');
    }
  };

  // Helper function to extract form note from request notes
  const extractFormNote = (requestNotes: string): string | null => {
    if (!requestNotes) return null;
    
    try {
      // Try to find the "Full responses" JSON in the notes
      const fullResponsesMatch = requestNotes.match(/Full responses: ({.*})/);
      if (fullResponsesMatch && fullResponsesMatch[1]) {
        try {
          const responsesJson = JSON.parse(fullResponsesMatch[1]);
          
          // Look for the "Note:" field in the responses
          if (responsesJson && typeof responsesJson === 'object') {
            for (const [questionId, response] of Object.entries(responsesJson)) {
              const resp = response as any;
              if (resp && resp.question && resp.question.toLowerCase().includes('note')) {
                const answer = Array.isArray(resp.answer) ? resp.answer.join(', ') : resp.answer;
                if (answer && answer.trim()) {
                  return answer.trim();
                }
              }
            }
          }
        } catch (jsonError) {
          console.warn('Error parsing Full responses JSON in extractFormNote:', jsonError);
          // Continue without throwing
        }
      }
    } catch (error) {
      console.error('Error in extractFormNote:', error);
    }
    
    return null;
  };

  // Helper function to extract email from request notes/form responses
  const extractFormEmail = (request: any): string | null => {
    // First check if email is directly in request object (from email column)
    // Use 'as any' because TypeScript types might not include email field yet
    const requestEmail = (request as any).email;
    
    console.log('🔍 Extracting email from request:', { 
      requestId: request.id,
      requestName: request.name,
      hasEmailField: 'email' in request,
      emailValue: requestEmail,
      emailType: typeof requestEmail,
      emailIsValid: requestEmail && typeof requestEmail === 'string' && requestEmail.trim().includes('@'),
      hasNotes: !!request.notes,
      notesLength: request.notes?.length 
    });
    
    if (requestEmail && typeof requestEmail === 'string' && requestEmail.trim()) {
      const email = requestEmail.trim();
      // Validate email format
      if (email.includes('@') && email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
        console.log('✅ Found email in request.email column:', email);
        return email;
      } else {
        console.warn('⚠️ Email in request.email column is not valid:', email);
      }
    }
    
    // Try to extract from notes/webhook payload
    if (request.notes && typeof request.notes === 'string') {
      try {
        // First, try to find email in notes directly (if stored as "Email: ..." by webhook)
        // This is the most reliable since webhook now explicitly adds "Email: ..." line
        const emailLineMatch = request.notes.match(/^Email:\s*([^\s@]+@[^\s@]+\.[^\s@]+)/im);
        if (emailLineMatch && emailLineMatch[1]) {
          const email = emailLineMatch[1].trim();
          if (email.includes('@') && email.length > 5) {
            console.log('Found email in notes Email: line:', email);
            return email;
          }
        }
        
        // Try other email patterns
        const emailPatterns = [
          /(?:Email|email|Mail|mail)[:\s]+([^\s@]+@[^\s@]+\.[^\s@]+)/i,
          /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g
        ];
        
        for (const pattern of emailPatterns) {
          const matches = request.notes.match(pattern);
          if (matches && matches[1]) {
            const email = matches[1].trim();
            if (email.includes('@') && email.length > 5) {
              console.log('Found email in notes with pattern:', email);
              return email;
            }
          }
        }
        
        // Try to parse Full responses JSON (multiline match)
        // Use a more flexible regex to capture the JSON
        const fullResponsesMatch = request.notes.match(/Full responses:\s*({[\s\S]*})/);
        if (fullResponsesMatch && fullResponsesMatch[1]) {
          try {
            // Try to find the end of the JSON object
            let jsonStr = fullResponsesMatch[1];
            // If it doesn't end with }, try to find the closing brace
            if (!jsonStr.trim().endsWith('}')) {
              // Find the last } that closes the object
              let braceCount = 0;
              let endIndex = -1;
              for (let i = 0; i < jsonStr.length; i++) {
                if (jsonStr[i] === '{') braceCount++;
                if (jsonStr[i] === '}') {
                  braceCount--;
                  if (braceCount === 0) {
                    endIndex = i + 1;
                    break;
                  }
                }
              }
              if (endIndex > 0) {
                jsonStr = jsonStr.substring(0, endIndex);
              }
            }
            
            try {
              const responsesJson = JSON.parse(jsonStr.trim());
              console.log('Parsed Full responses JSON, searching for email...', Object.keys(responsesJson).length, 'responses');
              
              // Look for email field in responses
              for (const [questionId, response] of Object.entries(responsesJson)) {
                const resp = response as any;
                if (resp && resp.question) {
                  const questionLower = resp.question.toLowerCase();
                  if (questionLower.includes('email') || questionLower.includes('mail')) {
                    const answer = Array.isArray(resp.answer) ? resp.answer.join(', ') : resp.answer;
                    if (answer && typeof answer === 'string') {
                      const email = answer.trim();
                      // Validate email format
                      if (email.includes('@') && email.length > 5 && email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
                        console.log('Found email in responses:', email, 'from question:', resp.question);
                        return email;
                      }
                    }
                  }
                }
              }
              console.log('No email found in Full responses JSON');
            } catch (jsonParseError) {
              console.warn('Error parsing Full responses JSON:', jsonParseError);
              // Continue to fallback methods
            }
          } catch (parseError) {
            console.error('Error parsing JSON from notes:', parseError);
            // Try to extract email with a simpler regex as fallback
            const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
            const emailMatches = request.notes.match(emailRegex);
            if (emailMatches && emailMatches.length > 0) {
              // Prefer the one after "Email:" if available
              const emailAfterLabel = request.notes.match(/Email:\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
              if (emailAfterLabel && emailAfterLabel[1]) {
                console.log('Found email after Email: label (fallback):', emailAfterLabel[1]);
                return emailAfterLabel[1].trim();
              }
              console.log('Found email with regex (fallback):', emailMatches[0]);
              return emailMatches[0].trim();
            }
          }
        } else {
          console.log('No Full responses JSON found in notes');
        }
      } catch (error) {
        console.error('Error parsing email from form responses:', error);
      }
    }
    
    console.log('No email found in request');
    return null;
  };

  // Helper function to parse requested apps from request
  const parseRequestedApps = (request: any): string[] => {
    const apps: string[] = [];
    
    // First, try requested_apps_raw field
    if (request.requested_apps_raw) {
      const appsList = request.requested_apps_raw.split(',').map((app: string) => app.trim()).filter(Boolean);
      apps.push(...appsList);
    }
    
    // Also try to extract from notes if available
    if (request.notes) {
      try {
        const fullResponsesMatch = request.notes.match(/Full responses: ({.*})/);
        if (fullResponsesMatch && fullResponsesMatch[1]) {
          try {
            const responsesJson = JSON.parse(fullResponsesMatch[1]);
            
            // Look for "app richieste" or similar fields
            if (responsesJson && typeof responsesJson === 'object') {
              for (const [questionId, response] of Object.entries(responsesJson)) {
                const resp = response as any;
                if (resp && resp.question && (
                  resp.question.toLowerCase().includes('app') || 
                  resp.question.toLowerCase().includes('richieste') ||
                  resp.question.toLowerCase().includes('bonus')
                )) {
                  const answer = resp.answer;
                  if (Array.isArray(answer)) {
                    apps.push(...answer.map((a: string) => a.trim()));
                  } else if (answer) {
                    apps.push(answer.trim());
                  }
                }
              }
            }
          } catch (jsonError) {
            console.warn('Error parsing Full responses JSON in parseRequestedApps:', jsonError);
            // Continue without throwing
          }
        }
      } catch (error) {
        console.error('Error parsing apps from notes:', error);
      }
    }
    
    // Remove duplicates and return
    return [...new Set(apps)];
  };

  const handleMergeRequest = async (request: any) => {
    if (isDemo) {
      alert('Merge is disabled in demo mode.');
      return;
    }

    const { clientId, isExisting, matchMethod } = isExistingClientRequest(request);
    
    console.log('Merge request - client detection:', {
      clientId,
      isExisting,
      matchMethod,
      requestName: request.name,
      requestContact: request.contact,
      notes: request.notes?.substring(0, 300)
    });
    
    // If no client found but flagged as potential match, try harder to find it
    if (isExisting && !clientId && request.notes) {
      // Try to extract client ID from notes more aggressively
      const idPatterns = [
        /ID:\s*([a-f0-9-]{36})/i,
        /\(ID:\s*([a-f0-9-]{36})\)/i,
        /client.*?id[:\s]+([a-f0-9-]{36})/i
      ];
      
      for (const pattern of idPatterns) {
        const match = request.notes.match(pattern);
        if (match && match[1]) {
          const foundClient = Array.isArray(clients) ? clients.find((c: any) => c.id === match[1]) : null;
          if (foundClient) {
            console.log('Found client by ID from notes:', foundClient.id, foundClient.name);
            setMergeRequestData({ request, clientId: foundClient.id, isNewClient: false });
            setShowMergeModal(true);
            return;
          }
        }
      }
      
      // If still not found, try fuzzy name matching
      if (request.name && Array.isArray(clients)) {
        const nameParts = request.name.split(' ');
        const firstName = nameParts[0]?.toLowerCase() || '';
        
        // Try to find by first name + contact
        if (firstName && request.contact) {
          const foundClient = clients.find((c: any) => {
            const clientFirstName = (c.name || '').toLowerCase();
            return clientFirstName === firstName && c.contact === request.contact;
          });
          
          if (foundClient) {
            console.log('Found client by name + contact:', foundClient.id, foundClient.name);
            setMergeRequestData({ request, clientId: foundClient.id, isNewClient: false });
            setShowMergeModal(true);
            return;
          }
        }
      }
    }
    
    // Show merge modal - it will handle both existing client update and new client creation
    setMergeRequestData({ request, clientId, isNewClient: !isExisting || !clientId });
    setShowMergeModal(true);
  };

  const handleConfirmMerge = async () => {
    if (!mergeRequestData) return;
    
    const { request, clientId, isNewClient } = mergeRequestData;
    setShowMergeModal(false);

    try {
      let finalClientId = clientId;
      
      // Before creating, double-check if client should exist (from fuzzy match)
      if (!finalClientId && request.notes && request.notes.includes('POTENTIAL EXISTING CLIENT')) {
        // Try harder to find the existing client
        const idPatterns = [
          /ID:\s*([a-f0-9-]{36})/i,
          /\(ID:\s*([a-f0-9-]{36})\)/i,
          /Potential Match:.*?\(ID:\s*([a-f0-9-]{36})\)/i
        ];
        
        for (const pattern of idPatterns) {
          const match = request.notes.match(pattern);
          if (match && match[1]) {
            const foundClient = Array.isArray(clients) ? clients.find((c: any) => c.id === match[1]) : null;
            if (foundClient) {
              console.log('Found existing client from notes during merge:', foundClient.id, foundClient.name);
              finalClientId = foundClient.id;
              break;
            }
          }
        }
        
        // If still not found, try name + contact matching
        if (!finalClientId && request.name && request.contact && Array.isArray(clients)) {
          const nameParts = request.name.split(' ');
          const firstName = nameParts[0]?.toLowerCase() || '';
          
          const foundClient = clients.find((c: any) => {
            const clientFirstName = (c.name || '').toLowerCase();
            return clientFirstName === firstName && c.contact === request.contact;
          });
          
          if (foundClient) {
            console.log('Found existing client by name+contact during merge:', foundClient.id, foundClient.name);
            finalClientId = foundClient.id;
          }
        }
      }
      
      // If no client exists, create a new one (only if truly new and not flagged as existing)
      // IMPORTANT: If request is flagged as POTENTIAL EXISTING CLIENT, we should NOT create a new client
      // even if we couldn't find the ID - user must manually verify
      const isFlaggedAsExisting = request.notes && request.notes.includes('POTENTIAL EXISTING CLIENT');
      
      if (!finalClientId && !isFlaggedAsExisting) {
        // Only create new client if NOT flagged as existing
        const [name, ...surnameParts] = request.name.split(' ');
        const surname = surnameParts.join(' ') || null;
        
        const formEmail = extractFormEmail(request);
        console.log('Creating new client with email:', formEmail);
        
        const newClient = await insertClient({
          name: name.trim(),
          surname: surname,
          contact: request.contact || null,
          email: formEmail || null,
          trusted: false,
          tier_id: null,
          notes: extractFormNote(request.notes || '') || null
        });
        
        finalClientId = newClient.id;
        await mutateClients();
        console.log('Created new client during merge', { 
          clientId: finalClientId, 
          email: formEmail,
          contact: request.contact 
        });
      } else if (!finalClientId && isFlaggedAsExisting) {
        // Client was flagged as existing but we couldn't find it - this is an error
        throw new Error(
          'This request is flagged as an existing client, but the client could not be found. ' +
          'Please verify the client ID in the request notes or manually link the request to the correct client.'
        );
      } else {
        console.log('Using existing client for merge:', finalClientId);
      }
      
      if (!finalClientId) {
        throw new Error('Failed to get or create client');
      }
      
      const updateData: any = {};
      
      // Update client with new information (append instead of overwrite)
      const client = Array.isArray(clients) ? clients.find((c: any) => c.id === finalClientId) : null;
      if (client) {
        // Append contact - keep all values, one per line (no duplicates)
        if (request.contact && request.contact.trim()) {
          const newContact = request.contact.trim();
          const existingContact = client.contact || '';
          
          if (existingContact) {
            // Split existing contacts by newline only (preserve structure)
            const existingContacts = existingContact
              .split('\n')
              .map(c => c.replace(/\s*\(.*?\)\s*/g, '').trim()) // Remove (original), (from form) labels
              .filter(Boolean);
            
            // Check if new contact is already in the list
            if (!existingContacts.includes(newContact)) {
              // Add new contact on a new line
              updateData.contact = `${existingContact}\n${newContact}`;
              console.log('✅ Merge - Adding new contact to existing list:', updateData.contact);
            } else {
              console.log('⚠️ Merge - Contact already exists in list, skipping');
            }
          } else {
            // No existing contact - just use new one
            updateData.contact = newContact;
            console.log('✅ Merge - Setting new contact (first one):', updateData.contact);
          }
        }
        
        // Append email - keep all values, one per line, always add new ones (no limit)
        const formEmail = extractFormEmail(request);
        console.log('🔍 Merge - Extracted email from request:', formEmail, 'Request object:', {
          hasEmailField: 'email' in request,
          emailValue: (request as any).email,
          notes: request.notes?.substring(0, 500)
        });
        
        if (formEmail) {
          const existingEmail = client.email || '';
          
          if (existingEmail) {
            // Split existing emails by newline, remove labels if present
            const existingEmails = existingEmail
              .split('\n')
              .map(e => e.replace(/\s*\(.*?\)\s*/g, '').trim()) // Remove (original), (from form) labels
              .filter(Boolean);
            
            // Check if new email is already in the list
            if (!existingEmails.includes(formEmail)) {
              // Add new email on a new line (always add, no limit)
              updateData.email = `${existingEmail}\n${formEmail}`;
              console.log('✅ Merge - Adding new email to existing list:', updateData.email);
            } else {
              console.log('⚠️ Merge - Email already exists in list, skipping');
            }
          } else {
            // No existing email - just use new one
            updateData.email = formEmail;
            console.log('✅ Merge - Setting new email (first one):', updateData.email);
          }
        } else {
          console.log('❌ Merge - No email extracted from request - checking notes:', request.notes?.substring(0, 300));
        }
        
        // Extract and add only the form note (not the entire webhook payload)
        const formNote = extractFormNote(request.notes || '');
        if (formNote) {
          const existingNotes = client.notes || '';
          if (existingNotes) {
            // Add new note on a new line with separator
            updateData.notes = `${existingNotes}\n\n---\n\n${formNote}`;
            console.log('✅ Merge - Adding new note to existing notes');
          } else {
            updateData.notes = formNote;
            console.log('✅ Merge - Setting new note (first one)');
          }
        }
      }

      // Update client if there are changes
      console.log('💾 Merge - Update data before saving:', updateData);
      if (Object.keys(updateData).length > 0) {
        try {
          const result = await updateClient(updateData, finalClientId);
          console.log('✅ Merge - Client update result:', result);
          
          // Verify email was saved
          const supabase = getSupabaseClient();
          if (supabase && updateData.email) {
            const { data: verifyClient } = await supabase.from('clients').select('id, name, email').eq('id', finalClientId).single();
            console.log('✅ Merge - Verified email saved:', { 
              requested: updateData.email,
              saved: verifyClient?.email 
            });
          }
          
          await mutateClients();
        } catch (updateError) {
          console.error('❌ Merge - Error updating client:', updateError);
          throw updateError;
        }
      } else {
        console.log('⚠️ Merge - No update data to save');
      }

      // Helper function for app name matching with common typo corrections
      const findMatchingApp = (requestedName: string): any | null => {
        if (!Array.isArray(apps)) return null;
        
        const normalizedRequested = requestedName.toLowerCase().trim();
        
        // Common typo/variation mappings - maps typos to correct database names
        const typoMappings: { [key: string]: string } = {
          'revoult': 'revolut',
          'revolute': 'revolut',
          'revolutt': 'revolut',
          'kraken exchange': 'kraken',
          'by bit': 'bybit',
          'b b v a': 'bbva',
          'buddy bank': 'buddybank',
          'isy bank': 'isybank',
          'isbank': 'isybank',
          'sisal casino': 'sisal',
          'poker stars': 'pokerstars',
          'trading 212': 'trading212',
        };
        
        // Normalize the requested name using typo mappings
        const correctedName = typoMappings[normalizedRequested] || normalizedRequested;
        
        // Strategy 1: Exact match (case-insensitive) with corrected name
        let match = apps.find((app: any) => 
          app.name.toLowerCase().trim() === correctedName
        );
        if (match) return match;
        
        // Strategy 2: Contains match (either direction)
        match = apps.find((app: any) => {
          const appName = app.name.toLowerCase().trim();
          return appName.includes(correctedName) || correctedName.includes(appName);
        });
        if (match) return match;
        
        return null;
      };

      // Parse and create client_apps for requested apps
      const requestedAppNames = parseRequestedApps(request);
      let createdAppsCount = 0;
      const unmatchedApps: string[] = [];
      
      if (requestedAppNames.length > 0 && Array.isArray(apps)) {
        for (const appName of requestedAppNames) {
          const matchedApp = findMatchingApp(appName);
          
          if (matchedApp) {
            // Check if client_app already exists
            const existingClientApp = Array.isArray(clientApps) 
              ? clientApps.find((ca: any) => ca.client_id === finalClientId && ca.app_id === matchedApp.id)
              : null;
            
            if (!existingClientApp) {
              await insertClientApp({
                client_id: finalClientId,
                app_id: matchedApp.id,
                status: 'requested',
                deposited: false,
                finished: false,
                started_at: new Date().toISOString()
              });
              createdAppsCount++;
            }
          } else {
            unmatchedApps.push(appName);
          }
        }
        
        if (createdAppsCount > 0) {
          await mutateClientApps();
        }
      }

      // Mark request as converted and link to client
      await updateRequest({ status: 'converted', client_id: finalClientId, processed_at: new Date().toISOString() }, request.id);
      await mutateRequests();

      let message = 'Request merged successfully!';
      if (createdAppsCount > 0) {
        message += ` Created ${createdAppsCount} app workflow(s).`;
      }
      if (unmatchedApps.length > 0) {
        message += ` Could not match: ${unmatchedApps.join(', ')}.`;
      }
      if (createdAppsCount === 0 && unmatchedApps.length === 0) {
        message += ' Updated client information.';
      }
      
      setToast({
        isOpen: true,
        message,
        type: unmatchedApps.length > 0 ? 'info' : 'success'
      });
    } catch (error: any) {
      console.error('Failed to merge request:', error);
      const errorMessage = error?.message || 'Unknown error occurred';
      setToast({
        isOpen: true,
        message: `Failed to merge request: ${errorMessage}`,
        type: 'error'
      });
    }
  };

  const handleDeleteRequest = async (requestId: string) => {
    if (isDemo) {
      alert('Delete is disabled in demo mode.');
      return;
    }

    const request = requests.find((r: any) => r.id === requestId);
    if (!request) return;

    // Show delete confirmation in merge modal
    setMergeRequestData({ request, clientId: null, action: 'delete' });
    setShowMergeModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!mergeRequestData) return;
    
    const { request } = mergeRequestData;
    setShowMergeModal(false);

    try {
      await deleteRequest(request.id);
      await mutateRequests();
      setToast({
        isOpen: true,
        message: 'Request deleted successfully!',
        type: 'success'
      });
    } catch (error: any) {
      console.error('Failed to delete request:', error);
      const errorMessage = error?.message || 'Unknown error occurred';
      setToast({
        isOpen: true,
        message: `Failed to delete request: ${errorMessage}`,
        type: 'error'
      });
    }
  };


  if (isLoading) {
    return (
      <div>
        <SectionHeader title="Requests" description="Loading requests..." />
        <LoadingSpinner message="Loading requests..." />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <SectionHeader title="Requests" description="Error loading requests" />
        <ErrorMessage
          error={error}
          onRetry={() => {
            mutateRequests();
            mutateClients();
            mutateClientApps();
          }}
        />
      </div>
    );
  }

  return (
    <div>
      <SectionHeader
        title="Requests"
        description="Inbox synced from Google Form submissions ready for conversion into client records."
        actions={
          <button
            onClick={() => {
              setConvertRequestId(null);
              setConvertRequestData(null);
              setShowNewSignupModal(true);
            }}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 500
            }}
          >
            New Signup
          </button>
        }
      />
      <NewSignupModal
        isOpen={showNewSignupModal}
        onClose={() => {
          setShowNewSignupModal(false);
          setConvertRequestId(null);
          setConvertRequestData(null);
        }}
        onSuccess={() => {
          mutateClientApps();
          mutateClients();
          if (convertRequestId) {
            updateRequest({ status: 'converted', processed_at: new Date().toISOString() }, convertRequestId);
            mutateRequests();
          }
          setShowNewSignupModal(false);
          setConvertRequestId(null);
          setConvertRequestData(null);
        }}
        initialAppId={convertRequestData?.appId}
        initialClientId={convertRequestData?.clientId}
        initialRequestId={convertRequestId || undefined}
        initialClientData={convertRequestData ? {
          name: convertRequestData.name,
          contact: convertRequestData.contact,
          email: convertRequestData.email
        } : undefined}
      />
      <FiltersBar>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="all">Any status</option>
          <option value="new">New</option>
          <option value="contacted">Contacted</option>
          <option value="converted">Converted</option>
          <option value="rejected">Rejected</option>
        </select>
        <input placeholder="Search" value={search} onChange={(event) => setSearch(event.target.value)} />
      </FiltersBar>
      {!Array.isArray(requests) || filteredRows.length === 0 ? (
        <EmptyState
          title="No requests found"
          message={
            statusFilter !== 'all' || search
              ? 'No requests match your current filters.'
              : 'No requests have been received yet.'
          }
        />
      ) : (
        <DataTable
          data={Array.isArray(filteredRows) ? filteredRows : []}
        columns={[
          {
            key: 'name',
            header: 'Requester',
            render: (row: any) => {
              let client = null;
              let displayName = '';
              
              // If request is linked to a client, use that client
              if (row.client_id) {
                client = row.clients || (Array.isArray(clients) ? clients.find((c: any) => c.id === row.client_id) : null);
                if (client) {
                  displayName = client.name + (client.surname ? ` ${client.surname}` : '');
                }
              } else {
                // For new requests, try to find existing client by name and contact
                if (Array.isArray(clients) && row.name && row.contact) {
                  client = clients.find((c: any) => {
                    const clientNameMatch = c.name.toLowerCase() === row.name.toLowerCase();
                    const clientContactMatch = c.contact === row.contact;
                    return clientNameMatch && clientContactMatch;
                  });
                  
                  // If not found by exact match, try partial name match
                  if (!client && row.name) {
                    const requestNameParts = row.name.toLowerCase().split(' ');
                    client = clients.find((c: any) => {
                      const clientNameLower = c.name.toLowerCase();
                      const matchesFirstName = requestNameParts[0] === clientNameLower || clientNameLower.includes(requestNameParts[0]);
                      const clientContactMatch = c.contact === row.contact;
                      return matchesFirstName && clientContactMatch;
                    });
                  }
                  
                  if (client) {
                    displayName = client.name + (client.surname ? ` ${client.surname}` : '');
                  }
                }
              }
              
              // If client found, show full name and make it clickable
              if (client && displayName) {
                return (
                  <Link 
                    href={`/clients/${client.id}`}
                    style={{ color: '#2563eb', textDecoration: 'none', fontWeight: '500' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {displayName}
                  </Link>
                );
              }
              
              // If not linked and no matching client found, show the full name from request
              // The request name might already include surname if it was parsed from the form
              // Try to format it nicely: if it has multiple words, show them all
              const requestName = row.name || '—';
              return <span style={{ color: '#1e293b' }}>{requestName}</span>;
            }
          },
          { key: 'contact', header: 'Contact', render: (row) => row.contact ?? '—' },
          { 
            key: 'requested_apps_raw', 
            header: 'Requested apps', 
            render: (row) => {
              const { isExisting, clientId } = isExistingClientRequest(row);
              const duplicateApps = isExisting && clientId ? getDuplicateApps(row, clientId) : [];
              
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <span>{row.requested_apps_raw ?? '—'}</span>
                  {duplicateApps.length > 0 && (
                    <span style={{ 
                      fontSize: '0.75rem', 
                      color: '#dc2626', 
                      fontWeight: '500',
                      padding: '0.125rem 0.5rem',
                      backgroundColor: '#fef2f2',
                      borderRadius: '4px',
                      display: 'inline-block',
                      width: 'fit-content'
                    }}>
                      ⚠️ Already logged: {duplicateApps.map((app: any) => app.name).join(', ')}
                    </span>
                  )}
                </div>
              );
            }
          },
          {
            key: 'status',
            header: 'Status',
            render: (row) => {
              const { isExisting, matchMethod } = isExistingClientRequest(row);
              // Custom status badges with different colors for new and converted
              const getStatusBadge = (status: string) => {
                if (status === 'new') {
                  return (
                    <span style={{
                      display: 'inline-block',
                      padding: '0.25rem 0.75rem',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      backgroundColor: '#dbeafe',
                      color: '#1e40af',
                      border: '1px solid #93c5fd'
                    }}>
                      New
                    </span>
                  );
                } else if (status === 'converted') {
                  return (
                    <span style={{
                      display: 'inline-block',
                      padding: '0.25rem 0.75rem',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      backgroundColor: '#d1fae5',
                      color: '#065f46',
                      border: '1px solid #6ee7b7'
                    }}>
                      Converted
                    </span>
                  );
                } else {
                  return <StatusBadge status={status} />;
                }
              };
              
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'flex-start' }}>
                  {getStatusBadge(row.status)}
                  {isExisting && row.status !== 'converted' && (
                    <span style={{ 
                      fontSize: '0.75rem', 
                      color: '#dc2626', 
                      fontWeight: '600',
                      padding: '0.125rem 0.5rem',
                      backgroundColor: '#fef2f2',
                      borderRadius: '4px',
                      border: '1px solid #fecaca'
                    }}>
                      ⚠️ Existing Client {matchMethod ? `(${matchMethod})` : ''}
                    </span>
                  )}
                </div>
              );
            }
          },
          {
            key: 'created_at',
            header: 'Received',
            render: (row) => new Date(row.created_at).toLocaleString()
          },
          {
            key: 'actions',
            header: 'Actions',
            render: (row) => {
              const { isExisting } = isExistingClientRequest(row);
              
              return (
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', flexDirection: 'column' }}>
                  {isExisting && (
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {row.status !== 'converted' && (
                        <button
                          onClick={() => handleMergeRequest(row)}
                          style={{
                            padding: '0.35rem 0.75rem',
                            fontSize: '0.85rem',
                            background: '#10b981',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: '500'
                          }}
                        >
                          Merge
                        </button>
                      )}
                    </div>
                  )}
                  {!isExisting && row.status !== 'converted' && (
                    <button
                      onClick={() => handleConvertRequestToSignup(row.id)}
                      style={{
                        padding: '0.35rem 0.75rem',
                        fontSize: '0.85rem',
                        background: '#2563eb',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer'
                      }}
                    >
                      Convert to Signup
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteRequest(row.id)}
                    style={{
                      padding: '0.35rem 0.75rem',
                      fontSize: '0.85rem',
                      background: '#dc2626',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: '500'
                    }}
                  >
                    Delete
                  </button>
                  <select
                    value={row.status}
                    onChange={(e) => handleUpdateStatus(row.id, e.target.value)}
                    style={{
                      padding: '0.35rem 0.75rem',
                      fontSize: '0.85rem',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="new">New</option>
                    <option value="contacted">Contacted</option>
                    <option value="converted">Converted</option>
                    <option value="rejected">Rejected</option>
                  </select>
              </div>
              );
            }
          }
        ]}
        />
      )}
      
      <Toast
        isOpen={toast.isOpen}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ isOpen: false, message: '', type: 'success' })}
        duration={3000}
      />

      {/* Merge/Delete Confirmation Modal */}
      {showMergeModal && mergeRequestData && (() => {
        const { request, clientId, action, isNewClient } = mergeRequestData;
        const isDelete = action === 'delete';
        const client = clientId && Array.isArray(clients) 
          ? clients.find((c: any) => c.id === clientId) 
          : null;
        const willCreateNewClient = !clientId || isNewClient;
        
        const formEmail = extractFormEmail(request);
        const formNote = extractFormNote(request.notes || '');
        const requestedAppNames = parseRequestedApps(request);
        
        // Helper to find matching apps for preview
        const findMatchingApp = (requestedName: string): any | null => {
          if (!Array.isArray(apps)) return null;
          const normalizedRequested = requestedName.toLowerCase().trim();
          const typoMappings: { [key: string]: string } = {
            'revoult': 'revolut', 'revolute': 'revolut', 'revolutt': 'revolut',
            'kraken exchange': 'kraken', 'by bit': 'bybit', 'b b v a': 'bbva',
            'buddy bank': 'buddybank', 'isy bank': 'isybank', 'isbank': 'isybank',
            'sisal casino': 'sisal', 'poker stars': 'pokerstars', 'trading 212': 'trading212',
          };
          const correctedName = typoMappings[normalizedRequested] || normalizedRequested;
          let match = apps.find((app: any) => app.name.toLowerCase().trim() === correctedName);
          if (match) return match;
          match = apps.find((app: any) => {
            const appName = app.name.toLowerCase().trim();
            return appName.includes(correctedName) || correctedName.includes(appName);
          });
          return match;
        };

        // Check which apps already exist for this client (only if client exists)
        const existingClientAppIds = !willCreateNewClient && clientId && Array.isArray(clientApps)
          ? clientApps
              .filter((ca: any) => ca.client_id === clientId)
              .map((ca: any) => ca.app_id)
          : [];

        const matchedApps = requestedAppNames
          .map(name => ({ 
            requested: name, 
            matched: findMatchingApp(name),
            alreadyExists: false
          }))
          .filter(item => item.matched)
          .map(item => ({
            ...item,
            alreadyExists: existingClientAppIds.includes(item.matched.id)
          }));
        
        // Separate apps that will be created vs already exist
        const appsToCreate = matchedApps.filter(item => !item.alreadyExists);
        const appsAlreadyExist = matchedApps.filter(item => item.alreadyExists);
        const unmatchedApps = requestedAppNames
          .filter(name => !findMatchingApp(name));

        return (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000
            }}
            onClick={() => {
              setShowMergeModal(false);
              setMergeRequestData(null);
            }}
          >
            <div
              style={{
                background: 'white',
                borderRadius: '12px',
                padding: '1.5rem',
                maxWidth: '600px',
                width: '90%',
                maxHeight: '90vh',
                overflowY: 'auto',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 600, color: isDelete ? '#dc2626' : '#2563eb' }}>
                  {isDelete ? 'Delete Request' : 'Merge Request with Existing Client'}
                </h2>
                <button
                  onClick={() => {
                    setShowMergeModal(false);
                    setMergeRequestData(null);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '1.5rem',
                    cursor: 'pointer',
                    color: '#64748b',
                    padding: '0.25rem 0.5rem'
                  }}
                >
                  ×
                </button>
              </div>

              {isDelete ? (
                <div>
                  <p style={{ marginBottom: '1rem', color: '#64748b' }}>
                    Are you sure you want to delete this request? This action cannot be undone.
                  </p>
                  <div style={{ 
                    padding: '1rem', 
                    backgroundColor: '#f8fafc', 
                    borderRadius: '8px', 
                    marginBottom: '1.5rem' 
                  }}>
                    <div><strong>Name:</strong> {request.name}</div>
                    {request.contact && <div><strong>Contact:</strong> {request.contact}</div>}
                    {request.requested_apps_raw && <div><strong>Requested Apps:</strong> {request.requested_apps_raw}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => {
                        setShowMergeModal(false);
                        setMergeRequestData(null);
                      }}
                      style={{
                        padding: '0.5rem 1rem',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        background: 'white',
                        color: '#475569',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        fontWeight: 500
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleConfirmDelete}
                      style={{
                        padding: '0.5rem 1rem',
                        border: 'none',
                        borderRadius: '6px',
                        background: '#dc2626',
                        color: 'white',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        fontWeight: 600
                      }}
                    >
                      Delete Request
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <p style={{ marginBottom: '1.5rem', color: '#64748b' }}>
                    This will merge the request with the existing client. Contact information will be appended (both values kept), and app workflows will be created.
                  </p>

                  {/* Client Info Comparison */}
                  <div style={{ marginBottom: '1.5rem' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>
                      {willCreateNewClient ? 'New Client Information' : 'Client Information'}
                    </h3>
                    <div style={{ 
                      padding: '1rem', 
                      backgroundColor: '#f8fafc', 
                      borderRadius: '8px',
                      display: 'grid',
                      gap: '0.75rem'
                    }}>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Client Name</div>
                        <div style={{ fontWeight: 500 }}>
                          {willCreateNewClient 
                            ? request.name 
                            : (client ? `${client.name}${client.surname ? ` ${client.surname}` : ''}` : '—')
                          }
                        </div>
                      </div>
                      
                      <div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Contact</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          {!willCreateNewClient && client?.contact && (
                            <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                              <div style={{ fontWeight: 500, marginBottom: '0.25rem' }}>Current:</div>
                              <div style={{ 
                                padding: '0.5rem', 
                                backgroundColor: 'white', 
                                borderRadius: '4px',
                                whiteSpace: 'pre-line',
                                fontSize: '0.875rem'
                              }}>
                                {client.contact.split('\n').map((c: string, idx: number) => (
                                  <div key={idx}>{c.replace(/\s*\(.*?\)\s*/g, '').trim()}</div>
                                ))}
                              </div>
                            </div>
                          )}
                          {request.contact && (
                            <div style={{ fontSize: '0.875rem', color: willCreateNewClient ? '#2563eb' : '#10b981' }}>
                              <div style={{ fontWeight: 500, marginBottom: '0.25rem' }}>
                                {willCreateNewClient ? 'Will be set:' : (client?.contact ? 'New (will be added):' : 'New:')}
                              </div>
                              <div style={{ fontWeight: 500 }}>{request.contact}</div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Email</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          {!willCreateNewClient && client?.email && (
                            <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                              <div style={{ fontWeight: 500, marginBottom: '0.25rem' }}>Current:</div>
                              <div style={{ 
                                padding: '0.5rem', 
                                backgroundColor: 'white', 
                                borderRadius: '4px',
                                whiteSpace: 'pre-line',
                                fontSize: '0.875rem'
                              }}>
                                {client.email.split('\n').map((e: string, idx: number) => (
                                  <div key={idx}>{e.replace(/\s*\(.*?\)\s*/g, '').trim()}</div>
                                ))}
                              </div>
                            </div>
                          )}
                          {formEmail && (
                            <div style={{ fontSize: '0.875rem', color: willCreateNewClient ? '#2563eb' : '#10b981' }}>
                              <div style={{ fontWeight: 500, marginBottom: '0.25rem' }}>
                                {willCreateNewClient ? 'Will be set:' : (client?.email ? 'New (will be added):' : 'New:')}
                              </div>
                              <div style={{ fontWeight: 500 }}>{formEmail}</div>
                            </div>
                          )}
                        </div>
                      </div>

                      {formNote && (
                        <div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Note from Form</div>
                          <div style={{ fontSize: '0.875rem', padding: '0.5rem', backgroundColor: 'white', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                            {formNote}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Apps to Create */}
                  {requestedAppNames.length > 0 && (
                    <div style={{ marginBottom: '1.5rem' }}>
                      <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>Requested Apps</h3>
                      <div style={{ 
                        padding: '1rem', 
                        backgroundColor: '#f8fafc', 
                        borderRadius: '8px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem'
                      }}>
                        {appsToCreate.length > 0 && (
                          <div>
                            <div style={{ fontSize: '0.75rem', color: '#10b981', marginBottom: '0.5rem', fontWeight: 500 }}>Will be created:</div>
                            {appsToCreate.map((item, idx) => (
                              <div key={idx} style={{ 
                                fontSize: '0.875rem', 
                                padding: '0.5rem', 
                                backgroundColor: 'white', 
                                borderRadius: '4px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                              }}>
                                <span style={{ fontWeight: 500 }}>{item.matched.name}</span>
                                {item.requested.toLowerCase() !== item.matched.name.toLowerCase() && (
                                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                    (from &quot;{item.requested}&quot;)
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        {appsAlreadyExist.length > 0 && (
                          <div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.5rem', fontWeight: 500 }}>Already exist (will be skipped):</div>
                            {appsAlreadyExist.map((item, idx) => (
                              <div key={idx} style={{ 
                                fontSize: '0.875rem', 
                                padding: '0.5rem', 
                                backgroundColor: '#f1f5f9', 
                                borderRadius: '4px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                color: '#64748b'
                              }}>
                                <span>{item.matched.name}</span>
                                <span style={{ fontSize: '0.75rem' }}>✓ Already logged</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {unmatchedApps.length > 0 && (
                          <div>
                            <div style={{ fontSize: '0.75rem', color: '#dc2626', marginBottom: '0.5rem', fontWeight: 500 }}>Could not match:</div>
                            {unmatchedApps.map((name, idx) => (
                              <div key={idx} style={{ 
                                fontSize: '0.875rem', 
                                padding: '0.5rem', 
                                backgroundColor: '#fee2e2', 
                                borderRadius: '4px',
                                color: '#991b1b'
                              }}>
                                {name}
                              </div>
                            ))}
                          </div>
                        )}
                        {appsToCreate.length === 0 && appsAlreadyExist.length === 0 && unmatchedApps.length === 0 && (
                          <div style={{ fontSize: '0.875rem', color: '#64748b', fontStyle: 'italic' }}>
                            No apps requested
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => {
                        setShowMergeModal(false);
                        setMergeRequestData(null);
                      }}
                      style={{
                        padding: '0.5rem 1rem',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        background: 'white',
                        color: '#475569',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        fontWeight: 500
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleConfirmMerge}
                      style={{
                        padding: '0.5rem 1rem',
                        border: 'none',
                        borderRadius: '6px',
                        background: '#10b981',
                        color: 'white',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        fontWeight: 600
                      }}
                    >
                      {willCreateNewClient ? 'Create Client & Convert' : 'Merge Request'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
