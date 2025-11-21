'use client';

import { useMemo, useState, useEffect } from 'react';
import { SectionHeader } from '@/components/SectionHeader';
import { DataTable } from '@/components/DataTable';
import { FiltersBar } from '@/components/FiltersBar';
import { useSupabaseData } from '@/lib/useSupabaseData';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorMessage } from '@/components/ErrorMessage';
import { EmptyState } from '@/components/EmptyState';
import { Pagination } from '@/components/Pagination';

export default function PaymentLinksPage() {
  const {
    data: paymentLinks,
    isLoading,
    error,
    mutate
  } = useSupabaseData({
    table: 'payment_links',
    order: { column: 'created_at', ascending: false },
    select: '*, clients(*), apps(*)'
  });

  const [usedFilter, setUsedFilter] = useState('all');
  const [providerFilter, setProviderFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const rows = useMemo(() => {
    return paymentLinks.map((link: any) => {
      const client = link.clients;
      const app = link.apps;
      return {
        ...link,
        clientName: client ? `${client.name} ${client.surname ?? ''}`.trim() : '—',
        appName: app?.name ?? '—'
      };
    });
  }, [paymentLinks]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (usedFilter === 'used' && !row.used) {
        return false;
      }
      if (usedFilter === 'unused' && row.used) {
        return false;
      }
      if (providerFilter !== 'all' && row.provider !== providerFilter) {
        return false;
      }
      return true;
    });
  }, [rows, usedFilter, providerFilter]);

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
  }, [usedFilter, providerFilter]);

  const providers = Array.from(new Set(paymentLinks.map((link: any) => link.provider))).sort();

  if (isLoading) {
    return (
      <div>
        <SectionHeader title="Payment links" description="Loading payment links..." />
        <LoadingSpinner message="Loading payment links..." />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <SectionHeader title="Payment links" description="Error loading payment links" />
        <ErrorMessage error={error} onRetry={mutate} />
      </div>
    );
  }

  return (
    <div>
      <SectionHeader
        title="Payment links"
        description="Manage SumUp, Amazon and other payment URLs used to move funds."
      />
      <FiltersBar>
        <select value={providerFilter} onChange={(event) => setProviderFilter(event.target.value)}>
          <option value="all">All providers</option>
          {providers.map((provider) => (
            <option key={provider} value={provider}>
              {provider}
            </option>
          ))}
        </select>
        <select value={usedFilter} onChange={(event) => setUsedFilter(event.target.value)}>
          <option value="all">Used & unused</option>
          <option value="used">Used only</option>
          <option value="unused">Unused only</option>
        </select>
      </FiltersBar>
      {filteredRows.length === 0 ? (
        <EmptyState
          title="No payment links found"
          message={
            usedFilter !== 'all' || providerFilter !== 'all'
              ? 'No payment links match your current filters.'
              : 'No payment links have been added yet.'
          }
        />
      ) : (
        <>
        <DataTable
          data={paginatedRows}
        columns={[
          { key: 'provider', header: 'Provider' },
          {
            key: 'url',
            header: 'URL',
            render: (row) => (
              <a href={row.url} target="_blank" rel="noreferrer" style={{ color: '#2563eb' }}>
                {row.url}
              </a>
            )
          },
          { key: 'amount', header: 'Amount', render: (row) => `€${Number(row.amount ?? 0).toFixed(2)}` },
          { key: 'purpose', header: 'Purpose', render: (row) => row.purpose ?? '—' },
          { key: 'clientName', header: 'Client' },
          { key: 'appName', header: 'App' },
          { key: 'used', header: 'Used', render: (row) => (row.used ? 'Yes' : 'No') },
          { key: 'created_at', header: 'Created', render: (row) => new Date(row.created_at).toLocaleString() }
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
