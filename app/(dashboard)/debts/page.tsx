'use client';

import { useMemo, useState, useEffect } from 'react';
import { SectionHeader } from '@/components/SectionHeader';
import { FiltersBar } from '@/components/FiltersBar';
import { DataTable } from '@/components/DataTable';
import { useSupabaseData } from '@/lib/useSupabaseData';
import { useSupabaseMutations } from '@/lib/useSupabaseMutations';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { StatusBadge } from '@/components/StatusBadge';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorMessage } from '@/components/ErrorMessage';
import { EmptyState } from '@/components/EmptyState';
import { Pagination } from '@/components/Pagination';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { Toast } from '@/components/Toast';

export default function DebtsPage() {
  const {
    data: referralDebts,
    isLoading: referralDebtsLoading,
    error: referralDebtsError,
    mutate: mutateReferralDebts,
    isDemo
  } = useSupabaseData({
    table: 'referral_link_debts',
    select: '*, referral_links(*)'
  });
  
  const {
    data: depositDebts,
    isLoading: depositDebtsLoading,
    error: depositDebtsError,
    mutate: mutateDepositDebts,
  } = useSupabaseData({
    table: 'deposit_debts' as any,
    select: '*, client_apps(*, apps(*))'
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
  
  const isLoading = referralDebtsLoading || depositDebtsLoading || clientsLoading;
  const error = referralDebtsError || depositDebtsError || clientsError;
  const { mutate: updateReferralDebt } = useSupabaseMutations('referral_link_debts');
  const { mutate: updateDepositDebt } = useSupabaseMutations('deposit_debts' as any);

  const [statusFilter, setStatusFilter] = useState('all');
  const [creditorFilter, setCreditorFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [settleDebtModal, setSettleDebtModal] = useState<{ isOpen: boolean; debt: any | null }>({
    isOpen: false,
    debt: null
  });
  const [toast, setToast] = useState<{ isOpen: boolean; message: string; type: 'success' | 'error' | 'info' }>({
    isOpen: false,
    message: '',
    type: 'success'
  });

  const rows = useMemo(() => {
    const referralDebtsArray = Array.isArray(referralDebts) ? referralDebts : [];
    const depositDebtsArray = Array.isArray(depositDebts) ? depositDebts : [];
    const clientsArray = Array.isArray(allClients) ? allClients : [];
    
    // Map referral link debts
    const referralRows = referralDebtsArray.map((debt: any) => {
      const creditor = clientsArray.find((c: any) => c.id === debt?.creditor_client_id);
      const debtor = debt?.debtor_client_id 
        ? clientsArray.find((c: any) => c.id === debt?.debtor_client_id)
        : null;
      const link = debt?.referral_links;
      
      return {
        ...debt,
        debtType: 'referral',
        creditorName: creditor ? `${creditor.name} ${creditor.surname ?? ''}`.trim() : debt?.creditor_client_id || 'Unknown',
        debtorName: debtor ? `${debtor.name} ${debtor.surname ?? ''}`.trim() : '—',
        linkUrl: link?.url ?? '—',
        description: debt?.description || 'Referral link debt'
      };
    });
    
    // Map deposit debts
    const depositRows = depositDebtsArray.map((debt: any) => {
      const client = clientsArray.find((c: any) => c.id === debt?.client_id);
      const clientApp = debt?.client_apps;
      const app = clientApp?.apps;
      
      return {
        ...debt,
        debtType: 'deposit',
        creditorName: 'Us',
        debtorName: client ? `${client.name} ${client.surname ?? ''}`.trim() : debt?.client_id || 'Unknown',
        linkUrl: app?.name ? `${app.name} deposit` : '—',
        description: debt?.deposit_source || debt?.description || `Deposit for ${app?.name || 'app'}`
      };
    });
    
    // Combine and sort by created_at (newest first)
    return [...referralRows, ...depositRows].sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [referralDebts, depositDebts, allClients]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      // Map deposit_debts status 'paid_back' to 'settled' for filtering
      const displayStatus = row.status === 'paid_back' ? 'settled' : row.status;
      
      if (statusFilter !== 'all' && displayStatus !== statusFilter) {
        return false;
      }
      if (creditorFilter !== 'all') {
        if (creditorFilter === 'us') {
          // Show only deposit debts (creditor is "Us")
          if (row.debtType !== 'deposit') {
            return false;
          }
        } else {
          // Show only referral debts with matching creditor
          if (row.debtType !== 'referral' || row.creditor_client_id !== creditorFilter) {
            return false;
          }
        }
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

  const handleSettleDebtClick = (debt: any) => {
    if (isDemo) {
      setToast({
        isOpen: true,
        message: 'Settlement is disabled in demo mode. Connect Supabase to enable this feature.',
        type: 'info'
      });
      return;
    }
    setSettleDebtModal({ isOpen: true, debt });
  };

  const handleSettleDebtConfirm = async () => {
    if (!settleDebtModal.debt) return;

    const debt = settleDebtModal.debt;
    
    try {
      if (debt.debtType === 'referral') {
        await updateReferralDebt({ status: 'settled', settled_at: new Date().toISOString() }, debt.id);
        await mutateReferralDebts();
      } else {
        // For deposit debts, update the client_app instead
        const supabase = getSupabaseClient();
        if (supabase && debt.client_app_id) {
          await (supabase as any)
            .from('client_apps')
            .update({ 
              deposit_paid_back: true,
              deposit_paid_back_at: new Date().toISOString()
            })
            .eq('id', debt.client_app_id);
        }
        await mutateDepositDebts();
      }
      setSettleDebtModal({ isOpen: false, debt: null });
      setToast({
        isOpen: true,
        message: debt.debtType === 'deposit' ? 'Deposit marked as paid back.' : 'Debt marked as settled.',
        type: 'success'
      });
    } catch (error) {
      console.error('Failed to settle debt:', error);
      setSettleDebtModal({ isOpen: false, debt: null });
      setToast({
        isOpen: true,
        message: 'Failed to settle debt. Please try again.',
        type: 'error'
      });
    }
  };

  if (isLoading) {
    return (
      <div>
        <SectionHeader title="Debts" description="Loading debts..." />
        <LoadingSpinner message="Loading debts..." />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <SectionHeader title="Debts" description="Error loading debts" />
        <ErrorMessage error={error} onRetry={() => { mutateReferralDebts(); mutateDepositDebts(); }} />
      </div>
    );
  }

  return (
    <div>
      <SectionHeader
        title="Debts"
        description="Monitor referral link debts and fronted deposits (our deposits)."
      />
      <FiltersBar>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="all">Any status</option>
          <option value="open">Open</option>
          <option value="partial">Partial</option>
          <option value="settled">Settled / Paid Back</option>
        </select>
        <select value={creditorFilter} onChange={(event) => setCreditorFilter(event.target.value)}>
          <option value="all">All creditors</option>
          <option value="us">Us (Deposit Debts)</option>
          {(() => {
            const clientsArray = Array.isArray(allClients) ? allClients : [];
            const referralDebtsArray = Array.isArray(referralDebts) ? referralDebts : [];
            return Array.from(new Set(referralDebtsArray.map((d: any) => d.creditor_client_id).filter(Boolean))).map((creditorId) => {
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
          { key: 'debtType', header: 'Type', render: (row) => row.debtType === 'deposit' ? '💰 Deposit' : '🔗 Referral' },
          { key: 'creditorName', header: 'Creditor' },
          { key: 'debtorName', header: 'Debtor' },
          { key: 'linkUrl', header: 'Source / Link', render: (row) => row.description || row.linkUrl || '—' },
          { key: 'amount', header: 'Amount', render: (row) => `€${Number(row.amount).toFixed(2)}` },
          {
            key: 'status',
            header: 'Status',
            render: (row) => {
              const displayStatus = row.status === 'paid_back' ? 'settled' : row.status;
              return <StatusBadge status={displayStatus} />;
            }
          },
          {
            key: 'created_at',
            header: 'Created',
            render: (row) => new Date(row.created_at).toLocaleDateString()
          },
          {
            key: 'actions',
            header: 'Actions',
            render: (row) => {
              const isSettled = row.status === 'settled' || row.status === 'paid_back';
              return !isSettled ? (
                <button
                  onClick={() => handleSettleDebtClick(row)}
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
                  {row.debtType === 'deposit' ? 'Mark paid back' : 'Mark settled'}
                </button>
              ) : (
                '—'
              );
            }
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
      <ConfirmationModal
        isOpen={settleDebtModal.isOpen}
        title={settleDebtModal.debt?.debtType === 'deposit' ? 'Mark Deposit as Paid Back?' : 'Mark Debt as Settled?'}
        message={
          settleDebtModal.debt
            ? `Are you sure you want to mark this ${settleDebtModal.debt.debtType === 'deposit' ? 'deposit' : 'debt'} as ${settleDebtModal.debt.debtType === 'deposit' ? 'paid back' : 'settled'}? This action cannot be undone.`
            : ''
        }
        confirmLabel={settleDebtModal.debt?.debtType === 'deposit' ? 'Mark Paid Back' : 'Mark Settled'}
        cancelLabel="Cancel"
        onConfirm={handleSettleDebtConfirm}
        onCancel={() => setSettleDebtModal({ isOpen: false, debt: null })}
        variant="info"
      />
      <Toast
        isOpen={toast.isOpen}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ isOpen: false, message: '', type: 'success' })}
      />
    </div>
  );
}
