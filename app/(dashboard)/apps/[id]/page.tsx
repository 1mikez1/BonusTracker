'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState, useMemo } from 'react';
import { useSupabaseData } from '@/lib/useSupabaseData';
import { SectionHeader } from '@/components/SectionHeader';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorMessage } from '@/components/ErrorMessage';
import { StatusBadge } from '@/components/StatusBadge';

export default function AppDetailPage() {
  const params = useParams();
  const router = useRouter();
  const appId = Array.isArray(params?.id) ? params?.id[0] : (params?.id as string | undefined);

  const {
    data: apps,
    isLoading: appsLoading,
    error: appsError
  } = useSupabaseData({
    table: 'apps',
    select: '*',
    match: appId ? { id: appId } : undefined
  });

  const {
    data: clientApps,
    isLoading: clientAppsLoading,
    error: clientAppsError
  } = useSupabaseData({
    table: 'client_apps',
    select: '*, clients!client_id(*), promotions(*)',
    match: appId ? { app_id: appId } : undefined
  });

  const {
    data: allClients,
    isLoading: allClientsLoading
  } = useSupabaseData({
    table: 'clients',
    select: '*'
  });

  const {
    data: promotions,
    isLoading: promotionsLoading
  } = useSupabaseData({
    table: 'promotions',
    select: '*',
    match: appId ? { app_id: appId } : undefined
  });

  const [searchTerm, setSearchTerm] = useState('');

  const isLoading = appsLoading || clientAppsLoading || allClientsLoading || promotionsLoading;
  const error = appsError || clientAppsError;

  // Get the app
  const app = Array.isArray(apps) ? apps.find((a: any) => a.id === appId) : null;

  // Helper function to check if a promotion is currently active
  const isPromotionActive = (promo: any): boolean => {
    if (!promo) return false;
    if (promo.is_active === false) return false;
    if (promo.is_active === true) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (promo.start_date) {
        const startDate = new Date(promo.start_date);
        startDate.setHours(0, 0, 0, 0);
        if (today < startDate) return false;
      }
      if (promo.end_date) {
        const endDate = new Date(promo.end_date);
        endDate.setHours(23, 59, 59, 999);
        if (today > endDate) return false;
      }
      return true;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (!promo.start_date && !promo.end_date) return true;
    if (promo.start_date) {
      const startDate = new Date(promo.start_date);
      startDate.setHours(0, 0, 0, 0);
      if (today < startDate) return false;
    }
    if (promo.end_date) {
      const endDate = new Date(promo.end_date);
      endDate.setHours(23, 59, 59, 999);
      if (today > endDate) return false;
    }
    return true;
  };

  // Check if app has active promotions
  const hasActivePromotion = useMemo(() => {
    const promotionsArray = Array.isArray(promotions) ? promotions : [];
    return promotionsArray.some((p: any) => isPromotionActive(p));
  }, [promotions]);

  // Get all clients
  const allClientsArray = useMemo(() => Array.isArray(allClients) ? allClients : [], [allClients]);

  // Get clients who have this app
  const clientAppsArray = useMemo(() => Array.isArray(clientApps) ? clientApps : [], [clientApps]);

  // Categorize clients into 4 groups
  const categorizedClients = useMemo(() => {
    const clientsWithApp = new Set<string>();
    const clientsDone = new Set<string>();
    const clientsToDo = new Set<string>();
    const clientsToBeFinished = new Set<string>();

    // Process client_apps (exclude error_irrecoverable apps)
    clientAppsArray.forEach((ca: any) => {
      const clientId = ca.client_id;
      if (!clientId) return;
      
      // Skip apps with error_irrecoverable = true
      if (ca.error_irrecoverable) return;

      clientsWithApp.add(clientId);

      // Done: completed or paid
      if (ca.status === 'completed' || ca.status === 'paid') {
        clientsDone.add(clientId);
      }
      // To Do: requested
      else if (ca.status === 'requested') {
        clientsToDo.add(clientId);
      }
      // To Be Finished: not completed, not paid, not requested, not cancelled
      else if (ca.status !== 'cancelled') {
        clientsToBeFinished.add(clientId);
      }
    });

    // Missing: clients who don't have this app yet
    const clientsMissing = allClientsArray
      .filter((c: any) => !clientsWithApp.has(c.id))
      .map((c: any) => c.id);

    return {
      missing: clientsMissing.map((id: string) => {
        const client = allClientsArray.find((c: any) => c.id === id);
        return { client, clientApp: null };
      }).filter((item: any) => item.client),
      toDo: Array.from(clientsToDo).map((id: string) => {
        const client = allClientsArray.find((c: any) => c.id === id);
        const clientApp = clientAppsArray.find((ca: any) => ca.client_id === id && ca.status === 'requested');
        return { client, clientApp };
      }).filter((item: any) => item.client),
      toBeFinished: Array.from(clientsToBeFinished).map((id: string) => {
        const client = allClientsArray.find((c: any) => c.id === id);
        const clientApp = clientAppsArray.find((ca: any) => 
          ca.client_id === id && 
          ca.status !== 'completed' && 
          ca.status !== 'paid' && 
          ca.status !== 'requested' && 
          ca.status !== 'cancelled' &&
          !ca.error_irrecoverable
        );
        return { client, clientApp };
      }).filter((item: any) => item.client),
      done: Array.from(clientsDone).map((id: string) => {
        const client = allClientsArray.find((c: any) => c.id === id);
        const clientApp = clientAppsArray.find((ca: any) => ca.client_id === id && (ca.status === 'completed' || ca.status === 'paid'));
        return { client, clientApp };
      }).filter((item: any) => item.client)
    };
  }, [clientAppsArray, allClientsArray]);

  // Filter by search term
  const filteredCategorizedClients = useMemo(() => {
    if (!searchTerm.trim()) {
      return categorizedClients;
    }

    const searchLower = searchTerm.toLowerCase().trim();
    const filterItems = (items: Array<{ client: any; clientApp: any }>) => {
      return items.filter((item: any) => {
        if (!item.client) return false;
        const fullName = `${item.client.name} ${item.client.surname || ''}`.trim().toLowerCase();
        const contact = (item.client.contact || '').toLowerCase();
        const email = (item.client.email || '').toLowerCase();
        return fullName.includes(searchLower) || contact.includes(searchLower) || email.includes(searchLower);
      });
    };

    return {
      missing: filterItems(categorizedClients.missing),
      toDo: filterItems(categorizedClients.toDo),
      toBeFinished: filterItems(categorizedClients.toBeFinished),
      done: filterItems(categorizedClients.done)
    };
  }, [categorizedClients, searchTerm]);

  if (isLoading) {
    return (
      <div>
        <SectionHeader title="App Details" description="Loading app data..." />
        <LoadingSpinner message="Loading app details..." />
      </div>
    );
  }

  if (error || !app) {
    return (
      <div>
        <SectionHeader title="App Details" description="Error loading app data" />
        <ErrorMessage
          error={error || new Error('App not found')}
          onRetry={() => router.refresh()}
        />
      </div>
    );
  }

  return (
    <div>
      <SectionHeader
        title={app.name}
        description={`${app.app_type || 'App'} • ${app.country || 'No country'} • ${hasActivePromotion ? 'Active' : 'Inactive'}`}
        actions={
          <Link
            href="/apps"
            style={{
              fontSize: '0.875rem',
              color: '#3b82f6',
              textDecoration: 'none'
            }}
          >
            ← Back to Apps
          </Link>
        }
      />

      {/* Search Filter */}
      <div style={{ marginBottom: '1.5rem' }}>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search clients by name, contact, or email..."
          style={{
            width: '100%',
            maxWidth: '500px',
            padding: '0.75rem',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            fontSize: '0.95rem'
          }}
        />
      </div>

      {/* Four Column Layout */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(4, 1fr)', 
        gap: '1.5rem',
        marginTop: '1.5rem'
      }}>
        {/* Column 1: Missing */}
        <div style={{
          backgroundColor: '#fff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          padding: '1.5rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '1rem',
            paddingBottom: '1rem',
            borderBottom: '2px solid #94a3b8'
          }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '600', margin: 0, color: '#64748b' }}>
              Missing
            </h2>
            <span style={{
              padding: '0.25rem 0.75rem',
              backgroundColor: '#f1f5f9',
              color: '#475569',
              borderRadius: '12px',
              fontSize: '0.875rem',
              fontWeight: '600'
            }}>
              {filteredCategorizedClients.missing.length}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '600px', overflowY: 'auto' }}>
            {filteredCategorizedClients.missing.length === 0 ? (
              <div style={{ color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', padding: '2rem' }}>
                All clients have started this app
              </div>
            ) : (
              filteredCategorizedClients.missing.map((item: any) => {
                const client = item.client;
                return (
                  <Link
                    key={client.id}
                    href={`/clients/${client.id}`}
                    style={{
                      display: 'block',
                      padding: '0.75rem',
                      backgroundColor: '#f8fafc',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      textDecoration: 'none',
                      color: 'inherit',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#f1f5f9';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#f8fafc';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <div style={{ fontWeight: '600', marginBottom: '0.25rem', color: '#1e293b' }}>
                      {client.name} {client.surname || ''}
                    </div>
                    {client.contact && (
                      <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>
                        {client.contact}
                      </div>
                    )}
                  </Link>
                );
              })
            )}
          </div>
        </div>

        {/* Column 2: To Do */}
        <div style={{
          backgroundColor: '#fff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          padding: '1.5rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '1rem',
            paddingBottom: '1rem',
            borderBottom: '2px solid #3b82f6'
          }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '600', margin: 0, color: '#2563eb' }}>
              To Do
            </h2>
            <span style={{
              padding: '0.25rem 0.75rem',
              backgroundColor: '#dbeafe',
              color: '#1e40af',
              borderRadius: '12px',
              fontSize: '0.875rem',
              fontWeight: '600'
            }}>
              {filteredCategorizedClients.toDo.length}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '600px', overflowY: 'auto' }}>
            {filteredCategorizedClients.toDo.length === 0 ? (
              <div style={{ color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', padding: '2rem' }}>
                No clients in &quot;To Do&quot;
              </div>
            ) : (
              filteredCategorizedClients.toDo.map((item: any) => {
                const client = item.client;
                const clientApp = item.clientApp;
                return (
                  <Link
                    key={client.id}
                    href={`/clients/${client.id}`}
                    style={{
                      display: 'block',
                      padding: '0.75rem',
                      backgroundColor: '#eff6ff',
                      borderRadius: '8px',
                      border: '1px solid #bfdbfe',
                      textDecoration: 'none',
                      color: 'inherit',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#dbeafe';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#eff6ff';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <div style={{ fontWeight: '600', marginBottom: '0.25rem', color: '#1e293b' }}>
                      {client.name} {client.surname || ''}
                    </div>
                    {clientApp && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                        <StatusBadge status={clientApp.status} />
                        {clientApp.started_at && (
                          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                            Started: {new Date(clientApp.started_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    )}
                  </Link>
                );
              })
            )}
          </div>
        </div>

        {/* Column 3: To Be Finished */}
        <div style={{
          backgroundColor: '#fff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          padding: '1.5rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '1rem',
            paddingBottom: '1rem',
            borderBottom: '2px solid #fbbf24'
          }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '600', margin: 0, color: '#f59e0b' }}>
              To Be Finished
            </h2>
            <span style={{
              padding: '0.25rem 0.75rem',
              backgroundColor: '#fef3c7',
              color: '#92400e',
              borderRadius: '12px',
              fontSize: '0.875rem',
              fontWeight: '600'
            }}>
              {filteredCategorizedClients.toBeFinished.length}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '600px', overflowY: 'auto' }}>
            {filteredCategorizedClients.toBeFinished.length === 0 ? (
              <div style={{ color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', padding: '2rem' }}>
                No clients to be finished
              </div>
            ) : (
              filteredCategorizedClients.toBeFinished.map((item: any) => {
                const client = item.client;
                const clientApp = item.clientApp;
                return (
                  <Link
                    key={client.id}
                    href={`/clients/${client.id}`}
                    style={{
                      display: 'block',
                      padding: '0.75rem',
                      backgroundColor: '#fffbeb',
                      borderRadius: '8px',
                      border: '1px solid #fde68a',
                      textDecoration: 'none',
                      color: 'inherit',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#fef3c7';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#fffbeb';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <div style={{ fontWeight: '600', marginBottom: '0.25rem', color: '#1e293b' }}>
                      {client.name} {client.surname || ''}
                    </div>
                    {clientApp && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                        <StatusBadge status={clientApp.status} />
                        {clientApp.started_at && (
                          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                            Started: {new Date(clientApp.started_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    )}
                  </Link>
                );
              })
            )}
          </div>
        </div>

        {/* Column 4: Done */}
        <div style={{
          backgroundColor: '#fff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          padding: '1.5rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '1rem',
            paddingBottom: '1rem',
            borderBottom: '2px solid #10b981'
          }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '600', margin: 0, color: '#059669' }}>
              Done
            </h2>
            <span style={{
              padding: '0.25rem 0.75rem',
              backgroundColor: '#d1fae5',
              color: '#065f46',
              borderRadius: '12px',
              fontSize: '0.875rem',
              fontWeight: '600'
            }}>
              {filteredCategorizedClients.done.length}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '600px', overflowY: 'auto' }}>
            {filteredCategorizedClients.done.length === 0 ? (
              <div style={{ color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', padding: '2rem' }}>
                No clients done
              </div>
            ) : (
              filteredCategorizedClients.done.map((item: any) => {
                const client = item.client;
                const clientApp = item.clientApp;
                return (
                  <Link
                    key={client.id}
                    href={`/clients/${client.id}`}
                    style={{
                      display: 'block',
                      padding: '0.75rem',
                      backgroundColor: '#f0fdf4',
                      borderRadius: '8px',
                      border: '1px solid #bbf7d0',
                      textDecoration: 'none',
                      color: 'inherit',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#d1fae5';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#f0fdf4';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <div style={{ fontWeight: '600', marginBottom: '0.25rem', color: '#1e293b' }}>
                      {client.name} {client.surname || ''}
                    </div>
                    {clientApp && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                        <StatusBadge status={clientApp.status} />
                        {clientApp.completed_at && (
                          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                            Completed: {new Date(clientApp.completed_at).toLocaleDateString()}
                          </span>
                        )}
                        {clientApp.profit_us && (
                          <span style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: '500' }}>
                            €{Number(clientApp.profit_us).toFixed(2)}
                          </span>
                        )}
                      </div>
                    )}
                  </Link>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

