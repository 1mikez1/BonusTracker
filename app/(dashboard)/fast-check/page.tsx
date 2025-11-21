'use client';

import { useState, useEffect } from 'react';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorMessage } from '@/components/ErrorMessage';
import Link from 'next/link';
import { supabaseClient } from '@/lib/supabaseClient';

interface FastCheckIssue {
  type: 'overdue_deadline' | 'due_soon' | 'stale_update' | 'missing_deposit' | 'pending_document';
  priority: number;
  title: string;
  description: string;
  client_id: string | null;
  client_app_id: string | null;
  client_name: string | null;
  app_name: string | null;
  metadata: Record<string, any>;
}

interface FastCheckResponse {
  success: boolean;
  timestamp: string;
  total_issues: number;
  top_5: FastCheckIssue[];
  by_type: {
    overdue_deadline: number;
    due_soon: number;
    stale_update: number;
    missing_deposit: number;
    pending_document: number;
  };
}

export default function FastCheckPage() {
  const [data, setData] = useState<FastCheckResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    loadFastCheck();
  }, []);

  const loadFastCheck = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const supabase = supabaseClient();
      if (!supabase) {
        throw new Error('Supabase client not initialized');
      }

      // Call Edge Function
      const { data: functionData, error: functionError } = await supabase.functions.invoke('daily-fast-check');

      if (functionError) {
        throw functionError;
      }

      setData(functionData as FastCheckResponse);
    } catch (err: any) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  };

  const getIssueIcon = (type: FastCheckIssue['type']): string => {
    switch (type) {
      case 'overdue_deadline': return '🔴';
      case 'due_soon': return '🟠';
      case 'stale_update': return '🟡';
      case 'missing_deposit': return '🔵';
      case 'pending_document': return '⚪';
      default: return '📋';
    }
  };

  const getIssueColor = (type: FastCheckIssue['type']): string => {
    switch (type) {
      case 'overdue_deadline': return '#ef4444';
      case 'due_soon': return '#f59e0b';
      case 'stale_update': return '#eab308';
      case 'missing_deposit': return '#3b82f6';
      case 'pending_document': return '#64748b';
      default: return '#64748b';
    }
  };

  if (isLoading) {
    return (
      <div style={{ padding: '2rem' }}>
        <LoadingSpinner size="large" message="Running fast-check..." />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '2rem' }}>
        <ErrorMessage error={error} onRetry={loadFastCheck} />
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '0.5rem' }}>
            Daily Fast-Check
          </h1>
          <p style={{ color: '#64748b', fontSize: '1rem' }}>
            Top 5 critical issues requiring attention
          </p>
        </div>
        <button
          onClick={loadFastCheck}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: '500'
          }}
        >
          Refresh
        </button>
      </div>

      {/* Summary */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
        gap: '1rem', 
        marginBottom: '2rem' 
      }}>
        <div style={{ 
          backgroundColor: '#fff', 
          padding: '1rem', 
          borderRadius: '8px', 
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#ef4444', marginBottom: '0.25rem' }}>
            {data.by_type.overdue_deadline}
          </div>
          <div style={{ color: '#64748b', fontSize: '0.85rem' }}>Overdue</div>
        </div>
        <div style={{ 
          backgroundColor: '#fff', 
          padding: '1rem', 
          borderRadius: '8px', 
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#f59e0b', marginBottom: '0.25rem' }}>
            {data.by_type.due_soon}
          </div>
          <div style={{ color: '#64748b', fontSize: '0.85rem' }}>Due Soon</div>
        </div>
        <div style={{ 
          backgroundColor: '#fff', 
          padding: '1rem', 
          borderRadius: '8px', 
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#eab308', marginBottom: '0.25rem' }}>
            {data.by_type.stale_update}
          </div>
          <div style={{ color: '#64748b', fontSize: '0.85rem' }}>Stale Updates</div>
        </div>
        <div style={{ 
          backgroundColor: '#fff', 
          padding: '1rem', 
          borderRadius: '8px', 
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#3b82f6', marginBottom: '0.25rem' }}>
            {data.by_type.missing_deposit}
          </div>
          <div style={{ color: '#64748b', fontSize: '0.85rem' }}>Missing Deposits</div>
        </div>
        <div style={{ 
          backgroundColor: '#fff', 
          padding: '1rem', 
          borderRadius: '8px', 
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#64748b', marginBottom: '0.25rem' }}>
            {data.by_type.pending_document}
          </div>
          <div style={{ color: '#64748b', fontSize: '0.85rem' }}>Pending Requests</div>
        </div>
      </div>

      {/* Top 5 Issues */}
      <div style={{ marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '1rem' }}>
          Top 5 Critical Issues
        </h2>
        {data.top_5.length === 0 ? (
          <div style={{ 
            padding: '2rem', 
            textAlign: 'center', 
            backgroundColor: '#f0fdf4', 
            borderRadius: '8px',
            border: '1px solid #bbf7d0'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>✅</div>
            <div style={{ fontSize: '1.2rem', fontWeight: '600', color: '#059669', marginBottom: '0.25rem' }}>
              All Clear!
            </div>
            <div style={{ color: '#64748b' }}>
              No critical issues found. Great job!
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {data.top_5.map((issue, index) => {
              const issueColor = getIssueColor(issue.type);
              const issueIcon = getIssueIcon(issue.type);
              const linkUrl = issue.client_id 
                ? `/clients/${issue.client_id}${issue.client_app_id ? `#app-${issue.client_app_id}` : ''}`
                : null;

              const IssueContent = (
                <div style={{
                  backgroundColor: '#fff',
                  padding: '1.5rem',
                  borderRadius: '8px',
                  border: `2px solid ${issueColor}`,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  display: 'flex',
                  gap: '1rem',
                  alignItems: 'flex-start'
                }}>
                  <div style={{ fontSize: '2rem' }}>{issueIcon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'flex-start',
                      marginBottom: '0.5rem'
                    }}>
                      <div>
                        <div style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '0.25rem' }}>
                          {issue.title}
                        </div>
                        <div style={{ color: '#64748b', fontSize: '0.9rem' }}>
                          {issue.description}
                        </div>
                      </div>
                      <div style={{
                        padding: '0.25rem 0.75rem',
                        backgroundColor: issueColor,
                        color: 'white',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: '600'
                      }}>
                        Priority {issue.priority}
                      </div>
                    </div>
                    {issue.metadata && (
                      <div style={{ 
                        fontSize: '0.85rem', 
                        color: '#64748b',
                        marginTop: '0.5rem',
                        paddingTop: '0.5rem',
                        borderTop: '1px solid #e2e8f0'
                      }}>
                        {issue.type === 'overdue_deadline' && (
                          <div>Days overdue: <strong>{issue.metadata.days_overdue}</strong></div>
                        )}
                        {issue.type === 'due_soon' && (
                          <div>Hours until deadline: <strong>{issue.metadata.hours_until}</strong></div>
                        )}
                        {issue.type === 'stale_update' && (
                          <div>Days since update: <strong>{issue.metadata.days_since_update}</strong></div>
                        )}
                        {issue.type === 'pending_document' && (
                          <div>Days old: <strong>{issue.metadata.days_old}</strong></div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );

              if (linkUrl) {
                return (
                  <Link key={index} href={linkUrl} style={{ textDecoration: 'none', color: 'inherit' }}>
                    {IssueContent}
                  </Link>
                );
              }

              return <div key={index}>{IssueContent}</div>;
            })}
          </div>
        )}
      </div>

      {/* Last Updated */}
      <div style={{ 
        marginTop: '2rem', 
        padding: '1rem', 
        backgroundColor: '#f8fafc', 
        borderRadius: '8px',
        fontSize: '0.85rem',
        color: '#64748b',
        textAlign: 'center'
      }}>
        Last updated: {new Date(data.timestamp).toLocaleString('it-IT')} | 
        Total issues found: <strong>{data.total_issues}</strong>
      </div>
    </div>
  );
}

