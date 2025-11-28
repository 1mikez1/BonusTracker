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

export default function SlotsPage() {
  const {
    data: slots,
    isLoading,
    error,
    mutate
  } = useSupabaseData({
    table: 'slots',
    order: { column: 'rtp_percentage', ascending: false }
  });
  
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const filteredRows = useMemo(() => {
    return slots.filter((slot: any) => {
      if (!search) {
        return true;
      }
      const haystack = `${slot.name} ${slot.provider ?? ''}`.toLowerCase();
      return haystack.includes(search.toLowerCase());
    });
  }, [slots, search]);

  // Paginate filtered rows
  const paginatedRows = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredRows.slice(startIndex, endIndex);
  }, [filteredRows, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredRows.length / pageSize);

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  if (isLoading) {
    return (
      <div>
        <SectionHeader title="Slots RTP" description="Loading slots..." />
        <LoadingSpinner message="Loading slots..." />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <SectionHeader title="Slots RTP" description="Error loading slots" />
        <ErrorMessage error={error} onRetry={mutate} />
      </div>
    );
  }

  return (
    <div>
      <SectionHeader
        title="Slots RTP"
        description="Pick the highest return-to-player slots for SISAL strategies."
      />
      <FiltersBar>
        <input placeholder="Search slot" value={search} onChange={(event) => setSearch(event.target.value)} />
      </FiltersBar>
      {filteredRows.length === 0 ? (
        <EmptyState
          title="No slots found"
          message={search ? 'No slots match your search criteria.' : 'No slots have been added yet.'}
        />
      ) : (
        <>
        <DataTable
          data={paginatedRows}
        columns={[
          { key: 'name', header: 'Slot' },
          { key: 'provider', header: 'Provider', render: (row) => row.provider ?? '—' },
          { key: 'rtp_percentage', header: 'RTP %', render: (row) => Number(row.rtp_percentage).toFixed(2) },
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
