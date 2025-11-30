'use client';

import { useState, useMemo, useEffect } from 'react';
import { useSupabaseData } from '@/lib/useSupabaseData';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorMessage } from '@/components/ErrorMessage';
import { EmptyState } from '@/components/EmptyState';
import { StatusBadge } from '@/components/StatusBadge';
import Link from 'next/link';
import { getSupabaseClient } from '@/lib/supabaseClient';

interface ClientError {
  id: string;
  error_type: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string | null;
  detected_at: string;
  client_id: string;
  client_app_id: string | null;
  clients: {
    id: string;
    name: string;
    surname: string | null;
  } | null;
  client_apps: {
    id: string;
    apps: {
      name: string;
    } | null;
  } | null;
}

interface ClientWithErrors {
  id: string;
  name: string;
  surname: string | null;
  email: string | null;
  contact: string | null;
  error_count: number;
  critical_errors: number;
  warnings: number;
  latest_error: string | null;
}

export default function UnifiedDashboardPage() {
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'critical' | 'warning' | 'info'>('all');
  const [isDetecting, setIsDetecting] = useState(false);
  const [lastDetection, setLastDetection] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['overdue_deadlines', 'due_soon_deadlines', 'clients_with_errors', 'recent_errors'])); // Default: all error sections expanded

  // Fetch all clients
  const { data: clients, isLoading: clientsLoading, error: clientsError, mutate: mutateClients } = useSupabaseData({
    table: 'clients',
    select: 'id, name, surname, email, contact, tiers(name)',
    order: { column: 'created_at', ascending: false }
  });

  // Fetch all client errors (optional - table might not exist in all environments)
  // Filter out resolved and cleared errors
  const { data: errors, isLoading: errorsLoading, error: errorsError, mutate: mutateErrors } = useSupabaseData({
    table: 'client_errors' as any,
    select: 'id, error_type, severity, title, description, detected_at, client_id, client_app_id, cleared_at, clients!client_id(id, name, surname), client_apps(id, apps(name))',
    filters: {
      resolved_at: { is: null },
      cleared_at: { is: null }
    },
    order: { column: 'detected_at' as any, ascending: false }
  }) as { data: ClientError[] | undefined; isLoading: boolean; error: any; mutate: () => void };

  // Fetch deadlines (overdue and due soon)
  const { data: deadlines, isLoading: deadlinesLoading } = useSupabaseData({
    table: 'client_apps',
    select: 'id, deadline_at, status, apps(name), clients!client_id(id, name, surname)',
    filters: {
      deadline_at: { not: { is: null } } as any
    },
    order: { column: 'created_at', ascending: true }
  });

  // Fetch pending requests
  const { data: requests, isLoading: requestsLoading } = useSupabaseData({
    table: 'requests',
    select: 'id, name, status, created_at, client_id, clients(id, name, surname)',
    filters: {
      status: { eq: 'new' }
    },
    order: { column: 'created_at', ascending: false }
  });

  // Calculate statistics
  const stats = useMemo(() => {
    // Handle case where errors might not be available (table doesn't exist)
    const errorsArray = Array.isArray(errors) ? errors : [];
    if (!deadlines || !requests) {
      return {
        totalErrors: 0,
        criticalErrors: 0,
        warnings: 0,
        overdueDeadlines: 0,
        dueSoonDeadlines: 0,
        pendingRequests: 0,
        clientsWithErrors: 0
      };
    }

    const now = new Date();
    const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    const criticalErrors = errorsArray.filter((e: ClientError) => e.severity === 'critical').length;
    const warnings = errorsArray.filter((e: ClientError) => e.severity === 'warning').length;
    const overdueDeadlines = deadlines.filter((d: any) => 
      d.deadline_at && new Date(d.deadline_at) < now && 
      !['completed', 'paid', 'cancelled'].includes(d.status)
    ).length;
    const dueSoonDeadlines = deadlines.filter((d: any) => 
      d.deadline_at && 
      new Date(d.deadline_at) >= now && 
      new Date(d.deadline_at) <= in48h &&
      !['completed', 'paid', 'cancelled'].includes(d.status)
    ).length;

    const uniqueClientsWithErrors = new Set(errorsArray.map((e: ClientError) => e.client_id)).size;

    return {
      totalErrors: errorsArray.length,
      criticalErrors,
      warnings,
      overdueDeadlines,
      dueSoonDeadlines,
      pendingRequests: requests.length,
      clientsWithErrors: uniqueClientsWithErrors
    };
  }, [errors, deadlines, requests]);

  // Group errors by client
  const clientsWithErrors = useMemo(() => {
    const errorsArray = Array.isArray(errors) ? errors : [];
    if (!clients) return [];

    const clientMap = new Map<string, ClientWithErrors>();

    // Initialize all clients
    for (const client of clients) {
      clientMap.set(client.id, {
        id: client.id,
        name: client.name,
        surname: client.surname,
        email: client.email || null,
        contact: client.contact || null,
        error_count: 0,
        critical_errors: 0,
        warnings: 0,
        latest_error: null
      });
    }

    // Count errors per client
    for (const error of errorsArray as ClientError[]) {
      if (filterSeverity !== 'all' && error.severity !== filterSeverity) continue;

      const client = clientMap.get(error.client_id);
      if (client) {
        client.error_count++;
        if (error.severity === 'critical') client.critical_errors++;
        if (error.severity === 'warning') client.warnings++;
        if (!client.latest_error || error.detected_at > client.latest_error) {
          client.latest_error = error.detected_at;
        }
      }
    }

    // Filter clients with errors and sort by error count
    return Array.from(clientMap.values())
      .filter(c => c.error_count > 0)
      .sort((a, b) => {
        // Sort by critical errors first, then total errors
        if (a.critical_errors !== b.critical_errors) {
          return b.critical_errors - a.critical_errors;
        }
        return b.error_count - a.error_count;
      });
  }, [errors, clients, filterSeverity]);

  // Filtered errors
  const filteredErrors = useMemo(() => {
    const errorsArray = Array.isArray(errors) ? errors : [];
    if (filterSeverity === 'all') return errorsArray as ClientError[];
    return errorsArray.filter((e: ClientError) => e.severity === filterSeverity) as ClientError[];
  }, [errors, filterSeverity]);

  // Overdue deadlines
  const overdueDeadlines = useMemo(() => {
    if (!deadlines) return [];
    const now = new Date();
    return deadlines.filter((d: any) => 
      d.deadline_at && 
      new Date(d.deadline_at) < now && 
      !['completed', 'paid', 'cancelled'].includes(d.status)
    ).slice(0, 10);
  }, [deadlines]);

  // Due soon deadlines (within 48 hours)
  const dueSoonDeadlinesList = useMemo(() => {
    if (!deadlines) return [];
    const now = new Date();
    const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    return deadlines.filter((d: any) => 
      d.deadline_at && 
      new Date(d.deadline_at) >= now && 
      new Date(d.deadline_at) <= in48h &&
      !['completed', 'paid', 'cancelled'].includes(d.status)
    ).slice(0, 10);
  }, [deadlines]);

  // Run error detection
  const runErrorDetection = async () => {
    try {
      setIsDetecting(true);
      const supabase = getSupabaseClient();
      if (!supabase) {
        throw new Error('Supabase client not initialized');
      }

      const { data, error } = await (supabase as any).rpc('detect_all_client_errors');

      if (error) {
        // If the function doesn't exist, that's okay - just log it
        if (error.message?.includes('function') || error.message?.includes('does not exist')) {
          console.warn('Error detection function not available:', error.message);
          alert('Error detection is not available in this environment.');
          return;
        }
        throw error;
      }

      setLastDetection(new Date().toISOString());
      mutateErrors();
      mutateClients();
    } catch (err: any) {
      console.error('Error detection failed:', err);
      alert('Error detection failed: ' + err.message);
    } finally {
      setIsDetecting(false);
    }
  };

  // Export errors to CSV
  const exportErrorsToCSV = () => {
    if (!filteredErrors || filteredErrors.length === 0) {
      alert('No errors to export');
      return;
    }

    const headers = ['Client Name', 'App', 'Error Type', 'Severity', 'Title', 'Description', 'Detected At'];
    const rows = filteredErrors.map(error => {
      const clientName = error.clients 
        ? `${error.clients.name} ${error.clients.surname || ''}`.trim()
        : 'Unknown';
      const appName = error.client_apps?.apps?.name || 'N/A';
      return [
        clientName,
        appName,
        error.error_type,
        error.severity,
        error.title,
        error.description || '',
        new Date(error.detected_at).toLocaleString('it-IT')
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `errors_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Only block on critical queries - errors are optional
  const isLoading = clientsLoading || deadlinesLoading || requestsLoading;
  // Only show error if critical queries fail - ignore client_errors errors
  const error = clientsError;

  if (isLoading) {
    return (
      <div style={{ padding: '2rem' }}>
        <LoadingSpinner size="large" message="Loading dashboard..." />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '2rem' }}>
        <ErrorMessage error={error} onRetry={() => { mutateErrors(); mutateClients(); }} />
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1600px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '0.5rem' }}>
            Unified Dashboard
          </h1>
          <p style={{ color: '#64748b', fontSize: '1rem' }}>
            Overview of all clients, bonuses, errors, and issues
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={runErrorDetection}
            disabled={isDetecting}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: isDetecting ? '#94a3b8' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: isDetecting ? 'not-allowed' : 'pointer',
              fontSize: '0.9rem',
              fontWeight: '500'
            }}
          >
            {isDetecting ? 'Detecting...' : 'Detect Errors'}
          </button>
          <button
            onClick={exportErrorsToCSV}
            disabled={!filteredErrors || filteredErrors.length === 0}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: (!filteredErrors || filteredErrors.length === 0) ? '#e2e8f0' : '#10b981',
              color: (!filteredErrors || filteredErrors.length === 0) ? '#94a3b8' : 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: (!filteredErrors || filteredErrors.length === 0) ? 'not-allowed' : 'pointer',
              fontSize: '0.9rem',
              fontWeight: '500'
            }}
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '1rem', 
        marginBottom: '2rem' 
      }}>
        <div style={{ 
          backgroundColor: '#fff', 
          padding: '1.5rem', 
          borderRadius: '8px', 
          border: '2px solid #ef4444',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: '2rem', fontWeight: '700', color: '#ef4444', marginBottom: '0.5rem' }}>
            {stats.criticalErrors}
          </div>
          <div style={{ color: '#64748b', fontSize: '0.9rem' }}>Critical Errors</div>
        </div>

        <div style={{ 
          backgroundColor: '#fff', 
          padding: '1.5rem', 
          borderRadius: '8px', 
          border: '2px solid #f59e0b',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: '2rem', fontWeight: '700', color: '#f59e0b', marginBottom: '0.5rem' }}>
            {stats.warnings}
          </div>
          <div style={{ color: '#64748b', fontSize: '0.9rem' }}>Warnings</div>
        </div>

        <div style={{ 
          backgroundColor: '#fff', 
          padding: '1.5rem', 
          borderRadius: '8px', 
          border: '2px solid #ef4444',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: '2rem', fontWeight: '700', color: '#ef4444', marginBottom: '0.5rem' }}>
            {stats.overdueDeadlines}
          </div>
          <div style={{ color: '#64748b', fontSize: '0.9rem' }}>Overdue Deadlines</div>
        </div>

        <div style={{ 
          backgroundColor: '#fff', 
          padding: '1.5rem', 
          borderRadius: '8px', 
          border: '2px solid #f59e0b',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: '2rem', fontWeight: '700', color: '#f59e0b', marginBottom: '0.5rem' }}>
            {stats.dueSoonDeadlines}
          </div>
          <div style={{ color: '#64748b', fontSize: '0.9rem' }}>Due in 48h</div>
        </div>

        <div style={{ 
          backgroundColor: '#fff', 
          padding: '1.5rem', 
          borderRadius: '8px', 
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: '2rem', fontWeight: '700', color: '#64748b', marginBottom: '0.5rem' }}>
            {stats.pendingRequests}
          </div>
          <div style={{ color: '#64748b', fontSize: '0.9rem' }}>Pending Requests</div>
        </div>

        <div style={{ 
          backgroundColor: '#fff', 
          padding: '1.5rem', 
          borderRadius: '8px', 
          border: '2px solid #ef4444',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: '2rem', fontWeight: '700', color: '#ef4444', marginBottom: '0.5rem' }}>
            {stats.clientsWithErrors}
          </div>
          <div style={{ color: '#64748b', fontSize: '0.9rem' }}>Clients with Errors</div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ 
        display: 'flex', 
        gap: '0.5rem', 
        marginBottom: '1.5rem',
        flexWrap: 'wrap'
      }}>
        <button
          onClick={() => setFilterSeverity('all')}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: filterSeverity === 'all' ? '#3b82f6' : '#e2e8f0',
            color: filterSeverity === 'all' ? 'white' : '#475569',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: '500'
          }}
        >
          All ({stats.totalErrors})
        </button>
        <button
          onClick={() => setFilterSeverity('critical')}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: filterSeverity === 'critical' ? '#ef4444' : '#fee2e2',
            color: filterSeverity === 'critical' ? 'white' : '#dc2626',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: '500'
          }}
        >
          Critical ({stats.criticalErrors})
        </button>
        <button
          onClick={() => setFilterSeverity('warning')}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: filterSeverity === 'warning' ? '#f59e0b' : '#fef3c7',
            color: filterSeverity === 'warning' ? 'white' : '#d97706',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: '500'
          }}
        >
          Warnings ({stats.warnings})
        </button>
      </div>

      {/* Overdue Deadlines */}
      <div style={{ marginBottom: '2rem' }}>
        <div
          onClick={() => {
            const newExpanded = new Set(expandedSections);
            if (newExpanded.has('overdue_deadlines')) {
              newExpanded.delete('overdue_deadlines');
            } else {
              newExpanded.add('overdue_deadlines');
            }
            setExpandedSections(newExpanded);
          }}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
            padding: '0.75rem 0',
            marginBottom: '1rem',
            borderBottom: '2px solid #e2e8f0'
          }}
        >
          <h2 style={{ fontSize: '1.5rem', fontWeight: '600', margin: 0 }}>
            Overdue Deadlines ({overdueDeadlines.length})
          </h2>
          <div style={{ fontSize: '1.2rem', color: '#64748b' }}>
            {expandedSections.has('overdue_deadlines') ? '▼' : '▶'}
          </div>
        </div>
        {expandedSections.has('overdue_deadlines') && (
          <>
            {overdueDeadlines.length === 0 ? (
              <EmptyState
                title="No overdue deadlines"
                message="All deadlines are on track!"
              />
            ) : (
              <div style={{ display: 'grid', gap: '1rem' }}>
            {overdueDeadlines.map((deadline: any) => {
              const clientName = deadline.clients 
                ? `${deadline.clients.name} ${deadline.clients.surname || ''}`.trim()
                : 'Unknown';
              const appName = deadline.apps?.name || 'Unknown App';
              const daysOverdue = Math.floor((new Date().getTime() - new Date(deadline.deadline_at).getTime()) / (1000 * 60 * 60 * 24));

              return (
                <Link
                  key={deadline.id}
                  href={`/clients/${deadline.clients?.id}`}
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  <div style={{
                    backgroundColor: '#fff',
                    padding: '1rem',
                    borderRadius: '8px',
                    border: '2px solid #ef4444',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                    cursor: 'pointer'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: '600' }}>{appName}</div>
                        <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{clientName}</div>
                      </div>
                      <div style={{ color: '#ef4444', fontWeight: '600' }}>
                        {daysOverdue} day{daysOverdue !== 1 ? 's' : ''} overdue
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Due Soon Deadlines (48h) */}
      <div style={{ marginBottom: '2rem' }}>
        <div
          onClick={() => {
            const newExpanded = new Set(expandedSections);
            if (newExpanded.has('due_soon_deadlines')) {
              newExpanded.delete('due_soon_deadlines');
            } else {
              newExpanded.add('due_soon_deadlines');
            }
            setExpandedSections(newExpanded);
          }}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
            padding: '0.75rem 0',
            marginBottom: '1rem',
            borderBottom: '2px solid #e2e8f0'
          }}
        >
          <h2 style={{ fontSize: '1.5rem', fontWeight: '600', margin: 0 }}>
            Due Soon (48h) ({dueSoonDeadlinesList.length})
          </h2>
          <div style={{ fontSize: '1.2rem', color: '#64748b' }}>
            {expandedSections.has('due_soon_deadlines') ? '▼' : '▶'}
          </div>
        </div>
        {expandedSections.has('due_soon_deadlines') && (
          <>
            {dueSoonDeadlinesList.length === 0 ? (
              <EmptyState
                title="No deadlines due soon"
                message="No deadlines are due within the next 48 hours."
              />
            ) : (
              <div style={{ display: 'grid', gap: '1rem' }}>
            {dueSoonDeadlinesList.map((deadline: any) => {
              const clientName = deadline.clients 
                ? `${deadline.clients.name} ${deadline.clients.surname || ''}`.trim()
                : 'Unknown';
              const appName = deadline.apps?.name || 'Unknown App';
              const deadlineDate = new Date(deadline.deadline_at);
              const now = new Date();
              const hoursUntil = Math.floor((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60));
              const daysUntil = Math.floor(hoursUntil / 24);
              const remainingHours = hoursUntil % 24;

              return (
                <Link
                  key={deadline.id}
                  href={`/clients/${deadline.clients?.id}`}
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  <div style={{
                    backgroundColor: '#fff',
                    padding: '1rem',
                    borderRadius: '8px',
                    border: '2px solid #f59e0b',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                    cursor: 'pointer'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: '600' }}>{appName}</div>
                        <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{clientName}</div>
                        <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>
                          Due: {deadlineDate.toLocaleString('it-IT', { 
                            day: '2-digit', 
                            month: '2-digit', 
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </div>
                      <div style={{ color: '#f59e0b', fontWeight: '600', textAlign: 'right' }}>
                        {daysUntil > 0 ? (
                          <>
                            {daysUntil} day{daysUntil !== 1 ? 's' : ''}
                            {remainingHours > 0 && <div style={{ fontSize: '0.85rem' }}>{remainingHours}h left</div>}
                          </>
                        ) : (
                          <>{hoursUntil}h left</>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Clients with Errors */}
      <div style={{ marginBottom: '2rem' }}>
        <div
          onClick={() => {
            const newExpanded = new Set(expandedSections);
            if (newExpanded.has('clients_with_errors')) {
              newExpanded.delete('clients_with_errors');
            } else {
              newExpanded.add('clients_with_errors');
            }
            setExpandedSections(newExpanded);
          }}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
            padding: '0.75rem 0',
            marginBottom: '1rem',
            borderBottom: '2px solid #e2e8f0'
          }}
        >
          <h2 style={{ fontSize: '1.5rem', fontWeight: '600', margin: 0 }}>
            Clients with Errors ({clientsWithErrors.length})
          </h2>
          <div style={{ fontSize: '1.2rem', color: '#64748b' }}>
            {expandedSections.has('clients_with_errors') ? '▼' : '▶'}
          </div>
        </div>
        {expandedSections.has('clients_with_errors') && (
          <>
            {clientsWithErrors.length === 0 ? (
              <EmptyState
                title="No clients with errors"
                message="All clients are error-free!"
              />
            ) : (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
            gap: '1rem' 
          }}>
            {clientsWithErrors.map((client) => {
              const clientName = `${client.name} ${client.surname || ''}`.trim();
              const hasCritical = client.critical_errors > 0;

              return (
                <Link
                  key={client.id}
                  href={`/clients/${client.id}`}
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  <div style={{
                    backgroundColor: '#fff',
                    padding: '1.5rem',
                    borderRadius: '8px',
                    border: hasCritical ? '2px solid #ef4444' : '1px solid #e2e8f0',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                    cursor: 'pointer',
                    transition: 'transform 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
                  }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                      <div style={{ fontSize: '1.1rem', fontWeight: '600' }}>
                        {clientName}
                      </div>
                      <div style={{
                        padding: '0.25rem 0.75rem',
                        backgroundColor: hasCritical ? '#ef4444' : '#f59e0b',
                        color: 'white',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: '600'
                      }}>
                        {client.error_count} {client.error_count === 1 ? 'error' : 'errors'}
                      </div>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.5rem' }}>
                      {client.email || client.contact || 'No contact'}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.8rem' }}>
                      {client.critical_errors > 0 && (
                        <span style={{ color: '#ef4444', fontWeight: '600' }}>
                          🔴 {client.critical_errors} critical
                        </span>
                      )}
                      {client.warnings > 0 && (
                        <span style={{ color: '#f59e0b', fontWeight: '600' }}>
                          🟠 {client.warnings} warnings
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
            )}
          </>
        )}
      </div>

      {/* Recent Errors */}
      <div style={{ marginBottom: '2rem' }}>
        <div
          onClick={() => {
            const newExpanded = new Set(expandedSections);
            if (newExpanded.has('recent_errors')) {
              newExpanded.delete('recent_errors');
            } else {
              newExpanded.add('recent_errors');
            }
            setExpandedSections(newExpanded);
          }}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
            padding: '0.75rem 0',
            marginBottom: '1rem',
            borderBottom: '2px solid #e2e8f0'
          }}
        >
          <h2 style={{ fontSize: '1.5rem', fontWeight: '600', margin: 0 }}>
            Recent Errors ({filteredErrors.length})
          </h2>
          <div style={{ fontSize: '1.2rem', color: '#64748b' }}>
            {expandedSections.has('recent_errors') ? '▼' : '▶'}
          </div>
        </div>
        {expandedSections.has('recent_errors') && (
          <>
            {filteredErrors.length === 0 ? (
              <EmptyState
                title="No errors found"
                message={`No ${filterSeverity === 'all' ? '' : filterSeverity} errors detected.`}
              />
            ) : (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {filteredErrors.slice(0, 20).map((error) => {
              const clientName = error.clients 
                ? `${error.clients.name} ${error.clients.surname || ''}`.trim()
                : 'Unknown Client';
              const appName = error.client_apps?.apps?.name || 'N/A';
              const severityColor = error.severity === 'critical' ? '#ef4444' : 
                                   error.severity === 'warning' ? '#f59e0b' : '#3b82f6';
              const linkUrl = error.client_id 
                ? `/clients/${error.client_id}${error.client_app_id ? `#app-${error.client_app_id}` : ''}`
                : null;

              const ErrorContent = (
                <div style={{
                  backgroundColor: '#fff',
                  padding: '1.5rem',
                  borderRadius: '8px',
                  border: `2px solid ${severityColor}`,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  display: 'flex',
                  gap: '1rem',
                  alignItems: 'flex-start'
                }}>
                  <div style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    backgroundColor: severityColor,
                    marginTop: '0.25rem',
                    flexShrink: 0
                  }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'flex-start',
                      marginBottom: '0.5rem'
                    }}>
                      <div>
                        <div style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '0.25rem' }}>
                          {error.title}
                        </div>
                        <div style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                          {clientName} - {appName}
                        </div>
                        {error.description && (
                          <div style={{ color: '#64748b', fontSize: '0.85rem' }}>
                            {error.description}
                          </div>
                        )}
                      </div>
                      <div style={{
                        padding: '0.25rem 0.75rem',
                        backgroundColor: severityColor,
                        color: 'white',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        textTransform: 'uppercase'
                      }}>
                        {error.severity}
                      </div>
                    </div>
                    <div style={{ 
                      fontSize: '0.75rem', 
                      color: '#94a3b8',
                      marginTop: '0.5rem',
                      paddingTop: '0.5rem',
                      borderTop: '1px solid #e2e8f0'
                    }}>
                      Detected: {new Date(error.detected_at).toLocaleString('it-IT')} | 
                      Type: {error.error_type}
                    </div>
                  </div>
                </div>
              );

              if (linkUrl) {
                return (
                  <Link key={error.id} href={linkUrl} style={{ textDecoration: 'none', color: 'inherit' }}>
                    {ErrorContent}
                  </Link>
                );
              }

              return <div key={error.id}>{ErrorContent}</div>;
            })}
          </div>
            )}
          </>
        )}
      </div>

      {/* Last Detection */}
      {lastDetection && (
        <div style={{ 
          marginTop: '2rem', 
          padding: '1rem', 
          backgroundColor: '#f0fdf4', 
          borderRadius: '8px',
          fontSize: '0.85rem',
          color: '#059669',
          textAlign: 'center'
        }}>
          ✅ Last error detection: {new Date(lastDetection).toLocaleString('it-IT')}
        </div>
      )}
    </div>
  );
}

