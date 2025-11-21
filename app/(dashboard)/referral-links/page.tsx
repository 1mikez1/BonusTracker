'use client';

import { useMemo, useState, useEffect } from 'react';
import { useSupabaseData } from '@/lib/useSupabaseData';
import { SectionHeader } from '@/components/SectionHeader';
import { DataTable } from '@/components/DataTable';
import { FiltersBar } from '@/components/FiltersBar';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorMessage } from '@/components/ErrorMessage';
import { EmptyState } from '@/components/EmptyState';
import { Pagination } from '@/components/Pagination';

export default function ReferralLinksPage() {
  const {
    data: referralLinks,
    isLoading,
    error,
    mutate,
    isDemo
  } = useSupabaseData({
    table: 'referral_links',
    select: '*, apps(*), clients!owner_client_id(*)'
  });
  
  const { data: apps } = useSupabaseData({ table: 'apps' });

  const [appFilter, setAppFilter] = useState('all');
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const rows = useMemo(() => {
    return referralLinks.map((link: any) => {
      const app = link.apps;
      const owner = link.clients;
      const remaining = link.max_uses ? Math.max(link.max_uses - link.current_uses, 0) : undefined;
      return {
        ...link,
        appName: app?.name ?? 'Unknown app',
        ownerName: owner ? `${owner.name} ${owner.surname ?? ''}`.trim() : 'Internal',
        remaining
      };
    });
  }, [referralLinks]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (appFilter !== 'all' && row.app_id !== appFilter) {
        return false;
      }
      if (ownerFilter === 'internal' && row.owner_client_id) {
        return false;
      }
      if (ownerFilter === 'external' && !row.owner_client_id) {
        return false;
      }
      if (statusFilter === 'available' && !row.is_active) {
        return false;
      }
      if (statusFilter === 'inactive' && row.is_active) {
        return false;
      }
      return true;
    });
  }, [rows, appFilter, ownerFilter, statusFilter]);

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
  }, [appFilter, ownerFilter, statusFilter]);

  if (isLoading) {
    return (
      <div>
        <SectionHeader title="Referral links" description="Loading referral links..." />
        <LoadingSpinner message="Loading referral links..." />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <SectionHeader title="Referral links" description="Error loading referral links" />
        <ErrorMessage error={error} onRetry={mutate} />
      </div>
    );
  }

  return (
    <div>
      <SectionHeader
        title="Referral links"
        description="Track referral URL usage, owners, and safe remaining capacity."
      />
      <FiltersBar>
        <select value={appFilter} onChange={(event) => setAppFilter(event.target.value)}>
          <option value="all">All apps</option>
          {apps.map((app) => (
            <option key={app.id} value={app.id}>
              {app.name}
            </option>
          ))}
        </select>
        <select value={ownerFilter} onChange={(event) => setOwnerFilter(event.target.value)}>
          <option value="all">All owners</option>
          <option value="internal">Owned by operations</option>
          <option value="external">Owned by clients</option>
        </select>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="all">Any status</option>
          <option value="available">Available</option>
          <option value="inactive">Inactive</option>
        </select>
      </FiltersBar>
      {filteredRows.length === 0 ? (
        <EmptyState
          title="No referral links found"
          message={
            appFilter !== 'all' || ownerFilter !== 'all' || statusFilter !== 'all'
              ? 'No referral links match your current filters.'
              : 'No referral links have been added yet.'
          }
        />
      ) : (
        <>
        <DataTable
          data={paginatedRows}
        columns={[
          { key: 'appName', header: 'App' },
          {
            key: 'url',
            header: 'Referral link',
            render: (row) => (
              <a href={row.url} target="_blank" rel="noreferrer" style={{ color: '#2563eb' }}>
                {row.url}
              </a>
            )
          },
          { key: 'ownerName', header: 'Owner' },
          {
            key: 'current_uses',
            header: 'Usage',
            render: (row) => (
              <div>
                <strong>{row.current_uses}</strong>
                {row.max_uses ? (
                  <div style={{ color: row.remaining && row.remaining < 3 ? '#b91c1c' : '#475569' }}>
                    {row.remaining} remaining
                  </div>
                ) : (
                  <div style={{ color: '#94a3b8' }}>Unlimited</div>
                )}
              </div>
            )
          },
          {
            key: 'is_active',
            header: 'Status',
            render: (row) => (row.is_active ? <span className="badge success">Available</span> : <span className="badge warning">Disabled</span>)
          },
          { key: 'notes', header: 'Notes', render: (row) => row.notes ?? '—' }
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
