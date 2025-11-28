'use client';

import { useMemo, useState, useCallback } from 'react';
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
  notes: string | null;
  clientName: string;
  appName: string;
  clients?: any;
  apps?: any;
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
    select: '*, apps(*), clients!client_id(*)'
  });
  
  const { mutate: updateClientApp } = useSupabaseMutations('client_apps');
  const [draggedItem, setDraggedItem] = useState<ClientAppItem | null>(null);
  const [draggedOverColumn, setDraggedOverColumn] = useState<Status | null>(null);
  const [appFilter, setAppFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showNewSignupModal, setShowNewSignupModal] = useState(false);

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
    }));
  }, [clientApps, appFilter, searchQuery]);

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
        <select 
          value={appFilter} 
          onChange={(e) => setAppFilter(e.target.value)}
        >
          <option value="all">All apps</option>
          {(() => {
            // Extract unique apps from clientApps relationship
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
          })().map((app: any) => (
            <option key={app.id} value={app.id}>
              {app.name}
            </option>
          ))}
        </select>
      </FiltersBar>
      <div className="status-columns">
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ textTransform: 'capitalize' }}>{column.status.replace(/_/g, ' ')}</h3>
              <span className="badge info">{column.items.length}</span>
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
                <strong>
                  <Link 
                    href={`/clients/${item.client_id}`}
                    style={{ color: '#2563eb', textDecoration: 'none' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {item.clientName}
                  </Link>
                </strong>
                <span>{item.appName}</span>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Deposit €{Number(item.deposit_amount ?? 0).toFixed(2)}</span>
                  <StatusBadge status={item.status} />
                </div>
                {item.notes ? <span>{item.notes}</span> : null}
              </div>
            ))}
            {!column.items.length ? <div className="empty-state">No items here.</div> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
