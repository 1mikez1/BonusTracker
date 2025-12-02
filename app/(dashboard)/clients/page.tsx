'use client';

import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useSupabaseData } from '@/lib/useSupabaseData';
import { SectionHeader } from '@/components/SectionHeader';
import { FiltersBar } from '@/components/FiltersBar';
import { DataTable } from '@/components/DataTable';
import { MetricCard } from '@/components/MetricCard';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorMessage } from '@/components/ErrorMessage';
import { EmptyState } from '@/components/EmptyState';
import { Pagination } from '@/components/Pagination';

interface ClientRow {
  id: string;
  name: string;
  surname: string | null;
  contact: string | null;
  email: string | null;
  trusted: boolean;
  tier_id: string | null;
  invited_by_client_id: string | null;
  notes: string | null;
  created_at: string;
  tier_name?: string;
  partner_name?: string | null;
  partner_id?: string | null;
  total_apps: number;
  total_profit_us: number;
  statuses: Record<string, number>;
  error_count?: number;
  critical_errors?: number;
}

export default function ClientsPage() {
  const {
    data: clients,
    isLoading: clientsLoading,
    error: clientsError,
    mutate: mutateClients,
    isDemo
  } = useSupabaseData({ 
    table: 'clients', 
    order: { column: 'created_at', ascending: false },
    select: '*, tiers(*)'
  });
  
  const {
    data: clientApps,
    isLoading: appsLoading,
    error: appsError,
    mutate: mutateClientApps
  } = useSupabaseData({ 
    table: 'client_apps',
    select: '*, apps(*), clients!client_id(*)'
  });

  // Fetch client errors (optional - table might not exist in all environments)
  const {
    data: clientErrors,
    isLoading: errorsLoading,
    error: errorsError
  } = useSupabaseData({ 
    table: 'client_errors' as any,
    select: 'id, client_id, severity, error_type',
    filters: {
      resolved_at: { is: null }
    }
  });

  // Fetch partner assignments to enable partner filtering
  const {
    data: partnerAssignments,
    isLoading: assignmentsLoading
  } = useSupabaseData({
    table: 'client_partner_assignments',
    select: '*, clients!client_id(id), client_partners!partner_id(id, name)'
  });

  // Only block on clients and clientApps loading - clientErrors and assignments are optional
  const isLoading = clientsLoading || appsLoading;
  // Show error if critical queries fail, but don't block on client_errors errors
  const error = clientsError || appsError;

  const [tierFilter, setTierFilter] = useState<string>('all');
  const [trustedFilter, setTrustedFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [partnerFilter, setPartnerFilter] = useState<string>('');
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);
  const [showPartnerDropdown, setShowPartnerDropdown] = useState(false);
  const [partnerSearchResults, setPartnerSearchResults] = useState<Array<{ id: string; displayName: string }>>([]);
  const [isSearchingPartners, setIsSearchingPartners] = useState(false);
  const partnerInputRef = useRef<HTMLInputElement>(null);
  const partnerDropdownRef = useRef<HTMLDivElement>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Debounced partner search
  useEffect(() => {
    if (!partnerFilter.trim()) {
      setPartnerSearchResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsSearchingPartners(true);
      try {
        const response = await fetch(`/api/partners/search?query=${encodeURIComponent(partnerFilter)}&limit=10`);
        if (response.ok) {
          const data = await response.json();
          setPartnerSearchResults(data.items || []);
        } else {
          setPartnerSearchResults([]);
        }
      } catch (error) {
        console.error('Error searching partners:', error);
        setPartnerSearchResults([]);
      } finally {
        setIsSearchingPartners(false);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [partnerFilter]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        partnerDropdownRef.current &&
        !partnerDropdownRef.current.contains(event.target as Node) &&
        partnerInputRef.current &&
        !partnerInputRef.current.contains(event.target as Node)
      ) {
        setShowPartnerDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectPartner = useCallback((partnerId: string, partnerName: string) => {
    setSelectedPartnerId(partnerId);
    setPartnerFilter(partnerName);
    setShowPartnerDropdown(false);
    setCurrentPage(1);
  }, []);

  const handleClearPartnerFilter = useCallback(() => {
    setSelectedPartnerId(null);
    setPartnerFilter('');
    setPartnerSearchResults([]);
    setCurrentPage(1);
  }, []);

  const rows = useMemo<ClientRow[]>(() => {
    const clientsArray = Array.isArray(clients) ? clients : [];
    const clientAppsArray = Array.isArray(clientApps) ? clientApps : [];
    const errorsArray = Array.isArray(clientErrors) ? clientErrors : [];
    const assignmentsArray = Array.isArray(partnerAssignments) ? partnerAssignments : [];
    
    return clientsArray.map((client: any) => {
      // Get tier from joined relationship
      const tier = client.tiers;
      const tierName = tier?.name;
      
      // Get partner assignment for this client
      const assignment = assignmentsArray.find((a: any) => a.client_id === client.id);
      const partner = assignment ? (assignment as any).client_partners : null;
      const partnerName = partner?.name || null;
      const partnerId = partner?.id || null;
      
      // Filter client apps for this client
      const apps = clientAppsArray.filter((item: any) => item?.client_id === client.id);
      const totalProfit = apps.reduce((sum: number, app: any) => sum + Number(app?.profit_us ?? 0), 0);
      const statuses = apps.reduce<Record<string, number>>((acc: Record<string, number>, app: any) => {
        const status = app?.status || 'unknown';
        acc[status] = (acc[status] ?? 0) + 1;
        return acc;
      }, {});
      
      // Count errors for this client
      const errors = errorsArray.filter((e: any) => e?.client_id === client.id);
      const errorCount = errors.length;
      const criticalErrors = errors.filter((e: any) => e?.severity === 'critical').length;
      
      return {
        ...client,
        tier_name: tierName,
        partner_name: partnerName,
        partner_id: partnerId,
        total_apps: apps.length,
        total_profit_us: totalProfit,
        statuses,
        error_count: errorCount,
        critical_errors: criticalErrors
      };
    });
  }, [clients, clientApps, clientErrors, partnerAssignments]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (tierFilter !== 'all' && row.tier_id !== tierFilter) {
        return false;
      }
      if (trustedFilter !== 'all') {
        const shouldBeTrusted = trustedFilter === 'trusted';
        if (row.trusted !== shouldBeTrusted) {
          return false;
        }
      }
      if (statusFilter !== 'all') {
        if (!row.statuses[statusFilter]) {
          return false;
        }
      }
      // Partner filter: if selectedPartnerId is set, match by ID; otherwise match by name search
      if (selectedPartnerId) {
        if (row.partner_id !== selectedPartnerId) {
          return false;
        }
      } else if (partnerFilter.trim()) {
        // Free-text search on partner name
        const partnerNameLower = (row.partner_name || '').toLowerCase();
        const searchLower = partnerFilter.toLowerCase();
        if (!partnerNameLower.includes(searchLower)) {
          return false;
        }
      }
      if (search) {
        const text = `${row.name} ${row.surname ?? ''} ${row.contact ?? ''} ${row.email ?? ''}`.toLowerCase();
        if (!text.includes(search.toLowerCase())) {
          return false;
        }
      }
      return true;
    });
  }, [rows, tierFilter, trustedFilter, statusFilter, search, partnerFilter, selectedPartnerId]);

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
  }, [tierFilter, trustedFilter, statusFilter, search, partnerFilter, selectedPartnerId]);

  const metrics = useMemo(() => {
    const totalProfit = filteredRows.reduce((sum, row) => sum + row.total_profit_us, 0);
    const trustedCount = filteredRows.filter((row) => row.trusted).length;
    // Count total client_apps from all clients (using relationship join)
    const totalClientApps = filteredRows.reduce((sum, row) => sum + row.total_apps, 0);
    return [
      { title: 'Clients', value: filteredRows.length.toString(), caption: 'Filtered subset' },
      { title: 'Trusted clients', value: trustedCount.toString(), caption: 'Marked as high confidence' },
      { title: 'Pipeline apps', value: totalClientApps.toString(), caption: 'All active app workflows' },
      { title: 'Total internal profit', value: `€${totalProfit.toFixed(2)}`, caption: 'Aggregated from client apps' }
    ];
  }, [filteredRows]);

  if (isLoading) {
    return (
      <div>
        <SectionHeader title="Clients" description="Loading client data..." />
        <LoadingSpinner message="Loading clients..." />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <SectionHeader title="Clients" description="Error loading client data" />
        <ErrorMessage error={error} onRetry={() => { mutateClients(); mutateClientApps(); }} />
      </div>
    );
  }

  return (
    <div>
      <SectionHeader
        title="Clients"
        description={
          isDemo
            ? 'Showing interactive demo data. Provide Supabase environment variables to load production records.'
            : 'List of all clients with aggregated activity and profitability.'
        }
        actions={<Link href="/requests" className="primary">Convert request</Link>}
      />
      <div className="card-grid">
        {metrics.map((metric) => (
          <MetricCard key={metric.title} title={metric.title} value={metric.value} caption={metric.caption} />
        ))}
      </div>
      <FiltersBar>
        <select value={tierFilter} onChange={(event) => setTierFilter(event.target.value)}>
          <option value="all">All tiers</option>
          {Array.isArray(clients) && Array.from(new Set(clients.map((c: any) => c.tier_id).filter(Boolean))).map((tierId) => {
            const client = clients.find((c: any) => c.tier_id === tierId);
            const tier = (client as any)?.tiers;
            if (!tier) return null;
            return (
              <option key={tierId} value={tierId}>
                {tier.name}
              </option>
            );
          })}
        </select>
        <select value={trustedFilter} onChange={(event) => setTrustedFilter(event.target.value)}>
          <option value="all">Trusted & non-trusted</option>
          <option value="trusted">Trusted only</option>
          <option value="untrusted">Non-trusted only</option>
        </select>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="all">Any status</option>
          <option value="requested">Requested</option>
          <option value="registered">Registered</option>
          <option value="deposited">Deposited</option>
          <option value="waiting_bonus">Waiting bonus</option>
          <option value="completed">Completed</option>
          <option value="paid">Paid</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <input
          placeholder="Search name/contact"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div style={{ position: 'relative', minWidth: '200px' }}>
          <input
            ref={partnerInputRef}
            placeholder="Filter by partner"
            value={partnerFilter}
            onChange={(e) => {
              setPartnerFilter(e.target.value);
              setShowPartnerDropdown(true);
              if (selectedPartnerId) {
                setSelectedPartnerId(null);
              }
            }}
            onFocus={() => {
              if (partnerFilter.trim() && partnerSearchResults.length > 0) {
                setShowPartnerDropdown(true);
              }
            }}
            style={{
              width: '100%',
              padding: '0.5rem',
              border: `2px solid ${selectedPartnerId ? '#10b981' : '#cbd5e1'}`,
              borderRadius: '6px',
              fontSize: '0.875rem',
              backgroundColor: '#fff',
              cursor: 'text',
              transition: 'border-color 0.2s',
              outline: 'none',
              fontWeight: selectedPartnerId ? '500' : '400',
              boxSizing: 'border-box'
            }}
          />
          {selectedPartnerId && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleClearPartnerFilter();
              }}
              style={{
                position: 'absolute',
                right: '0.5rem',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '1.2rem',
                color: '#64748b',
                padding: '0',
                width: '20px',
                height: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              ×
            </button>
          )}
          {showPartnerDropdown && (partnerSearchResults.length > 0 || isSearchingPartners) && (
            <div
              ref={partnerDropdownRef}
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: '0.25rem',
                backgroundColor: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                zIndex: 1000,
                maxHeight: '200px',
                overflowY: 'auto'
              }}
            >
              {isSearchingPartners ? (
                <div style={{ padding: '0.75rem', textAlign: 'center', color: '#64748b' }}>
                  Searching...
                </div>
              ) : (
                partnerSearchResults.map((partner) => (
                  <button
                    key={partner.id}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleSelectPartner(partner.id, partner.displayName);
                    }}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      textAlign: 'left',
                      border: 'none',
                      background: selectedPartnerId === partner.id ? '#f0fdf4' : 'transparent',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      color: selectedPartnerId === partner.id ? '#059669' : '#0f172a',
                      fontWeight: selectedPartnerId === partner.id ? '600' : '400',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      if (selectedPartnerId !== partner.id) {
                        e.currentTarget.style.backgroundColor = '#f8fafc';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedPartnerId !== partner.id) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    {partner.displayName}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </FiltersBar>
      {filteredRows.length === 0 ? (
        <EmptyState
          title="No clients found"
          message={search || tierFilter !== 'all' || trustedFilter !== 'all' || statusFilter !== 'all' || partnerFilter
            ? 'No clients match your current filters. Try adjusting your search criteria.'
            : 'No clients have been added yet. Convert a request to create your first client.'}
          action={
            search || tierFilter !== 'all' || trustedFilter !== 'all' || statusFilter !== 'all' || partnerFilter
              ? undefined
              : {
                  label: 'Convert request',
                  onClick: () => window.location.href = '/requests'
                }
          }
        />
      ) : (
        <>
        <DataTable
          data={paginatedRows}
        columns={[
          {
            key: 'name',
            header: 'Client',
            render: (row) => (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Link href={`/clients/${row.id}`} style={{ fontWeight: 600 }}>
                    {row.name} {row.surname ?? ''}
                  </Link>
                  {(row.error_count ?? 0) > 0 && (
                    <span style={{
                      padding: '0.15rem 0.5rem',
                      backgroundColor: (row.critical_errors ?? 0) > 0 ? '#ef4444' : '#f59e0b',
                      color: 'white',
                      borderRadius: '12px',
                      fontSize: '0.7rem',
                      fontWeight: '700',
                      minWidth: '20px',
                      textAlign: 'center'
                    }}>
                      {row.error_count}
                    </span>
                  )}
                </div>
                <div style={{ color: '#64748b', fontSize: '0.85rem' }}>{row.contact ?? '—'}</div>
              </div>
            )
          },
          {
            key: 'partner_name',
            header: 'Partner',
            render: (row) => row.partner_name ? (
              <Link href={`/partners/${row.partner_id}`} style={{ color: '#059669', textDecoration: 'none' }}>
                {row.partner_name}
              </Link>
            ) : '—'
          },
          {
            key: 'tier_name',
            header: 'Tier',
            render: (row) => row.tier_name ?? '—'
          },
          {
            key: 'trusted',
            header: 'Trust',
            render: (row) => (row.trusted ? <span className="badge success">Trusted</span> : '—')
          },
          {
            key: 'total_apps',
            header: 'Apps',
            render: (row) => (
              <div>
                <strong>{row.total_apps}</strong>
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                  {Object.entries(row.statuses).map(([status, count]) => (
                    <span key={status} className="badge info">
                      {status.replace(/_/g, ' ')} · {count}
                    </span>
                  ))}
                </div>
              </div>
            )
          },
          {
            key: 'total_profit_us',
            header: 'Internal profit',
            render: (row) => `€${row.total_profit_us.toFixed(2)}`
          },
          {
            key: 'created_at',
            header: 'Created',
            render: (row) => new Date(row.created_at).toLocaleDateString()
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
