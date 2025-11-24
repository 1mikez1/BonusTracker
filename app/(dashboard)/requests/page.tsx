'use client';

import { useMemo, useState } from 'react';
import { SectionHeader } from '@/components/SectionHeader';
import { DataTable } from '@/components/DataTable';
import { FiltersBar } from '@/components/FiltersBar';
import { useSupabaseData } from '@/lib/useSupabaseData';
import { useSupabaseMutations } from '@/lib/useSupabaseMutations';
import { StatusBadge } from '@/components/StatusBadge';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorMessage } from '@/components/ErrorMessage';
import { EmptyState } from '@/components/EmptyState';
import Link from 'next/link';
import { NewSignupModal } from '@/components/NewSignupModal';
import { Toast } from '@/components/Toast';

export default function RequestsPage() {
  const {
    data: requests,
    isLoading: requestsLoading,
    error: requestsError,
    mutate: mutateRequests,
    isDemo
  } = useSupabaseData({
    table: 'requests',
    order: { column: 'created_at', ascending: false },
    select: '*, clients(*)'
  });
  
  const {
    data: clients,
    isLoading: clientsLoading,
    error: clientsError,
    mutate: mutateClients
  } = useSupabaseData({ table: 'clients' });
  
  const {
    data: apps,
    isLoading: appsLoading,
    error: appsError
  } = useSupabaseData({ table: 'apps' });
  
  const {
    data: clientApps,
    isLoading: clientAppsLoading,
    error: clientAppsError,
    mutate: mutateClientApps
  } = useSupabaseData({ table: 'client_apps' });
  
  const {
    data: tiers,
    isLoading: tiersLoading,
    error: tiersError
  } = useSupabaseData({ table: 'tiers' });
  
  const { mutate: updateRequest } = useSupabaseMutations('requests');
  const { insert: insertClient } = useSupabaseMutations('clients');
  const { insert: insertClientApp } = useSupabaseMutations('client_apps');

  const isLoading = requestsLoading || clientsLoading || appsLoading || clientAppsLoading || tiersLoading;
  const error = requestsError || clientsError || appsError || clientAppsError || tiersError;

  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showAddClientForm, setShowAddClientForm] = useState(false);
  const [showNewSignupModal, setShowNewSignupModal] = useState(false);
  const [convertRequestId, setConvertRequestId] = useState<string | null>(null);
  const [convertRequestData, setConvertRequestData] = useState<any>(null);
  
  // Toast notification state
  const [toast, setToast] = useState<{
    isOpen: boolean;
    message: string;
    type: 'success' | 'error' | 'info';
  }>({
    isOpen: false,
    message: '',
    type: 'success'
  });
  
  // Add client form fields
  const [newClientName, setNewClientName] = useState('');
  const [newClientSurname, setNewClientSurname] = useState('');
  const [newClientContact, setNewClientContact] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientTrusted, setNewClientTrusted] = useState(false);
  const [newClientTierId, setNewClientTierId] = useState('');
  const [newClientInvitedBy, setNewClientInvitedBy] = useState('');
  const [newClientNotes, setNewClientNotes] = useState('');
  const [isSavingClient, setIsSavingClient] = useState(false);

  const filteredRows = useMemo(() => {
    if (!Array.isArray(requests)) return [];
    return requests.filter((request: any) => {
      if (statusFilter !== 'all' && request.status !== statusFilter) {
        return false;
      }
      if (search) {
        const haystack = `${request.name} ${request.contact ?? ''} ${request.requested_apps_raw ?? ''}`.toLowerCase();
        if (!haystack.includes(search.toLowerCase())) {
          return false;
        }
      }
      return true;
    });
  }, [requests, statusFilter, search]);

  const handleConvertRequest = async (requestId: string) => {
    if (isDemo) {
      alert('Conversion is disabled in demo mode. Connect Supabase to enable this feature.');
      return;
    }

    const request = requests.find((r: any) => r.id === requestId);
    if (!request) return;

    try {
      // Check if client already exists (by name + contact)
      let client = clients.find(
        (c: any) => c.name.toLowerCase() === request.name.toLowerCase() && c.contact === request.contact
      );

      // Create client if doesn't exist
      if (!client) {
        const [name, ...surnameParts] = request.name.split(' ');
        const surname = surnameParts.join(' ') || null;
        client = await insertClient({
          name,
          surname,
          contact: request.contact ?? null,
          email: null,
          trusted: false,
          tier_id: null,
          invited_by_client_id: null,
          notes: `Converted from request ${requestId}`
        });
        await mutateClients();
      }

      // Parse requested apps (simple parsing - can be enhanced)
      const requestedAppsText = request.requested_apps_raw?.toLowerCase() || '';
      const matchedApps = apps.filter((app: any) => requestedAppsText.includes(app.name.toLowerCase()));

      // Create client_apps for each matched app
      for (const app of matchedApps) {
        await insertClientApp({
          client_id: client.id,
          app_id: app.id,
          status: 'requested',
          deposited: false,
          finished: false
        });
      }

      // Update request status
      await updateRequest({ status: 'converted', client_id: client.id, processed_at: new Date().toISOString() }, requestId);
      await mutateRequests();
      await mutateClientApps();

      alert(`Request converted! Created client and ${matchedApps.length} app workflow(s).`);
    } catch (error) {
      console.error('Failed to convert request:', error);
      alert('Failed to convert request. Please try again.');
    }
  };

  const handleUpdateStatus = async (requestId: string, newStatus: string) => {
    if (isDemo) {
      alert('Status updates are disabled in demo mode.');
      return;
    }

    try {
      await updateRequest({ status: newStatus as any }, requestId);
      await mutateRequests();
    } catch (error) {
      console.error('Failed to update status:', error);
      alert('Failed to update status. Please try again.');
    }
  };

  const handleAddClient = async () => {
    if (isDemo) {
      alert('Adding clients is disabled in demo mode. Connect Supabase to enable this feature.');
      return;
    }

    if (!newClientName.trim()) {
      alert('Please enter a client name.');
      return;
    }

    setIsSavingClient(true);
    try {
      const newClient = await insertClient({
        name: newClientName.trim(),
        surname: newClientSurname.trim() || null,
        contact: newClientContact.trim() || null,
        email: newClientEmail.trim() || null,
        trusted: newClientTrusted,
        tier_id: newClientTierId || null,
        invited_by_client_id: newClientInvitedBy || null,
        notes: newClientNotes.trim() || null
      });
      
      await mutateClients();
      
      // Reset form
      setNewClientName('');
      setNewClientSurname('');
      setNewClientContact('');
      setNewClientEmail('');
      setNewClientTrusted(false);
      setNewClientTierId('');
      setNewClientInvitedBy('');
      setNewClientNotes('');
      setShowAddClientForm(false);
      
      const clientFullName = `${newClientName}${newClientSurname ? ' ' + newClientSurname : ''}`;
      setToast({
        isOpen: true,
        message: `Client "${clientFullName}" created successfully!`,
        type: 'success'
      });
    } catch (error) {
      console.error('Failed to create client:', error);
      setToast({
        isOpen: true,
        message: 'Failed to create client. Please try again.',
        type: 'error'
      });
    } finally {
      setIsSavingClient(false);
    }
  };

  const handleCancelAddClient = () => {
    setNewClientName('');
    setNewClientSurname('');
    setNewClientContact('');
    setNewClientEmail('');
    setNewClientTrusted(false);
    setNewClientTierId('');
    setNewClientInvitedBy('');
    setNewClientNotes('');
    setShowAddClientForm(false);
  };

  if (isLoading) {
    return (
      <div>
        <SectionHeader title="Requests" description="Loading requests..." />
        <LoadingSpinner message="Loading requests..." />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <SectionHeader title="Requests" description="Error loading requests" />
        <ErrorMessage
          error={error}
          onRetry={() => {
            mutateRequests();
            mutateClients();
            mutateClientApps();
          }}
        />
      </div>
    );
  }

  return (
    <div>
      <SectionHeader
        title="Requests"
        description="Inbox synced from Google Form submissions ready for conversion into client records."
        actions={
          <button
            onClick={() => {
              setConvertRequestId(null);
              setConvertRequestData(null);
              setShowNewSignupModal(true);
            }}
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
        onClose={() => {
          setShowNewSignupModal(false);
          setConvertRequestId(null);
          setConvertRequestData(null);
        }}
        onSuccess={() => {
          mutateClientApps();
          mutateClients();
          if (convertRequestId) {
            updateRequest({ status: 'converted', processed_at: new Date().toISOString() }, convertRequestId);
            mutateRequests();
          }
          setShowNewSignupModal(false);
          setConvertRequestId(null);
          setConvertRequestData(null);
        }}
        initialAppId={convertRequestData?.appId}
        initialClientId={convertRequestData?.clientId}
        initialRequestId={convertRequestId || undefined}
        initialClientData={convertRequestData ? {
          name: convertRequestData.name,
          contact: convertRequestData.contact,
          email: convertRequestData.email
        } : undefined}
      />
      <FiltersBar>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="all">Any status</option>
          <option value="new">New</option>
          <option value="contacted">Contacted</option>
          <option value="converted">Converted</option>
          <option value="rejected">Rejected</option>
        </select>
        <input placeholder="Search" value={search} onChange={(event) => setSearch(event.target.value)} />
        <button
          onClick={() => setShowAddClientForm(!showAddClientForm)}
          style={{
            padding: '0.5rem 1rem',
            fontSize: '0.875rem',
            background: '#10b981',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: '500',
            marginLeft: 'auto'
          }}
        >
          {showAddClientForm ? 'Cancel' : '+ Add Client Profile'}
        </button>
      </FiltersBar>
      
      {showAddClientForm && (
        <div style={{
          backgroundColor: '#f8fafc',
          padding: '1.5rem',
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
          marginBottom: '1.5rem',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1rem', color: '#1e293b' }}>
            Add New Client Profile
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>
                Name *
              </label>
              <input
                type="text"
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.875rem' }}
                disabled={isSavingClient}
                placeholder="First name"
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>
                Surname
              </label>
              <input
                type="text"
                value={newClientSurname}
                onChange={(e) => setNewClientSurname(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.875rem' }}
                disabled={isSavingClient}
                placeholder="Last name"
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>
                Contact
              </label>
              <input
                type="text"
                value={newClientContact}
                onChange={(e) => setNewClientContact(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.875rem' }}
                disabled={isSavingClient}
                placeholder="Phone/Telegram/WhatsApp"
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>
                Email
              </label>
              <input
                type="email"
                value={newClientEmail}
                onChange={(e) => setNewClientEmail(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.875rem' }}
                disabled={isSavingClient}
                placeholder="email@example.com"
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>
                Tier
              </label>
              <select
                value={newClientTierId}
                onChange={(e) => setNewClientTierId(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.875rem' }}
                disabled={isSavingClient}
              >
                <option value="">Select tier</option>
                {Array.isArray(tiers) && tiers.map((tier: any) => (
                  <option key={tier.id} value={tier.id}>{tier.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>
                Invited By
              </label>
              <select
                value={newClientInvitedBy}
                onChange={(e) => setNewClientInvitedBy(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.875rem' }}
                disabled={isSavingClient}
              >
                <option value="">Select client</option>
                {Array.isArray(clients) && clients.map((client: any) => (
                  <option key={client.id} value={client.id}>
                    {client.name}{client.surname ? ` ${client.surname}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>
                Notes
              </label>
              <textarea
                value={newClientNotes}
                onChange={(e) => setNewClientNotes(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.875rem', minHeight: '80px', resize: 'vertical' }}
                disabled={isSavingClient}
                placeholder="Internal notes about this client"
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="checkbox"
                id="newClientTrusted"
                checked={newClientTrusted}
                onChange={(e) => setNewClientTrusted(e.target.checked)}
                disabled={isSavingClient}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <label htmlFor="newClientTrusted" style={{ fontSize: '0.875rem', cursor: 'pointer' }}>
                Trusted client
              </label>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
            <button
              onClick={handleCancelAddClient}
              disabled={isSavingClient}
              style={{
                padding: '0.5rem 1rem',
                fontSize: '0.875rem',
                background: 'white',
                color: '#64748b',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                cursor: isSavingClient ? 'not-allowed' : 'pointer',
                fontWeight: '500'
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleAddClient}
              disabled={isSavingClient || !newClientName.trim()}
              style={{
                padding: '0.5rem 1rem',
                fontSize: '0.875rem',
                background: isSavingClient || !newClientName.trim() ? '#94a3b8' : '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: isSavingClient || !newClientName.trim() ? 'not-allowed' : 'pointer',
                fontWeight: '500'
              }}
            >
              {isSavingClient ? 'Creating...' : 'Create Client'}
            </button>
          </div>
        </div>
      )}
      {!Array.isArray(requests) || filteredRows.length === 0 ? (
        <EmptyState
          title="No requests found"
          message={
            statusFilter !== 'all' || search
              ? 'No requests match your current filters.'
              : 'No requests have been received yet.'
          }
        />
      ) : (
        <DataTable
          data={Array.isArray(filteredRows) ? filteredRows : []}
        columns={[
          {
            key: 'name',
            header: 'Requester',
            render: (row: any) => {
              let client = null;
              let displayName = '';
              
              // If request is linked to a client, use that client
              if (row.client_id) {
                client = row.clients || (Array.isArray(clients) ? clients.find((c: any) => c.id === row.client_id) : null);
                if (client) {
                  displayName = client.name + (client.surname ? ` ${client.surname}` : '');
                }
              } else {
                // For new requests, try to find existing client by name and contact
                if (Array.isArray(clients) && row.name && row.contact) {
                  client = clients.find((c: any) => {
                    const clientNameMatch = c.name.toLowerCase() === row.name.toLowerCase();
                    const clientContactMatch = c.contact === row.contact;
                    return clientNameMatch && clientContactMatch;
                  });
                  
                  // If not found by exact match, try partial name match
                  if (!client && row.name) {
                    const requestNameParts = row.name.toLowerCase().split(' ');
                    client = clients.find((c: any) => {
                      const clientNameLower = c.name.toLowerCase();
                      const matchesFirstName = requestNameParts[0] === clientNameLower || clientNameLower.includes(requestNameParts[0]);
                      const clientContactMatch = c.contact === row.contact;
                      return matchesFirstName && clientContactMatch;
                    });
                  }
                  
                  if (client) {
                    displayName = client.name + (client.surname ? ` ${client.surname}` : '');
                  }
                }
              }
              
              // If client found, show full name and make it clickable
              if (client && displayName) {
                return (
                  <Link 
                    href={`/clients/${client.id}`}
                    style={{ color: '#2563eb', textDecoration: 'none', fontWeight: '500' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {displayName}
                  </Link>
                );
              }
              
              // If not linked and no matching client found, show the full name from request
              // The request name might already include surname if it was parsed from the form
              // Try to format it nicely: if it has multiple words, show them all
              const requestName = row.name || '—';
              return <span style={{ color: '#1e293b' }}>{requestName}</span>;
            }
          },
          { key: 'contact', header: 'Contact', render: (row) => row.contact ?? '—' },
          { key: 'requested_apps_raw', header: 'Requested apps', render: (row) => row.requested_apps_raw ?? '—' },
          {
            key: 'status',
            header: 'Status',
            render: (row) => <StatusBadge status={row.status} />
          },
          {
            key: 'created_at',
            header: 'Received',
            render: (row) => new Date(row.created_at).toLocaleString()
          },
          {
            key: 'actions',
            header: 'Actions',
            render: (row) => (
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {row.status === 'new' && (
                  <button
                    onClick={() => {
                      const request = requests.find((r: any) => r.id === row.id);
                      if (request) {
                        // Try to find matching app from requested_apps_raw
                        const requestedAppsText = (request.requested_apps_raw || '').toLowerCase();
                        const matchedApp = apps.find((app: any) => requestedAppsText.includes(app.name.toLowerCase()));
                        
                        setConvertRequestId(row.id);
                        setConvertRequestData({
                          name: request.name,
                          contact: request.contact,
                          email: request.contact || '',
                          appId: matchedApp?.id,
                          clientId: request.client_id
                        });
                        setShowNewSignupModal(true);
                      }
                    }}
                    style={{
                      padding: '0.35rem 0.75rem',
                      fontSize: '0.85rem',
                      background: '#2563eb',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    Convert to Signup
                  </button>
                )}
                {row.status !== 'converted' && row.status !== 'rejected' && (
                  <select
                    value={row.status}
                    onChange={(e) => handleUpdateStatus(row.id, e.target.value)}
                    style={{
                      padding: '0.35rem 0.75rem',
                      fontSize: '0.85rem',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="new">New</option>
                    <option value="contacted">Contacted</option>
                    <option value="converted">Converted</option>
                    <option value="rejected">Rejected</option>
                  </select>
                )}
              </div>
            )
          }
        ]}
        />
      )}
      
      <Toast
        isOpen={toast.isOpen}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ isOpen: false, message: '', type: 'success' })}
        duration={3000}
      />
    </div>
  );
}
