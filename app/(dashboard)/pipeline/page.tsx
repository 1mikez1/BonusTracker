'use client';

import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import { SectionHeader } from '@/components/SectionHeader';
import { FiltersBar } from '@/components/FiltersBar';
import { useSupabaseData } from '@/lib/useSupabaseData';
import { useSupabaseMutations } from '@/lib/useSupabaseMutations';
import { StatusBadge } from '@/components/StatusBadge';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorMessage } from '@/components/ErrorMessage';
import { NewSignupModal } from '@/components/NewSignupModal';

const STATUSES = ['requested', 'registered', 'deposited', 'waiting_bonus', 'completed', 'paid', 'cancelled'] as const;

type Status = (typeof STATUSES)[number];

interface ClientAppItem {
  id: string;
  client_id: string;
  app_id: string;
  status: string;
  deposit_amount: string | null;
  profit_us: string | null;
  notes: string | null;
  clientName: string;
  appName: string;
  clients?: any;
  apps?: any;
  promotions?: any | any[];
}

export default function PipelinePage() {
  const {
    data: clientApps,
    isLoading,
    error,
    mutate: mutateData,
    isDemo
  } = useSupabaseData({
    table: 'client_apps',
    select: '*, apps(*), clients!client_id(*), promotions(*)'
  });
  
  const { mutate: updateClientApp } = useSupabaseMutations('client_apps');
  const [draggedItem, setDraggedItem] = useState<ClientAppItem | null>(null);
  const [draggedOverColumn, setDraggedOverColumn] = useState<Status | null>(null);
  const [appFilter, setAppFilter] = useState<string>('all');
  const [appSearch, setAppSearch] = useState<string>('');
  const [showAppDropdown, setShowAppDropdown] = useState(false);
  const appSearchInputRef = useRef<HTMLInputElement>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showNewSignupModal, setShowNewSignupModal] = useState(false);
  const [hiddenColumns, setHiddenColumns] = useState<Set<Status>>(new Set());
  const [showHiddenColumnsMenu, setShowHiddenColumnsMenu] = useState(false);
  const hiddenMenuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (hiddenMenuRef.current && !hiddenMenuRef.current.contains(event.target as Node)) {
        setShowHiddenColumnsMenu(false);
      }
    };

    if (showHiddenColumnsMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showHiddenColumnsMenu]);

  // Get unique apps for the dropdown
  const availableApps = useMemo(() => {
    const appsArray = Array.isArray(clientApps) ? clientApps : [];
    const uniqueApps = new Map<string, any>();
    appsArray.forEach((item: any) => {
      const app = item?.apps;
      if (app && app.id && !uniqueApps.has(app.id)) {
        uniqueApps.set(app.id, app);
      }
    });
    return Array.from(uniqueApps.values()).sort((a: any, b: any) => 
      (a.name || '').localeCompare(b.name || '')
    );
  }, [clientApps]);

  // Filter apps based on search
  const filteredAppsForDropdown = useMemo(() => {
    if (!appSearch.trim()) return availableApps;
    const searchLower = appSearch.toLowerCase().trim();
    return availableApps.filter((app: any) => 
      app.name?.toLowerCase().includes(searchLower)
    );
  }, [availableApps, appSearch]);

  const columns = useMemo(() => {
    // Ensure clientApps is an array
    const appsArray = Array.isArray(clientApps) ? clientApps : [];
    
    // Filter by app if selected
    let filteredApps = appFilter === 'all' 
      ? appsArray 
      : appsArray.filter((item: any) => item?.app_id === appFilter);
    
    // Filter by search query if provided
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filteredApps = filteredApps.filter((item: any) => {
        const client = item?.clients;
        const app = item?.apps;
        const clientName = client ? `${client.name} ${client.surname ?? ''}`.trim().toLowerCase() : '';
        const appName = app?.name?.toLowerCase() || '';
        const notes = item?.notes?.toLowerCase() || '';
        const depositAmount = item?.deposit_amount?.toString() || '';
        
        return (
          clientName.includes(query) ||
          appName.includes(query) ||
          notes.includes(query) ||
          depositAmount.includes(query)
        );
      });
    }
    
    return STATUSES.map((status) => ({
      status,
      items: filteredApps
        .filter((item: any) => item?.status === status)
        .map((item: any) => {
          const client = item?.clients;
          const app = item?.apps;
          return {
            ...item,
            clientName: client ? `${client.name} ${client.surname ?? ''}`.trim() : item?.client_id || 'Unknown',
            appName: app?.name ?? item?.app_id ?? 'Unknown'
          } as ClientAppItem;
        })
        .sort((a, b) => {
          // Primary sort: by client name (alphabetical)
          const clientNameA = a.clientName.toLowerCase();
          const clientNameB = b.clientName.toLowerCase();
          if (clientNameA !== clientNameB) {
            return clientNameA.localeCompare(clientNameB);
          }
          // Secondary sort: by app name (alphabetical)
          const appNameA = a.appName.toLowerCase();
          const appNameB = b.appName.toLowerCase();
          return appNameA.localeCompare(appNameB);
        })
    })).filter((column) => !hiddenColumns.has(column.status));
  }, [clientApps, appFilter, searchQuery, hiddenColumns]);

  const handleDragStart = useCallback((item: ClientAppItem) => {
    setDraggedItem(item);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, status: Status) => {
    e.preventDefault();
    setDraggedOverColumn(status);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDraggedOverColumn(null);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent, targetStatus: Status) => {
      e.preventDefault();
      setDraggedOverColumn(null);

      if (!draggedItem || draggedItem.status === targetStatus || isDemo) {
        setDraggedItem(null);
        return;
      }

      try {
        await updateClientApp({ status: targetStatus }, draggedItem.id);
        // Trigger SWR revalidation
        await mutateData();
      } catch (error) {
        console.error('Failed to update status:', error);
        alert('Failed to update status. Please try again.');
      } finally {
        setDraggedItem(null);
      }
    },
    [draggedItem, updateClientApp, isDemo, mutateData]
  );

  const toggleColumnVisibility = useCallback((status: Status) => {
    setHiddenColumns(prev => {
      const next = new Set(prev);
      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });
  }, []);

  if (isLoading) {
    return (
      <div>
        <SectionHeader title="Pipeline" description="Loading pipeline data..." />
        <LoadingSpinner message="Loading client apps..." />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <SectionHeader title="Pipeline" description="Error loading pipeline data" />
        <ErrorMessage error={error} onRetry={mutateData} />
      </div>
    );
  }

  return (
    <div>
      <SectionHeader
        title="Pipeline"
        description={
          isDemo
            ? 'Drag-and-drop interactions are disabled in demo mode. Connect Supabase to activate live workflow transitions.'
            : 'Drag and drop cards between stages to progress each client app.'
        }
        actions={
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            {hiddenColumns.size > 0 && (
              <div style={{ position: 'relative' }} ref={hiddenMenuRef}>
                <button
                  onClick={() => setShowHiddenColumnsMenu(!showHiddenColumnsMenu)}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#f8fafc',
                    color: '#0f172a',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  👁️ Show Hidden ({hiddenColumns.size})
                </button>
                {showHiddenColumnsMenu && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      right: 0,
                      marginTop: '0.5rem',
                      background: '#fff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                      padding: '0.5rem',
                      minWidth: '180px',
                      zIndex: 1000
                    }}
                  >
                    <div style={{ fontSize: '0.75rem', color: '#64748b', padding: '0.5rem', borderBottom: '1px solid #e2e8f0', marginBottom: '0.5rem' }}>
                      Hidden Columns
                    </div>
                    {Array.from(hiddenColumns).map((status) => (
                      <button
                        key={status}
                        onClick={() => {
                          toggleColumnVisibility(status);
                        }}
                        style={{
                          width: '100%',
                          padding: '0.5rem 0.75rem',
                          background: 'none',
                          border: 'none',
                          textAlign: 'left',
                          cursor: 'pointer',
                          fontSize: '0.875rem',
                          color: '#0f172a',
                          textTransform: 'capitalize',
                          borderRadius: '4px',
                          transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#f8fafc';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        {status.replace(/_/g, ' ')}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <button
              onClick={() => setShowNewSignupModal(true)}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: 500
              }}
            >
              New Signup
            </button>
          </div>
        }
      />
      <NewSignupModal
        isOpen={showNewSignupModal}
        onClose={() => setShowNewSignupModal(false)}
        onSuccess={() => {
          mutateData();
          setShowNewSignupModal(false);
        }}
      />
      <FiltersBar>
        <input
          type="text"
          placeholder="Search by client name, app, notes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ flex: '1', minWidth: '250px' }}
        />
        <div style={{ position: 'relative', minWidth: '200px' }}>
          <input
            ref={appSearchInputRef}
            type="text"
            placeholder={appFilter === 'all' ? 'All apps' : availableApps.find((a: any) => a.id === appFilter)?.name || 'All apps'}
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
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '0.875rem',
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
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '1.25rem',
                color: '#64748b',
                padding: '0.25rem',
                lineHeight: 1
              }}
            >
              ×
            </button>
          )}
          {showAppDropdown && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                backgroundColor: '#fff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
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
                  padding: '0.625rem 0.75rem',
                  background: appFilter === 'all' ? '#f0f9ff' : 'transparent',
                  border: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  color: appFilter === 'all' ? '#1e40af' : '#0f172a',
                  fontWeight: appFilter === 'all' ? '600' : '400',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (appFilter !== 'all') {
                    e.currentTarget.style.background = '#f8fafc';
                  }
                }}
                onMouseLeave={(e) => {
                  if (appFilter !== 'all') {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                All apps
              </button>
              {filteredAppsForDropdown.length > 0 ? (
                filteredAppsForDropdown.map((app: any) => (
                  <button
                    key={app.id}
                    onClick={() => {
                      setAppFilter(app.id);
                      setAppSearch('');
                      setShowAppDropdown(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '0.625rem 0.75rem',
                      background: appFilter === app.id ? '#f0f9ff' : 'transparent',
                      border: 'none',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      color: appFilter === app.id ? '#1e40af' : '#0f172a',
                      fontWeight: appFilter === app.id ? '600' : '400',
                      transition: 'background-color 0.2s',
                      borderTop: '1px solid #e2e8f0'
                    }}
                    onMouseEnter={(e) => {
                      if (appFilter !== app.id) {
                        e.currentTarget.style.background = '#f8fafc';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (appFilter !== app.id) {
                        e.currentTarget.style.background = 'transparent';
                      }
                    }}
                  >
                    {app.name}
                  </button>
                ))
              ) : (
                <div style={{ padding: '0.75rem', textAlign: 'center', color: '#64748b', fontSize: '0.875rem' }}>
                  No apps found
                </div>
              )}
            </div>
          )}
        </div>
      </FiltersBar>
      <div 
        className="status-columns"
        style={{
          gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))`
        }}
      >
        {columns.map((column) => (
          <div
            key={column.status}
            className="status-column"
            onDragOver={(e) => handleDragOver(e, column.status)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, column.status)}
            style={{
              backgroundColor: draggedOverColumn === column.status ? 'rgba(59, 130, 246, 0.05)' : undefined,
              borderColor: draggedOverColumn === column.status ? '#3b82f6' : undefined
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h3 style={{ textTransform: 'capitalize', fontSize: '0.875rem', fontWeight: 600, margin: 0 }}>{column.status.replace(/_/g, ' ')}</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="badge info" style={{ fontSize: '0.7rem', padding: '0.1rem 0.5rem' }}>{column.items.length}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleColumnVisibility(column.status);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '0.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#64748b',
                    fontSize: '0.875rem',
                    transition: 'color 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#0f172a';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = '#64748b';
                  }}
                  title="Hide column"
                >
                  👁️
                </button>
              </div>
            </div>
            {column.items.map((item) => (
              <div
                key={item.id}
                className="status-card"
                draggable={!isDemo}
                onDragStart={() => handleDragStart(item)}
                style={{
                  cursor: isDemo ? 'default' : 'grab',
                  opacity: draggedItem?.id === item.id ? 0.5 : 1
                }}
              >
                <strong style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                  <Link 
                    href={`/clients/${item.client_id}`}
                    style={{ color: '#2563eb', textDecoration: 'none' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {item.clientName}
                  </Link>
                </strong>
                <span style={{ fontSize: '0.75rem' }}>{item.appName}</span>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
                  <span>€{Number(
                    item.profit_us ?? 
                    (Array.isArray(item.promotions) && item.promotions.length > 0 
                      ? item.promotions[0]?.our_reward ?? 0
                      : (item.promotions as any)?.our_reward ?? 0) ?? 0
                  ).toFixed(2)}</span>
                  <StatusBadge status={item.status} />
                </div>
                {item.notes ? <span style={{ fontSize: '0.7rem', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.notes}</span> : null}
              </div>
            ))}
            {!column.items.length ? <div className="empty-state">No items here.</div> : null}
          </div>
        ))}
        {hiddenColumns.size > 0 && (
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '0.5rem', 
            padding: '0.75rem',
            background: '#f8fafc',
            border: '1px dashed #cbd5e1',
            borderRadius: '12px',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: '120px'
          }}>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.5rem', textAlign: 'center' }}>Hidden columns</div>
            {Array.from(hiddenColumns).map((status) => (
              <button
                key={status}
                onClick={() => toggleColumnVisibility(status)}
                style={{
                  background: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  padding: '0.5rem 0.75rem',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  color: '#0f172a',
                  textTransform: 'capitalize',
                  width: '100%',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#f1f5f9';
                  e.currentTarget.style.borderColor = '#cbd5e1';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#fff';
                  e.currentTarget.style.borderColor = '#e2e8f0';
                }}
              >
                {status.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
