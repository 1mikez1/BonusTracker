'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { SectionHeader } from '@/components/SectionHeader';
import { FiltersBar } from '@/components/FiltersBar';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorMessage } from '@/components/ErrorMessage';
import { EmptyState } from '@/components/EmptyState';
import { useSupabaseData } from '@/lib/useSupabaseData';
import { useSupabaseMutations } from '@/lib/useSupabaseMutations';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { Toast } from '@/components/Toast';
import type { ClientPartner } from '@/types/partners';
import type { ClientPartnerAssignment, PartnerPayment } from '@/types/partners';
import type { ClientAppRow, BuildPartnerTotalsArgs } from '@/lib/partners';
import { buildPartnerBreakdown, calculatePartnerBalance } from '@/lib/partners';

interface PartnerSummaryState {
  partner: ClientPartner;
  clientsCount: number;
  totalProfit: number;
  partnerShare: number;
  ownerShare: number;
  totalPaid: number;
  balance: number;
}

type SortColumn = 'name' | 'clientsCount' | 'totalProfit' | 'partnerShare' | 'totalPaid' | 'balance';

export default function PartnersPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'due' | 'settled' | 'negative'>('all');
  const [sortColumn, setSortColumn] = useState<SortColumn>('balance');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [summaries, setSummaries] = useState<PartnerSummaryState[]>([]);
  const [isSummariesLoading, setIsSummariesLoading] = useState(true);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; partnerId: string | null; partnerName: string }>({
    isOpen: false,
    partnerId: null,
    partnerName: ''
  });
  const [isChecking, setIsChecking] = useState(false);
  const [toast, setToast] = useState<{ isOpen: boolean; message: string; type: 'success' | 'error' | 'info' }>({
    isOpen: false,
    message: '',
    type: 'success'
  });

  const {
    data: partners,
    isLoading: partnersLoading,
    error: partnersError,
    mutate: mutatePartners
  } = useSupabaseData({
    table: 'client_partners',
    order: { column: 'created_at', ascending: false }
  });

  const { data: assignments, isLoading: assignmentsLoading, mutate: mutateAssignments } = useSupabaseData({
    table: 'client_partner_assignments',
    select: '*, clients(*)'
  });

  const { data: clientApps, isLoading: appsLoading, mutate: mutateClientApps } = useSupabaseData({
    table: 'client_apps',
    select: 'id, client_id, profit_us, status, completed_at, created_at'
  });

  const { data: partnerPayments, isLoading: paymentsLoading, mutate: mutatePayments } = useSupabaseData({
    table: 'partner_payments'
  });

  const { remove: deletePartner } = useSupabaseMutations('client_partners', undefined, mutatePartners);

  const isLoading = partnersLoading || assignmentsLoading || appsLoading || paymentsLoading;
  const error = partnersError;

  useEffect(() => {
    if (!partners || !assignments || !clientApps || !partnerPayments) return;
    setIsSummariesLoading(true);
    const calc = partners.map((partner) => {
      const partnerAssignments = (assignments as ClientPartnerAssignment[]).filter(
        (assignment) => assignment.partner_id === partner.id
      );
      const args: BuildPartnerTotalsArgs = {
        partner,
        assignments: partnerAssignments,
        clientApps: clientApps as ClientAppRow[],
        payments: (partnerPayments as PartnerPayment[]).filter((payment) => payment.partner_id === partner.id)
      };
      const breakdown = buildPartnerBreakdown({
        partner: args.partner,
        assignments: args.assignments,
        clientApps: args.clientApps
      });
      const totals = calculatePartnerBalance(args);
      return {
        partner,
        clientsCount: partnerAssignments.length,
        totalProfit: breakdown.reduce((sum, item) => sum + item.totalProfit, 0),
        partnerShare: totals.partnerShare,
        ownerShare: totals.ownerShare,
        totalPaid: totals.totalPaid,
        balance: totals.balance
      };
    });
    setSummaries(calc);
    setIsSummariesLoading(false);
  }, [partners, assignments, clientApps, partnerPayments]);

  const filteredSummaries = useMemo(() => {
    return summaries.filter((summary) => {
      if (search && !summary.partner.name.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      if (statusFilter === 'due' && summary.balance <= 0) return false;
      if (statusFilter === 'settled' && summary.balance !== 0) return false;
      if (statusFilter === 'negative' && summary.balance >= 0) return false;
      return true;
    });
  }, [summaries, search, statusFilter]);

  const sortedSummaries = useMemo(() => {
    const sorted = [...filteredSummaries];
    sorted.sort((a, b) => {
      let aVal: any;
      let bVal: any;

      if (sortColumn === 'name') {
        aVal = a.partner.name.toLowerCase();
        bVal = b.partner.name.toLowerCase();
      } else {
        aVal = a[sortColumn];
        bVal = b[sortColumn];
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [filteredSummaries, sortColumn, sortDirection]);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const handleDeleteClick = (partnerId: string, partnerName: string) => {
    setDeleteModal({ isOpen: true, partnerId, partnerName });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteModal.partnerId) return;
    await deletePartner(deleteModal.partnerId, {
      onSuccess: () => {
        mutatePartners();
        mutateAssignments();
        setDeleteModal({ isOpen: false, partnerId: null, partnerName: '' });
      }
    });
  };

  const handleCheckAssignments = async () => {
    setIsChecking(true);
    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        setToast({ isOpen: true, message: 'Supabase client not available', type: 'error' });
        setIsChecking(false);
        return;
      }
      const { data, error } = await (supabase.rpc as any)('check_and_assign_partners');
      
      if (error) {
        console.error('Error checking assignments:', error);
        setToast({ isOpen: true, message: 'Failed to check assignments: ' + error.message, type: 'error' });
        setIsChecking(false);
        return;
      }

      // Refresh data
      mutateAssignments();
      mutatePartners();
      
      const assignedCount = data?.filter((r: any) => r.assigned).length || 0;
      const totalCount = data?.length || 0;
      
      setToast({ 
        isOpen: true, 
        message: `Check completed. ${assignedCount} of ${totalCount} clients assigned to partners.`, 
        type: 'success' 
      });
    } catch (error: any) {
      console.error('Error checking assignments:', error);
      setToast({ isOpen: true, message: 'Failed to check assignments', type: 'error' });
    } finally {
      setIsChecking(false);
    }
  };

  // Calculate totals
  const totals = useMemo(() => {
    return filteredSummaries.reduce(
      (acc, summary) => ({
        totalProfit: acc.totalProfit + summary.totalProfit,
        totalPartnerShare: acc.totalPartnerShare + summary.partnerShare,
        totalPaid: acc.totalPaid + summary.totalPaid,
        totalBalance: acc.totalBalance + summary.balance,
        totalClients: acc.totalClients + summary.clientsCount
      }),
      { totalProfit: 0, totalPartnerShare: 0, totalPaid: 0, totalBalance: 0, totalClients: 0 }
    );
  }, [filteredSummaries]);

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) return <span style={{ opacity: 0.3 }}>↕</span>;
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  if (isLoading || isSummariesLoading) {
    return (
      <div>
        <SectionHeader title="Partners" description="Loading partner data..." />
        <LoadingSpinner message="Loading partners..." />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <SectionHeader title="Partners" description="Unable to load partners" />
        <ErrorMessage
          error={error}
          onRetry={() => {
            mutatePartners();
            mutateAssignments();
            mutateClientApps();
            mutatePayments();
          }}
        />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <SectionHeader
        title="Partners"
        description="Manage sourcing partners and track profit splits, payments, and balances."
        actions={
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                backgroundColor: 'white',
                color: '#475569',
                fontWeight: '500',
                fontSize: '0.875rem',
                cursor: isChecking ? 'not-allowed' : 'pointer',
                opacity: isChecking ? 0.6 : 1,
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => !isChecking && (e.currentTarget.style.backgroundColor = '#f8fafc')}
              onMouseLeave={(e) => !isChecking && (e.currentTarget.style.backgroundColor = 'white')}
              onClick={handleCheckAssignments}
              disabled={isChecking}
            >
              {isChecking ? 'Checking...' : '✓ Check Assignments'}
            </button>
            <button
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                backgroundColor: '#059669',
                color: 'white',
                border: 'none',
                fontWeight: '600',
                fontSize: '0.875rem',
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#047857')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#059669')}
              onClick={() => router.push('/partners/new')}
            >
              + New Partner
            </button>
          </div>
        }
      />

      {/* Summary Cards */}
      {filteredSummaries.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div style={{ padding: '1.25rem', background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Total Partners</div>
            <div style={{ fontSize: '1.75rem', fontWeight: '700', color: '#0f172a' }}>{filteredSummaries.length}</div>
          </div>
          <div style={{ padding: '1.25rem', background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Total Profit</div>
            <div style={{ fontSize: '1.75rem', fontWeight: '700', color: '#0f172a' }}>€{totals.totalProfit.toFixed(2)}</div>
          </div>
          <div style={{ padding: '1.25rem', background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Partner Share</div>
            <div style={{ fontSize: '1.75rem', fontWeight: '700', color: '#059669' }}>€{totals.totalPartnerShare.toFixed(2)}</div>
          </div>
          <div style={{ padding: '1.25rem', background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Total Paid</div>
            <div style={{ fontSize: '1.75rem', fontWeight: '700', color: '#0f172a' }}>€{totals.totalPaid.toFixed(2)}</div>
          </div>
          <div style={{ padding: '1.25rem', background: totals.totalBalance > 0 ? '#fef2f2' : totals.totalBalance < 0 ? '#f0fdf4' : '#f8fafc', borderRadius: '12px', border: `1px solid ${totals.totalBalance > 0 ? '#fecaca' : totals.totalBalance < 0 ? '#bbf7d0' : '#e2e8f0'}`, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Total Balance</div>
            <div style={{ fontSize: '1.75rem', fontWeight: '700', color: totals.totalBalance > 0 ? '#dc2626' : totals.totalBalance < 0 ? '#16a34a' : '#64748b' }}>
              {totals.totalBalance > 0 ? '↑' : totals.totalBalance < 0 ? '↓' : '✓'} €{Math.abs(totals.totalBalance).toFixed(2)}
            </div>
          </div>
        </div>
      )}

      <FiltersBar>
        <input
          style={{
            padding: '0.5rem 0.75rem',
            borderRadius: '8px',
            border: '1px solid #cbd5e1',
            fontSize: '0.875rem',
            width: '100%',
            maxWidth: '300px'
          }}
          placeholder="Search by partner name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          style={{
            padding: '0.5rem 0.75rem',
            borderRadius: '8px',
            border: '1px solid #cbd5e1',
            fontSize: '0.875rem',
            background: 'white'
          }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
        >
          <option value="all">All Partners</option>
          <option value="due">Balance Due</option>
          <option value="settled">Settled</option>
          <option value="negative">Advance Paid</option>
        </select>
      </FiltersBar>

      {!filteredSummaries.length ? (
        <EmptyState
          title="No partners found"
          message={search || statusFilter !== 'all' ? 'No partners match your filters.' : 'Create a partner to get started.'}
        />
      ) : (
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                <tr>
                  <th
                    style={{
                      padding: '1rem',
                      textAlign: 'left',
                      fontSize: '0.75rem',
                      fontWeight: '700',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: '#475569',
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                    onClick={() => handleSort('name')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      Partner
                      <SortIcon column="name" />
                    </div>
                  </th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#475569' }}>
                    Default Split
                  </th>
                  <th
                    style={{
                      padding: '1rem',
                      textAlign: 'right',
                      fontSize: '0.75rem',
                      fontWeight: '700',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: '#475569',
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                    onClick={() => handleSort('clientsCount')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem' }}>
                      Clients
                      <SortIcon column="clientsCount" />
                    </div>
                  </th>
                  <th
                    style={{
                      padding: '1rem',
                      textAlign: 'right',
                      fontSize: '0.75rem',
                      fontWeight: '700',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: '#475569',
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                    onClick={() => handleSort('totalProfit')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem' }}>
                      Total Profit
                      <SortIcon column="totalProfit" />
                    </div>
                  </th>
                  <th
                    style={{
                      padding: '1rem',
                      textAlign: 'right',
                      fontSize: '0.75rem',
                      fontWeight: '700',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: '#475569',
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                    onClick={() => handleSort('partnerShare')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem' }}>
                      Partner Share
                      <SortIcon column="partnerShare" />
                    </div>
                  </th>
                  <th
                    style={{
                      padding: '1rem',
                      textAlign: 'right',
                      fontSize: '0.75rem',
                      fontWeight: '700',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: '#475569',
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                    onClick={() => handleSort('totalPaid')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem' }}>
                      Paid
                      <SortIcon column="totalPaid" />
                    </div>
                  </th>
                  <th
                    style={{
                      padding: '1rem',
                      textAlign: 'right',
                      fontSize: '0.75rem',
                      fontWeight: '700',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: '#475569',
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                    onClick={() => handleSort('balance')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem' }}>
                      Balance
                      <SortIcon column="balance" />
                    </div>
                  </th>
                  <th style={{ padding: '1rem', textAlign: 'center', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#475569' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedSummaries.map((summary, idx) => {
                  const balanceColor = summary.balance > 0 ? '#dc2626' : summary.balance < 0 ? '#16a34a' : '#64748b';
                  const balanceBg = summary.balance > 0 ? '#fef2f2' : summary.balance < 0 ? '#f0fdf4' : '#f8fafc';
                  const balanceIcon = summary.balance > 0 ? '↑' : summary.balance < 0 ? '↓' : '✓';
                  const balanceLabel = summary.balance > 0 ? 'Due' : summary.balance < 0 ? 'Advance' : 'Settled';

                  return (
                    <tr
                      key={summary.partner.id}
                      style={{
                        borderBottom: idx < sortedSummaries.length - 1 ? '1px solid #e2e8f0' : 'none',
                        transition: 'background-color 0.15s'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <td style={{ padding: '1rem' }}>
                        <div>
                          <Link
                            href={`/partners/${summary.partner.id}`}
                            style={{
                              fontWeight: '600',
                              color: '#0f172a',
                              textDecoration: 'none',
                              fontSize: '0.95rem'
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = '#059669')}
                            onMouseLeave={(e) => (e.currentTarget.style.color = '#0f172a')}
                          >
                            {summary.partner.name}
                          </Link>
                          {summary.partner.contact_info && (
                            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>
                              {summary.partner.contact_info}
                            </div>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <span style={{ fontSize: '0.875rem', color: '#475569' }}>
                          {Math.round(summary.partner.default_split_partner * 100)}% / {Math.round(summary.partner.default_split_owner * 100)}%
                        </span>
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'right' }}>
                        <span style={{ fontWeight: '600', color: '#0f172a' }}>{summary.clientsCount}</span>
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'right' }}>
                        <span style={{ fontWeight: '600', color: '#0f172a' }}>€{summary.totalProfit.toFixed(2)}</span>
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'right' }}>
                        <span style={{ fontWeight: '600', color: '#059669' }}>€{summary.partnerShare.toFixed(2)}</span>
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'right' }}>
                        <span style={{ fontWeight: '500', color: '#475569' }}>€{summary.totalPaid.toFixed(2)}</span>
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'right' }}>
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.375rem 0.75rem',
                            borderRadius: '6px',
                            background: balanceBg,
                            border: `1px solid ${balanceColor}20`
                          }}
                        >
                          <span style={{ fontWeight: '700', color: balanceColor, fontSize: '0.875rem' }}>
                            {balanceIcon} €{Math.abs(summary.balance).toFixed(2)}
                          </span>
                          <span style={{ fontSize: '0.7rem', fontWeight: '600', color: balanceColor, textTransform: 'uppercase' }}>
                            {balanceLabel}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
                          <Link
                            href={`/partners/${summary.partner.id}`}
                            style={{
                              fontSize: '0.8rem',
                              fontWeight: '500',
                              color: '#059669',
                              textDecoration: 'none',
                              padding: '0.25rem 0.5rem',
                              borderRadius: '4px',
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = '#ecfdf5';
                              e.currentTarget.style.textDecoration = 'underline';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'transparent';
                              e.currentTarget.style.textDecoration = 'none';
                            }}
                          >
                            View
                          </Link>
                          <Link
                            href={`/partners/new?partnerId=${summary.partner.id}`}
                            style={{
                              fontSize: '0.8rem',
                              fontWeight: '500',
                              color: '#475569',
                              textDecoration: 'none',
                              padding: '0.25rem 0.5rem',
                              borderRadius: '4px',
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = '#f1f5f9';
                              e.currentTarget.style.textDecoration = 'underline';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'transparent';
                              e.currentTarget.style.textDecoration = 'none';
                            }}
                          >
                            Edit
                          </Link>
                          <button
                            onClick={() => handleDeleteClick(summary.partner.id, summary.partner.name)}
                            style={{
                              fontSize: '0.8rem',
                              fontWeight: '500',
                              color: '#dc2626',
                              background: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              padding: '0.25rem 0.5rem',
                              borderRadius: '4px',
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = '#fef2f2';
                              e.currentTarget.style.textDecoration = 'underline';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'transparent';
                              e.currentTarget.style.textDecoration = 'none';
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={deleteModal.isOpen}
        onCancel={() => setDeleteModal({ isOpen: false, partnerId: null, partnerName: '' })}
        onConfirm={handleDeleteConfirm}
        title="Delete Partner"
        message={`Are you sure you want to delete partner "${deleteModal.partnerName}"? This will also remove all client assignments and payment records. This action cannot be undone.`}
        variant="danger"
      />

      <Toast
        isOpen={toast.isOpen}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ ...toast, isOpen: false })}
      />
    </div>
  );
}
