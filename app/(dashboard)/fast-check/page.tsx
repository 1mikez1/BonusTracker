'use client';

import { useState, useEffect } from 'react';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorMessage } from '@/components/ErrorMessage';
import Link from 'next/link';
import { getSupabaseClient } from '@/lib/supabaseClient';

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
  by_category?: {
    overdue_deadline: FastCheckIssue[];
    due_soon: FastCheckIssue[];
    stale_update: FastCheckIssue[];
    missing_deposit: FastCheckIssue[];
    pending_document: FastCheckIssue[];
  };
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
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['overdue_deadline', 'due_soon']));
  const [searchQuery, setSearchQuery] = useState('');
  const [itemsPerCategory, setItemsPerCategory] = useState<Record<string, number>>({
    overdue_deadline: 10,
    due_soon: 10,
    stale_update: 10,
    missing_deposit: 10,
    pending_document: 10
  });

  useEffect(() => {
    loadFastCheck();
  }, []);

  const loadFastCheck = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const supabase = getSupabaseClient();
      if (!supabase) {
        throw new Error('Supabase client not initialized');
      }

      // Call Edge Function
      const { data: functionData, error: functionError } = await supabase.functions.invoke('daily-fast-check');

      if (functionError) {
        throw functionError;
      }

      // Debug: Log the response to see what we're getting
      console.log('Fast-Check Response:', functionData);
      console.log('Has by_category?', !!functionData?.by_category);
      console.log('Response keys:', functionData ? Object.keys(functionData) : 'no data');

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

  const getCategoryLabel = (type: FastCheckIssue['type']): string => {
    switch (type) {
      case 'overdue_deadline': return '🔴 Overdue Deadlines';
      case 'due_soon': return '🟠 Deadlines Due Soon (48h)';
      case 'stale_update': return '🟡 Stale Updates (14+ days)';
      case 'missing_deposit': return '🔵 Missing Deposits';
      case 'pending_document': return '⚪ Pending Requests (7+ days)';
      default: return type;
    }
  };

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const showMoreInCategory = (category: string) => {
    setItemsPerCategory(prev => ({
      ...prev,
      [category]: (prev[category] || 10) + 10
    }));
  };

  const filterIssues = (issues: FastCheckIssue[]): FastCheckIssue[] => {
    if (!searchQuery.trim()) return issues;
    const query = searchQuery.toLowerCase();
    return issues.filter(issue => 
      issue.client_name?.toLowerCase().includes(query) ||
      issue.app_name?.toLowerCase().includes(query) ||
      issue.title.toLowerCase().includes(query) ||
      issue.description.toLowerCase().includes(query)
    );
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
            Advanced issue tracking by category - {data?.total_issues || 0} total issues found
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

      {/* Search Bar */}
      <div style={{ marginBottom: '1.5rem' }}>
        <input
          type="text"
          placeholder="Search by client name, app name, or description..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '0.75rem 1rem',
            fontSize: '0.95rem',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            outline: 'none',
            transition: 'border-color 0.2s'
          }}
          onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
          onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
        />
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

      {/* Top 5 Critical Issues Overview */}
      {data.top_5.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '1rem' }}>
            🚨 Top 5 Most Critical Issues
          </h2>
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
        </div>
      )}

      {/* Issues by Category */}
      {data.by_category ? (
        <div style={{ marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '1.5rem' }}>
            Issues by Category
          </h2>
          
          {data.total_issues === 0 ? (
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
            <div style={{ display: 'grid', gap: '1.5rem' }}>
              {(['overdue_deadline', 'due_soon', 'stale_update', 'missing_deposit', 'pending_document'] as const).map((category) => {
                // Safe access with multiple checks
                const categoryIssues = data?.by_category?.[category] || [];
                const filteredIssues = filterIssues(categoryIssues);
                const displayedIssues = filteredIssues.slice(0, itemsPerCategory[category] || 10);
                const hasMore = filteredIssues.length > displayedIssues.length;
                const isExpanded = expandedCategories.has(category);
                const issueColor = getIssueColor(category);
                const count = data?.by_type?.[category] || 0;

                if (count === 0) return null;

                return (
                  <div key={category} style={{
                    backgroundColor: '#fff',
                    borderRadius: '8px',
                    border: `1px solid ${issueColor}`,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                    overflow: 'hidden'
                  }}>
                    {/* Category Header */}
                    <div
                      onClick={() => toggleCategory(category)}
                      style={{
                        padding: '1.25rem 1.5rem',
                        backgroundColor: `${issueColor}15`,
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        borderBottom: isExpanded ? `2px solid ${issueColor}` : 'none',
                        transition: 'background-color 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = `${issueColor}25`}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = `${issueColor}15`}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ fontSize: '1.5rem' }}>{getIssueIcon(category)}</div>
                        <div>
                          <div style={{ fontSize: '1.1rem', fontWeight: '600' }}>
                            {getCategoryLabel(category)}
                          </div>
                          <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.25rem' }}>
                            {count} issue{count !== 1 ? 's' : ''} found
                            {searchQuery && ` (${filteredIssues.length} matching)`}
                          </div>
                        </div>
                      </div>
                      <div style={{ fontSize: '1.2rem', color: issueColor }}>
                        {isExpanded ? '▼' : '▶'}
                      </div>
                    </div>

                    {/* Category Content */}
                    {isExpanded && (
                      <div style={{ padding: '1.5rem' }}>
                        {displayedIssues.length === 0 ? (
                          <div style={{ 
                            padding: '2rem', 
                            textAlign: 'center', 
                            color: '#64748b' 
                          }}>
                            No issues match your search query
                          </div>
                        ) : (
                          <>
                            <div style={{ display: 'grid', gap: '1rem' }}>
                              {displayedIssues.map((issue, index) => {
                                const linkUrl = issue.client_id 
                                  ? `/clients/${issue.client_id}${issue.client_app_id ? `#app-${issue.client_app_id}` : ''}`
                                  : null;

                                const IssueContent = (
                                  <div style={{
                                    backgroundColor: '#f8fafc',
                                    padding: '1rem',
                                    borderRadius: '6px',
                                    border: `1px solid ${issueColor}40`,
                                    display: 'flex',
                                    gap: '1rem',
                                    alignItems: 'flex-start',
                                    transition: 'transform 0.2s, box-shadow 0.2s'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'translateX(4px)';
                                    e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.1)';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'translateX(0)';
                                    e.currentTarget.style.boxShadow = 'none';
                                  }}
                                  >
                                    <div style={{ fontSize: '1.5rem' }}>{getIssueIcon(issue.type)}</div>
                                    <div style={{ flex: 1 }}>
                                      <div style={{ 
                                        display: 'flex', 
                                        justifyContent: 'space-between', 
                                        alignItems: 'flex-start',
                                        marginBottom: '0.5rem'
                                      }}>
                                        <div>
                                          <div style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.25rem' }}>
                                            {issue.title}
                                          </div>
                                          <div style={{ color: '#64748b', fontSize: '0.9rem' }}>
                                            {issue.description}
                                          </div>
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
                                          {issue.type === 'missing_deposit' && issue.metadata.deposit_required && (
                                            <div>Deposit required: <strong>€{issue.metadata.deposit_required}</strong></div>
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
                            
                            {hasMore && (
                              <button
                                onClick={() => showMoreInCategory(category)}
                                style={{
                                  marginTop: '1rem',
                                  padding: '0.5rem 1rem',
                                  backgroundColor: issueColor,
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  fontSize: '0.9rem',
                                  fontWeight: '500',
                                  width: '100%'
                                }}
                              >
                                Show {Math.min(10, filteredIssues.length - displayedIssues.length)} More
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div style={{ 
          padding: '2rem', 
          textAlign: 'center', 
          backgroundColor: '#fef3c7', 
          borderRadius: '8px',
          border: '1px solid #fbbf24',
          marginBottom: '1rem'
        }}>
          <div style={{ fontSize: '1.1rem', fontWeight: '600', color: '#92400e', marginBottom: '0.5rem' }}>
            ⚠️ Category view not available
          </div>
          <div style={{ color: '#78350f', fontSize: '0.9rem' }}>
            Please deploy the updated Edge Function to see issues by category. The function needs to return <code>by_category</code> in the response.
          </div>
        </div>
      )}

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

