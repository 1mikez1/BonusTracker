'use client';

import { useMemo, useState, useEffect } from 'react';
import { useSupabaseData } from '@/lib/useSupabaseData';
import { useSupabaseMutations } from '@/lib/useSupabaseMutations';
import { SectionHeader } from '@/components/SectionHeader';
import { MetricCard } from '@/components/MetricCard';
import { FiltersBar } from '@/components/FiltersBar';
import { DataTable } from '@/components/DataTable';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorMessage } from '@/components/ErrorMessage';
import { EmptyState } from '@/components/EmptyState';
import { Pagination } from '@/components/Pagination';

export default function PromotionsPage() {
  const {
    data: promotions,
    isLoading: promotionsLoading,
    error: promotionsError,
    mutate: mutatePromotions
  } = useSupabaseData({
    table: 'promotions',
    select: '*, apps(*)',
    order: { column: 'end_date', ascending: true, nullsFirst: false }
  });

  const {
    data: apps,
    isLoading: appsLoading
  } = useSupabaseData({
    table: 'apps',
    order: { column: 'name', ascending: true }
  });

  const { mutate: updatePromotion } = useSupabaseMutations('promotions', undefined, mutatePromotions);

  const isLoading = promotionsLoading || appsLoading;
  const error = promotionsError;

  const [appFilter, setAppFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  
  // Edit state
  const [editingPromotionId, setEditingPromotionId] = useState<string | null>(null);
  const [isSavingPromotion, setIsSavingPromotion] = useState(false);
  
  // Edit form fields
  const [promoName, setPromoName] = useState('');
  const [promoAppId, setPromoAppId] = useState('');
  const [promoClientReward, setPromoClientReward] = useState('');
  const [promoOurReward, setPromoOurReward] = useState('');
  const [promoDepositRequired, setPromoDepositRequired] = useState('');
  const [promoExpense, setPromoExpense] = useState('');
  const [promoProfitType, setPromoProfitType] = useState('CASH');
  const [promoMaxInvites, setPromoMaxInvites] = useState('');
  const [promoIsActive, setPromoIsActive] = useState(true);
  const [promoStartDate, setPromoStartDate] = useState('');
  const [promoEndDate, setPromoEndDate] = useState('');
  const [promoTimeToGetBonus, setPromoTimeToGetBonus] = useState('');
  const [promoFreezeDays, setPromoFreezeDays] = useState('');
  const [promoTermsConditions, setPromoTermsConditions] = useState('');
  const [promoNotes, setPromoNotes] = useState('');

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
    const promotionsArray = Array.isArray(promotions) ? promotions : [];
    return promotionsArray.map((promo: any) => ({
      ...promo,
      isActive: isPromotionActive(promo),
      app: promo.apps
    }));
  }, [promotions]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (appFilter !== 'all' && row.app_id !== appFilter) {
        return false;
      }
      if (statusFilter === 'active' && !row.isActive) {
        return false;
      }
      if (statusFilter === 'expired' && row.isActive) {
        return false;
      }
      return true;
    });
  }, [rows, appFilter, statusFilter]);

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
  }, [appFilter, statusFilter]);

  const metrics = useMemo(() => {
    const activeCount = filteredRows.filter((row) => row.isActive).length;
    const totalClientReward = filteredRows.reduce((sum, row) => sum + Number(row.client_reward || 0), 0);
    const totalOurReward = filteredRows.reduce((sum, row) => sum + Number(row.our_reward || 0), 0);
    return [
      { title: 'Total Promotions', value: filteredRows.length.toString(), caption: 'Filtered by current view' },
      { title: 'Active Promotions', value: activeCount.toString(), caption: 'Currently valid' },
      { title: 'Total Client Reward', value: `€${totalClientReward.toFixed(2)}`, caption: 'Sum of client rewards' },
      { title: 'Total Our Reward', value: `€${totalOurReward.toFixed(2)}`, caption: 'Sum of our rewards' }
    ];
  }, [filteredRows]);

  // Get unique apps for filter
  const uniqueApps = useMemo(() => {
    const appsArray = Array.isArray(promotions) ? promotions : [];
    const appMap = new Map();
    appsArray.forEach((promo: any) => {
      if (promo.apps) {
        appMap.set(promo.app_id, { id: promo.app_id, name: promo.apps.name });
      }
    });
    return Array.from(appMap.values());
  }, [promotions]);

  // Initialize form when editing starts
  useEffect(() => {
    if (editingPromotionId) {
      const promo = rows.find((p: any) => p.id === editingPromotionId);
      if (promo) {
        setPromoName(promo.name || '');
        setPromoAppId(promo.app_id || '');
        setPromoClientReward(promo.client_reward ? String(promo.client_reward) : '');
        setPromoOurReward(promo.our_reward ? String(promo.our_reward) : '');
        setPromoDepositRequired(promo.deposit_required ? String(promo.deposit_required) : '');
        setPromoExpense(promo.expense ? String(promo.expense) : '');
        setPromoProfitType(promo.profit_type || 'CASH');
        setPromoMaxInvites(promo.max_invites ? String(promo.max_invites) : '');
        setPromoIsActive(promo.is_active !== false);
        setPromoStartDate(promo.start_date ? promo.start_date : '');
        setPromoEndDate(promo.end_date ? promo.end_date : '');
        setPromoTimeToGetBonus(promo.time_to_get_bonus || '');
        setPromoFreezeDays(promo.freeze_days ? String(promo.freeze_days) : '');
        setPromoTermsConditions(promo.terms_conditions || '');
        setPromoNotes(promo.notes || '');
      }
    }
  }, [editingPromotionId, rows]);

  const handleEditPromotion = (promoId: string) => {
    setEditingPromotionId(promoId);
  };

  const handleCancelEdit = () => {
    setEditingPromotionId(null);
    // Reset form fields
    setPromoName('');
    setPromoAppId('');
    setPromoClientReward('');
    setPromoOurReward('');
    setPromoDepositRequired('');
    setPromoExpense('');
    setPromoProfitType('CASH');
    setPromoMaxInvites('');
    setPromoIsActive(true);
    setPromoStartDate('');
    setPromoEndDate('');
    setPromoTimeToGetBonus('');
    setPromoFreezeDays('');
    setPromoTermsConditions('');
    setPromoNotes('');
  };

  const handleSavePromotion = async () => {
    if (!editingPromotionId || !promoName.trim()) return;

    setIsSavingPromotion(true);
    try {
      const updateData: any = {
        name: promoName.trim(),
        app_id: promoAppId || null,
        client_reward: promoClientReward ? parseFloat(promoClientReward) : 0,
        our_reward: promoOurReward ? parseFloat(promoOurReward) : 0,
        deposit_required: promoDepositRequired ? parseFloat(promoDepositRequired) : 0,
        expense: promoExpense ? parseFloat(promoExpense) : null,
        profit_type: promoProfitType || null,
        max_invites: promoMaxInvites ? parseInt(promoMaxInvites, 10) : null,
        is_active: promoIsActive,
        start_date: promoStartDate || null,
        end_date: promoEndDate || null,
        time_to_get_bonus: promoTimeToGetBonus.trim() || null,
        freeze_days: promoFreezeDays ? parseInt(promoFreezeDays, 10) : null,
        terms_conditions: promoTermsConditions.trim() || null,
        notes: promoNotes.trim() || null
      };

      await updatePromotion(updateData, editingPromotionId);
      setEditingPromotionId(null);
    } catch (error) {
      console.error('Error saving promotion:', error);
      alert('Failed to save promotion. Please try again.');
    } finally {
      setIsSavingPromotion(false);
    }
  };

  if (isLoading) {
    return (
      <div>
        <SectionHeader title="Promotions Management" description="Loading promotions data..." />
        <LoadingSpinner message="Loading promotions..." />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <SectionHeader title="Promotions Management" description="Error loading promotions data" />
        <ErrorMessage
          error={error}
          onRetry={() => {
            mutatePromotions();
          }}
        />
      </div>
    );
  }

  return (
    <div>
      <SectionHeader
        title="Promotions Management"
        description="Manage all app promotions, track active bonuses, deadlines, and profitability."
      />
      <div className="card-grid">
        {metrics.map((metric) => (
          <MetricCard key={metric.title} title={metric.title} value={metric.value} caption={metric.caption} />
        ))}
      </div>
      <FiltersBar>
        <select value={appFilter} onChange={(event) => setAppFilter(event.target.value)}>
          <option value="all">All apps</option>
          {uniqueApps.map((app: any) => (
            <option key={app.id} value={app.id}>
              {app.name}
            </option>
          ))}
        </select>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="all">All statuses</option>
          <option value="active">Active only</option>
          <option value="expired">Expired only</option>
        </select>
      </FiltersBar>
      {filteredRows.length === 0 ? (
        <EmptyState
          title="No promotions found"
          message={
            appFilter !== 'all' || statusFilter !== 'all'
              ? 'No promotions match your current filters. Try adjusting your selection.'
              : 'No promotions have been added yet.'
          }
        />
      ) : (
        <>
        <DataTable
          data={paginatedRows}
          columns={[
            {
              key: 'app',
              header: 'App',
              render: (row) => row.app?.name ?? '—'
            },
            {
              key: 'name',
              header: 'Promotion Name'
            },
            {
              key: 'status',
              header: 'Status',
              render: (row) => {
                const profitType = row.profit_type || 'CASH';
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {row.isActive ? (
                      <span className="badge success">● Active</span>
                    ) : (
                      <span className="badge" style={{ backgroundColor: '#e2e8f0', color: '#64748b' }}>○ Expired</span>
                    )}
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
                  </div>
                );
              }
            },
            {
              key: 'rewards',
              header: 'Rewards',
              render: (row) => (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.9rem' }}>
                  <div>
                    <span style={{ color: '#64748b' }}>Client:</span>
                    <span style={{ marginLeft: '0.5rem', fontWeight: '500', color: '#10b981' }}>
                      €{Number(row.client_reward || 0).toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Us:</span>
                    <span style={{ marginLeft: '0.5rem', fontWeight: '500', color: '#3b82f6' }}>
                      €{Number(row.our_reward || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              )
            },
            {
              key: 'deposit',
              header: 'Deposit',
              render: (row) => {
                const expense = row.expense ? Number(row.expense) : null;
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.9rem' }}>
                    <div>
                      <span style={{ color: '#64748b' }}>Required:</span>
                      <span style={{ marginLeft: '0.5rem', fontWeight: '500' }}>
                        €{Number(row.deposit_required || 0).toFixed(2)}
                      </span>
                    </div>
                    {expense !== null && (
                      <div>
                        <span style={{ color: '#64748b' }}>Expense:</span>
                        <span style={{ marginLeft: '0.5rem', fontWeight: '500', color: '#ef4444' }}>
                          €{expense.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                );
              }
            },
            {
              key: 'invites',
              header: 'Max Invites',
              render: (row) => row.max_invites ? row.max_invites.toString() : '—'
            },
            {
              key: 'deadline',
              header: 'Deadline',
              render: (row) => {
                if (!row.end_date) return '—';
                const deadline = new Date(row.end_date);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const isPast = deadline < today;
                return (
                  <span style={{ color: isPast ? '#94a3b8' : '#f59e0b', fontWeight: '500' }}>
                    {deadline.toLocaleDateString()}
                  </span>
                );
              }
            },
            {
              key: 'time_to_get_bonus',
              header: 'Time to Get Bonus',
              render: (row) => row.time_to_get_bonus || '—'
            },
            {
              key: 'notes',
              header: 'Notes',
              render: (row) => row.notes ? (
                <span style={{ fontSize: '0.85rem', color: '#64748b', fontStyle: 'italic' }}>
                  {row.notes}
                </span>
              ) : '—'
            },
            {
              key: 'actions',
              header: 'Actions',
              render: (row) => {
                const isEditing = editingPromotionId === row.id;
                if (isEditing) {
                  return null; // Hide actions column when editing (buttons are in the form)
                }
                return (
                  <button
                    onClick={() => handleEditPromotion(row.id)}
                    style={{
                      padding: '0.375rem 0.75rem',
                      backgroundColor: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: '500'
                    }}
                  >
                    Edit
                  </button>
                );
              }
            }
          ]}
          renderRow={(row: any, rowIndex: number) => {
            const isEditing = editingPromotionId === row.id;
            if (!isEditing) {
              return null; // Use default row rendering
            }
            // Render edit form as an additional row below the normal row
            const appsArray = Array.isArray(apps) ? apps : [];
            return (
              <>
                {/* Normal row will be rendered by default */}
                <tr key={`edit-${row.id}`} style={{ backgroundColor: '#f8fafc' }}>
                  <td colSpan={10} style={{ padding: '1.5rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem' }}>
                          Promotion Name *
                        </label>
                        <input
                          type="text"
                          value={promoName}
                          onChange={(e) => setPromoName(e.target.value)}
                          style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                          disabled={isSavingPromotion}
                          required
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem' }}>
                          App *
                        </label>
                        <select
                          value={promoAppId}
                          onChange={(e) => setPromoAppId(e.target.value)}
                          style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                          disabled={isSavingPromotion}
                          required
                        >
                          <option value="">Select app</option>
                          {appsArray.map((app: any) => (
                            <option key={app.id} value={app.id}>
                              {app.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem' }}>
                          Client Reward (€)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={promoClientReward}
                          onChange={(e) => setPromoClientReward(e.target.value)}
                          style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                          disabled={isSavingPromotion}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem' }}>
                          Our Reward (€)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={promoOurReward}
                          onChange={(e) => setPromoOurReward(e.target.value)}
                          style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                          disabled={isSavingPromotion}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem' }}>
                          Deposit Required (€)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={promoDepositRequired}
                          onChange={(e) => setPromoDepositRequired(e.target.value)}
                          style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                          disabled={isSavingPromotion}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem' }}>
                          Expense (€)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={promoExpense}
                          onChange={(e) => setPromoExpense(e.target.value)}
                          style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                          disabled={isSavingPromotion}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem' }}>
                          Profit Type
                        </label>
                        <select
                          value={promoProfitType}
                          onChange={(e) => setPromoProfitType(e.target.value)}
                          style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                          disabled={isSavingPromotion}
                        >
                          <option value="CASH">CASH</option>
                          <option value="VOUCHER">VOUCHER</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem' }}>
                          Max Invites
                        </label>
                        <input
                          type="number"
                          value={promoMaxInvites}
                          onChange={(e) => setPromoMaxInvites(e.target.value)}
                          style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                          disabled={isSavingPromotion}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem' }}>
                          Start Date
                        </label>
                        <input
                          type="date"
                          value={promoStartDate}
                          onChange={(e) => setPromoStartDate(e.target.value)}
                          style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                          disabled={isSavingPromotion}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem' }}>
                          End Date
                        </label>
                        <input
                          type="date"
                          value={promoEndDate}
                          onChange={(e) => setPromoEndDate(e.target.value)}
                          style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                          disabled={isSavingPromotion}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem' }}>
                          Time to Get Bonus
                        </label>
                        <input
                          type="text"
                          value={promoTimeToGetBonus}
                          onChange={(e) => setPromoTimeToGetBonus(e.target.value)}
                          placeholder="e.g., 2-5 days after deposit"
                          style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                          disabled={isSavingPromotion}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem' }}>
                          Freeze Days
                        </label>
                        <input
                          type="number"
                          value={promoFreezeDays}
                          onChange={(e) => setPromoFreezeDays(e.target.value)}
                          style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                          disabled={isSavingPromotion}
                        />
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <input
                          type="checkbox"
                          checked={promoIsActive}
                          onChange={(e) => setPromoIsActive(e.target.checked)}
                          disabled={isSavingPromotion}
                        />
                        <span style={{ fontWeight: '500', fontSize: '0.875rem' }}>Active</span>
                      </label>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem' }}>
                        Terms & Conditions
                      </label>
                      <textarea
                        value={promoTermsConditions}
                        onChange={(e) => setPromoTermsConditions(e.target.value)}
                        rows={3}
                        style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontFamily: 'inherit' }}
                        disabled={isSavingPromotion}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem' }}>
                        Notes
                      </label>
                      <textarea
                        value={promoNotes}
                        onChange={(e) => setPromoNotes(e.target.value)}
                        rows={3}
                        style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontFamily: 'inherit' }}
                        disabled={isSavingPromotion}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
                      <button
                        onClick={handleCancelEdit}
                        disabled={isSavingPromotion}
                        style={{
                          padding: '0.5rem 1.5rem',
                          backgroundColor: '#64748b',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: isSavingPromotion ? 'not-allowed' : 'pointer',
                          fontSize: '0.875rem',
                          fontWeight: '500'
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSavePromotion}
                        disabled={isSavingPromotion || !promoName.trim()}
                        style={{
                          padding: '0.5rem 1.5rem',
                          backgroundColor: '#10b981',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: (isSavingPromotion || !promoName.trim()) ? 'not-allowed' : 'pointer',
                          fontSize: '0.875rem',
                          fontWeight: '600',
                          opacity: (isSavingPromotion || !promoName.trim()) ? 0.6 : 1
                        }}
                      >
                        {isSavingPromotion ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </div>
                  </td>
                </tr>
              </>
            );
          }}
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

