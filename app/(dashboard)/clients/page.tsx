'use client';

import { useMemo, useState, useEffect } from 'react';
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
    select: '*, tiers(*), clients!invited_by_client_id(*)'
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

  // Fetch client errors
  const {
    data: clientErrors,
    isLoading: errorsLoading,
    error: errorsError
  } = useSupabaseData({ 
    table: 'client_errors',
    select: 'id, client_id, severity, error_type',
    filters: {
      resolved_at: { is: null }
    }
  });

  const isLoading = clientsLoading || appsLoading || errorsLoading;
  const error = clientsError || appsError || errorsError;

  const [tierFilter, setTierFilter] = useState<string>('all');
  const [trustedFilter, setTrustedFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const rows = useMemo<ClientRow[]>(() => {
    const clientsArray = Array.isArray(clients) ? clients : [];
    const clientAppsArray = Array.isArray(clientApps) ? clientApps : [];
    const errorsArray = Array.isArray(clientErrors) ? clientErrors : [];
    
    return clientsArray.map((client: any) => {
      // Get tier from joined relationship
      const tier = client.tiers;
      const tierName = tier?.name;
      
      // Get invited_by client from joined relationship
      const inviter = client.clients;
      
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
        total_apps: apps.length,
        total_profit_us: totalProfit,
        statuses,
        error_count: errorCount,
        critical_errors: criticalErrors
      };
    });
  }, [clients, clientApps, clientErrors]);

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
      if (search) {
        const text = `${row.name} ${row.surname ?? ''} ${row.contact ?? ''} ${row.email ?? ''}`.toLowerCase();
        if (!text.includes(search.toLowerCase())) {
          return false;
        }
      }
      return true;
    });
  }, [rows, tierFilter, trustedFilter, statusFilter, search]);

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
  }, [tierFilter, trustedFilter, statusFilter, search]);

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
            const tier = client?.tiers;
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
      </FiltersBar>
      {filteredRows.length === 0 ? (
        <EmptyState
          title="No clients found"
          message={search || tierFilter !== 'all' || trustedFilter !== 'all' || statusFilter !== 'all' 
            ? 'No clients match your current filters. Try adjusting your search criteria.'
            : 'No clients have been added yet. Convert a request to create your first client.'}
          action={
            search || tierFilter !== 'all' || trustedFilter !== 'all' || statusFilter !== 'all'
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
                  {row.error_count && row.error_count > 0 && (
                    <span style={{
                      padding: '0.15rem 0.5rem',
                      backgroundColor: row.critical_errors && row.critical_errors > 0 ? '#ef4444' : '#f59e0b',
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
