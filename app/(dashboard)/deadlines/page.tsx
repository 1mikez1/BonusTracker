'use client';

import { useState, useMemo } from 'react';
import { useSupabaseData } from '@/lib/useSupabaseData';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorMessage } from '@/components/ErrorMessage';
import { EmptyState } from '@/components/EmptyState';
import { StatusBadge } from '@/components/StatusBadge';
import Link from 'next/link';

type DeadlineStatus = 'overdue' | 'due_48h' | 'in_progress' | 'completed';

interface ClientAppWithDeadline {
  id: string;
  started_at: string | null;
  deadline_at: string | null;
  status: string;
  apps: {
    id: string;
    name: string;
    deadline_days: number | null;
  } | null;
  clients: {
    id: string;
    name: string;
    surname: string | null;
  } | null;
}

export default function DeadlinesPage() {
  const [filterStatus, setFilterStatus] = useState<DeadlineStatus | 'all'>('all');

  // Fetch client_apps with deadlines
  const { data: clientApps, isLoading, error, mutate } = useSupabaseData<ClientAppWithDeadline>({
    table: 'client_apps',
    select: 'id, started_at, deadline_at, status, apps(id, name, deadline_days), clients!client_id(id, name, surname)',
    filters: {
      deadline_at: { not: { is: null } }
    },
    order: { column: 'deadline_at', ascending: true }
  });

  // Categorize deadlines
  const categorized = useMemo(() => {
    if (!clientApps) return { overdue: [], due_48h: [], in_progress: [], completed: [] };

    const now = new Date();
    const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    const categories = {
      overdue: [] as ClientAppWithDeadline[],
      due_48h: [] as ClientAppWithDeadline[],
      in_progress: [] as ClientAppWithDeadline[],
      completed: [] as ClientAppWithDeadline[]
    };

    for (const app of clientApps) {
      if (!app.deadline_at) continue;

      const deadline = new Date(app.deadline_at);
      const status = app.status;

      // Completed or paid = completed
      if (status === 'completed' || status === 'paid') {
        categories.completed.push(app);
      }
      // Overdue = deadline passed and not completed
      else if (deadline < now) {
        categories.overdue.push(app);
      }
      // Due in 48h = deadline within 48 hours
      else if (deadline <= in48h) {
        categories.due_48h.push(app);
      }
      // In progress = deadline in future
      else {
        categories.in_progress.push(app);
      }
    }

    return categories;
  }, [clientApps]);

  // Filtered data based on selected status
  const filteredData = useMemo(() => {
    if (filterStatus === 'all') {
      // Show all, sorted: overdue → due_48h → in_progress → completed
      return [
        ...categorized.overdue,
        ...categorized.due_48h,
        ...categorized.in_progress,
        ...categorized.completed
      ];
    }
    return categorized[filterStatus] || [];
  }, [filterStatus, categorized]);

  // Calculate days until deadline
  const getDaysUntilDeadline = (deadlineAt: string | null): number | null => {
    if (!deadlineAt) return null;
    const deadline = new Date(deadlineAt);
    const now = new Date();
    const diffMs = deadline.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Get deadline status color
  const getDeadlineColor = (app: ClientAppWithDeadline): string => {
    if (!app.deadline_at) return '#64748b'; // gray
    
    const status = app.status;
    if (status === 'completed' || status === 'paid') return '#10b981'; // green
    
    const days = getDaysUntilDeadline(app.deadline_at);
    if (days === null) return '#64748b';
    
    if (days < 0) return '#ef4444'; // red (overdue)
    if (days <= 2) return '#f59e0b'; // orange (due in 48h)
    return '#10b981'; // green (in progress)
  };

  // Get deadline status text
  const getDeadlineStatusText = (app: ClientAppWithDeadline): string => {
    if (!app.deadline_at) return 'No deadline';
    
    const status = app.status;
    if (status === 'completed' || status === 'paid') return 'Completed';
    
    const days = getDaysUntilDeadline(app.deadline_at);
    if (days === null) return 'No deadline';
    
    if (days < 0) return `Overdue by ${Math.abs(days)} days`;
    if (days === 0) return 'Due today';
    if (days === 1) return 'Due tomorrow';
    if (days <= 2) return `Due in ${days} days`;
    return `Due in ${days} days`;
  };

  if (isLoading) {
    return (
      <div style={{ padding: '2rem' }}>
        <LoadingSpinner size="large" message="Loading deadlines..." />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '2rem' }}>
        <ErrorMessage error={error} onRetry={() => mutate()} />
      </div>
    );
  }

  const totalCount = categorized.overdue.length + categorized.due_48h.length + 
                     categorized.in_progress.length + categorized.completed.length;

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '0.5rem' }}>
          Bonus Deadlines
        </h1>
        <p style={{ color: '#64748b', fontSize: '1rem' }}>
          Track and manage bonus deadlines for all client apps
        </p>
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
            {categorized.overdue.length}
          </div>
          <div style={{ color: '#64748b', fontSize: '0.9rem' }}>Overdue</div>
        </div>

        <div style={{ 
          backgroundColor: '#fff', 
          padding: '1.5rem', 
          borderRadius: '8px', 
          border: '2px solid #f59e0b',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: '2rem', fontWeight: '700', color: '#f59e0b', marginBottom: '0.5rem' }}>
            {categorized.due_48h.length}
          </div>
          <div style={{ color: '#64748b', fontSize: '0.9rem' }}>Due in 48h</div>
        </div>

        <div style={{ 
          backgroundColor: '#fff', 
          padding: '1.5rem', 
          borderRadius: '8px', 
          border: '2px solid #10b981',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: '2rem', fontWeight: '700', color: '#10b981', marginBottom: '0.5rem' }}>
            {categorized.in_progress.length}
          </div>
          <div style={{ color: '#64748b', fontSize: '0.9rem' }}>In Progress</div>
        </div>

        <div style={{ 
          backgroundColor: '#fff', 
          padding: '1.5rem', 
          borderRadius: '8px', 
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: '2rem', fontWeight: '700', color: '#64748b', marginBottom: '0.5rem' }}>
            {categorized.completed.length}
          </div>
          <div style={{ color: '#64748b', fontSize: '0.9rem' }}>Completed</div>
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
          onClick={() => setFilterStatus('all')}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: filterStatus === 'all' ? '#3b82f6' : '#e2e8f0',
            color: filterStatus === 'all' ? 'white' : '#475569',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: '500'
          }}
        >
          All ({totalCount})
        </button>
        <button
          onClick={() => setFilterStatus('overdue')}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: filterStatus === 'overdue' ? '#ef4444' : '#fee2e2',
            color: filterStatus === 'overdue' ? 'white' : '#dc2626',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: '500'
          }}
        >
          Overdue ({categorized.overdue.length})
        </button>
        <button
          onClick={() => setFilterStatus('due_48h')}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: filterStatus === 'due_48h' ? '#f59e0b' : '#fef3c7',
            color: filterStatus === 'due_48h' ? 'white' : '#d97706',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: '500'
          }}
        >
          Due in 48h ({categorized.due_48h.length})
        </button>
        <button
          onClick={() => setFilterStatus('in_progress')}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: filterStatus === 'in_progress' ? '#10b981' : '#d1fae5',
            color: filterStatus === 'in_progress' ? 'white' : '#059669',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: '500'
          }}
        >
          In Progress ({categorized.in_progress.length})
        </button>
        <button
          onClick={() => setFilterStatus('completed')}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: filterStatus === 'completed' ? '#64748b' : '#f1f5f9',
            color: filterStatus === 'completed' ? 'white' : '#475569',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: '500'
          }}
        >
          Completed ({categorized.completed.length})
        </button>
      </div>

      {/* Deadlines List */}
      {filteredData.length === 0 ? (
        <EmptyState
          title="No deadlines found"
          message={filterStatus === 'all' 
            ? "No client apps have deadlines configured."
            : `No ${filterStatus} deadlines found.`}
        />
      ) : (
        <div style={{ 
          display: 'grid', 
          gap: '1rem'
        }}>
          {filteredData.map((app) => {
            const clientName = `${app.clients?.name || ''} ${app.clients?.surname || ''}`.trim();
            const appName = app.apps?.name || 'Unknown App';
            const deadlineColor = getDeadlineColor(app);
            const deadlineText = getDeadlineStatusText(app);
            const days = getDaysUntilDeadline(app.deadline_at);

            return (
              <Link
                key={app.id}
                href={`/clients/${app.clients?.id}`}
                style={{
                  textDecoration: 'none',
                  color: 'inherit'
                }}
              >
                <div style={{
                  backgroundColor: '#fff',
                  padding: '1.5rem',
                  borderRadius: '8px',
                  border: `2px solid ${deadlineColor}`,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  cursor: 'pointer'
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '1.2rem', fontWeight: '600', marginBottom: '0.25rem' }}>
                        {appName}
                      </div>
                      <div style={{ color: '#64748b', fontSize: '0.9rem' }}>
                        {clientName || 'Unknown Client'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <StatusBadge status={app.status} />
                      <div style={{
                        padding: '0.25rem 0.75rem',
                        backgroundColor: deadlineColor,
                        color: 'white',
                        borderRadius: '4px',
                        fontSize: '0.8rem',
                        fontWeight: '600'
                      }}>
                        {deadlineText}
                      </div>
                    </div>
                  </div>

                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
                    gap: '1rem',
                    fontSize: '0.85rem',
                    color: '#64748b'
                  }}>
                    {app.started_at && (
                      <div>
                        <strong>Started:</strong>{' '}
                        {new Date(app.started_at).toLocaleDateString('it-IT', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric'
                        })}
                      </div>
                    )}
                    {app.deadline_at && (
                      <div>
                        <strong>Deadline:</strong>{' '}
                        {new Date(app.deadline_at).toLocaleDateString('it-IT', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric'
                        })}
                      </div>
                    )}
                    {app.apps?.deadline_days && (
                      <div>
                        <strong>Deadline Days:</strong> {app.apps.deadline_days}
                      </div>
                    )}
                    {days !== null && (
                      <div>
                        <strong>Days Remaining:</strong>{' '}
                        <span style={{ 
                          color: days < 0 ? '#ef4444' : days <= 2 ? '#f59e0b' : '#10b981',
                          fontWeight: '600'
                        }}>
                          {days < 0 ? Math.abs(days) : days}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

