// Supabase Edge Function: Daily Fast-Check
// Advanced fast-check that identifies critical issues by category with configurable limits

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS configuration - can be restricted via ALLOWED_ORIGINS environment variable
// Format: comma-separated list of origins, e.g., "https://example.com,https://app.example.com"
// Default: "*" (allows all origins) - change this in production for better security
const allowedOrigins = Deno.env.get("ALLOWED_ORIGINS")?.split(",").map(o => o.trim()) || ["*"];
const origin = Deno.env.get("ORIGIN") || allowedOrigins[0] || "*"; // For backward compatibility

const corsHeaders = {
  "Access-Control-Allow-Origin": origin, // Default to * for backward compatibility
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface FastCheckIssue {
  type: 'overdue_deadline' | 'due_soon' | 'stale_update' | 'missing_deposit' | 'pending_document';
  priority: number; // 1-5, lower = more critical
  title: string;
  description: string;
  client_id: string | null;
  client_app_id: string | null;
  client_name: string | null;
  app_name: string | null;
  metadata: Record<string, any>;
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
      return new Response(
        JSON.stringify({ error: "Missing Supabase credentials" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const issues: FastCheckIssue[] = [];
    const now = new Date();
    const daysAgo7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const daysAgo14 = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    
    // Configurable limits per category (can be increased)
    const LIMIT_PER_CATEGORY = 20; // Show up to 20 issues per category

    // Issue 1: Overdue Deadlines (Priority 1)
    const { data: overdueDeadlines, error: overdueError } = await supabase
      .from('client_apps')
      .select('id, deadline_at, status, apps(name), clients!client_apps_client_id_fkey(id, name, surname)')
      .not('deadline_at', 'is', null)
      .lt('deadline_at', now.toISOString())
      .not('status', 'in', ['completed', 'paid', 'cancelled'])
      .order('deadline_at', { ascending: true })
      .limit(LIMIT_PER_CATEGORY);

    if (!overdueError && overdueDeadlines) {
      for (const app of overdueDeadlines) {
        const deadline = new Date(app.deadline_at);
        const daysOverdue = Math.floor((now.getTime() - deadline.getTime()) / (1000 * 60 * 60 * 24));
        const clientName = `${app.clients?.name || ''} ${app.clients?.surname || ''}`.trim();

        issues.push({
          type: 'overdue_deadline',
          priority: 1,
          title: `Overdue Deadline: ${app.apps?.name || 'Unknown App'}`,
          description: `${clientName} - Deadline passed ${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} ago`,
          client_id: app.clients?.id || null,
          client_app_id: app.id,
          client_name: clientName,
          app_name: app.apps?.name || null,
          metadata: {
            deadline_at: app.deadline_at,
            days_overdue: daysOverdue,
            status: app.status
          }
        });
      }
    }

    // Issue 2: Deadlines Due in 48h (Priority 2)
    const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const { data: dueSoon, error: dueSoonError } = await supabase
      .from('client_apps')
      .select('id, deadline_at, status, apps(name), clients!client_apps_client_id_fkey(id, name, surname)')
      .not('deadline_at', 'is', null)
      .gte('deadline_at', now.toISOString())
      .lte('deadline_at', in48h.toISOString())
      .not('status', 'in', ['completed', 'paid', 'cancelled'])
      .order('deadline_at', { ascending: true })
      .limit(LIMIT_PER_CATEGORY);

    if (!dueSoonError && dueSoon) {
      for (const app of dueSoon) {
        const deadline = new Date(app.deadline_at);
        const hoursUntil = Math.floor((deadline.getTime() - now.getTime()) / (1000 * 60 * 60));
        const clientName = `${app.clients?.name || ''} ${app.clients?.surname || ''}`.trim();

        issues.push({
          type: 'due_soon',
          priority: 2,
          title: `Deadline Soon: ${app.apps?.name || 'Unknown App'}`,
          description: `${clientName} - Deadline in ${hoursUntil} hours`,
          client_id: app.clients?.id || null,
          client_app_id: app.id,
          client_name: clientName,
          app_name: app.apps?.name || null,
          metadata: {
            deadline_at: app.deadline_at,
            hours_until: hoursUntil,
            status: app.status
          }
        });
      }
    }

    // Issue 3: Stale Updates (no update in 14+ days) (Priority 3)
    const { data: staleUpdates, error: staleError } = await supabase
      .from('client_apps')
      .select('id, updated_at, status, apps(name), clients!client_apps_client_id_fkey(id, name, surname)')
      .not('status', 'in', ['completed', 'paid', 'cancelled'])
      .lt('updated_at', daysAgo14.toISOString())
      .order('updated_at', { ascending: true })
      .limit(LIMIT_PER_CATEGORY);

    if (!staleError && staleUpdates) {
      for (const app of staleUpdates) {
        const updatedAt = new Date(app.updated_at);
        const daysSinceUpdate = Math.floor((now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24));
        const clientName = `${app.clients?.name || ''} ${app.clients?.surname || ''}`.trim();

        issues.push({
          type: 'stale_update',
          priority: 3,
          title: `Stale Update: ${app.apps?.name || 'Unknown App'}`,
          description: `${clientName} - No update in ${daysSinceUpdate} days`,
          client_id: app.clients?.id || null,
          client_app_id: app.id,
          client_name: clientName,
          app_name: app.apps?.name || null,
          metadata: {
            last_updated: app.updated_at,
            days_since_update: daysSinceUpdate,
            status: app.status
          }
        });
      }
    }

    // Issue 4: Missing Deposit (status = registered but no deposit) (Priority 4)
    const { data: missingDeposits, error: depositError } = await supabase
      .from('client_apps')
      .select('id, status, deposited, deposit_amount, apps(name), clients!client_apps_client_id_fkey(id, name, surname)')
      .eq('status', 'registered')
      .eq('deposited', false)
      .order('created_at', { ascending: true })
      .limit(LIMIT_PER_CATEGORY);

    if (!depositError && missingDeposits) {
      for (const app of missingDeposits) {
        const clientName = `${app.clients?.name || ''} ${app.clients?.surname || ''}`.trim();

        issues.push({
          type: 'missing_deposit',
          priority: 4,
          title: `Missing Deposit: ${app.apps?.name || 'Unknown App'}`,
          description: `${clientName} - Registered but no deposit recorded`,
          client_id: app.clients?.id || null,
          client_app_id: app.id,
          client_name: clientName,
          app_name: app.apps?.name || null,
          metadata: {
            status: app.status,
            deposit_required: app.deposit_amount
          }
        });
      }
    }

    // Issue 5: Pending Documents (requests not converted) (Priority 5)
    const { data: pendingRequests, error: requestsError } = await supabase
      .from('requests')
      .select('id, name, status, created_at, client_id, clients(id, name, surname)')
      .eq('status', 'new')
      .lt('created_at', daysAgo7.toISOString())
      .order('created_at', { ascending: true })
      .limit(LIMIT_PER_CATEGORY);

    if (!requestsError && pendingRequests) {
      for (const request of pendingRequests) {
        const clientName = request.clients 
          ? `${request.clients.name || ''} ${request.clients.surname || ''}`.trim()
          : request.name;
        const daysOld = Math.floor((now.getTime() - new Date(request.created_at).getTime()) / (1000 * 60 * 60 * 24));

        issues.push({
          type: 'pending_document',
          priority: 5,
          title: `Pending Request: ${clientName}`,
          description: `Request pending for ${daysOld} days`,
          client_id: request.client_id || null,
          client_app_id: null,
          client_name: clientName,
          app_name: null,
          metadata: {
            request_id: request.id,
            days_old: daysOld,
            status: request.status
          }
        });
      }
    }

    // Group issues by type
    const issuesByType: Record<string, FastCheckIssue[]> = {
      overdue_deadline: [],
      due_soon: [],
      stale_update: [],
      missing_deposit: [],
      pending_document: []
    };

    issues.forEach(issue => {
      issuesByType[issue.type].push(issue);
    });

    // Sort each category by priority (most critical first)
    Object.keys(issuesByType).forEach(type => {
      issuesByType[type].sort((a, b) => {
        // First by priority, then by metadata (days overdue, hours until, etc.)
        if (a.priority !== b.priority) return a.priority - b.priority;
        
        // For overdue: most overdue first
        if (a.type === 'overdue_deadline' && a.metadata.days_overdue && b.metadata.days_overdue) {
          return b.metadata.days_overdue - a.metadata.days_overdue;
        }
        
        // For due soon: soonest first
        if (a.type === 'due_soon' && a.metadata.hours_until && b.metadata.hours_until) {
          return a.metadata.hours_until - b.metadata.hours_until;
        }
        
        // For stale: oldest first
        if (a.type === 'stale_update' && a.metadata.days_since_update && b.metadata.days_since_update) {
          return b.metadata.days_since_update - a.metadata.days_since_update;
        }
        
        return 0;
      });
    });

    // Get overall top 5 most critical (for quick overview)
    const allIssuesSorted = [...issues].sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      if (a.type === 'overdue_deadline' && a.metadata.days_overdue && b.metadata.days_overdue) {
        return b.metadata.days_overdue - a.metadata.days_overdue;
      }
      return 0;
    });
    const top5 = allIssuesSorted.slice(0, 5);

    return new Response(
      JSON.stringify({
        success: true,
        timestamp: now.toISOString(),
        total_issues: issues.length,
        top_5: top5,
        by_category: {
          overdue_deadline: issuesByType.overdue_deadline,
          due_soon: issuesByType.due_soon,
          stale_update: issuesByType.stale_update,
          missing_deposit: issuesByType.missing_deposit,
          pending_document: issuesByType.pending_document
        },
        by_type: {
          overdue_deadline: issuesByType.overdue_deadline.length,
          due_soon: issuesByType.due_soon.length,
          stale_update: issuesByType.stale_update.length,
          missing_deposit: issuesByType.missing_deposit.length,
          pending_document: issuesByType.pending_document.length
        }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        error: error.message || "Internal server error"
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

