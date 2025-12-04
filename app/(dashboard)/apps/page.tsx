'use client';

import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { useSupabaseData } from '@/lib/useSupabaseData';
import { SectionHeader } from '@/components/SectionHeader';
import { MetricCard } from '@/components/MetricCard';
import { FiltersBar } from '@/components/FiltersBar';
import { DataTable } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorMessage } from '@/components/ErrorMessage';
import { EmptyState } from '@/components/EmptyState';
import { Pagination } from '@/components/Pagination';
import { NewSignupModal } from '@/components/NewSignupModal';

interface AppWithRelations {
  id: string;
  name: string;
  app_type: string | null;
  country: string | null;
  is_active: boolean;
  notes: string | null;
  promotions?: Array<{ id: string; name: string; client_reward: number; our_reward: number }>;
  clientApps?: Array<{ id: string; client_id: string; status: string; profit_us: number | null }>;
  referralLinks?: Array<{ id: string }>;
  totalProfit: number;
}

export default function AppsPage() {
  const {
    data: apps,
    isLoading: appsLoading,
    error: appsError,
    mutate: mutateApps,
    isDemo
  } = useSupabaseData({ 
    table: 'apps', 
    order: { column: 'name', ascending: true },
    select: '*, promotions(*), client_apps(*, clients!client_id(*)), referral_links(*)'
  });

  const isLoading = appsLoading;
  const error = appsError;

  const [typeFilter, setTypeFilter] = useState('all');
  const [activeFilter, setActiveFilter] = useState('active');
  const [bonusFilter, setBonusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [showNewSignupModal, setShowNewSignupModal] = useState(false);
  const [selectedAppIdForSignup, setSelectedAppIdForSignup] = useState<string | undefined>(undefined);

  // Build filters for server-side filtering
  const appFilters = useMemo(() => {
    const filters: any = {};
    if (typeFilter !== 'all') {
      filters.app_type = { eq: typeFilter };
    }
    if (activeFilter === 'active') {
      filters.is_active = { eq: true };
    } else if (activeFilter === 'inactive') {
      filters.is_active = { eq: false };
    }
    return Object.keys(filters).length > 0 ? filters : undefined;
  }, [typeFilter, activeFilter]);

  // Helper function to check if a promotion is currently active
  const isPromotionActive = (promo: any): boolean => {
    if (!promo) return false;
    
    // First check the explicit is_active flag from CSV
    if (promo.is_active === false) return false;
    if (promo.is_active === true) {
      // If explicitly active, still check dates
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Check start date
      if (promo.start_date) {
        const startDate = new Date(promo.start_date);
        startDate.setHours(0, 0, 0, 0);
        if (today < startDate) return false;
      }
      
      // Check end date
      if (promo.end_date) {
        const endDate = new Date(promo.end_date);
        endDate.setHours(23, 59, 59, 999);
        if (today > endDate) return false;
      }
      
      return true;
    }
    
    // Fallback to date-based logic if is_active is not set
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // If no dates specified, consider it active
    if (!promo.start_date && !promo.end_date) return true;
    
    // Check start date
    if (promo.start_date) {
      const startDate = new Date(promo.start_date);
      startDate.setHours(0, 0, 0, 0);
      if (today < startDate) return false;
    }
    
    // Check end date
    if (promo.end_date) {
      const endDate = new Date(promo.end_date);
      endDate.setHours(23, 59, 59, 999);
      if (today > endDate) return false;
    }
    
    return true;
  };

  const rows = useMemo(() => {
    // Ensure apps array is actually an array
    const appsArray = Array.isArray(apps) ? apps : [];
    
    return appsArray.map((app: any) => {
      // Get promotions from joined relationship (already filtered by app_id)
      const appPromotions = Array.isArray(app.promotions) ? app.promotions : [];
      const activePromotions = appPromotions.filter((promo: any) => isPromotionActive(promo));
      
      // Get client_apps from joined relationship (already filtered by app_id)
      const appClientApps = Array.isArray(app.client_apps) ? app.client_apps : [];
      
      // Get referral_links from joined relationship (already filtered by app_id)
      const appReferralLinks = Array.isArray(app.referral_links) ? app.referral_links : [];
      
      const totalProfit = appClientApps.reduce((sum: number, item: any) => sum + Number(item?.profit_us ?? 0), 0);
      
      return {
        ...app,
        promotions: appPromotions,
        activePromotions: activePromotions,
        hasActiveBonus: activePromotions.length > 0,
        clientApps: appClientApps,
        referralLinks: appReferralLinks,
        totalProfit
      } as AppWithRelations & { activePromotions: any[]; hasActiveBonus: boolean };
    });
  }, [apps]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (typeFilter !== 'all' && row.app_type !== typeFilter) {
        return false;
      }
      if (activeFilter === 'active' && !row.is_active) {
        return false;
      }
      if (activeFilter === 'inactive' && row.is_active) {
        return false;
      }
      if (bonusFilter === 'with_bonus' && !(row as any).hasActiveBonus) {
        return false;
      }
      if (bonusFilter === 'no_bonus' && (row as any).hasActiveBonus) {
        return false;
      }
      return true;
    });
  }, [rows, typeFilter, activeFilter, bonusFilter]);

  // Paginate filtered rows
  const paginatedRows = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredRows.slice(startIndex, endIndex);
  }, [filteredRows, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredRows.length / pageSize);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [typeFilter, activeFilter, bonusFilter]);

  const metrics = useMemo(() => {
    const totalProfit = filteredRows.reduce((sum, row) => sum + row.totalProfit, 0);
    const totalClients = filteredRows.reduce((sum, row) => sum + (row.clientApps?.length || 0), 0);
    // Count total referral links from all apps
    const totalReferralLinks = filteredRows.reduce((sum, row) => {
      const app = apps.find((a: any) => a.id === row.id) as any;
      return sum + (app?.referral_links?.length || 0);
    }, 0);
    return [
      { title: 'Apps', value: filteredRows.length.toString(), caption: 'Filtered by current view' },
      { title: 'Client workflows', value: totalClients.toString(), caption: 'Active client-app combinations' },
      { title: 'Internal profit', value: `€${totalProfit.toFixed(2)}`, caption: 'Across filtered apps' },
      { title: 'Referral links', value: totalReferralLinks.toString(), caption: 'Total across ecosystem' }
    ];
  }, [filteredRows, apps]);

  const uniqueTypes = Array.from(new Set(apps.map((app) => app.app_type).filter(Boolean))) as string[];

  if (isLoading) {
    return (
      <div>
        <SectionHeader title="Apps & Promotions" description="Loading apps data..." />
        <LoadingSpinner message="Loading apps and promotions..." />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <SectionHeader title="Apps & Promotions" description="Error loading apps data" />
        <ErrorMessage
          error={error}
          onRetry={mutateApps}
        />
      </div>
    );
  }

  return (
    <div>
      <SectionHeader
        title="Apps & Promotions"
        description="Monitor every partner app with live promotions, referral inventory, and profitability."
        actions={
          <button
            onClick={() => setShowNewSignupModal(true)}
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
          setSelectedAppIdForSignup(undefined);
        }}
        onSuccess={() => {
          mutateApps();
          setShowNewSignupModal(false);
          setSelectedAppIdForSignup(undefined);
        }}
        initialAppId={selectedAppIdForSignup}
      />
      <div className="card-grid">
        {metrics.map((metric) => (
          <MetricCard key={metric.title} title={metric.title} value={metric.value} caption={metric.caption} />
        ))}
      </div>
      <FiltersBar>
        <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
          <option value="all">All types</option>
          {uniqueTypes.map((type) => (
            <option key={type} value={type ?? 'unknown'}>
              {type}
            </option>
          ))}
        </select>
        <select value={activeFilter} onChange={(event) => setActiveFilter(event.target.value)}>
          <option value="all">Active & inactive</option>
          <option value="active">Active only</option>
          <option value="inactive">Inactive only</option>
        </select>
        <select value={bonusFilter} onChange={(event) => setBonusFilter(event.target.value)}>
          <option value="all">All bonuses</option>
          <option value="with_bonus">With active bonus</option>
          <option value="no_bonus">No active bonus</option>
        </select>
      </FiltersBar>
      {filteredRows.length === 0 ? (
        <EmptyState
          title="No apps found"
          message={
            typeFilter !== 'all' || activeFilter !== 'all' || bonusFilter !== 'all'
              ? 'No apps match your current filters. Try adjusting your selection.'
              : 'No apps have been added yet.'
          }
        />
      ) : (
        <>
        <DataTable
          data={paginatedRows}
        columns={[
          { 
            key: 'name', 
            header: 'App',
            render: (row) => (
              <Link
                href={`/apps/${row.id}`}
                style={{
                  color: '#3b82f6',
                  textDecoration: 'none',
                  fontWeight: '500'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.textDecoration = 'underline';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.textDecoration = 'none';
                }}
              >
                {row.name}
              </Link>
            )
          },
          { key: 'app_type', header: 'Type', render: (row) => row.app_type ?? '—' },
          { key: 'country', header: 'Country', render: (row) => row.country ?? '—' },
          {
            key: 'is_active',
            header: 'Active',
            render: (row) => (row.is_active ? <span className="badge success">Active</span> : <span className="badge warning">Paused</span>)
          },
          {
            key: 'hasActiveBonus',
            header: 'Active Bonus',
            render: (row) => {
              const hasActive = (row as any).hasActiveBonus;
              const activePromos = (row as any).activePromotions || [];
              if (hasActive) {
                return (
                  <div>
                    <span className="badge success" style={{ marginBottom: '0.25rem', display: 'inline-block' }}>
                      ✓ Active
                    </span>
                    <div style={{ marginTop: '0.35rem', fontSize: '0.85rem', color: '#475569' }}>
                      {activePromos.length} promotion{activePromos.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                );
              }
              return <span className="badge" style={{ backgroundColor: '#e2e8f0', color: '#64748b' }}>No active bonus</span>;
            }
          },
          {
            key: 'clientApps',
            header: 'Client workflows',
            render: (row) => (
              <div>
                <strong>{row.clientApps?.length ?? 0}</strong>
                <div style={{ marginTop: '0.35rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  {(row.clientApps || []).slice(0, 3).map((entry: any) => {
                    const client = (entry as any).clients;
                    const clientName = client ? `${client.name} ${client.surname ?? ''}`.trim() : entry.client_id;
                    return (
                      <span key={entry.id} style={{ color: '#475569', fontSize: '0.85rem' }}>
                        {clientName} → <StatusBadge status={entry.status} />
                      </span>
                    );
                  })}
                  {(row.clientApps?.length ?? 0) > 3 ? <span style={{ color: '#94a3b8' }}>+ more</span> : null}
                </div>
              </div>
            )
          },
          {
            key: 'promotions',
            header: 'Promotions',
            render: (row) => {
              const activePromos = (row as any).activePromotions || [];
              const allPromos = row.promotions || [];
              return (
                <div>
                  {allPromos.length ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {allPromos.map((promo: any) => {
                        const isActive = isPromotionActive(promo);
                        const profitType = promo.profit_type || 'CASH';
                        const expense = promo.expense ? Number(promo.expense) : null;
                        const maxInvites = promo.max_invites;
                        const deadline = promo.end_date ? new Date(promo.end_date).toLocaleDateString() : null;
                        const timeToGetBonus = promo.time_to_get_bonus;
                        
                        return (
                          <div key={promo.id} style={{ 
                            padding: '0.75rem', 
                            backgroundColor: isActive ? '#f0fdf4' : '#f8fafc', 
                            borderRadius: '6px',
                            border: `1px solid ${isActive ? '#bbf7d0' : '#e2e8f0'}`,
                            fontSize: '0.85rem'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                              {isActive ? (
                                <span style={{ color: '#10b981', fontWeight: '600', fontSize: '0.9rem' }}>●</span>
                              ) : (
                                <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>○</span>
                              )}
                              <strong style={{ fontSize: '0.95rem' }}>{promo.name}</strong>
                              <span style={{ 
                                padding: '0.15rem 0.5rem', 
                                borderRadius: '4px', 
                                fontSize: '0.75rem',
                                fontWeight: '500',
                                backgroundColor: profitType === 'CASH' ? '#dbeafe' : '#fef3c7',
                                color: profitType === 'CASH' ? '#1e40af' : '#92400e'
                              }}>
                                {profitType}
                              </span>
                              {!isActive && <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>(expired)</span>}
                            </div>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', marginBottom: '0.5rem' }}>
                              <div>
                                <span style={{ color: '#64748b', fontSize: '0.8rem' }}>Client:</span>
                                <span style={{ marginLeft: '0.25rem', fontWeight: '500', color: '#10b981' }}>
                                  €{Number(promo.client_reward || 0).toFixed(2)}
                                </span>
                              </div>
                              <div>
                                <span style={{ color: '#64748b', fontSize: '0.8rem' }}>Us:</span>
                                <span style={{ marginLeft: '0.25rem', fontWeight: '500', color: '#3b82f6' }}>
                                  €{Number(promo.our_reward || 0).toFixed(2)}
                                </span>
                              </div>
                              <div>
                                <span style={{ color: '#64748b', fontSize: '0.8rem' }}>Deposit:</span>
                                <span style={{ marginLeft: '0.25rem', fontWeight: '500' }}>
                                  €{Number(promo.deposit_required || 0).toFixed(2)}
                                </span>
                              </div>
                              {expense !== null && (
                                <div>
                                  <span style={{ color: '#64748b', fontSize: '0.8rem' }}>Expense:</span>
                                  <span style={{ marginLeft: '0.25rem', fontWeight: '500', color: '#ef4444' }}>
                                    €{expense.toFixed(2)}
                                  </span>
                                </div>
                              )}
                              {maxInvites && (
                                <div>
                                  <span style={{ color: '#64748b', fontSize: '0.8rem' }}>Max Invites:</span>
                                  <span style={{ marginLeft: '0.25rem', fontWeight: '500' }}>
                                    {maxInvites}
                                  </span>
                                </div>
                              )}
                              {deadline && (
                                <div>
                                  <span style={{ color: '#64748b', fontSize: '0.8rem' }}>Deadline:</span>
                                  <span style={{ marginLeft: '0.25rem', fontWeight: '500', color: isActive ? '#f59e0b' : '#94a3b8' }}>
                                    {deadline}
                                  </span>
                                </div>
                              )}
                              {timeToGetBonus && (
                                <div style={{ gridColumn: 'span 2' }}>
                                  <span style={{ color: '#64748b', fontSize: '0.8rem' }}>Time to get bonus:</span>
                                  <span style={{ marginLeft: '0.25rem', fontWeight: '500' }}>
                                    {timeToGetBonus}
                                  </span>
                                </div>
                              )}
                            </div>
                            
                            {promo.notes && (
                              <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid #e2e8f0' }}>
                                <span style={{ color: '#64748b', fontSize: '0.8rem', fontStyle: 'italic' }}>
                                  {promo.notes}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <span style={{ color: '#94a3b8' }}>No promotions</span>
                  )}
                </div>
              );
            }
          },
          {
            key: 'totalProfit',
            header: 'Internal profit',
            render: (row) => `€${row.totalProfit.toFixed(2)}`
          },
          {
            key: 'actions',
            header: 'Actions',
            render: (row) => (
              <button
                onClick={() => {
                  setSelectedAppIdForSignup(row.id);
                  setShowNewSignupModal(true);
                }}
                style={{
                  padding: '0.35rem 0.75rem',
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: 500
                }}
              >
                Add signup
              </button>
            )
          }
        ]}
        />
        {totalPages > 1 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            pageSize={pageSize}
            totalItems={filteredRows.length}
            onPageSizeChange={setPageSize}
          />
        )}
        </>
      )}
    </div>
  );
}
