'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { useSupabaseData } from '@/lib/useSupabaseData';
import { useSupabaseMutations } from '@/lib/useSupabaseMutations';
import { SectionHeader } from '@/components/SectionHeader';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorMessage } from '@/components/ErrorMessage';
import { EmptyState } from '@/components/EmptyState';
import { Toast } from '@/components/Toast';
import Link from 'next/link';

export default function PayoutsPage() {
  const [toast, setToast] = useState<{ isOpen: boolean; message: string; type: 'success' | 'error' | 'info' }>({ isOpen: false, message: '', type: 'success' });
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'overdue' | 'confirmed'>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [isConfirmingAll, setIsConfirmingAll] = useState(false);
  const [appFilter, setAppFilter] = useState<string>('all');
  const [appSearch, setAppSearch] = useState<string>('');
  const [showAppDropdown, setShowAppDropdown] = useState(false);
  const appSearchInputRef = useRef<HTMLInputElement>(null);
  const appDropdownRef = useRef<HTMLDivElement>(null);

  // Fetch pending payouts (completed apps not yet confirmed)
  const { data: pendingPayouts, isLoading: payoutsLoading, mutate: mutatePayouts } = useSupabaseData({
    table: 'client_apps',
    select: 'id, app_id, completed_at, started_at, created_at, expected_payout_at, payout_confirmed, payout_confirmed_at, profit_us, apps(id, name), promotions(time_to_get_bonus), clients!client_id(id, name, surname, client_partner_assignments(client_partners(name)))',
    filters: {
      status: { eq: 'completed' }
    } as any,
    order: { column: 'completed_at' as any, ascending: false }
  });

  // State for editing completed date
  const [editingCompletedDateId, setEditingCompletedDateId] = useState<string | null>(null);
  const [completedDateText, setCompletedDateText] = useState('');
  const [isSavingCompletedDate, setIsSavingCompletedDate] = useState(false);

  // Mutations for confirming payouts
  const { mutate: updatePayout } = useSupabaseMutations('client_apps', 'payouts', mutatePayouts);

  // Pending payouts with countdown
  const pendingPayoutsList = useMemo(() => {
    if (!pendingPayouts) return [];
    const now = new Date();
    return (pendingPayouts as any[]).map((payout: any) => {
      // Use completed_at, fallback to started_at, then created_at
      const completedDate = payout.completed_at 
        ? new Date(payout.completed_at) 
        : (payout.started_at 
          ? new Date(payout.started_at) 
          : (payout.created_at ? new Date(payout.created_at) : null));
      
      const expectedDate = payout.expected_payout_at ? new Date(payout.expected_payout_at) : null;
      const daysRemaining = expectedDate 
        ? Math.ceil((expectedDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : null;
      const isOverdue = expectedDate && expectedDate < now;
      const daysSinceCompleted = completedDate
        ? Math.floor((now.getTime() - completedDate.getTime()) / (1000 * 60 * 60 * 24))
        : null;
      // Check if time_to_get_bonus is configured
      const hasTimeToGetBonus = payout.promotions?.time_to_get_bonus ? true : false;
      const hasExplicitCompletedAt = !!payout.completed_at;
      
      return {
        ...payout,
        completedDate, // Use the fallback date
        daysRemaining,
        isOverdue,
        daysSinceCompleted,
        hasExpectedDate: !!expectedDate,
        hasTimeToGetBonus,
        hasCompletedAt: !!completedDate,
        hasExplicitCompletedAt
      };
    }).sort((a, b) => {
      // Sort by overdue first, then by days remaining, then by days since completed
      if (a.isOverdue && !b.isOverdue) return -1;
      if (!a.isOverdue && b.isOverdue) return 1;
      if (a.daysRemaining === null && b.daysRemaining !== null) return 1;
      if (a.daysRemaining !== null && b.daysRemaining === null) return -1;
      if (a.daysRemaining !== null && b.daysRemaining !== null) {
        return a.daysRemaining - b.daysRemaining;
      }
      // If no expected date, sort by days since completed (newest first)
      return (b.daysSinceCompleted ?? 0) - (a.daysSinceCompleted ?? 0);
    });
  }, [pendingPayouts]);

  // Get unique apps for the dropdown
  const availableApps = useMemo(() => {
    if (!pendingPayouts || !Array.isArray(pendingPayouts)) return [];
    const appsMap = new Map<string, { id: string; name: string }>();
    (pendingPayouts as any[]).forEach((payout: any) => {
      // Try to get app info from joined apps object first, then fallback to app_id
      const appId = payout?.apps?.id || payout?.app_id;
      const appName = payout?.apps?.name;
      
      if (appId) {
        // Use app name if available, otherwise use app_id as fallback
        appsMap.set(appId, { 
          id: appId, 
          name: appName || `App ${appId.substring(0, 8)}` 
        });
      }
    });
    return Array.from(appsMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [pendingPayouts]);

  // Filter apps for dropdown based on search
  const filteredAppsForDropdown = useMemo(() => {
    if (!Array.isArray(availableApps)) return [];
    if (!appSearch.trim()) return availableApps;
    const query = appSearch.toLowerCase().trim();
    return availableApps.filter((app) => app?.name?.toLowerCase().includes(query));
  }, [availableApps, appSearch]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        appDropdownRef.current &&
        !appDropdownRef.current.contains(event.target as Node) &&
        appSearchInputRef.current &&
        !appSearchInputRef.current.contains(event.target as Node)
      ) {
        setShowAppDropdown(false);
      }
    };

    if (showAppDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAppDropdown]);

  // Filter payouts by status, search query, and app filter
  const filteredPayouts = useMemo(() => {
    let filtered = pendingPayoutsList;
    
    // Filter by status
    if (filterStatus === 'pending') {
      filtered = filtered.filter((p: any) => !p.payout_confirmed);
    } else if (filterStatus === 'overdue') {
      filtered = filtered.filter((p: any) => p.isOverdue && !p.payout_confirmed);
    } else if (filterStatus === 'confirmed') {
      filtered = filtered.filter((p: any) => p.payout_confirmed);
    }
    
    // Filter by app
    if (appFilter !== 'all') {
      filtered = filtered.filter((p: any) => {
        // Try both app_id directly and apps.id from join
        const appId = p.app_id || p.apps?.id;
        // Convert both to strings for comparison to avoid type issues
        const matches = String(appId) === String(appFilter);
        return matches;
      });
    }
    
    // Filter by search query (client name or partner name only - app is filtered separately)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((p: any) => {
        const clientName = p.clients 
          ? `${p.clients.name} ${p.clients.surname || ''}`.trim().toLowerCase()
          : '';
        
        // Extract partner names from assignments
        const partnerNames: string[] = [];
        if (p.clients?.client_partner_assignments) {
          const assignments = Array.isArray(p.clients.client_partner_assignments) 
            ? p.clients.client_partner_assignments 
            : [p.clients.client_partner_assignments];
          assignments.forEach((assignment: any) => {
            if (assignment?.client_partners?.name) {
              partnerNames.push(assignment.client_partners.name.toLowerCase());
            }
          });
        }
        
        return clientName.includes(query) || 
               partnerNames.some(partnerName => partnerName.includes(query));
      });
    }
    
    return filtered;
  }, [pendingPayoutsList, filterStatus, searchQuery, appFilter]);

  // Statistics
  const stats = useMemo(() => {
    const total = pendingPayoutsList.length;
    const pending = pendingPayoutsList.filter((p: any) => !p.payout_confirmed).length;
    const overdue = pendingPayoutsList.filter((p: any) => p.isOverdue && !p.payout_confirmed).length;
    const confirmed = pendingPayoutsList.filter((p: any) => p.payout_confirmed).length;
    const totalProfit = pendingPayoutsList.reduce((sum, p: any) => sum + Number(p.profit_us ?? 0), 0);
    const pendingProfit = pendingPayoutsList
      .filter((p: any) => !p.payout_confirmed)
      .reduce((sum, p: any) => sum + Number(p.profit_us ?? 0), 0);
    
    return { total, pending, overdue, confirmed, totalProfit, pendingProfit };
  }, [pendingPayoutsList]);

  // Confirm payout
  const handleConfirmPayout = async (clientAppId: string, appName: string, clientName: string) => {
    try {
      await updatePayout(
        {
          payout_confirmed: true,
          payout_confirmed_at: new Date().toISOString()
        } as any,
        clientAppId
      );
      setToast({ isOpen: true, message: `Payout confirmed for ${appName} - ${clientName}`, type: 'success' });
      mutatePayouts();
    } catch (error: any) {
      console.error('Failed to confirm payout:', error);
      setToast({ isOpen: true, message: 'Failed to confirm payout', type: 'error' });
    }
  };

  // Unconfirm payout
  const handleUnconfirmPayout = async (clientAppId: string, appName: string, clientName: string) => {
    try {
      await updatePayout(
        {
          payout_confirmed: false,
          payout_confirmed_at: null
        } as any,
        clientAppId
      );
      setToast({ isOpen: true, message: `Payout unconfirmed for ${appName} - ${clientName}`, type: 'success' });
      mutatePayouts();
    } catch (error: any) {
      console.error('Failed to unconfirm payout:', error);
      setToast({ isOpen: true, message: 'Failed to unconfirm payout', type: 'error' });
    }
  };

  // Edit completed date
  const handleEditCompletedDate = (payout: any) => {
    setEditingCompletedDateId(payout.id);
    // Format date for input (YYYY-MM-DD)
    if (payout.completed_at) {
      const date = new Date(payout.completed_at);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      setCompletedDateText(`${year}-${month}-${day}`);
    } else {
      // Use fallback date if completed_at is not set
      const fallbackDate = payout.completedDate || new Date();
      const year = fallbackDate.getFullYear();
      const month = String(fallbackDate.getMonth() + 1).padStart(2, '0');
      const day = String(fallbackDate.getDate()).padStart(2, '0');
      setCompletedDateText(`${year}-${month}-${day}`);
    }
  };

  // Save completed date
  const handleSaveCompletedDate = async (payoutId: string) => {
    setIsSavingCompletedDate(true);
    try {
      let completedAt: string | null = null;
      if (completedDateText.trim()) {
        const date = new Date(completedDateText);
        if (isNaN(date.getTime())) {
          setToast({ isOpen: true, message: 'Invalid date format. Please use YYYY-MM-DD.', type: 'error' });
          setIsSavingCompletedDate(false);
          return;
        }
        date.setHours(0, 0, 0, 0);
        completedAt = date.toISOString();
      }

      await updatePayout(
        { completed_at: completedAt } as any,
        payoutId
      );
      setToast({ isOpen: true, message: 'Completed date updated successfully', type: 'success' });
      setEditingCompletedDateId(null);
      setCompletedDateText('');
      mutatePayouts();
    } catch (error: any) {
      console.error('Failed to save completed date:', error);
      setToast({ isOpen: true, message: 'Failed to save completed date', type: 'error' });
    } finally {
      setIsSavingCompletedDate(false);
    }
  };

  // Cancel editing completed date
  const handleCancelCompletedDate = () => {
    setEditingCompletedDateId(null);
    setCompletedDateText('');
  };

  // Confirm all pending/overdue payouts
  const handleConfirmAll = async () => {
    const toConfirm = filteredPayouts.filter((p: any) => !p.payout_confirmed);
    
    if (toConfirm.length === 0) {
      setToast({ isOpen: true, message: 'No pending payouts to confirm', type: 'info' });
      return;
    }

    if (!confirm(`Are you sure you want to confirm ${toConfirm.length} payout(s)?`)) {
      return;
    }

    setIsConfirmingAll(true);
    try {
      const confirmPromises = toConfirm.map((payout: any) =>
        updatePayout(
          {
            payout_confirmed: true,
            payout_confirmed_at: new Date().toISOString()
          } as any,
          payout.id
        )
      );
      
      await Promise.all(confirmPromises);
      setToast({ isOpen: true, message: `Successfully confirmed ${toConfirm.length} payout(s)`, type: 'success' });
      mutatePayouts();
    } catch (error: any) {
      console.error('Failed to confirm all payouts:', error);
      setToast({ isOpen: true, message: 'Failed to confirm all payouts', type: 'error' });
    } finally {
      setIsConfirmingAll(false);
    }
  };

  if (payoutsLoading) {
    return (
      <div style={{ padding: '2rem' }}>
        <LoadingSpinner size="large" message="Loading payouts..." />
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1600px', margin: '0 auto' }}>
      <SectionHeader
        title="Payouts"
      />

      {/* Statistics Cards */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '1rem', 
        marginBottom: '2rem' 
      }}>
        <div style={{ 
          backgroundColor: '#fff', 
          padding: '1.5rem', 
          borderRadius: '8px', 
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: '2rem', fontWeight: '700', color: '#64748b', marginBottom: '0.5rem' }}>
            {stats.total}
          </div>
          <div style={{ color: '#64748b', fontSize: '0.9rem' }}>Total Completed</div>
        </div>

        <div style={{ 
          backgroundColor: '#fff', 
          padding: '1.5rem', 
          borderRadius: '8px', 
          border: '2px solid #ef4444',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: '2rem', fontWeight: '700', color: '#ef4444', marginBottom: '0.5rem' }}>
            {stats.overdue}
          </div>
          <div style={{ color: '#64748b', fontSize: '0.9rem' }}>Overdue</div>
        </div>

        <div style={{ 
          backgroundColor: '#fff', 
          padding: '1.5rem', 
          borderRadius: '8px', 
          border: '2px solid #f59e0b',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: '2rem', fontWeight: '700', color: '#f59e0b', marginBottom: '0.5rem' }}>
            {stats.pending}
          </div>
          <div style={{ color: '#64748b', fontSize: '0.9rem' }}>Pending</div>
        </div>

        <div style={{ 
          backgroundColor: '#fff', 
          padding: '1.5rem', 
          borderRadius: '8px', 
          border: '2px solid #10b981',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: '2rem', fontWeight: '700', color: '#10b981', marginBottom: '0.5rem' }}>
            {stats.confirmed}
          </div>
          <div style={{ color: '#64748b', fontSize: '0.9rem' }}>Confirmed</div>
        </div>

        <div style={{ 
          backgroundColor: '#fff', 
          padding: '1.5rem', 
          borderRadius: '8px', 
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#64748b', marginBottom: '0.5rem' }}>
            €{stats.pendingProfit.toFixed(2)}
          </div>
          <div style={{ color: '#64748b', fontSize: '0.9rem' }}>Pending Profit</div>
        </div>
      </div>

      {/* Search and Filters */}
      <div style={{ 
        display: 'flex', 
        gap: '1rem', 
        marginBottom: '1.5rem',
        flexWrap: 'wrap',
        alignItems: 'flex-end'
      }}>
        {/* App Filter */}
        <div style={{ position: 'relative', minWidth: '200px' }}>
          <label style={{ 
            display: 'block', 
            fontSize: '0.875rem', 
            fontWeight: '500', 
            color: '#475569', 
            marginBottom: '0.25rem' 
          }}>
            Filter by App
          </label>
          <input
            ref={appSearchInputRef}
            type="text"
            placeholder={appFilter === 'all' ? 'All apps' : (Array.isArray(availableApps) ? availableApps.find((a) => a?.id === appFilter)?.name : null) || 'All apps'}
            value={appSearch}
            onChange={(e) => {
              setAppSearch(e.target.value);
              setShowAppDropdown(true);
            }}
            onFocus={() => setShowAppDropdown(true)}
            onBlur={() => {
              // Delay to allow click on dropdown item
              setTimeout(() => setShowAppDropdown(false), 200);
            }}
            style={{
              width: '100%',
              padding: '0.5rem 0.75rem',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontSize: '0.9rem',
              boxSizing: 'border-box'
            }}
          />
          {appFilter !== 'all' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setAppFilter('all');
                setAppSearch('');
                setShowAppDropdown(false);
              }}
              style={{
                position: 'absolute',
                right: '0.5rem',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
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
          {showAppDropdown && (
            <div
              ref={appDropdownRef}
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                backgroundColor: '#fff',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                maxHeight: '250px',
                overflowY: 'auto',
                zIndex: 1000,
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                marginTop: '0.25rem'
              }}
              onMouseDown={(e) => e.preventDefault()}
            >
              <button
                onClick={() => {
                  setAppFilter('all');
                  setAppSearch('');
                  setShowAppDropdown(false);
                }}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  textAlign: 'left',
                  background: appFilter === 'all' ? '#e0e7ff' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  color: '#1e293b'
                }}
                onMouseEnter={(e) => {
                  if (appFilter !== 'all') {
                    e.currentTarget.style.backgroundColor = '#f1f5f9';
                  }
                }}
                onMouseLeave={(e) => {
                  if (appFilter !== 'all') {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                All apps
              </button>
              {Array.isArray(filteredAppsForDropdown) && filteredAppsForDropdown.length > 0 ? (
                filteredAppsForDropdown.map((app) => (
                  <button
                    key={app?.id || Math.random()}
                    onClick={() => {
                      if (app?.id) {
                        setAppFilter(app.id);
                        setAppSearch('');
                        setShowAppDropdown(false);
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      textAlign: 'left',
                      background: appFilter === app?.id ? '#e0e7ff' : 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      color: '#1e293b'
                    }}
                    onMouseEnter={(e) => {
                      if (appFilter !== app?.id) {
                        e.currentTarget.style.backgroundColor = '#f1f5f9';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (appFilter !== app?.id) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    {app?.name || 'Unknown'}
                  </button>
                ))
              ) : (
                appSearch.trim() ? (
                  <div style={{ padding: '0.5rem 0.75rem', color: '#64748b', fontSize: '0.85rem' }}>
                    No apps found
                  </div>
                ) : (
                  Array.isArray(availableApps) && availableApps.length === 0 ? (
                    <div style={{ padding: '0.5rem 0.75rem', color: '#64748b', fontSize: '0.85rem' }}>
                      No apps available
                    </div>
                  ) : null
                )
              )}
            </div>
          )}
        </div>

        {/* Search Input */}
        <div style={{ flex: '1', minWidth: '250px' }}>
          <label style={{ 
            display: 'block', 
            fontSize: '0.875rem', 
            fontWeight: '500', 
            color: '#475569', 
            marginBottom: '0.25rem' 
          }}>
            Search by Client or Partner
          </label>
          <input
            type="text"
            placeholder="Search by client name or partner name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '0.5rem 1rem',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              fontSize: '0.9rem'
            }}
          />
        </div>

        {/* Status Filters */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button
          onClick={() => setFilterStatus('all')}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: filterStatus === 'all' ? '#3b82f6' : '#e2e8f0',
            color: filterStatus === 'all' ? 'white' : '#475569',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: '500'
          }}
        >
          All ({stats.total})
        </button>
        <button
          onClick={() => setFilterStatus('pending')}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: filterStatus === 'pending' ? '#f59e0b' : '#fef3c7',
            color: filterStatus === 'pending' ? 'white' : '#d97706',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: '500'
          }}
        >
          Pending ({stats.pending})
        </button>
        <button
          onClick={() => setFilterStatus('overdue')}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: filterStatus === 'overdue' ? '#ef4444' : '#fee2e2',
            color: filterStatus === 'overdue' ? 'white' : '#dc2626',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: '500'
          }}
        >
          Overdue ({stats.overdue})
        </button>
        <button
          onClick={() => setFilterStatus('confirmed')}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: filterStatus === 'confirmed' ? '#10b981' : '#d1fae5',
            color: filterStatus === 'confirmed' ? 'white' : '#065f46',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: '500'
          }}
        >
          Confirmed ({stats.confirmed})
        </button>
        </div>

        {/* Confirm All Button */}
        {filteredPayouts.filter((p: any) => !p.payout_confirmed).length > 0 && (
          <button
            onClick={handleConfirmAll}
            disabled={isConfirmingAll}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: isConfirmingAll ? '#94a3b8' : '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: isConfirmingAll ? 'not-allowed' : 'pointer',
              fontSize: '0.9rem',
              fontWeight: '600',
              whiteSpace: 'nowrap'
            }}
          >
            {isConfirmingAll ? 'Confirming...' : `✓ Confirm All (${filteredPayouts.filter((p: any) => !p.payout_confirmed).length})`}
          </button>
        )}
      </div>

      {/* Payouts List */}
      {filteredPayouts.length === 0 ? (
        <EmptyState
          title="No payouts found"
          message={filterStatus === 'all' 
            ? "No completed apps found." 
            : filterStatus === 'pending'
            ? "All payouts have been confirmed."
            : filterStatus === 'overdue'
            ? "No overdue payouts."
            : "No confirmed payouts."}
        />
      ) : (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {filteredPayouts.map((payout: any) => {
            const clientName = payout.clients 
              ? `${payout.clients.name} ${payout.clients.surname || ''}`.trim()
              : 'Unknown Client';
            const appName = payout.apps?.name || 'N/A';
            const profitUs = payout.profit_us ? Number(payout.profit_us).toFixed(2) : '0.00';
            const expectedDate = payout.expected_payout_at ? new Date(payout.expected_payout_at) : null;
            const completedDate = payout.completedDate; // Already uses fallback (completed_at -> started_at -> created_at)
            const confirmedDate = payout.payout_confirmed_at ? new Date(payout.payout_confirmed_at) : null;
            const isOverdue = payout.isOverdue;
            const daysRemaining = payout.daysRemaining;
            const daysSinceCompleted = payout.daysSinceCompleted;
            const hasExpectedDate = payout.hasExpectedDate;
            const hasTimeToGetBonus = payout.hasTimeToGetBonus;
            const hasCompletedAt = payout.hasCompletedAt;
            const hasExplicitCompletedAt = payout.hasExplicitCompletedAt;
            const isConfirmed = payout.payout_confirmed;
            const isEditingCompletedDate = editingCompletedDateId === payout.id;
            
            // Color logic: confirmed > overdue > no date set > days remaining <= 3 > normal
            const borderColor = isConfirmed ? '#10b981' :
                              isOverdue ? '#ef4444' : 
                              !hasExpectedDate ? '#94a3b8' : 
                              (daysRemaining !== null && daysRemaining <= 3) ? '#f59e0b' : '#3b82f6';
            const bgColor = isConfirmed ? '#d1fae5' :
                          isOverdue ? '#fee2e2' : 
                          !hasExpectedDate ? '#f1f5f9' : 
                          (daysRemaining !== null && daysRemaining <= 3) ? '#fef3c7' : '#dbeafe';

            return (
              <div
                key={payout.id}
                style={{
                  backgroundColor: '#fff',
                  padding: '1.5rem',
                  borderRadius: '8px',
                  border: `2px solid ${borderColor}`,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  display: 'flex',
                  gap: '1rem',
                  alignItems: 'flex-start'
                }}
              >
                <div style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  backgroundColor: borderColor,
                  marginTop: '0.25rem',
                  flexShrink: 0
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'flex-start',
                    marginBottom: '0.5rem'
                  }}>
                    <div>
                      <div style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '0.25rem' }}>
                        {appName} - {clientName}
                      </div>
                      <div style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                        Profit: €{profitUs}
                      </div>
                      {isEditingCompletedDate ? (
                        <div style={{ marginBottom: '0.5rem' }}>
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                            <input
                              type="date"
                              value={completedDateText}
                              onChange={(e) => setCompletedDateText(e.target.value)}
                              style={{
                                padding: '0.375rem 0.5rem',
                                border: '1px solid #cbd5e1',
                                borderRadius: '6px',
                                fontSize: '0.85rem'
                              }}
                              disabled={isSavingCompletedDate}
                            />
                            <button
                              onClick={() => handleSaveCompletedDate(payout.id)}
                              disabled={isSavingCompletedDate}
                              style={{
                                padding: '0.375rem 0.75rem',
                                backgroundColor: '#10b981',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: isSavingCompletedDate ? 'not-allowed' : 'pointer',
                                fontSize: '0.85rem',
                                fontWeight: '500'
                              }}
                            >
                              {isSavingCompletedDate ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              onClick={handleCancelCompletedDate}
                              disabled={isSavingCompletedDate}
                              style={{
                                padding: '0.375rem 0.75rem',
                                backgroundColor: '#e2e8f0',
                                color: '#475569',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: isSavingCompletedDate ? 'not-allowed' : 'pointer',
                                fontSize: '0.85rem',
                                fontWeight: '500'
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span>
                            {hasExplicitCompletedAt ? 'Completed' : 'Started'}: {completedDate?.toLocaleDateString('it-IT')}
                            {!hasExplicitCompletedAt && <span style={{ fontStyle: 'italic', color: '#94a3b8' }}> (using start date)</span>}
                          </span>
                          <button
                            onClick={() => handleEditCompletedDate(payout)}
                            style={{
                              padding: '0.25rem 0.5rem',
                              backgroundColor: 'transparent',
                              color: '#3b82f6',
                              border: '1px solid #3b82f6',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '0.75rem',
                              fontWeight: '500'
                            }}
                          >
                            {hasExplicitCompletedAt ? 'Edit' : 'Set Date'}
                          </button>
                        </div>
                      )}
                      {expectedDate && (
                        <div style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                          Expected payout: {expectedDate.toLocaleDateString('it-IT')}
                        </div>
                      )}
                      {confirmedDate && (
                        <div style={{ color: '#10b981', fontSize: '0.85rem', marginBottom: '0.25rem', fontWeight: '500' }}>
                          ✓ Confirmed: {confirmedDate.toLocaleDateString('it-IT')}
                        </div>
                      )}
                      {!hasExpectedDate && !isConfirmed && hasCompletedAt && !hasTimeToGetBonus && (
                        <div style={{ color: '#f59e0b', fontSize: '0.85rem', fontStyle: 'italic' }}>
                          ⚠️ Configure time_to_get_bonus in promotion to enable countdown
                        </div>
                      )}
                    </div>
                    <div style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: bgColor,
                      color: borderColor,
                      borderRadius: '6px',
                      fontSize: '0.9rem',
                      fontWeight: '600',
                      textAlign: 'center',
                      minWidth: '120px'
                    }}>
                      {isConfirmed ? (
                        <div>
                          <div style={{ fontSize: '0.75rem', marginBottom: '0.25rem' }}>CONFIRMED</div>
                          <div style={{ fontSize: '0.7rem' }}>{confirmedDate?.toLocaleDateString('it-IT')}</div>
                        </div>
                      ) : isOverdue ? (
                        <div>
                          <div style={{ fontSize: '0.75rem', marginBottom: '0.25rem' }}>OVERDUE</div>
                          <div>{Math.abs(daysRemaining ?? 0)} days ago</div>
                        </div>
                      ) : daysRemaining !== null ? (
                        <div>
                          <div style={{ fontSize: '0.75rem', marginBottom: '0.25rem' }}>Days remaining</div>
                          <div>{daysRemaining} {daysRemaining === 1 ? 'day' : 'days'}</div>
                        </div>
                      ) : daysSinceCompleted !== null ? (
                        <div>
                          <div style={{ fontSize: '0.75rem', marginBottom: '0.25rem' }}>Days since completed</div>
                          <div>{daysSinceCompleted} {daysSinceCompleted === 1 ? 'day' : 'days'}</div>
                        </div>
                      ) : (
                        <div>No date set</div>
                      )}
                    </div>
                  </div>
                  <div style={{ 
                    display: 'flex',
                    gap: '0.5rem',
                    marginTop: '1rem',
                    paddingTop: '1rem',
                    borderTop: '1px solid #e2e8f0'
                  }}>
                    <Link
                      href={`/clients/${payout.clients?.id || ''}#app-${payout.id}`}
                      style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: '#3b82f6',
                        color: 'white',
                        borderRadius: '6px',
                        textDecoration: 'none',
                        fontSize: '0.9rem',
                        fontWeight: '500',
                        display: 'inline-block'
                      }}
                    >
                      View Details
                    </Link>
                    {isConfirmed ? (
                      <button
                        onClick={() => handleUnconfirmPayout(payout.id, appName, clientName)}
                        style={{
                          padding: '0.5rem 1rem',
                          backgroundColor: '#f59e0b',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '0.9rem',
                          fontWeight: '500'
                        }}
                      >
                        ↻ Unconfirm
                      </button>
                    ) : (
                      <button
                        onClick={() => handleConfirmPayout(payout.id, appName, clientName)}
                        style={{
                          padding: '0.5rem 1rem',
                          backgroundColor: '#10b981',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '0.9rem',
                          fontWeight: '500'
                        }}
                      >
                        ✓ Confirm Payout
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Toast */}
      <Toast
        isOpen={toast.isOpen}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ isOpen: false, message: '', type: 'success' })}
      />
    </div>
  );
}

