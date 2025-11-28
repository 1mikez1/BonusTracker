'use client';

import { useMemo, useState, useEffect } from 'react';
import { SectionHeader } from '@/components/SectionHeader';
import { FiltersBar } from '@/components/FiltersBar';
import { DataTable } from '@/components/DataTable';
import { useSupabaseData } from '@/lib/useSupabaseData';
import { useSupabaseMutations } from '@/lib/useSupabaseMutations';
import { StatusBadge } from '@/components/StatusBadge';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorMessage } from '@/components/ErrorMessage';
import { EmptyState } from '@/components/EmptyState';
import { Pagination } from '@/components/Pagination';

export default function DebtsPage() {
  const {
    data: debts,
    isLoading: debtsLoading,
    error: debtsError,
    mutate: mutateDebts,
    isDemo
  } = useSupabaseData({
    table: 'referral_link_debts',
    select: '*, referral_links(*)'
  });
  
  // Fetch all clients separately to avoid relationship ambiguity
  const {
    data: allClients,
    isLoading: clientsLoading,
    error: clientsError
  } = useSupabaseData({
    table: 'clients',
    select: 'id, name, surname'
  });
  
  const isLoading = debtsLoading || clientsLoading;
  const error = debtsError || clientsError;
  const { mutate: updateDebt } = useSupabaseMutations('referral_link_debts');

  const [statusFilter, setStatusFilter] = useState('all');
  const [creditorFilter, setCreditorFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const rows = useMemo(() => {
    // Ensure debts is an array
    const debtsArray = Array.isArray(debts) ? debts : [];
    
    const clientsArray = Array.isArray(allClients) ? allClients : [];
    
    return debtsArray.map((debt: any) => {
      // Find creditor and debtor from separate clients query
      const creditor = clientsArray.find((c: any) => c.id === debt?.creditor_client_id);
      const debtor = debt?.debtor_client_id 
        ? clientsArray.find((c: any) => c.id === debt?.debtor_client_id)
        : null;
      const link = debt?.referral_links;
      
      return {
        ...debt,
        creditorName: creditor ? `${creditor.name} ${creditor.surname ?? ''}`.trim() : debt?.creditor_client_id || 'Unknown',
        debtorName: debtor ? `${debtor.name} ${debtor.surname ?? ''}`.trim() : '—',
        linkUrl: link?.url ?? '—'
      };
    });
  }, [debts, allClients]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (statusFilter !== 'all' && row.status !== statusFilter) {
        return false;
      }
      if (creditorFilter !== 'all' && row.creditor_client_id !== creditorFilter) {
        return false;
      }
      return true;
    });
  }, [rows, statusFilter, creditorFilter]);

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
  }, [statusFilter, creditorFilter]);

  const handleSettleDebt = async (debtId: string) => {
    if (isDemo) {
      alert('Settlement is disabled in demo mode. Connect Supabase to enable this feature.');
      return;
    }

    if (!confirm('Mark this debt as settled?')) {
      return;
    }

    try {
      await updateDebt({ status: 'settled', settled_at: new Date().toISOString() }, debtId);
      await mutateDebts();
      alert('Debt marked as settled.');
    } catch (error) {
      console.error('Failed to settle debt:', error);
      alert('Failed to settle debt. Please try again.');
    }
  };

  if (isLoading) {
    return (
      <div>
        <SectionHeader title="Referral link debts" description="Loading debts..." />
        <LoadingSpinner message="Loading debts..." />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <SectionHeader title="Referral link debts" description="Error loading debts" />
        <ErrorMessage error={error} onRetry={mutateDebts} />
      </div>
    );
  }

  return (
    <div>
      <SectionHeader
        title="Referral link debts"
        description="Monitor loans and fronted deposits linked to referral usage."
      />
      <FiltersBar>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="all">Any status</option>
          <option value="open">Open</option>
          <option value="partial">Partial</option>
          <option value="settled">Settled</option>
        </select>
        <select value={creditorFilter} onChange={(event) => setCreditorFilter(event.target.value)}>
          <option value="all">All creditors</option>
          {(() => {
            const clientsArray = Array.isArray(allClients) ? allClients : [];
            const debtsArray = Array.isArray(debts) ? debts : [];
            return Array.from(new Set(debtsArray.map((d: any) => d.creditor_client_id).filter(Boolean))).map((creditorId) => {
              const creditor = clientsArray.find((c: any) => c.id === creditorId);
              const creditorName = creditor ? `${creditor.name} ${creditor.surname ?? ''}`.trim() : creditorId;
              return (
                <option key={creditorId} value={creditorId}>
                  {creditorName}
                </option>
              );
            });
          })()}
        </select>
      </FiltersBar>
      {filteredRows.length === 0 ? (
        <EmptyState
          title="No debts found"
          message={
            statusFilter !== 'all' || creditorFilter !== 'all'
              ? 'No debts match your current filters.'
              : 'No debts have been recorded yet.'
          }
        />
      ) : (
        <>
        <DataTable
          data={paginatedRows}
        columns={[
          { key: 'creditorName', header: 'Creditor' },
          { key: 'debtorName', header: 'Debtor' },
          { key: 'linkUrl', header: 'Referral link' },
          { key: 'amount', header: 'Amount', render: (row) => `€${Number(row.amount).toFixed(2)}` },
          {
            key: 'status',
            header: 'Status',
            render: (row) => <StatusBadge status={row.status} />
          },
          {
            key: 'created_at',
            header: 'Created',
            render: (row) => new Date(row.created_at).toLocaleDateString()
          },
          {
            key: 'actions',
            header: 'Actions',
            render: (row) =>
              row.status !== 'settled' ? (
                <button
                  onClick={() => handleSettleDebt(row.id)}
                  style={{
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.85rem',
                    background: '#22c55e',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                >
                  Mark settled
                </button>
              ) : (
                '—'
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
